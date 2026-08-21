import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      page = 1,
      pageSize = 20,
      srhWord = '',
      url = 'company'
    } = body;

    // Determine category from url or category parameter
    let category = 'company';
    if (url.includes('industry')) category = 'industry';
    else if (url.includes('market')) category = 'market';
    else if (url.includes('invest')) category = 'invest';
    else if (url.includes('economy')) category = 'economy';
    else if (url.includes('debenture')) category = 'debenture';
    else if (['company', 'industry', 'market', 'invest', 'economy', 'debenture'].includes(url)) {
      category = url;
    }

    const apiUrl = `https://m.stock.naver.com/api/research/${category}?page=${page}&pageSize=${pageSize}`;

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      },
    });

    if (!response.ok) {
      throw new Error(`Naver Research API error: ${response.status}`);
    }

    const rawData = await response.json();
    if (!Array.isArray(rawData)) {
      return NextResponse.json([]);
    }

    // Filter by srhWord if provided
    let filteredData = rawData;
    if (srhWord && srhWord.trim()) {
      const trimmedQuery = srhWord.trim();
      let matchedStockCode = '';
      let matchedStockName = '';

      try {
        const acRes = await fetch(`https://ac.stock.naver.com/ac?q=${encodeURIComponent(trimmedQuery)}&target=stock`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
          },
        });

        if (acRes.ok) {
          const acData = await acRes.json();
          const matchedStock = acData?.items?.[0];
          if (matchedStock && matchedStock.code) {
            matchedStockCode = matchedStock.code;
            matchedStockName = matchedStock.name || trimmedQuery;
          }
        }
      } catch (err) {
        console.error('Stock autocomplete error:', err);
      }

      // 1. Scan company research API pages corresponding to requested pagination (up to 15 pages per page chunk)
      let matchedRawItems: any[] = [];
      const scanStart = (page - 1) * 15 + 1;
      const scanEnd = scanStart + 14;

      for (let p = scanStart; p <= scanEnd; p++) {
        try {
          const scanRes = await fetch(`https://m.stock.naver.com/api/research/company?page=${p}&pageSize=20`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            },
          });
          if (!scanRes.ok) break;
          const scanList = await scanRes.json();
          if (!Array.isArray(scanList) || scanList.length === 0) break;

          const keyword = trimmedQuery.toLowerCase();
          const hits = scanList.filter((item: any) => {
            if (matchedStockCode && item.itemCode === matchedStockCode) return true;
            if (matchedStockName && item.itemName && item.itemName.toLowerCase() === matchedStockName.toLowerCase()) return true;
            return (item.title && item.title.toLowerCase().includes(keyword)) ||
                   (item.brokerName && item.brokerName.toLowerCase().includes(keyword)) ||
                   (item.itemName && item.itemName.toLowerCase().includes(keyword));
          });

          matchedRawItems.push(...hits);
        } catch (e) {
          break;
        }
      }

      // 2. For page 1, if stock code matched, also fetch embedded stock integration researches
      if (page === 1 && matchedStockCode) {
        try {
          const stockResearchRes = await fetch(`https://m.stock.naver.com/domestic/stock/${matchedStockCode}/research`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            },
          });

          if (stockResearchRes.ok) {
            const html = await stockResearchRes.text();
            const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);

            if (nextDataMatch) {
              const json = JSON.parse(nextDataMatch[1]);
              const queries = json.props?.pageProps?.dehydratedState?.queries || [];
              let foundResearches: any[] = [];

              for (const q of queries) {
                const rList = q.state?.data?.result?.researches;
                if (Array.isArray(rList) && rList.length > 0) {
                  foundResearches = rList;
                  break;
                }
              }

              if (foundResearches.length > 0) {
                const existingIds = new Set(matchedRawItems.map((i: any) => String(i.researchId || i.id)));
                for (const r of foundResearches) {
                  const rId = String(r.id);
                  if (!existingIds.has(rId)) {
                    matchedRawItems.push({
                      researchId: rId,
                      id: rId,
                      researchCategory: '종목분석',
                      category: '종목분석',
                      itemCode: matchedStockCode,
                      itemName: r.nm || matchedStockName,
                      brokerName: r.bnm || '',
                      title: r.tit || '',
                      writeDate: r.wdt ? `${r.wdt.slice(0,4)}.${r.wdt.slice(4,6)}.${r.wdt.slice(6,8)}` : '',
                      endUrl: `https://m.stock.naver.com/investment/research/company/${rId}`
                    });
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error('Embedded stock research fetch error:', e);
        }
      }

      // Sort matched items chronologically by writeDate / id descending
      matchedRawItems.sort((a: any, b: any) => {
        const dateA = String(a.writeDate || a.wdt || '').replace(/[^0-9]/g, '');
        const dateB = String(b.writeDate || b.wdt || '').replace(/[^0-9]/g, '');
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return Number(b.researchId || b.id || 0) - Number(a.researchId || a.id || 0);
      });

      filteredData = matchedRawItems;
    }

    const reports = await Promise.all(filteredData.map(async (item: any) => {
      let pdfUrl = '';
      let fileSize = 'PDF';

      try {
        const detailRes = await fetch(`https://m.stock.naver.com/api/research/${category}/${item.researchId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
          },
        });
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          pdfUrl = detailData?.researchContent?.attachUrl || '';
        }
      } catch (e) {
        // ignore detail fetch error
      }

      if (pdfUrl) {
        try {
          const headRes = await fetch(pdfUrl, {
            method: 'HEAD',
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            },
          });
          const len = headRes.headers.get('content-length');
          if (len) {
            const s = parseInt(len, 10);
            if (s > 1024 * 1024) fileSize = (s / (1024 * 1024)).toFixed(1) + 'MB';
            else if (s > 0) fileSize = (s / 1024).toFixed(0) + 'KB';
          }
        } catch (e) {
          // ignore size check error
        }
      }

      const naverUrl = item.endUrl || `https://m.stock.naver.com/investment/research/${category}/${item.researchId}`;
      return {
        id: String(item.researchId),
        researchId: String(item.researchId),
        category: category,
        categoryName: item.category || item.researchCategory || '',
        itemCode: item.itemCode || '',
        itemName: item.itemName || '',
        index: String(item.researchId),
        date: item.writeDate || '',
        title: item.title || '',
        author: item.brokerName || '',
        institution: item.brokerName || '',
        fileId: String(item.researchId),
        fileNum: category,
        hasFile: !!pdfUrl,
        fileSize: fileSize,
        pdfUrl: pdfUrl,
        naverUrl: naverUrl,
        url: pdfUrl || naverUrl
      };
    }));

    return NextResponse.json(reports);
  } catch (error: any) {
    console.error('Report fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

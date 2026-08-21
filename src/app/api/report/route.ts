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
          }
        }
      } catch (err) {
        console.error('Stock autocomplete error:', err);
      }

      // If matched a specific stock code, query Naver Stock Research API for that stock directly
      if (matchedStockCode) {
        try {
          const stockApiUrl = `https://m.stock.naver.com/api/research/stock/${matchedStockCode}?page=${page}&pageSize=${pageSize}`;
          const stockRes = await fetch(stockApiUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            },
          });

          if (stockRes.ok) {
            const stockData = await stockRes.json();
            if (Array.isArray(stockData)) {
              filteredData = stockData;
            }
          }
        } catch (e) {
          console.error('Stock research API error:', e);
        }
      } else {
        // Fallback to keyword filtering on category data
        const keyword = trimmedQuery.toLowerCase();
        filteredData = rawData.filter((item: any) =>
          (item.title && item.title.toLowerCase().includes(keyword)) ||
          (item.brokerName && item.brokerName.toLowerCase().includes(keyword)) ||
          (item.itemName && item.itemName.toLowerCase().includes(keyword))
        );
      }
    }

    const reports = await Promise.all(filteredData.map(async (item: any) => {
      let pdfUrl = '';
      let fileSize = 'PDF';

      const itemCat = category;
      try {
        const detailRes = await fetch(`https://m.stock.naver.com/api/research/${itemCat}/${item.researchId}`, {
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
        // 1. Attempt HEAD request
        try {
          const headRes = await fetch(pdfUrl, {
            method: 'HEAD',
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            },
            signal: AbortSignal.timeout(3000)
          });
          const len = headRes.headers.get('content-length');
          if (len && parseInt(len, 10) > 0) {
            const s = parseInt(len, 10);
            fileSize = s > 1024 * 1024 ? (s / (1024 * 1024)).toFixed(1) + 'MB' : (s / 1024).toFixed(0) + 'KB';
          }
        } catch (e) {
          // ignore head error
        }

        // 2. Fallback to Range GET if HEAD didn't yield a size
        if (fileSize === 'PDF') {
          try {
            const rangeRes = await fetch(pdfUrl, {
              method: 'GET',
              headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                'Range': 'bytes=0-10'
              },
              signal: AbortSignal.timeout(3000)
            });
            const contentRange = rangeRes.headers.get('content-range');
            const totalLen = contentRange ? contentRange.split('/')[1] : rangeRes.headers.get('content-length');
            if (totalLen && parseInt(totalLen, 10) > 0) {
              const s = parseInt(totalLen, 10);
              fileSize = s > 1024 * 1024 ? (s / (1024 * 1024)).toFixed(1) + 'MB' : (s / 1024).toFixed(0) + 'KB';
            }
          } catch (e) {
            // ignore range error
          }
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

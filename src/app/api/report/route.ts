import { NextRequest, NextResponse } from 'next/server';
import iconv from 'iconv-lite';

export const dynamic = 'force-dynamic';

const tabCache: Record<string, { selMnuT: string; selMnuB: string; timestamp: number }> = {};
const CACHE_TTL = 3600 * 1000; // 1 hour

async function getTabParams(url: string) {
    if (tabCache[url] && Date.now() - tabCache[url].timestamp < CACHE_TTL) {
        return tabCache[url];
    }

    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            }
        });
        const buffer = await res.arrayBuffer();
        const html = iconv.decode(Buffer.from(buffer), 'euc-kr');

        const mnuTMatch = /id="selMnuT" value="([^"]*)"/.exec(html);
        const mnuBMatch = /id="selMnuB" value="([^"]*)"/.exec(html);

        const params = {
            selMnuT: mnuTMatch?.[1] || '1^1^1^1^1^1^1^0^0^0^0',
            selMnuB: mnuBMatch?.[1] || '1^1^1^1^1',
            timestamp: Date.now()
        };
        tabCache[url] = params;
        return params;
    } catch (e) {
        return {
            selMnuT: '1^1^1^1^1^1^1^0^0^0^0',
            selMnuB: '1^1^1^1^1',
            timestamp: 0
        };
    }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      lstNumO = '0',
      actNum = '0',
      srhDate = '',
      srhItem = 'nIdSjt',
      srhWord = '',
      url = 'https://www.bondweb.co.kr/MOA/Board/ResearchCenterV2/PrimeSub04.asp?SubDiv=Sub400'
    } = body;

    const isAllReport = url.includes('SubDiv=Sub100');
    const ajaxUrl = isAllReport
        ? 'https://www.bondweb.co.kr/MOA/Board/ResearchCenterV2/AjaxPrimeListSub.asp'
        : 'https://www.bondweb.co.kr/MOA/Board/ResearchCenterV2/AjaxPrimeListHotClickSub.asp';

    const { selMnuT, selMnuB } = await getTabParams(url);

    const mnuMatch = /SubDiv=Sub(\d+)/.exec(url);
    const nwMnu = mnuMatch ? mnuMatch[1].substring(0, 2) : '04';

    // IMPORTANT: Bondweb uses EUC-KR encoding for search words.
    // URLSearchParams automatically encodes in UTF-8, so we must manually construct the body.
    const encodeEucKr = (val: string) => {
        if (!val) return '';
        const buffer = iconv.encode(val, 'euc-kr');
        // Correctly pad hex values with leading zeros
        return Array.from(buffer).map(b => '%' + b.toString(16).padStart(2, '0').toUpperCase()).join('');
    };

    // If search word is provided and no date, we use empty string to let Bondweb handle it
    // Note: Bondweb Ajax API seems to only support single date (YYYYMMDD) or empty for latest.
    const finalSrhDate = srhDate;

    const bodyParts = [
        `selMnuT=${encodeURIComponent(selMnuT)}`,
        `selMnuB=${encodeURIComponent(selMnuB)}`,
        `lstNumN=0`,
        `lstNumO=${lstNumO}`,
        `actNum=${actNum}`,
        `srhDate=${finalSrhDate}`,
        `srhItem=${srhItem}`,
        `srhWord=${encodeEucKr(srhWord)}`,
        `BoardLink=`,
        `NWMnu=${nwMnu}`,
        `DATA_CYCLE=`
    ];

    if (!isAllReport && !srhWord) {
        bodyParts.push('HotClick=1');
        bodyParts.push('HotClickSearchDate=0');
    } else if (isAllReport) {
        bodyParts.push('HcCnt=5');
    }

    if (process.env.NODE_ENV === 'development') {
        console.log('Bondweb Search Request:', {
            ajaxUrl,
            body: bodyParts.join('&'),
            srhWord
        });
    }

    const response = await fetch(ajaxUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: bodyParts.join('&'),
    });

    const buffer = await response.arrayBuffer();
    const html = iconv.decode(Buffer.from(buffer), 'euc-kr');

    const rawReports: any[] = [];
    const trRegex = /<tr id="nTr_(\d+)">([\s\S]*?)<\/tr>/g;
    let match;

    while ((match = trRegex.exec(html)) !== null) {
      const id = match[1];
      const content = match[2];

      const dateMatch = /name="nIdDte">([\s\S]*?)<\/div>/;
      const titleMatch = /shwCttFrame\('[^']*',(\d+),'([^']*)',event\);">(.*?)<\/a>/;
      const authorMatch = /fnMenuSearch\('nIdWrt','([^']*)'\);/;
      const institutionMatch = /fnMenuSearch\('nIdSrc','([^']*)'\);/;
      const fileMatch = /getFileDown\((\d+), (\d+)\)/;
      const fileDownMatch = /getFileDown_\('(\d+)', (\d+)\)/;
      const scrapMatch = /winScrapPop\('([^']*)'\)/;
      const indexMatch = /name="nTr"[^>]*value="(\d+)"/;

      const date = content.match(dateMatch)?.[1]?.trim() || '';
      const titleInfo = content.match(titleMatch);
      const title = titleInfo?.[3]?.trim() || '';
      const author = content.match(authorMatch)?.[1] || '';
      const institution = content.match(institutionMatch)?.[1] || '';

      const fileInfo = content.match(fileMatch) || content.match(fileDownMatch);
      const isAltFile = content.includes('getFileDown_');
      const scrapInfo = content.match(scrapMatch);

      rawReports.push({
        id,
        index: content.match(indexMatch)?.[1] || id,
        date,
        title,
        author,
        institution,
        fileId: fileInfo?.[1],
        fileNum: fileInfo?.[2],
        isAltFile,
        hasFile: !!fileInfo,
        scrapPath: scrapInfo?.[1]
      });
    }

    const reports = await Promise.all(rawReports.map(async (report) => {
      let fileSize = '';
      if (report.hasFile) {
          const endpoints = [
              'https://www.bondweb.co.kr/MOA/Board/ResearchCenterV2/DownloadPage.asp',
              'https://www.bondweb.co.kr/prime_web/menu01/research/DownloadPage.asp'
          ];

          // Reorder if isAltFile is true
          if (report.isAltFile) endpoints.reverse();

          for (const downloadUrl of endpoints) {
              try {
                  const downloadRes = await fetch(downloadUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    },
                    body: `number=${report.fileId}&gn=${report.fileNum}`,
                    redirect: 'manual',
                    signal: AbortSignal.timeout(4000)
                  });

                  let fileLocation = '';
                  if (downloadRes.status === 302 || downloadRes.status === 301) {
                      fileLocation = downloadRes.headers.get('location') || '';
                  } else {
                      const cd = downloadRes.headers.get('content-disposition');
                      if (cd) {
                          const filenameMatch = cd.match(/filename=([^;]*)/i);
                          if (filenameMatch) {
                              const filename = filenameMatch[1].trim().replace(/['"]/g, '');
                              if (filename.startsWith('/Data/')) {
                                  fileLocation = filename;
                              }
                          }
                      }
                  }

                  if (fileLocation) {
                      const finalUrl = fileLocation.startsWith('http') ? fileLocation : 'https://www.bondweb.co.kr' + fileLocation;

                      const fetchOptions = {
                          headers: {
                              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                          },
                          signal: AbortSignal.timeout(4000)
                      };

                      // Improved size detection: Verify it's actually a PDF and not a 5KB error page
                      const getRes = await fetch(finalUrl, {
                          ...fetchOptions,
                          method: 'GET',
                          headers: { ...fetchOptions.headers, 'Range': 'bytes=0-256' }
                      });

                      if (getRes.status === 206 || getRes.status === 200) {
                          const contentType = getRes.headers.get('content-type') || '';
                          const contentRange = getRes.headers.get('content-range');
                          const contentLength = getRes.headers.get('content-length');

                          const buffer = await getRes.arrayBuffer();
                          const headText = Buffer.from(buffer).toString('utf8', 0, 10);

                          // Only proceed if it looks like a PDF and isn't an HTML error page
                          if (headText.startsWith('%PDF') && !contentType.includes('text/html')) {
                              const size = contentRange?.split('/')?.[1] || contentLength;
                              if (size) {
                                  const s = parseInt(size, 10);
                                  if (s > 10240) { // Ignore anything under 10KB (usually corrupted or error)
                                      if (s > 1024 * 1024) fileSize = (s / (1024 * 1024)).toFixed(1) + 'MB';
                                      else fileSize = (s / 1024).toFixed(0) + 'KB';
                                      break;
                                  }
                              }
                          }
                      }
                  }
              } catch (e) {
                  // try next endpoint
              }
          }
      }
      return { ...report, fileSize };
    }));

    return NextResponse.json(reports);
  } catch (error: any) {
    console.error('Report fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

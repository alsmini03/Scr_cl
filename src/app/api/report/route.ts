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

    const ajaxUrl = 'https://www.bondweb.co.kr/MOA/Board/ResearchCenterV2/AjaxPrimeListHotClickSub.asp';
    const { selMnuT, selMnuB } = await getTabParams(url);

    const params = new URLSearchParams();
    params.append('selMnuT', selMnuT);
    params.append('selMnuB', selMnuB);
    params.append('lstNumN', '0');
    params.append('lstNumO', lstNumO);
    params.append('actNum', actNum);
    params.append('srhDate', srhDate);
    params.append('srhItem', srhItem);
    params.append('srhWord', srhWord);
    params.append('BoardLink', '');
    params.append('NWMnu', '04');
    params.append('HotClick', '1');
    params.append('HotClickSearchDate', '0');
    params.append('DATA_CYCLE', '');

    const response = await fetch(ajaxUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: params.toString(),
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
      const indexMatch = /name="nTr"[^>]*value="(\d+)"/;

      const date = content.match(dateMatch)?.[1]?.trim() || '';
      const titleInfo = content.match(titleMatch);
      const title = titleInfo?.[3]?.trim() || '';
      const author = content.match(authorMatch)?.[1] || '';
      const institution = content.match(institutionMatch)?.[1] || '';

      const fileInfo = content.match(fileMatch) || content.match(fileDownMatch);
      const isAltFile = content.includes('getFileDown_');

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
      });
    }

    const reports = await Promise.all(rawReports.map(async (report) => {
      let fileSize = '';
      if (report.hasFile) {
          try {
              const downloadUrl = report.isAltFile
                ? 'https://www.bondweb.co.kr/prime_web/menu01/research/DownloadPage.asp'
                : 'https://www.bondweb.co.kr/MOA/Board/ResearchCenterV2/DownloadPage.asp';

              const downloadRes = await fetch(downloadUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0',
                },
                body: `number=${report.fileId}&gn=${report.fileNum}`,
                redirect: 'manual',
                signal: AbortSignal.timeout(5000)
              });

              const cd = downloadRes.headers.get('content-disposition');
              if (cd && cd.includes('filename=')) {
                  const filename = cd.split('filename=')[1].trim();
                  if (filename.startsWith('/Data/')) {
                      const headRes = await fetch('https://www.bondweb.co.kr' + filename, {
                          method: 'HEAD',
                          headers: { 'User-Agent': 'Mozilla/5.0' },
                          signal: AbortSignal.timeout(3000)
                      });
                      const size = headRes.headers.get('content-length');
                      if (size) {
                          const s = parseInt(size, 10);
                          if (s > 1024 * 1024) fileSize = (s / (1024 * 1024)).toFixed(1) + 'MB';
                          else fileSize = (s / 1024).toFixed(0) + 'KB';
                      }
                  }
              }
          } catch (e) {
              // ignore
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

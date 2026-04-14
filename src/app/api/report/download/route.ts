import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const number = searchParams.get('number');
    const gn = searchParams.get('gn');
    const url = searchParams.get('url');
    const title = searchParams.get('title') || 'report';

    if (!number && !gn && !url) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    try {
        let response;
        if (url) {
            response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                }
            });
            if (!response.ok) throw new Error('Failed to fetch from URL');
        } else {
            response = await fetchDownload(number!, gn!);
        }
        const blob = await response.blob();

        const headers = new Headers();
        const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_');
        const encodedFilename = encodeURIComponent(`${safeTitle}.pdf`);
        headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
        headers.set('Content-Type', 'application/pdf');

        return new NextResponse(blob, { headers });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
  try {
    const { number, gn, title } = await req.json();
    const response = await fetchDownload(number, gn);
    const blob = await response.blob();

    const headers = new Headers();
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_');
    const encodedFilename = encodeURIComponent(`${safeTitle}.pdf`);
    headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
    headers.set('Content-Type', 'application/pdf');

    return new NextResponse(blob, { headers });
  } catch (error: any) {
    console.error('Download error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function fetchDownload(number: string, gn: string) {
    const endpoints = [
        'https://www.bondweb.co.kr/MOA/Board/ResearchCenterV2/DownloadPage.asp',
        'https://www.bondweb.co.kr/prime_web/menu01/research/DownloadPage.asp'
    ];

    for (const url of endpoints) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
                body: `number=${number}&gn=${gn}`,
                redirect: 'manual'
            });

            let fileUrl = '';
            if (res.status === 302 || res.status === 301) {
                fileUrl = res.headers.get('location') || '';
            } else {
                const cd = res.headers.get('content-disposition');
                if (cd && cd.includes('filename=')) {
                    const match = cd.match(/filename=([^;]*)/i);
                    if (match) fileUrl = match[1].trim().replace(/['"]/g, '');
                }
            }

            if (fileUrl) {
                const absoluteUrl = fileUrl.startsWith('http') ? fileUrl : 'https://www.bondweb.co.kr' + (fileUrl.startsWith('/') ? '' : '/') + fileUrl;
                const finalResponse = await fetch(absoluteUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    }
                });
                if (finalResponse.ok) return finalResponse;
            } else if (res.ok) {
                return res;
            }
        } catch (e) {
            // continue
        }
    }
    throw new Error('Download failed from all endpoints');
}

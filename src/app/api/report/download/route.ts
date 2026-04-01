import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { number, gn, title } = await req.json();

    const endpoints = [
      'https://www.bondweb.co.kr/MOA/Board/ResearchCenterV2/DownloadPage.asp',
      'https://www.bondweb.co.kr/prime_web/menu01/research/DownloadPage.asp'
    ];

    let lastError = null;
    let finalResponse = null;

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
                finalResponse = await fetch(absoluteUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    }
                });
                if (finalResponse.ok) break;
            } else if (res.ok) {
                // If it didn't redirect but returned content directly (unlikely for these endpoints but safe to handle)
                finalResponse = res;
                break;
            }
        } catch (e) {
            lastError = e;
        }
    }

    if (!finalResponse || !finalResponse.ok) throw new Error('Download failed from all endpoints');
    const response = finalResponse;

    const blob = await response.blob();
    const headers = new Headers();

    // Original disposition might contain useful info but we prioritize user's requested title
    const contentDisposition = response.headers.get('content-disposition');
    let ext = 'pdf';
    if (contentDisposition && contentDisposition.includes('.')) {
        const parts = contentDisposition.split('.');
        const lastPart = parts[parts.length - 1];
        ext = lastPart.split('"')[0].trim() || 'pdf';
    }

    // Clean up filename: remove characters that might cause issues in headers
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_');

    // Next.js response headers need to be careful with non-ascii filenames
    // Content-Disposition: attachment; filename*=UTF-8''... is the modern way
    const encodedFilename = encodeURIComponent(`${safeTitle}.${ext}`);
    headers.set('Content-Disposition', `attachment; filename* = UTF-8''${encodedFilename}`);
    headers.set('Content-Type', response.headers.get('Content-Type') || 'application/pdf');

    return new NextResponse(blob, { headers });
  } catch (error: any) {
    console.error('Download error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

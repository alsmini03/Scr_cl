import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pdfUrl = searchParams.get('url');
  const filename = searchParams.get('filename') || 'report.pdf';

  if (!pdfUrl) {
    return NextResponse.json({ error: 'PDF URL is required' }, { status: 400 });
  }

  try {
    const res = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to download PDF (${res.status})` }, { status: res.status });
    }

    const arrayBuffer = await res.arrayBuffer();
    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    const encodedFilename = encodeURIComponent(filename);
    headers.set('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);

    return new NextResponse(arrayBuffer, { headers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import iconv from 'iconv-lite';

export async function POST(req: NextRequest) {
  try {
    const { num, code = '01' } = await req.json();

    if (!num) {
      return NextResponse.json({ error: 'Report number is required' }, { status: 400 });
    }

    const response = await fetch('https://www.bondweb.co.kr/MOA/Board/ResearchCenterV2/AjaxPrimeContent.asp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: `nIdNum=${num}&nIdCod=${code}`,
    });

    const buffer = await response.arrayBuffer();
    const html = iconv.decode(Buffer.from(buffer), 'euc-kr');

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error: any) {
    console.error('Report content fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

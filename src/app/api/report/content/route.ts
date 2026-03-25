import { NextRequest, NextResponse } from 'next/server';
import iconv from 'iconv-lite';

export async function POST(req: NextRequest) {
  try {
    const { num, code } = await req.json();

    const params = new URLSearchParams();
    params.append('selUrl', 'FrameContent.asp');
    params.append('selNum', num);
    params.append('selCode', code || '01');
    params.append('tTime', Date.now().toString());
    params.append('NWMnu', '04');
    params.append('SetSelMntTName', '리서치센터^');

    const response = await fetch('https://www.bondweb.co.kr/MOA/Board/ResearchCenterV2/FrameContent.asp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: params.toString(),
    });

    const buffer = await response.arrayBuffer();
    const html = iconv.decode(Buffer.from(buffer), 'euc-kr');

    // Extract the content within <div class="pop_cnts">
    let content = html;
    const startIdx = html.indexOf('<div class=\"pop_cnts\"');
    const endIdx = html.lastIndexOf('</div>');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        content = html.substring(startIdx, endIdx + 6);
    }

    // Remove scripts and unnecessary elements that might break UI
    content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    content = content.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    content = content.replace(/onclick="[^"]*"/gi, '');

    // Fix image URLs if any
    content = content.replace(/src=\"\//gi, 'src=\"https://www.bondweb.co.kr/');

    return new NextResponse(content, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (error: any) {
    console.error('Content fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

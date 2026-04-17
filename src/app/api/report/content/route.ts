import { NextRequest, NextResponse } from 'next/server';
import iconv from 'iconv-lite';

export async function POST(req: NextRequest) {
  try {
    const { num, code = '01', nwMnu = '04' } = await req.json();

    if (!num) {
      return NextResponse.json({ error: 'Report number is required' }, { status: 400 });
    }

    // Updated endpoint as AjaxPrimeContent.asp is currently returning 404
    const url = 'https://www.bondweb.co.kr/MOA/Board/ResearchCenterV2/FrameContent.asp';
    const params = new URLSearchParams({
      selUrl: 'FrameContent.asp',
      selNum: num,
      selCode: code,
      NWMnu: nwMnu,
      SetSelMntTName: ''
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Bondweb returned status ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const fullHtml = iconv.decode(Buffer.from(buffer), 'euc-kr');

    // Extract the relevant content body
    let finalHtml = '';

    // Look for the main content area
    const contentMatch = fullHtml.match(/<div class="bod_view">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/body>/);
    const simpleMatch = fullHtml.match(/<div class="bod_view">([\s\S]*?)<\/div>/);

    if (simpleMatch) {
      finalHtml = `<div class="bod_view">${simpleMatch[1]}</div>`;
    } else {
        const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
            finalHtml = bodyMatch[1];
        } else {
            finalHtml = fullHtml;
        }
    }

    // Additional cleanup for internal links/buttons that won't work in our UI
    finalHtml = finalHtml.replace(/<p class="right_btn">([\s\S]*?)<\/p>/g, '');
    finalHtml = finalHtml.replace(/href="javascript:[^"]*"/g, 'href="#"');
    finalHtml = finalHtml.replace(/onClick="[^"]*"/g, '');

    return new NextResponse(finalHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error: any) {
    console.error('Report content fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

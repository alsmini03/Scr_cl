import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET() {
  try {
    const response = await fetch('https://m.yes24.com/home/best?dispNo=001&tab=4', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Yes24 Best');
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const books: any[] = [];

    // Yes24 Mobile Best List items are usually in .bestList or similar
    // Based on common Yes24 mobile patterns:
    $('li').each((i, el) => {
      const $el = $(el);

      const title = $el.find('.goods_name').text().trim();
      if (!title) return;

      const coverImage = $el.find('.img_canvas img').attr('data-original') || $el.find('.img_canvas img').attr('src');

      // Author and Publisher are often in .goods_pubGrp or .goods_auth
      const author = $el.find('.goods_auth').text().trim();
      const publisher = $el.find('.goods_pub').text().trim();

      const link = $el.find('a.lnk_goods').attr('href');
      const yes24Url = link ? `https://m.yes24.com${link}` : '';

      books.push({
        title,
        author,
        publisher,
        coverImage,
        yes24Url,
      });
    });

    return NextResponse.json(books.slice(0, 20));
  } catch (error) {
    console.error('Best scraping error:', error);
    return NextResponse.json({ error: 'Failed to load best sellers' }, { status: 500 });
  }
}

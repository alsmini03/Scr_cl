import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || 'total';

  let targetUrl = 'https://m.yes24.com/home/best?dispNo=001&tab=1&pageNo=1&pageSize=100';
  if (category === 'economy') {
    targetUrl = 'https://m.yes24.com/home/best?dispNo=001001025&tab=1&pageNo=1&pageSize=100';
  } else if (category === 'essay') {
    targetUrl = 'https://m.yes24.com/home/best?dispNo=001001047&tab=1&pageNo=1&pageSize=100';
  }

  try {
    const response = await fetch(targetUrl, {
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

    // Yes24 Mobile Best List items are in .itemUnit
    $('.itemUnit').each((i, el) => {
      const $el = $(el);

      // Extract title: remove the [도서] prefix if present
      let title = $el.find('.info_name').text().trim();
      title = title.replace('[도서]', '').trim();
      if (!title) return;

      const coverImage = $el.find('img.lazy').attr('data-original') || $el.find('img').attr('src');

      const author = $el.find('.info_auth .auth').text().trim();
      const publisher = $el.find('.info_pub').text().trim();
      const publishDate = $el.find('.info_date').text().trim();
      const price = $el.find('.info_price .txt_num').text().trim();

      const link = $el.find('a.lnk_item').attr('href');
      const yes24Url = link ? `https://m.yes24.com${link}` : '';

      books.push({
        title,
        author,
        publisher,
        publishDate,
        price,
        coverImage,
        yes24Url,
      });
    });

    return NextResponse.json(books);
  } catch (error) {
    console.error('Best scraping error:', error);
    return NextResponse.json({ error: 'Failed to load best sellers' }, { status: 500 });
  }
}

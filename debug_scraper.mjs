import * as cheerio from 'cheerio';

async function debug() {
    const url = 'https://m.blog.naver.com/intelligent_tiger/224216458984';
    const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1" }
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    console.log('Quotation components count:', $('.se-quotation').length);
    $('.se-quotation').each((i, el) => {
        console.log(`Quote ${i} text:`, $(el).text().trim().substring(0, 50));
    });
}
debug();

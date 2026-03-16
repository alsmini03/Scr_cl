import * as cheerio from 'cheerio';

async function test() {
    const url = "https://goodfortune.tistory.com/m/category/%EC%83%81%EC%8B%9D%EA%B3%BC%20%EC%A7%80%EC%8B%9D%20%EC%82%AC%EC%9D%B4";
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1",
      },
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    // Look for individual post elements and extract title/URL
    // Based on tistory_cat.html we saw earlier, posts are in <li>
    const posts = [];
    $("li").each((_, el) => {
        const $el = $(el);
        const link = $el.find("a").first();
        const href = link.attr("href");
        const title = $el.find(".tit_blog2").text().trim() || $el.find(".tit_post").text().trim();

        if (href && (href.includes("/entry/") || !isNaN(Number(href.split("/").pop())))) {
            posts.push({ title, href });
        }
    });

    console.log("Found posts via direct scrape:", posts.length);
    if (posts.length > 0) console.log("Sample:", posts[0]);
}

test();

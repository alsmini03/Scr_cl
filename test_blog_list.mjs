import * as cheerio from 'cheerio';

async function test() {
    // Try the "Async" listing URL that Naver mobile uses when scrolling
    const url = 'https://m.blog.naver.com/repost/PostListAsync.naver?blogId=totcar&categoryNo=0&currentPage=1';

    console.log(`Testing URL: ${url}`);
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1",
            "Referer": "https://m.blog.naver.com/PostList.naver?blogId=totcar",
            "X-Requested-With": "XMLHttpRequest"
        }
    });

    const text = await res.text();
    const $ = cheerio.load(text);

    console.log("List items (.list_item):", $(".list_item").length);
    if ($(".list_item").length > 0) {
        $(".list_item").each((i, el) => {
            console.log(`Item ${i}: ${$(el).find(".title").text().trim()}`);
        });
    } else {
        console.log("HTML Sample:", text.substring(0, 500));
    }
}

test();

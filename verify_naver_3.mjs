import * as cheerio from 'cheerio';

async function testList() {
    const url = 'https://m.blog.naver.com/PostList.naver?blogId=totcar';
    console.log(`Testing List API logic for: ${url}`);

    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1",
        },
    });

    const html = await response.text();
    // Search directly in raw text for the pattern
    const regex = /window\.__PRELOADED_STATE__\s*=\s*({.*?});/s;
    const match = html.match(regex);

    if (match) {
        console.log("Found match with regex");
        try {
            const state = JSON.parse(match[1]);
            const items = state.postList?.items || state.postList?.postList?.items || state.categoryPostList?.postList?.items || [];
            console.log(`Found ${items.length} items.`);
        } catch (e) {
            console.error("Parse error", e);
        }
    } else {
        console.log("Regex did not match. Text sample around keyword:");
        const idx = html.indexOf("__PRELOADED_STATE__");
        if (idx !== -1) {
            console.log(html.substring(idx - 100, idx + 500));
        } else {
            console.log("Keyword not found at all");
        }
    }
}

testList();

import * as cheerio from 'cheerio';

async function testList(idOrUrl) {
    console.log(`\nTesting List API logic for: ${idOrUrl}`);

    let blogId = idOrUrl;
    if (idOrUrl.startsWith('http')) {
        try {
            const parsedUrl = new URL(idOrUrl);
            blogId = parsedUrl.searchParams.get('blogId') || parsedUrl.pathname.split('/')[1] || idOrUrl;
        } catch {
            blogId = idOrUrl;
        }
    }

    // Fallback to scraping (skip RSS for this test to see if scraping works for categories)
    const fetchUrl = idOrUrl.startsWith('http') ? idOrUrl : `https://m.blog.naver.com/PostList.naver?blogId=${idOrUrl}`;
    console.log(`Fetching: ${fetchUrl}`);

    const response = await fetch(fetchUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1",
        },
    });

    if (!response.ok) {
        console.log("Response not OK");
        return;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const scripts = $("script").toArray();
    let found = false;
    for (const script of scripts) {
        const content = $(script).html() || "";
        if (content.includes("__PRELOADED_STATE__")) {
            found = true;
            try {
                const jsonStr = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
                const state = JSON.parse(jsonStr);
                const items = state.postList?.postList?.items || state.categoryPostList?.postList?.items || state.postList?.items || [];

                console.log(`Found ${items.length} items in __PRELOADED_STATE__`);
                items.slice(0, 2).forEach(item => {
                    console.log(`- ${item.titleWithOutEmoji || item.title}`);
                });
            } catch (e) {
                console.error("Parse error", e);
            }
            break;
        }
    }
    if (!found) console.log("__PRELOADED_STATE__ not found");
}

const testUrl = "https://m.blog.naver.com/PostList.naver?blogId=totcar&categoryName=%EB%89%B4%EC%8A%A4%2F%EC%A0%95%EC%B1%85%20%EB%B8%8C%EB%A6%AC%ED%95%91&categoryNo=1&logCode=0&tab=1";
testList(testUrl);
testList("totcar");

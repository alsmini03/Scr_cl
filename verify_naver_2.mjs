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
    const $ = cheerio.load(html);

    let posts = [];
    const scripts = $("script").toArray();
    for (const script of scripts) {
        const content = $(script).html() || "";
        if (content.includes("__PRELOADED_STATE__")) {
            console.log("Found __PRELOADED_STATE__ in script");
            try {
                // Find where the JSON actually starts
                const startIdx = content.indexOf('{');
                const endIdx = content.lastIndexOf('}') + 1;
                const jsonStr = content.substring(startIdx, endIdx);
                const state = JSON.parse(jsonStr);

                // Inspect state structure
                console.log("State keys:", Object.keys(state));
                if (state.postList) console.log("postList keys:", Object.keys(state.postList));

                const items = state.postList?.items || state.postList?.postList?.items || state.categoryPostList?.postList?.items || [];
                posts = items.map((item) => ({
                    title: item.titleWithOutEmoji || item.title,
                    url: `https://m.blog.naver.com/${item.blogId}/${item.logNo}`,
                    published_at: item.addDate
                }));
            } catch (e) {
                console.error("Parse error", e);
            }
            break;
        }
    }

    console.log(`Found ${posts.length} posts.`);
    posts.slice(0, 3).forEach(p => console.log(`- ${p.title} (${p.published_at})`));
    return posts[0]?.url;
}

testList();

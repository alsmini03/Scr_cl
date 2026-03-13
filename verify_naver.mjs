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
            try {
                const jsonStr = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
                const state = JSON.parse(jsonStr);
                const items = state.postList?.postList?.items || state.categoryPostList?.postList?.items || [];
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

async function testExtract(postUrl) {
    if (!postUrl) return;
    console.log(`\nTesting Extract API logic for: ${postUrl}`);

    const response = await fetch(postUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1",
        },
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    let title = $("h2.title").first().text().trim() || $("meta[property='og:title']").attr("content") || "";
    title = title.replace(/\s*:\s*네이버\s*블로그$/, "");

    const date = $(".se_publishDate, .date").first().text().trim();

    let content = "";
    const contentArea = $(".se-main-container, .post_ct, #post-view");
    if (contentArea.length > 0) {
        contentArea.find(".se-component.se-text").each((_, el) => {
            $(el).find(".se-text-paragraph").each((_, p) => {
                const text = $(p).text().trim();
                if (text) content += text + "\n";
            });
        });
    }

    console.log(`Title: ${title}`);
    console.log(`Date: ${date}`);
    console.log(`Content length: ${content.length}`);
    console.log(`Content snippet: ${content.substring(0, 100)}...`);
}

async function run() {
    const latestUrl = await testList();
    await testExtract(latestUrl);
}

run();

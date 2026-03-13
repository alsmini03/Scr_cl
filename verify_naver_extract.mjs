import * as cheerio from 'cheerio';

async function testExtract() {
    const url = 'https://m.blog.naver.com/totcar/223788775440'; // Sample post
    console.log(`Testing Extract logic for: ${url}`);

    const response = await fetch(url, {
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
    // Naver Smart Editor ONE uses .se-main-container
    const contentArea = $(".se-main-container");
    if (contentArea.length > 0) {
        console.log("Detected SE-ONE");
        contentArea.find(".se-component.se-text").each((_, el) => {
            $(el).find(".se-text-paragraph").each((_, p) => {
                const text = $(p).text().trim();
                if (text) content += text + "\n";
            });
            content += "\n";
        });
    } else {
        // Fallback for older editors
        console.log("Using fallback selectors");
        content = $(".post_ct, #post-view, #postViewArea").text().trim().replace(/\s+/g, ' ');
    }

    console.log(`Title: ${title}`);
    console.log(`Date: ${date}`);
    console.log(`Content snippet: ${content.substring(0, 200)}...`);
}

testExtract();

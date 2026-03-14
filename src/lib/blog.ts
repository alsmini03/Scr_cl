import * as cheerio from 'cheerio';

export async function getBlogPosts(idOrUrl: string) {
    let blogId = idOrUrl;
    let categoryNo = "";
    let isTistory = idOrUrl.includes("tistory.com");

    if (idOrUrl.startsWith('http')) {
        try {
            const parsedUrl = new URL(idOrUrl);
            if (isTistory) {
                blogId = parsedUrl.hostname.split('.')[0];
            } else {
                blogId = parsedUrl.searchParams.get('blogId') || parsedUrl.pathname.split('/')[1] || idOrUrl;
                categoryNo = parsedUrl.searchParams.get('categoryNo') || "";
            }
        } catch {
            blogId = idOrUrl;
        }
    }

    let allPosts: any[] = [];

    // RSS approach
    let rssUrl = isTistory ? `https://${blogId}.tistory.com/rss` : `https://rss.blog.naver.com/${blogId}.xml`;
    if (!isTistory && categoryNo) {
        rssUrl += `?categoryNo=${categoryNo}`;
    }

    try {
        const response = await fetch(rssUrl);
        if (response.ok) {
            const xml = await response.text();
            const $ = cheerio.load(xml, { xmlMode: true });

            $("item").each((_, el) => {
                const title = $(el).find("title").text().trim();
                let link = $(el).find("link").text().trim();
                const description = $(el).find("description").text();
                const pubDate = $(el).find("pubDate").text();

                const imgMatch = description.match(/<img[^>]+src="([^">]+)"/);
                const thumbnail = imgMatch ? imgMatch[1] : null;

                if (!isTistory && link.includes("blog.naver.com/")) {
                    const parts = link.split('/');
                    const lastPart = parts[parts.length - 1];
                    const logNo = lastPart.split('?')[0];
                    if (!isNaN(Number(logNo))) {
                        link = `https://m.blog.naver.com/${blogId}/${logNo}`;
                    }
                } else if (isTistory && !link.includes('/m/')) {
                    // Convert to mobile link
                    const url = new URL(link);
                    link = `${url.origin}/m${url.pathname}`;
                }

                if (title && link) {
                    allPosts.push({
                        title,
                        url: link,
                        thumbnail,
                        published_at: pubDate,
                        blogId
                    });
                }
            });

            if (allPosts.length > 0) return allPosts;
        }
    } catch (e) {
        console.error(`RSS failed for ${blogId}`, e);
    }

    // Fallback to scraping
    const fetchUrl = idOrUrl.startsWith('http') ? idOrUrl : `https://m.blog.naver.com/PostList.naver?blogId=${idOrUrl}`;
    try {
        const response = await fetch(fetchUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1",
            },
        });

        if (response.ok) {
            const html = await response.text();
            const $ = cheerio.load(html);

            const scripts = $("script").toArray();
            for (const script of scripts) {
                const content = $(script).html() || "";
                if (content.includes("__PRELOADED_STATE__")) {
                    const jsonStr = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
                    const state = JSON.parse(jsonStr);
                    const items = state.postList?.postList?.items || state.categoryPostList?.postList?.items || state.postList?.items || [];

                    items.forEach((item: any) => {
                        allPosts.push({
                            title: item.titleWithOutEmoji || item.title,
                            url: `https://m.blog.naver.com/${item.blogId || blogId}/${item.logNo}`,
                            thumbnail: item.thumbnailUrl,
                            published_at: item.addDate,
                            blogId: item.blogId || blogId
                        });
                    });
                    break;
                }
            }
        }
    } catch (e) {
        console.error(`Scraping failed for ${blogId}`, e);
    }

    return allPosts;
}

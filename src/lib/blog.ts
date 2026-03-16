import * as cheerio from 'cheerio';

export async function getBlogPosts(idOrUrl: string) {
    let blogId = idOrUrl;
    let categoryNo = "";
    let isTistory = idOrUrl.includes("tistory.com");
    let isBrunch = idOrUrl.includes("brunch.co.kr");

    if (idOrUrl.startsWith('http')) {
        try {
            const parsedUrl = new URL(idOrUrl);
            if (isTistory) {
                blogId = parsedUrl.hostname.split('.')[0];
            } else if (isBrunch) {
                blogId = parsedUrl.pathname.split('/')[1]; // @socandy
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
    if (isTistory && idOrUrl.includes('/category/')) {
        // Tistory Category: skip to scraping
    } else {
        let rssUrl = isTistory ? `https://${blogId}.tistory.com/rss` : `https://rss.blog.naver.com/${blogId}.xml`;
        if (!isTistory && categoryNo) {
            rssUrl += `?categoryNo=${categoryNo}`;
        }

        try {
            const response = await fetch(rssUrl);
        if (response.ok) {
            const xml = await response.text();
            const $ = cheerio.load(xml, { xmlMode: true });
            const channelTitle = $("channel > title").first().text().trim();

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
                        author: channelTitle,
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
    }

    // Fallback to scraping
    const fetchUrl = idOrUrl.startsWith('http') ? idOrUrl : `https://m.blog.naver.com/PostList.naver?blogId=${idOrUrl}`;
    try {
        const response = await fetch(fetchUrl, {
            headers: {
                "User-Agent": "facebookexternalhit/1.1", // Works better for most
            },
        });

        if (response.ok) {
            const html = await response.text();
            const $ = cheerio.load(html);

            if (isBrunch) {
                const rssUrl = $("link[type='application/rss+xml']").attr("href");
                if (rssUrl) {
                    const rssRes = await fetch(rssUrl);
                    if (rssRes.ok) {
                        const xml = await rssRes.text();
                        const $rss = cheerio.load(xml, { xmlMode: true });
                        const channelTitle = $rss("channel > title").first().text().trim();
                        $rss("item").each((_, el) => {
                            const title = $rss(el).find("title").text().trim();
                            const link = $rss(el).find("link").text().trim();
                            const pubDate = $rss(el).find("pubDate").text();
                            const description = $rss(el).find("description").text();
                            const imgMatch = description.match(/<img[^>]+src="([^">]+)"/);

                            allPosts.push({
                                title,
                                author: channelTitle,
                                url: link,
                                thumbnail: imgMatch ? imgMatch[1] : null,
                                published_at: pubDate,
                                blogId
                            });
                        });
                        if (allPosts.length > 0) return allPosts;
                    }
                }
            }

            if (isTistory && (fetchUrl.includes('/m/category/') || fetchUrl.includes('/category/'))) {
                // Scraping Tistory Category List (prefers mobile for consistency)
                const scripts = $("script[type='application/ld+json']").toArray();
                for (const script of scripts) {
                    const content = $(script).html() || "";
                    if (content.includes("BreadcrumbList")) {
                        try {
                            const data = JSON.parse(content);
                            const items = data.itemListElement || [];

                        const postPromises = items.map(async (item: any) => {
                                if (item.item && item.item["@id"] && item.item["@id"].includes("/m/entry/")) {
                                    const postUrl = item.item["@id"];
                                try {
                                    const postRes = await fetch(postUrl, {
                                        headers: { "User-Agent": "facebookexternalhit/1.1" }
                                        });
                                    let author = "";
                                    let date = new Date().toISOString();
                                    if (postRes.ok) {
                                        const postHtml = await postRes.text();
                                        const $post = cheerio.load(postHtml);
                                        $post("script").each((_, s) => {
                                            const sc = $(s).html() || "";
                                            if (sc.includes("authorNickname")) {
                                                const match = sc.match(/"authorNickname":"(.*?)"/);
                                                if (match) author = match[1];
                                            }
                                        });
                                        if (!author) author = $post("meta[property='og:article:author']").attr("content") || $post(".txt_author").first().text().trim();
                                        date = $post("meta[property='article:published_time']").attr("content") || $post("meta[property='og:regDate']").attr("content") || $post(".txt_date").first().text().trim() || date;
                                    }

                                    return {
                                        title: item.item.name,
                                        author: author,
                                        url: postUrl,
                                        thumbnail: null,
                                        published_at: date,
                                        blogId: blogId
                                    };
                                } catch (e) {
                                    return null;
                                }
                                }
                            return null;
                        });

                        const results = await Promise.all(postPromises);
                        const filteredResults = results.filter(r => r !== null) as any[];
                        if (filteredResults.length > 0) return filteredResults;
                        } catch(e) {}
                    }
                }

                if (allPosts.length === 0) {
                    $("li a").each((_, el) => {
                        const $el = $(el);
                        const href = $el.attr('href');
                        const title = $el.find(".tit_blog2").text().trim() || $el.find(".tit_post").text().trim();
                        const thumbnail = $el.find(".img_thumb").attr("src");

                        if (href && (href.includes('/m/entry/') || href.includes('/m/') || !isNaN(Number(href.split('/').pop())))) {
                            let fullUrl = href;
                            if (href.startsWith('/m/')) {
                                fullUrl = `https://${blogId}.tistory.com${href}`;
                            } else if (!href.startsWith('http')) {
                                const entryMatch = href.match(/(\d+)$/);
                                if (entryMatch) {
                                    fullUrl = `https://${blogId}.tistory.com/m/${entryMatch[1]}`;
                                } else {
                                    fullUrl = `https://${blogId}.tistory.com/m/${href}`;
                                }
                            }

                            allPosts.push({
                                title: title || "Untitled Post",
                                url: fullUrl,
                                thumbnail: thumbnail ? (thumbnail.startsWith('//') ? 'https:' + thumbnail : thumbnail) : null,
                                published_at: new Date().toISOString(),
                                blogId: blogId
                            });
                        }
                    });
                }
            } else if (isBrunch) {
                // Fallback for Brunch if RSS not found in meta
                let userId = "";
                $("script").each((_, el) => {
                    const content = $(el).html() || "";
                    const match = content.match(/"userId":\[[01],"([^"]+)"\]/);
                    if (match) userId = match[1];
                });

                if (userId) {
                    // Try to construct RSS from userId
                    const rssUrl = `https://brunch.co.kr/rss/@@${userId}`;
                    const rssRes = await fetch(rssUrl);
                    if (rssRes.ok) {
                        const xml = await rssRes.text();
                        const $rss = cheerio.load(xml, { xmlMode: true });
                        const channelTitle = $rss("channel > title").first().text().trim();
                        $rss("item").each((_, el) => {
                            const title = $rss(el).find("title").text().trim();
                            const link = $rss(el).find("link").text().trim();
                            const pubDate = $rss(el).find("pubDate").text();
                            const description = $rss(el).find("description").text();
                            const imgMatch = description.match(/<img[^>]+src="([^">]+)"/);

                            allPosts.push({
                                title,
                                author: channelTitle,
                                url: link,
                                thumbnail: imgMatch ? imgMatch[1] : null,
                                published_at: pubDate,
                                blogId
                            });
                        });
                        if (allPosts.length > 0) return allPosts;
                    }
                }
            } else {
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
        }
    } catch (e) {
        console.error(`Scraping failed for ${blogId}`, e);
    }

    return allPosts;
}

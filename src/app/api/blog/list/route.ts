import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const blogIdParam = searchParams.get("blogId") || "totcar";
    const blogIds = blogIdParam.split(',');

    let allPosts: any[] = [];

    for (const idOrUrl of blogIds) {
        let blogId = idOrUrl;
        let categoryNo = "";

        if (idOrUrl.startsWith('http')) {
            try {
                const parsedUrl = new URL(idOrUrl);
                blogId = parsedUrl.searchParams.get('blogId') || parsedUrl.pathname.split('/')[1] || idOrUrl;
                categoryNo = parsedUrl.searchParams.get('categoryNo') || "";
            } catch {
                blogId = idOrUrl;
            }
        }

        // Use RSS as the most reliable list source for Naver Blog
        let rssUrl = `https://rss.blog.naver.com/${blogId}.xml`;
        if (categoryNo) {
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

                    // Extract first image from description if possible
                    const imgMatch = description.match(/<img[^>]+src="([^">]+)"/);
                    const thumbnail = imgMatch ? imgMatch[1] : null;

                    // Convert link to mobile if needed
                    if (link.includes("blog.naver.com/")) {
                        const parts = link.split('/');
                        const lastPart = parts[parts.length - 1];
                        const logNo = lastPart.split('?')[0];
                        // Some links are blog.naver.com/id/logNo, some are blog.naver.com/PostView.naver?blogId=...
                        if (!isNaN(Number(logNo))) {
                            link = `https://m.blog.naver.com/${blogId}/${logNo}`;
                        }
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

                if (allPosts.length > 0) continue;
            }
        } catch (e) {
            console.error(`RSS failed for ${blogId}`, e);
        }

        // Fallback to scraping if RSS is disabled
        const fetchUrl = idOrUrl.startsWith('http') ? idOrUrl : `https://m.blog.naver.com/PostList.naver?blogId=${idOrUrl}`;
        const response = await fetch(fetchUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1",
            },
        });

        if (!response.ok) continue;

        const html = await response.text();
        const $ = cheerio.load(html);

        const scripts = $("script").toArray();
        for (const script of scripts) {
            const content = $(script).html() || "";
            if (content.includes("__PRELOADED_STATE__")) {
                try {
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
                } catch (e) {
                    console.error("Failed to parse preloaded state", e);
                }
                break;
            }
        }
    }

    // Sort by date (naive, since naver date format varies)
    // For now, just return as they come from multiple blogs (interleaved if we want, or grouped)

    return NextResponse.json({ posts: allPosts });
  } catch (error: any) {
    console.error("Blog List Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

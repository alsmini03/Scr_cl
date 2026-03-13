import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const blogIds = (searchParams.get("blogId") || "totcar").split(',');

    let allPosts: any[] = [];

    for (const blogId of blogIds) {
        const url = `https://m.blog.naver.com/PostList.naver?blogId=${blogId}`;
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        });

        if (!response.ok) continue;

        const html = await response.text();
        const $ = cheerio.load(html);

        $(".list_item").each((_, el) => {
            const title = $(el).find(".title").text().trim();
            const link = $(el).find("a.link").attr("href");
            const thumbnail = $(el).find(".thumb_area img").attr("src");
            const date = $(el).find(".date").text().trim();

            if (title && link) {
                allPosts.push({
                    title,
                    url: link.startsWith("http") ? link : `https://m.blog.naver.com${link}`,
                    thumbnail,
                    published_at: date,
                    blogId
                });
            }
        });
    }

    // Sort by date (naive, since naver date format varies)
    // For now, just return as they come from multiple blogs (interleaved if we want, or grouped)

    return NextResponse.json({ posts: allPosts });
  } catch (error: any) {
    console.error("Blog List Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

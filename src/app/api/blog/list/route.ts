import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const blogId = searchParams.get("blogId") || "totcar";
    const url = `https://m.blog.naver.com/PostList.naver?blogId=${blogId}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch blog list");
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const posts: any[] = [];

    // Naver Mobile Blog List Selector
    $(".list_item").each((_, el) => {
        const title = $(el).find(".title").text().trim();
        const link = $(el).find("a.link").attr("href");
        const thumbnail = $(el).find(".thumb_area img").attr("src");
        const date = $(el).find(".date").text().trim();

        if (title && link) {
            posts.push({
                title,
                url: link.startsWith("http") ? link : `https://m.blog.naver.com${link}`,
                thumbnail,
                published_at: date
            });
        }
    });

    return NextResponse.json({ posts });
  } catch (error: any) {
    console.error("Blog List Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

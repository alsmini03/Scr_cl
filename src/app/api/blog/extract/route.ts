import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || !url.includes("blog.naver.com")) {
      return NextResponse.json({ error: "Invalid Naver Blog URL" }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch blog post");
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Naver Blog Mobile Content Selector
    const title = $("h2.title").first().text().trim() || $("meta[property='og:title']").attr("content");

    // Content extraction logic
    let content = "";

    // Naver smart editor 3.0 / ONE selectors
    const contentArea = $(".se-main-container, .post_ct, #post-view");

    if (contentArea.length > 0) {
        contentArea.find(".se-component").each((_, el) => {
            const $comp = $(el);

            // Text component
            if ($comp.hasClass("se-text")) {
                $comp.find(".se-text-paragraph").each((_, p) => {
                    const text = $(p).text().trim();
                    if (text) content += text + "\n";
                });
                content += "\n";
            }

            // Image component
            else if ($comp.hasClass("se-image")) {
                const imgSrc = $comp.find("img").attr("src");
                const caption = $comp.find(".se-caption").text().trim();
                if (imgSrc) {
                    content += `![image](${imgSrc})\n`;
                    if (caption) content += `*${caption}*\n`;
                    content += "\n";
                }
            }

            // Link component
            else if ($comp.hasClass("se-oglink")) {
                const linkTitle = $comp.find(".se-oglink-title").text().trim();
                const linkUrl = $comp.find("a").attr("href");
                if (linkUrl) {
                    content += `[${linkTitle || 'Link'}](${linkUrl})\n\n`;
                }
            }
        });
    } else {
        // Fallback for older editor
        content = $("#postViewArea").text().trim().replace(/\n+/g, "\n\n");
    }

    const thumbnail = $("meta[property='og:image']").attr("content");
    const date = $(".se_publishDate, .date").first().text().trim();

    return NextResponse.json({
      title,
      content,
      thumbnail,
      published_at: date,
      url
    });
  } catch (error: any) {
    console.error("Blog Extract Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

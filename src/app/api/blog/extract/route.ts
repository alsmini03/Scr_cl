import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { getBlogPosts } from "@/lib/naver";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let url = body.url;

    if (!url || !url.includes("blog.naver.com")) {
      return NextResponse.json({ error: "Invalid Naver Blog URL" }, { status: 400 });
    }

    // Handle List URL: if user provides a list URL, get the latest post first
    if (url.includes("PostList.naver") || (url.split('/').length <= 4 && !url.includes('logNo'))) {
        const posts = await getBlogPosts(url);
        if (posts && posts.length > 0) {
            url = posts[0].url;
        }
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch blog post");
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Naver Blog Mobile Content Selector
    let title = $(".se-title-text, h2.title").first().text().trim() || $("meta[property='og:title']").attr("content") || "";

    // Clean up title (remove " : 네이버 블로그" etc)
    title = title.replace(/\s*:\s*네이버\s*블로그$/, "");

    // Content extraction logic
    let content = "";

    // Naver smart editor 3.0 / ONE selectors
    const contentArea = $(".se-main-container, .post_ct, #post-view, .se_component_wrap");

    if (contentArea.length > 0) {
        contentArea.find(".se-component, .se_component").each((_, el) => {
            const $comp = $(el);

            // Text component
            if ($comp.hasClass("se-text") || $comp.hasClass("se_textarea")) {
                $comp.find(".se-text-paragraph, .se_textarea").each((_, p) => {
                    const text = $(p).text().trim();
                    if (text) content += text + "\n";
                });
                content += "\n";
            }

            // Image component
            else if ($comp.hasClass("se-image") || $comp.hasClass("se_image")) {
                const imgSrc = $comp.find("img").attr("src") || $comp.find("img").attr("data-lazy-src");
                const caption = $comp.find(".se-caption, .se_image_caption").text().trim();
                if (imgSrc) {
                    content += `![image](${imgSrc})\n`;
                    if (caption) content += `*${caption}*\n`;
                    content += "\n";
                }
            }

            // Link component
            else if ($comp.hasClass("se-oglink") || $comp.hasClass("se_oglink")) {
                const linkTitle = $comp.find(".se-oglink-title, .se_oglink_title").text().trim();
                const linkUrl = $comp.find("a").attr("href");
                if (linkUrl) {
                    content += `[${linkTitle || 'Link'}](${linkUrl})\n\n`;
                }
            }
        });
    }

    // If still empty, try fallback selectors
    if (!content.trim()) {
        content = $("#postViewArea, .post_ct, #post-view").text().trim().replace(/\n+/g, "\n\n");
    }

    const thumbnail = $("meta[property='og:image']").attr("content");
    const date = $(".se_publishDate, .date, .se-publish-date").first().text().trim();

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

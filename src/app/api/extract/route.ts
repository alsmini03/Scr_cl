import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || !url.includes("yes24.com")) {
      return NextResponse.json(
        { error: "Invalid Yes24 URL" },
        { status: 400 }
      );
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch page");
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract Title (Cleaned)
    let title = $("h2.gd_name").first().text().trim();
    if (!title) {
        title = $('meta[property="og:title"]').attr("content")?.split("|")[0].trim() || "";
    }

    // Extract Author
    const author = $(".gd_auth").first().text().trim().replace(/\s+/g, " ");

    // Extract Publisher
    const publisher = $(".gd_pub a").first().text().trim() || $(".gd_pub").first().text().trim();

    // Extract Publish Date
    const publishDate = $(".gd_date").first().text().trim();

    // Extract Price
    const priceStr = $(".yes_m").first().text().trim();
    const price = priceStr ? parseInt(priceStr.replace(/[^0-9]/g, "")) : 0;

    // Extract Description
    let description = $("#infoset_introduce .infoText_wrap")
      .first()
      .text()
      .trim();

    if (!description) {
        description = $('meta[name="description"]').attr("content") || "";
    }

    if (description.length > 300) {
      description = description.slice(0, 300) + "...";
    } else if (!description) {
      description = "설명이 없습니다.";
    }

    // Extract Cover Image
    let coverImage = $(".gImg").attr("src");
    if (!coverImage) {
        coverImage = $("em.imgBdr img").attr("src");
    }
    if (!coverImage) {
        coverImage = $('meta[property="og:image"]').attr("content");
    }

    // Extract Category
    let category = "";
    const categoryLinks = $("#infoset_goodsCate .yesAlertLi li a");
    if (categoryLinks.length > 0) {
        // Build category string from the first breadcrumb trail
        const categories: string[] = [];
        categoryLinks.each((_, el) => {
            const text = $(el).text().trim();
            if (text && text !== "국내도서" && text !== "외국도서") {
                categories.push(text);
            }
        });
        category = categories.join(" / ");
    }

    if (!category) {
        category = $(".gd_tag").first().text().trim() || "도서";
    }

    return NextResponse.json({
      title,
      author,
      publisher,
      publishDate,
      price: price.toLocaleString() + "원",
      description,
      coverImage,
      category,
    });
  } catch (error) {
    console.error("Extraction error:", error);
    return NextResponse.json(
      { error: "Failed to extract book information" },
      { status: 500 }
    );
  }
}

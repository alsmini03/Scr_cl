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

    // Extract Publisher and Date
    const pubInfo = $(".gd_pub").first().text().trim();
    const publisher = $(".gd_pub a").first().text().trim();
    const parts = pubInfo.split("|").map(p => p.trim());
    const publishDate = parts.length > 1 ? parts[parts.length - 1] : "";

    // Extract Price
    const priceStr = $(".yes_m").first().text().trim();
    const price = priceStr ? parseInt(priceStr.replace(/[^0-9]/g, "")) : 0;

    // Extract Description (improved)
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
    const category = $(".gd_tag").first().text().trim() || "도서";

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

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

    let title = "";
    let author = "";
    let publisher = "";
    let publishDate = "";
    let price = 0;
    let description = "";
    let coverImage = "";
    let category = "";

    // 1. Try all JSON-LD blocks to find the Book/Product data
    const jsonLdScripts = $('script[type="application/ld+json"]');
    jsonLdScripts.each((_, script) => {
      try {
        const jsonLd = JSON.parse($(script).text().trim());
        const blocks = Array.isArray(jsonLd) ? jsonLd : [jsonLd];

        for (const block of blocks) {
          const type = Array.isArray(block["@type"]) ? block["@type"] : [block["@type"]];

          if (type.includes("Book") || type.includes("Product")) {
            if (!title) title = block.name || "";

            if (!author && block.author) {
              if (Array.isArray(block.author)) {
                author = block.author.map((a: any) => a.name).filter(Boolean).join(", ");
              } else {
                author = block.author.name || "";
              }
            }

            if (!publisher && block.publisher) {
              publisher = block.publisher.name || "";
            }

            if (!publishDate) publishDate = block.datePublished || "";

            if (price === 0 && block.offers) {
              const offers = Array.isArray(block.offers) ? block.offers[0] : block.offers;
              price = offers.price || 0;
            }

            if (!description) description = block.description || "";
            if (!coverImage) coverImage = block.image || "";

            if (!category && block.genre) {
              category = Array.isArray(block.genre) ? block.genre.join(" / ") : block.genre;
            }
          }
        }
      } catch (e) {
        // Ignore parse errors for specific blocks
      }
    });

    // 2. CSS Selectors Fallbacks
    if (!title) title = $("h2.gd_name").first().text().trim() || $(".gd_name").first().text().trim();
    if (!author) author = $(".gd_auth").first().text().trim().replace(/\s+/g, " ");
    if (!publisher) publisher = $(".gd_pub a").first().text().trim() || $(".gd_pub").first().text().trim();
    if (!publishDate) publishDate = $(".gd_date").first().text().trim();
    if (price === 0) {
      const priceStr = $(".yes_m").first().text().trim() || $(".yes_b").first().text().trim();
      price = priceStr ? parseInt(priceStr.replace(/[^0-9]/g, "")) : 0;
    }
    if (!description) description = $("#infoset_introduce .infoText_wrap").first().text().trim();
    if (!coverImage) coverImage = $(".gImg").attr("src") || $("em.imgBdr img").attr("src") || "";

    // 3. Open Graph Fallbacks
    if (!title) title = $('meta[property="og:title"]').attr("content")?.split("|")[0].trim() || "";
    if (!description) description = $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || "";
    if (!coverImage) coverImage = $('meta[property="og:image"]').attr("content") || "";

    // 4. Category refinement
    if (!category) {
        const categoryLinks = $("#infoset_goodsCate .yesAlertLi li a");
        if (categoryLinks.length > 0) {
            const categories: string[] = [];
            categoryLinks.each((_, el) => {
                const text = $(el).text().trim();
                if (text && text !== "국내도서" && text !== "외국도서") {
                    categories.push(text);
                }
            });
            category = categories.join(" / ");
        }
    }

    if (!category) {
        category = $(".gd_tag").first().text().trim() || "도서";
    }

    // Final string cleanups
    if (description.length > 300) {
      description = description.slice(0, 300) + "...";
    }
    if (!description) description = "설명이 없습니다.";

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

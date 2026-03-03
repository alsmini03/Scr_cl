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

    // 1. Try JSON-LD (robust for both mobile and desktop)
    const jsonLdScript = $('script[type="application/ld+json"]').first();
    if (jsonLdScript.length > 0) {
      try {
        const jsonLd = JSON.parse(jsonLdScript.text().trim());
        const bookData = Array.isArray(jsonLd) ? jsonLd[0] : jsonLd;

        title = bookData.name || "";

        if (bookData.author) {
          if (Array.isArray(bookData.author)) {
            author = bookData.author.map((a: { name?: string }) => a.name).filter(Boolean).join(", ");
          } else {
            author = bookData.author.name || "";
          }
        }

        if (bookData.publisher) {
          publisher = bookData.publisher.name || "";
        }

        publishDate = bookData.datePublished || "";

        if (bookData.offers) {
          const offers = Array.isArray(bookData.offers) ? bookData.offers[0] : bookData.offers;
          price = offers.price || 0;
        }

        description = bookData.description || "";
        coverImage = bookData.image || "";

        if (bookData.genre) {
            category = Array.isArray(bookData.genre) ? bookData.genre.join(" / ") : bookData.genre;
        }
      } catch (e) {
        console.error("JSON-LD parse error:", e);
      }
    }

    // 2. CSS Selectors (Desktop) as fallbacks
    if (!title) title = $("h2.gd_name").first().text().trim();
    if (!author) author = $(".gd_auth").first().text().trim().replace(/\s+/g, " ");
    if (!publisher) publisher = $(".gd_pub a").first().text().trim() || $(".gd_pub").first().text().trim();
    if (!publishDate) publishDate = $(".gd_date").first().text().trim();
    if (price === 0) {
      const priceStr = $(".yes_m").first().text().trim();
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

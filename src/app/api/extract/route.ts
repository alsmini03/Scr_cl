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
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
                author = block.author.map((a: { name?: string }) => a.name).filter(Boolean).join(", ");
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
      } catch {
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

    // 4. Detailed Sections Extraction
    let detailedDescription = description;

    const sections = [
      { title: "책소개", selector: "#infoset_introduce" },
      { title: "목차", selector: "#infoset_toc" },
      { title: "저자 소개", selector: "#infoset_author, #infoset_authorGrp" },
      { title: "책 속으로", selector: "#infoset_inBook" },
      { title: "출판사 리뷰", selector: "#infoset_pubReview, #infoset_pubReivew" }
    ];

    let combinedDetails = "";
    sections.forEach(section => {
      let content = "";

      // Try to get text from the specific container(s)
      const container = $(section.selector).first();

      if (container.length > 0) {
        // YES24 stores content in various places. Priority:
        // 1. textarea.txtContentText (Full content)
        // 2. .info_origin (Full author info)
        // 3. .infoText_wrap
        // 4. .fullTxt

        // Find ALL textareas and infoText_wraps within the container and combine them
        const textareas = container.find("textarea.txtContentText");
        let combinedRaw = "";

        if (textareas.length > 0) {
            textareas.each((_, el) => {
                combinedRaw += $(el).text().trim() + "\n";
            });
        } else {
            combinedRaw = container.find(".info_origin").text().trim() ||
                          container.find(".infoText_wrap").text().trim() ||
                          container.find(".fullTxt").text().trim();
        }

        if (!combinedRaw) {
          // If no specific content container found, get text from the main wrap
          combinedRaw = container.find(".infoSetCont_wrap").text().trim();
        }

        if (combinedRaw) {
          // Clean up HTML-like breaks and extra whitespace
          content = combinedRaw
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/&nbsp;/g, " ")
            .replace(/접기$/g, "")
            .replace(/더보기$/g, "")
            .trim();
        }
      }

      if (content) {
        combinedDetails += `### ${section.title}\n${content}\n\n`;
      }
    });

    if (combinedDetails) {
      description = combinedDetails;
    }

    const details: Record<string, string> = {};
    sections.forEach(section => {
        let sectionContent = "";
        const container = $(section.selector).first();
        if (container.length > 0) {
            const textareas = container.find("textarea.txtContentText");
            if (textareas.length > 0) {
                textareas.each((_, el) => {
                    sectionContent += $(el).text().trim() + "\n";
                });
            } else {
                sectionContent = container.find(".info_origin").text().trim() ||
                                 container.find(".infoText_wrap").text().trim() ||
                                 container.find(".fullTxt").text().trim() ||
                                 container.find(".infoSetCont_wrap").text().trim();
            }
            if (sectionContent) {
                sectionContent = sectionContent
                    .replace(/<br\s*\/?>/gi, "\n")
                    .replace(/&nbsp;/g, " ")
                    .replace(/접기$/g, "")
                    .replace(/더보기$/g, "")
                    .trim();
            }
        }

        // Map section titles to database field names
        const fieldMap: Record<string, string> = {
            "책소개": "intro",
            "목차": "toc",
            "저자 소개": "author_intro",
            "책 속으로": "inside",
            "출판사 리뷰": "publisher_review"
        };
        const fieldName = fieldMap[section.title];
        if (fieldName) {
            details[fieldName] = sectionContent || "";
        }
    });

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
    if (!description || description.trim() === "") description = "설명이 없습니다.";

    return NextResponse.json({
      title,
      author,
      publisher,
      publishDate,
      price: price.toLocaleString() + "원",
      description,
      coverImage,
      category,
      ...details
    });
  } catch (error) {
    console.error("Extraction error:", error);
    return NextResponse.json(
      { error: "Failed to extract book information" },
      { status: 500 }
    );
  }
}

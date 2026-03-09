import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || !url.includes("youtube.com") && !url.includes("youtu.be")) {
      return NextResponse.json(
        { error: "Invalid YouTube URL" },
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

    const title = $('meta[property="og:title"]').attr("content") || "";
    const description = $('meta[property="og:description"]').attr("content") || "";
    const thumbnail = $('meta[property="og:image"]').attr("content") || "";

    return NextResponse.json({
      title,
      description,
      thumbnail,
      // Duration and specific publish date are harder to get from OG tags alone
      // without using YouTube Data API, but we'll return what we have.
    });
  } catch (error) {
    console.error("YouTube Extraction error:", error);
    return NextResponse.json(
      { error: "Failed to extract YouTube video information" },
      { status: 500 }
    );
  }
}

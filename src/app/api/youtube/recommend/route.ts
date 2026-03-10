import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(req: NextRequest) {
  try {
    const url = "https://m.youtube.com/@understanding./videos";

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch YouTube channel page");
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Look for ytInitialData which contains the video list in JSON format
    const scriptTag = $("script").filter((i, el) => {
      const text = $(el).text();
      return text.includes("var ytInitialData =") || text.includes("window[\"ytInitialData\"] =");
    }).first();

    if (!scriptTag.length) {
      return NextResponse.json({ error: "Could not find ytInitialData" }, { status: 500 });
    }

    const scriptText = scriptTag.text();
    const jsonStrMatch = scriptText.match(/ytInitialData\s*=\s*({.+?});/);

    if (!jsonStrMatch) {
        return NextResponse.json({ error: "Could not parse ytInitialData" }, { status: 500 });
    }

    const ytData = JSON.parse(jsonStrMatch[1]);

    let contents = [];

    try {
        const tabs = ytData.contents?.singleColumnBrowseResultsRenderer?.tabs || ytData.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
        const videoTab = tabs.find((t: any) => t.tabRenderer?.title === "동영상" || t.tabRenderer?.title === "Videos");

        if (videoTab) {
            const gridItems = videoTab.tabRenderer.content?.richGridRenderer?.contents ||
                              videoTab.tabRenderer.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.gridRenderer?.items || [];

            contents = gridItems.map((item: any) => {
                const video = item.richItemRenderer?.content?.videoRenderer || item.gridVideoRenderer;
                if (!video) return null;

                const videoId = video.videoId;
                const title = video.title?.runs?.[0]?.text || video.title?.accessibility?.accessibilityData?.label;
                const thumbnail = video.thumbnail?.thumbnails?.sort((a: any, b: any) => b.width - a.width)[0]?.url;
                const publishedTime = video.publishedTimeText?.simpleText;
                const viewCount = video.viewCountText?.simpleText;
                const duration = video.lengthText?.simpleText;

                return {
                    videoId,
                    title,
                    thumbnail,
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    publishedTime,
                    viewCount,
                    duration
                };
            }).filter(Boolean);
        }
    } catch (e) {
        console.error("Error parsing ytData structure:", e);
    }

    return NextResponse.json(contents);
  } catch (error: any) {
    console.error("YouTube Recommend Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

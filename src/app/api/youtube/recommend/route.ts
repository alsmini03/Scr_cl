import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

function parseYouTubeRelativeTime(timeStr: string): number {
  if (!timeStr) return 0;

  const now = Date.now();
  const match = timeStr.match(/(\d+)\s*(초|분|시간|일|주|개월|년)\s*전/);

  if (!match) return 0;

  const value = parseInt(match[1]);
  const unit = match[2];

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  switch (unit) {
    case '초': return now - (value * 1000);
    case '분': return now - (value * minute);
    case '시간': return now - (value * hour);
    case '일': return now - (value * day);
    case '주': return now - (value * week);
    case '개월': return now - (value * month);
    case '년': return now - (value * year);
    default: return now;
  }
}

async function fetchChannelVideos(channelUrl: string, limit = 0) {
  const response = await fetch(channelUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    next: { revalidate: 3600 } // Cache for 1 hour
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch YouTube channel page: ${channelUrl}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const scriptTag = $("script").filter((i, el) => {
    const text = $(el).text();
    return text.includes("var ytInitialData =") || text.includes("window[\"ytInitialData\"] =");
  }).first();

  if (!scriptTag.length) return [];

  const scriptText = scriptTag.text();
  const jsonStrMatch = scriptText.match(/ytInitialData\s*=\s*({.+?});/);

  if (!jsonStrMatch) return [];

  const ytData = JSON.parse(jsonStrMatch[1]);

  let videos = [];

  try {
      const tabs = ytData.contents?.singleColumnBrowseResultsRenderer?.tabs || ytData.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
      const videoTab = tabs.find((t: any) => t.tabRenderer?.title === "동영상" || t.tabRenderer?.title === "Videos");

      if (videoTab) {
          const gridItems = videoTab.tabRenderer.content?.richGridRenderer?.contents ||
                            videoTab.tabRenderer.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.gridRenderer?.items || [];

          const itemsToProcess = limit > 0 ? gridItems.slice(0, limit) : gridItems;
          videos = itemsToProcess.map((item: any) => {
              const richContent = item.richItemRenderer?.content;
              const video = richContent?.videoRenderer || item.gridVideoRenderer;

              if (video) {
                  const videoId = video.videoId;
                  const title = video.title?.runs?.[0]?.text ||
                                video.title?.simpleText ||
                                video.title?.accessibility?.accessibilityData?.label;
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
              }

              // Support for new lockupViewModel (YouTube Mobile)
              const lockup = richContent?.lockupViewModel;
              if (lockup) {
                  const videoId = lockup.contentId;
                  const metadata = lockup.metadata?.lockupMetadataViewModel;
                  const title = metadata?.title?.content;

                  const thumbnail = lockup.contentImage?.thumbnailViewModel?.image?.sources?.sort((a: any, b: any) => b.width - a.width)[0]?.url;

                  // Meta extraction from various possible structures in contentMetadataViewModel
                  let viewCount = "";
                  let publishedTime = "";

                  const renderer = metadata?.metadata?.contentMetadataViewModel;
                  if (renderer?.metadata) {
                      viewCount = renderer.metadata[0]?.content || "";
                      publishedTime = renderer.metadata[1]?.content || "";
                  } else if (renderer?.metadataRows) {
                      const row = renderer.metadataRows[0];
                      const parts = row?.metadataParts || [];
                      viewCount = parts[0]?.text?.content || "";
                      publishedTime = parts[1]?.text?.content || "";
                  }

                  // Duration from overlays
                  const overlays = lockup.contentImage?.thumbnailViewModel?.overlays || [];
                  const durationOverlay = overlays.find((o: any) => o.thumbnailOverlayTimeStatusRenderer);
                  const badgeOverlay = overlays.find((o: any) => o.thumbnailBottomOverlayViewModel);

                  const duration = durationOverlay?.thumbnailOverlayTimeStatusRenderer?.text?.content ||
                                   badgeOverlay?.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel?.text || "";

                  if (videoId && title) {
                      return {
                          videoId,
                          title,
                          thumbnail,
                          url: `https://www.youtube.com/watch?v=${videoId}`,
                          publishedTime,
                          viewCount,
                          duration
                      };
                  }
              }

              return null;
          }).filter(Boolean);
      }
  } catch (e) {
      console.error("Error parsing ytData structure:", e);
  }
  return videos;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const urlParam = searchParams.get("url");

    if (!urlParam) {
      return NextResponse.json({ videos: [], all: [] });
    }

    const urls = urlParam.split(',').filter(Boolean);

    if (urls.length === 1) {
      const videos = await fetchChannelVideos(urls[0]);
      return NextResponse.json({ videos });
    }

    // Limit to 10 videos per channel when fetching all to improve performance
    const results = await Promise.allSettled(urls.map(url => fetchChannelVideos(url, 10)));

    const videoGroups = results.map((res) => {
      return res.status === 'fulfilled' ? res.value : [];
    });

    // Combine all videos and sort by date (newest first)
    const allVideos = videoGroups.flat();

    allVideos.sort((a, b) => {
        const timeA = parseYouTubeRelativeTime(a.publishedTime);
        const timeB = parseYouTubeRelativeTime(b.publishedTime);
        return timeB - timeA;
    });

    return NextResponse.json({
      all: allVideos,
      videos: allVideos
    });
  } catch (error: any) {
    console.error("YouTube Recommend Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

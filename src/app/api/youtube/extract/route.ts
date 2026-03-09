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

    // First attempt with a browser user agent
    let response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
      },
    });

    let html = await response.text();
    let $ = cheerio.load(html);

    let title = $('meta[property="og:title"]').attr("content") ||
                $('meta[name="twitter:title"]').attr("content") ||
                $("title").text();

    // If browser UA failed to get basic meta tags, try with a social crawler UA
    // Note: YouTube often returns " - YouTube" or "YouTube" in title when it detects a bot
    if (!title || title.trim() === "YouTube" || title.trim() === "- YouTube") {
      response = await fetch(url, {
        headers: {
          "User-Agent": "facebookexternalhit/1.1",
          "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      });
      html = await response.text();
      $ = cheerio.load(html);
    }

    if (!response.ok) {
      throw new Error("Failed to fetch page");
    }

    title = $('meta[property="og:title"]').attr("content") ||
            $('meta[name="twitter:title"]').attr("content") ||
            $("title").text() || "";

    let ogDescription = $('meta[property="og:description"]').attr("content") ||
                      $('meta[name="twitter:description"]').attr("content") || "";

    let thumbnail = $('meta[property="og:image"]').attr("content") ||
                    $('meta[name="twitter:image"]').attr("content") || "";

    // Cleanup title (remove " - YouTube")
    title = title.replace(" - YouTube", "").trim();

    // Fallback for thumbnail if ID is available
    const videoIdMatch = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w\-]{11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!thumbnail && videoId) {
      thumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    }

    // Attempt to fetch transcript
    let transcript = "";
    let playerResponse = null;
    try {
      // YouTube embeds the player response in the HTML
      // Sometimes it's window['ytInitialPlayerResponse'] or var ytInitialPlayerResponse
      const playerResponseRegex = /ytInitialPlayerResponse\s*=\s*({.+?});/s;
      const playerMatch = html.match(playerResponseRegex);

      if (playerMatch) {
        playerResponse = JSON.parse(playerMatch[1]);
      } else {
          // Try another pattern
          const altRegex = /"playerResponse":\s*({.+?})\s*,\s*"playbackTracking"/s;
          const altMatch = html.match(altRegex);
          if (altMatch) {
              playerResponse = JSON.parse(altMatch[1]);
          }
      }

      if (playerResponse) {
        const captionTracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;

        if (captionTracks && captionTracks.length > 0) {
          // Prefer Korean (ko), then English (en), then any
          const track = captionTracks.find((t: any) => t.languageCode === 'ko') ||
                        captionTracks.find((t: any) => t.languageCode?.startsWith('ko')) ||
                        captionTracks.find((t: any) => t.languageCode === 'en') ||
                        captionTracks[0];

          if (track?.baseUrl) {
            const capRes = await fetch(track.baseUrl + "&fmt=json3", {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://www.youtube.com/",
              }
            });
            const capData = await capRes.json();
            if (capData.events) {
                transcript = capData.events
                    .filter((ev: any) => ev.segs)
                    .map((ev: any) => ev.segs.map((s: any) => s.utf8).join(''))
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();
            }
          }
        }
      }
    } catch (e) {
      console.warn("Transcript extraction failed:", e);
    }

    // Extract duration from playerResponse or HTML if available
    let duration = "";
    const lengthSeconds = playerResponse?.videoDetails?.lengthSeconds ||
                          html.match(/"lengthSeconds":"(\d+)"/)?.[1];

    if (lengthSeconds) {
        const seconds = parseInt(lengthSeconds);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        duration = `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Use transcript as description if found, otherwise use OG description
    const description = transcript || ogDescription;

    return NextResponse.json({
      title,
      description,
      thumbnail,
      duration,
    });
  } catch (error) {
    console.error("YouTube Extraction error:", error);
    return NextResponse.json(
      { error: "Failed to extract YouTube video information" },
      { status: 500 }
    );
  }
}

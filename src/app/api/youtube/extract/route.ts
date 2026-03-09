import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";

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
    let summary = "";
    let playerResponse = null;

    // 1. Try manual scraping first (much lighter on tokens)
    try {
      // YouTube embeds the player response in the HTML
      const playerResponseRegex = /(?:var\s+|window\[['"]|window\.)ytInitialPlayerResponse\s*=\s*({.+?});/s;
      const playerMatch = html.match(playerResponseRegex);

      if (playerMatch) {
        playerResponse = JSON.parse(playerMatch[1]);
      } else {
          const altRegex = /"playerResponse":\s*({.+?})\s*,\s*"playbackTracking"/s;
          const altMatch = html.match(altRegex);
          if (altMatch) {
              playerResponse = JSON.parse(altMatch[1]);
          }
      }

      if (playerResponse) {
        const captionTracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;

        if (captionTracks && captionTracks.length > 0) {
          const track = captionTracks.find((t: any) => t.languageCode === 'ko') ||
                        captionTracks.find((t: any) => t.languageCode?.startsWith('ko')) ||
                        captionTracks.find((t: any) => t.languageCode === 'en') ||
                        captionTracks[0];

          if (track?.baseUrl) {
            const transcriptHeaders = {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Referer": url,
              "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            };

            const jsonRes = await fetch(track.baseUrl + "&fmt=json3", { headers: transcriptHeaders });
            if (jsonRes.ok) {
              const capData = await jsonRes.json();
              if (capData.events) {
                  transcript = capData.events
                      .filter((ev: any) => ev.segs)
                      .map((ev: any) => ev.segs.map((s: any) => s.utf8).join(''))
                      .join(' ')
                      .replace(/\s+/g, ' ')
                      .trim();
              }
            }

            if (!transcript) {
              const xmlRes = await fetch(track.baseUrl, { headers: transcriptHeaders });
              if (xmlRes.ok) {
                const xmlText = await xmlRes.text();
                const $xml = cheerio.load(xmlText, { xmlMode: true });
                transcript = $xml('text').map((i, el) => $xml(el).text()).get().join(' ')
                              .replace(/\s+/g, ' ')
                              .trim();
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Manual transcript scraping failed:", e);
    }

    // 2. Use Gemini for summary/transcript refinement
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        if (transcript) {
          // If we have transcript, summarize the TEXT (much fewer tokens)
          console.log("Summarizing scraped transcript with Gemini...");
          const result = await ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: [{ text: `아래 유튜브 영상 스크립트를 상세하게 요약해 주세요. 마크다운 형식을 사용하여 한국어로 답변해 주세요.\n\n[스크립트]\n${transcript}` }],
          });
          summary = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
        } else {
          // If no transcript, analyze the video URL (fallback, might hit token limit)
          console.log("No transcript found, analyzing video URL with Gemini...");
          const result = await ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: [
              { fileData: { fileUri: url, mimeType: "video/mp4" } },
              { text: "이 유튜브 영상의 내용을 상세하게 요약해 주세요. 마크다운 형식을 사용하여 가능하다면 전체 자막(스크립트)도 포함해 주세요. 한국어로 답변해 주세요." }
            ],
          });
          const geminiText = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (geminiText) {
            transcript = geminiText;
            summary = geminiText.split('\n\n')[0];
          }
        }
      } catch (geminiError) {
        console.error("Gemini processing failed:", geminiError);
      }
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

    // Extract publish date
    let publishDate = playerResponse?.microformat?.playerMicroformatRenderer?.publishDate ||
                      playerResponse?.microformat?.playerMicroformatRenderer?.uploadDate ||
                      html.match(/itemprop="datePublished" content="(.*?)"/)?.[1] ||
                      html.match(/itemprop="uploadDate" content="(.*?)"/)?.[1] || "";

    if (publishDate) {
        // Extract YYYY-MM-DD from ISO string
        publishDate = publishDate.split('T')[0];
    }

    // Use transcript/summary as description if found, otherwise use OG description
    const finalSummary = summary || transcript || "";
    const finalDescription = playerResponse?.videoDetails?.shortDescription || ogDescription || "";

    return NextResponse.json({
      title,
      summary: finalSummary,
      description: finalDescription,
      thumbnail,
      duration,
      publishDate,
      transcript: transcript,
    });
  } catch (error) {
    console.error("YouTube Extraction error:", error);
    return NextResponse.json(
      { error: "Failed to extract YouTube video information" },
      { status: 500 }
    );
  }
}

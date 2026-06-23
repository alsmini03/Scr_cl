import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cheerio from "cheerio";
import he from "he";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function extractReport(url: string, modelName?: string, promptText?: string) {
    // 1. Fetch the PDF
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch PDF from ${url}`);
    }
    const pdfBuffer = await response.arrayBuffer();

    // Check for PDF signature (%PDF-)
    const buffer = Buffer.from(pdfBuffer);
    const signature = buffer.slice(0, 5).toString('ascii');
    if (signature !== '%PDF-') {
        const contentSample = buffer.slice(0, 500).toString('utf8');
        if (contentSample.includes('<html') || contentSample.includes('<HTML')) {
            throw new Error("유효한 PDF 파일이 아닙니다. (Bondweb 세션 만료 또는 접근 권한 오류)");
        }
        throw new Error("올바른 PDF 형식이 아닙니다.");
    }

    const base64Pdf = buffer.toString("base64");

    // 2. Initialize Gemini model
    const geminiModel = genAI.getGenerativeModel({ model: modelName || "gemini-1.5-flash" });

    // 3. Generate content with PDF data
    const result = await geminiModel.generateContent([
      promptText || "이 리포트를 요약하고 핵심 내용을 분석해 주세요.",
      {
        inlineData: {
          data: base64Pdf,
          mimeType: "application/pdf",
        },
      },
    ]);

    return result.response.text();
}

export async function extractYoutube(url: string, requestedModel?: string, requestedPrompt?: string) {
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
      throw new Error("Failed to fetch YouTube page");
    }

    title = $('meta[property="og:title"]').attr("content") ||
            $('meta[name="twitter:title"]').attr("content") ||
            $("title").text() || "";

    const ogDescription = $('meta[property="og:description"]').attr("content") ||
                      $('meta[name="twitter:description"]').attr("content") || "";

    let thumbnail = $('meta[property="og:image"]').attr("content") ||
                    $('meta[name="twitter:image"]').attr("content") || "";

    title = title.replace(" - YouTube", "").trim();

    const videoIdMatch = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w\-]{11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!thumbnail && videoId) {
      thumbnail = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    }

    let transcript = "";
    let summary = "";
    let playerResponse = null;

    try {
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
        if (playerResponse.videoDetails?.title) {
          title = playerResponse.videoDetails.title;
        }

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

    if (process.env.GEMINI_API_KEY) {
        const geminiModel = requestedModel || "gemini-1.5-flash";
        const model = genAI.getGenerativeModel({ model: geminiModel });

        const promptText = requestedPrompt || "이 영상을 분석해 주세요.";

        const parts = [
          { text: `${promptText}\n\n[영상 제목]\n${title}\n\n[영상 설명]\n${ogDescription}` }
        ];

        const result = await model.generateContent(parts);
        summary = result.response.text();
    } else {
      summary = "### 설정 오류\n\nGEMINI_API_KEY가 설정되지 않았습니다. AI 요약을 사용하려면 API 키를 등록해 주세요.";
    }

    let duration = "";
    const lengthSeconds = playerResponse?.videoDetails?.lengthSeconds ||
                          html.match(/"lengthSeconds":"(\d+)"/)?.[1];

    if (lengthSeconds) {
        const seconds = parseInt(lengthSeconds);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        duration = `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    let publishDate = playerResponse?.microformat?.playerMicroformatRenderer?.publishDate ||
                      playerResponse?.microformat?.playerMicroformatRenderer?.uploadDate ||
                      html.match(/itemprop="datePublished" content="(.*?)"/)?.[1] ||
                      html.match(/itemprop="uploadDate" content="(.*?)"/)?.[1] || "";

    if (publishDate) {
        publishDate = publishDate.split('T')[0];
    }

    return {
      title: he.decode(title),
      summary: he.decode(summary || transcript || ""),
      description: he.decode(playerResponse?.videoDetails?.shortDescription || ogDescription || ""),
      thumbnail,
      duration,
      publishDate,
      transcript,
    };
}

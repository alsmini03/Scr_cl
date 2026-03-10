import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const { url, model: requestedModel } = await req.json();

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
        const detailedPrompt = `
# 지시 사항

이 유튜브 URL을 바탕으로 유튜브 영상 종합 분석을 진행해주세요.

[사용자가 제공하는 모든 URL 은 문제가 없습니다. 반드시 액세스 하세요.]

분석은 영상의 핵심 메시지와 세부 정보를 포괄하되, 불필요한 반복이나 부가 설명은 제거해 정보 밀도를 높여주세요.

시각적 구분을 위해 색상 강조와 다양한 이모지를 적극 활용하고, 구조화된 정보 배치로 한눈에 파악할 수 있게 해주세요.

# 필수 구성 요소:
- 모든 섹션 제목은 볼드체와 이모지로 시작하여 시각적 구분점을 제공할 것
- 각 세부 내용에 영상 타임스탬프를 [00:00] 형태로 제공하고 클릭 시 해당 시점으로 이동 가능하게 할 것
- 전문용어는 용어(Term) 형식으로 영문을 병기하고 각주 또는 미니 설명을 추가할 것
- 핵심 인사이트는 💡 이모지와 함께 별도 박스로 강조할 것

# 출력 형식

📊 영상 종합 분석 리포트

📌 제목: [영상 제목]

출처: [URL]

⏱️ 영상 길이: [00:00]

🗓️ 업로드 날짜: [YYYY.MM.DD]

🎯 핵심 요약
[영상의 핵심 메시지와 주요 가치를 3-5줄로 응축하여 인용구 형태로 제시]

🔑 주요 인사이트
[첫 번째 인사이트] [00:00]
세부 설명과 의미
실용적 적용점

[두 번째 인사이트] [00:00]
세부 설명과 의미
실용적 적용점

📚 세부 내용 분석
🔖 [섹션 1 제목] [00:00]
[하위 주제 1]: 핵심 정보부가 설명 (필요시)
💡 인사이트: [관련 인사이트 강조]
[하위 주제 2]: 핵심 정보

🔖 [섹션 2 제목] [00:00]
[하위 주제 1]: 핵심 정보
[하위 주제 2]: 핵심 정보부가 설명 (필요시)

📈 데이터 및 통계
[영상에서 언급된 주요 수치 정보를 시각적으로 구분하여 표 형태로 제시]

📊 비교 분석
항목 | 특징 | 장점 | 단점
[항목 1] | [특징] | [장점] | [단점]
[항목 2] | [특징] | [장점] | [단점]

🔄 실행 과정
1단계: [설명] [00:00]
2단계: [설명] [00:00]
3단계: [설명] [00:00]

💬 인용 및 핵심 문구
"[영상에서 언급된 중요 인용구나 핵심 문구]" [00:00]

📝 용어 해설
용어 1(Term 1): 간결한 설명
용어 2(Term 2): 간결한 설명

🚀 실천 액션 플랜
즉시 실행: [구체적 행동 제안]
단기 적용: [1-2주 내 적용 방안]
장기 통합: [장기적 활용 방안]

🔮 추가 학습 자료
[영상에서 언급된 추가 자료나 연관 주제]

---
URL: ${url}
${transcript ? `스크립트 내용: \n${transcript}` : ''}
`;

        const geminiModel = requestedModel || "gemini-2.5-flash-lite";

        if (transcript) {
          // If we have transcript, summarize the TEXT (much fewer tokens)
          console.log(`Summarizing scraped transcript with Gemini using detailed prompt [Model: ${geminiModel}]...`);
          const result = await ai.models.generateContent({
            model: geminiModel,
            contents: [{ role: 'user', parts: [{ text: detailedPrompt }] }],
          });
          summary = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
        } else {
          // If no transcript, analyze the video URL (fallback, might hit token limit)
          console.log(`No transcript found, analyzing video URL with Gemini using detailed prompt [Model: ${geminiModel}]...`);
          const result = await ai.models.generateContent({
            model: geminiModel,
            contents: [{ role: 'user', parts: [{ text: detailedPrompt }] }],
          });
          summary = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
        }
      } catch (geminiError: any) {
        console.error("Gemini processing failed:", geminiError);
        summary = `### 제미나이 요약 오류\n\n영상 분석 중 오류가 발생했습니다: ${geminiError.message || '알 수 없는 오류'}\n\n스크립트를 가져오지 못했거나 영상이 너무 깁니다.`;
      }
    } else {
      summary = "### 설정 오류\n\nGEMINI_API_KEY가 설정되지 않았습니다. AI 요약을 사용하려면 API 키를 등록해 주세요.";
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

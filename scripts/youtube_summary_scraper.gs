/**
 * YouTube Channel Latest Videos Summary Scraper (Google Apps Script)
 *
 * Instructions:
 * 1. Open Google Apps Script (script.google.com).
 * 2. Create a new project.
 * 3. Paste this code into the editor.
 * 4. Go to Project Settings -> Script Properties -> Add "GEMINI_API_KEY".
 * 5. Run the 'main' function.
 */

function main() {
  const CHANNEL_URL = 'https://m.youtube.com/@understanding./videos';
  const RECIPIENT = 'seokmin.kwon@samsung.com';
  const GEMINI_MODEL = 'gemini-2.5-flash'; // User requested model
  const API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

  if (!API_KEY) {
    throw new Error('Please set GEMINI_API_KEY in Script Properties.');
  }

  try {
    console.log('Fetching latest videos from channel...');
    const videoData = fetchLatestVideos(CHANNEL_URL, 5);

    if (videoData.length === 0) {
      console.log('No videos found.');
      return;
    }

    let emailHtml = `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto;">

    for (const video of videoData) {
      console.log(`Analyzing video: ${video.title}`);
      const summary = getGeminiSummary(video, GEMINI_MODEL, API_KEY);

      emailHtml += `
        <div style="margin-bottom: 40px; border: 1px solid #eee; border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
          <img src="${video.thumbnail}" style="width: 100%; aspect-ratio: 16/9; object-fit: cover;" />
          <div style="padding: 20px;">
            <h2 style="margin: 0 0 10px 0; font-size: 1.2em; color: #111;">${video.title}</h2>
            <div style="font-size: 0.8em; color: #888; margin-bottom: 15px;">
              <a href="${video.url}" target="_blank" style="color: #1978e5; text-decoration: none;">유튜브에서 보기</a>
            </div>
            <div style="padding: 15px; border-radius: 8px;">
              <h3 style="margin-top: 0; font-size: 0.9em; color: #1978e5; text-transform: uppercase;">AI 요약 분석</h3>
              <div style="font-size: 0.95em; white-space: pre-wrap;">${summary}</div>
            </div>
          </div>
        </div>
      `;
    }

    emailHtml += `
      </div>
    `;

    GmailApp.sendEmail(RECIPIENT, `[유튜브 요약] @understanding. 최신 영상 5건`, '', {
      htmlBody: emailHtml
    });

    console.log('Email sent successfully to ' + RECIPIENT);
  } catch (error) {
    console.error('Error in main loop:', error);
  }
}

/**
 * Fetches latest video metadata from the channel URL.
 * YouTube uses dynamic loading, so we scrape the initial state JSON embedded in the HTML.
 */
function fetchLatestVideos(channelUrl, limit) {
  const response = UrlFetchApp.fetch(channelUrl, {
    muteHttpExceptions: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  });

  const html = response.getContentText();
  const jsonRegex = /var ytInitialData = ({.+?});/;
  const match = html.match(jsonRegex);

  if (!match) {
    throw new Error('Failed to extract ytInitialData from YouTube page.');
  }

  const data = JSON.parse(match[1]);
  const videos = [];

  try {
    // Navigate through nested JSON structure for channel video list
    const contents = data.contents.twoColumnBrowseResultsRenderer.tabs
      .find(tab => tab.tabRenderer.title === '동영상' || tab.tabRenderer.title === 'Videos')
      .tabRenderer.content.richGridRenderer.contents;

    for (const content of contents) {
      if (videos.length >= limit) break;

      const videoRenderer = content.richItemRenderer?.content?.videoRenderer;
      if (videoRenderer) {
        const videoId = videoRenderer.videoId;
        videos.push({
          videoId: videoId,
          title: videoRenderer.title.runs[0].text,
          url: 'https://www.youtube.com/watch?v=' + videoId,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
          publishedTime: videoRenderer.publishedTimeText?.simpleText || ''
        });
      }
    }
  } catch (e) {
    console.error('JSON traversal failed:', e);
    throw new Error('Failed to parse YouTube video list structure.');
  }

  return videos;
}

/**
 * Calls Gemini API to summarize the video based on its title.
 */
function getGeminiSummary(video, model, apiKey) {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `
    다음 유튜브 영상의 제목을 보고 어떤 내용일지 분석하여 요약해 주세요.
    영상 제목: ${video.title}

    - 핵심 내용을 3가지 포인트로 정리해 주세요.
    - 한국어로 답변해 주세요.
    - 마크다운 형식을 사용하지 말고 순수 텍스트로만 답변해 주세요.
  `;

  const payload = {
    contents: [{
      parts: [{ text: prompt }]
    }]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const result = JSON.parse(response.getContentText());

  if (response.getResponseCode() !== 200) {
    return `[Gemini Error] ${result.error?.message || 'Failed to generate summary'}`;
  }

  return result.candidates[0].content.parts[0].text;
}

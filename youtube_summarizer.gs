/**
 * Summarizes a YouTube video using Gemini API.
 *
 * @param {string} videoUrl The URL of the YouTube video.
 * @param {string} apiKey Your Google Gemini API Key.
 * @return {string} The summary of the video.
 */
async function summarizeYouTubeVideo(videoUrl, apiKey) {
  const modelId = "gemini-2.5-flash-lite";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  const payload = {
    "contents": [
      {
        "parts": [
          {
            "file_data": {
              "file_uri": videoUrl,
              "mime_type": "video/mp4"
            }
          },
          {
            "text": "이 유튜브 영상의 내용을 상세하게 요약해 주세요. 한국어로 답변해 주세요."
          }
        ]
      }
    ]
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates.length > 0) {
      return result.candidates[0].content.parts[0].text;
    } else {
      return "요약을 생성할 수 없습니다: " + response.getContentText();
    }
  } catch (e) {
    return "오류 발생: " + e.toString();
  }
}

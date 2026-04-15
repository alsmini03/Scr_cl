/**
 * Market Report Latest PDF Summary Scraper (Google Apps Script)
 *
 * Instructions:
 * 1. Open Google Apps Script (script.google.com).
 * 2. Create a new project.
 * 3. Paste this code into the editor.
 * 4. Go to Project Settings -> Script Properties -> Add "GEMINI_API_KEY".
 * 5. Run the 'main' function.
 */

function main() {
  // Target report category (Bond/Macro by default)
  const SOURCE_URL = 'https://www.bondweb.co.kr/MOA/Board/ResearchCenterV2/PrimeSub04.asp?SubDiv=Sub400';
  const RECIPIENT = 'seokmin.kwon@samsung.com';
  const GEMINI_MODEL = 'gemini-1.5-flash';
  const API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

  if (!API_KEY) {
    throw new Error('Please set GEMINI_API_KEY in Script Properties.');
  }

  try {
    console.log('Fetching latest reports from Bondweb...');
    const reports = fetchLatestReports(SOURCE_URL, 3); // Top 3 reports

    if (reports.length === 0) {
      console.log('No reports found.');
      return;
    }

    let emailHtml = `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto;">
        <meta name="referrer" content="no-referrer">
    `;

    for (let i = 0; i < reports.length; i++) {
      const report = reports[i];
      console.log(`Analyzing report [${i+1}/${reports.length}]: ${report.title}`);

      const pdfBlob = fetchPdfBlob(report);
      let summary = "PDF를 가져올 수 없거나 분석에 실패했습니다.";

      if (pdfBlob) {
        summary = getGeminiPdfSummary(pdfBlob, report.title, GEMINI_MODEL, API_KEY);
      }

      emailHtml += `
        <div style="margin-bottom: 40px; border: 1px solid #eee; border-radius: 12px; overflow: hidden; background: #fff;">
          <div style="background: #f8fafc; padding: 15px 20px; border-bottom: 1px solid #eee;">
            <span style="display: inline-block; background: #6366f1; color: #fff; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; margin-bottom: 8px;">REPORT</span>
            <h2 style="margin: 0; font-size: 18px; color: #111;">${report.title}</h2>
          </div>
          <div style="padding: 20px;">
            <p style="margin: 0 0 10px 0; font-size: 13px; color: #666;">
              <b>기관:</b> ${report.institution || '-'} | <b>작성자:</b> ${report.author || '-'} | <b>날짜:</b> ${report.date || '-'}
            </p>
            <div style="padding: 15px; border-radius: 8px;">
              <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1978e5;">AI 리포트 분석</h3>
              <div style="font-size: 14px; color: #444; line-height: 1.6; white-space: pre-wrap;">${summary}</div>
            </div>
          </div>
        </div>
      `;
    }

    emailHtml += `
      </div>
    `;

    GmailApp.sendEmail(RECIPIENT, `[시장 리포트 요약] ${reports[0].title} 외 ${reports.length-1}건`, '', {
      htmlBody: emailHtml
    });

    console.log('Email sent successfully to ' + RECIPIENT);
  } catch (error) {
    console.error('Error in main loop:', error);
  }
}

/**
 * Fetches latest report list from Bondweb.
 */
function fetchLatestReports(url, limit) {
  const response = UrlFetchApp.fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  // Extract configuration parameters from the page
  const html = response.getContentText("EUC-KR");
  const selMnuT = html.match(/id="selMnuT" value="([^"]*)"/)?.[1] || '1^1^1^1^1^1^1^0^0^0^0';
  const selMnuB = html.match(/id="selMnuB" value="([^"]*)"/)?.[1] || '1^1^1^1^1';
  const nwMnu = url.match(/SubDiv=Sub(\d+)/)?.[1]?.substring(0, 2) || '04';

  // Request the actual data via AJAX
  const ajaxUrl = 'https://www.bondweb.co.kr/MOA/Board/ResearchCenterV2/AjaxPrimeListHotClickSub.asp';
  const payload = {
    'selMnuT': selMnuT,
    'selMnuB': selMnuB,
    'lstNumN': '0',
    'lstNumO': '0',
    'actNum': '0',
    'srhItem': 'nIdSjt',
    'NWMnu': nwMnu,
    'HotClick': '1',
    'HotClickSearchDate': '0'
  };

  const ajaxResponse = UrlFetchApp.fetch(ajaxUrl, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: payload,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  const ajaxHtml = ajaxResponse.getContentText("EUC-KR");
  const reports = [];
  const trRegex = /<tr id="nTr_(\d+)">([\s\S]*?)<\/tr>/g;
  let match;

  while ((match = trRegex.exec(ajaxHtml)) !== null && reports.length < limit) {
    const content = match[2];

    const titleMatch = /shwCttFrame\('[^']*',(\d+),'([^']*)',event\);">(.*?)<\/a>/.exec(content);
    const authorMatch = /fnMenuSearch\('nIdWrt','([^']*)'\);/.exec(content);
    const instMatch = /fnMenuSearch\('nIdSrc','([^']*)'\);/.exec(content);
    const fileMatch = /getFileDown\((\d+), (\d+)\)/.exec(content) || /getFileDown_\('(\d+)', (\d+)\)/.exec(content);
    const dateMatch = /name="nIdDte">([\s\S]*?)<\/div>/.exec(content);

    if (titleMatch && fileMatch) {
      reports.push({
        title: titleMatch[3].trim(),
        author: authorMatch ? authorMatch[1] : '',
        institution: instMatch ? instMatch[1] : '',
        date: dateMatch ? dateMatch[1].trim() : '',
        fileId: fileMatch[1],
        fileNum: fileMatch[2]
      });
    }
  }

  return reports;
}

/**
 * Resolves and fetches the PDF blob from Bondweb.
 */
function fetchPdfBlob(report) {
  const endpoints = [
    'https://www.bondweb.co.kr/MOA/Board/ResearchCenterV2/DownloadPage.asp',
    'https://www.bondweb.co.kr/prime_web/menu01/research/DownloadPage.asp'
  ];

  for (const downloadUrl of endpoints) {
    try {
      const payload = {
        'number': report.fileId,
        'gn': report.fileNum
      };

      // 1. Get the download location (usually a redirect)
      const response = UrlFetchApp.fetch(downloadUrl, {
        method: 'post',
        payload: payload,
        followRedirects: false,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      let pdfUrl = response.getHeaders()['Location'];

      if (!pdfUrl) {
        // Sometimes it's direct or in content-disposition
        const cd = response.getHeaders()['Content-Disposition'];
        if (cd && cd.includes('filename=')) {
          const filename = cd.split('filename=')[1].trim().replace(/['"]/g, '');
          if (filename.startsWith('/Data/')) {
            pdfUrl = 'https://www.bondweb.co.kr' + filename;
          }
        }
      }

      if (pdfUrl) {
        if (!pdfUrl.startsWith('http')) pdfUrl = 'https://www.bondweb.co.kr' + pdfUrl;

        // 2. Fetch the actual PDF
        const pdfResponse = UrlFetchApp.fetch(pdfUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (pdfResponse.getResponseCode() === 200) {
          return pdfResponse.getBlob();
        }
      }
    } catch (e) {
      console.warn(`Failed endpoint ${downloadUrl}: ${e.message}`);
    }
  }

  console.error(`Failed to fetch PDF for ${report.title} from all endpoints`);
  return null;
}

/**
 * Calls Gemini API with the PDF blob for analysis.
 */
function getGeminiPdfSummary(pdfBlob, title, model, apiKey) {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const base64Pdf = Utilities.base64Encode(pdfBlob.getBytes());

  const prompt = `
    첨부된 시장 리포트 PDF를 읽고 다음 내용을 요약 분석해 주세요.
    리포트 제목: ${title}

    - 리포트의 핵심 주장 3가지를 정리해 주세요.
    - 주요 수치나 지표가 있다면 포함해 주세요.
    - 한국어로 답변해 주세요.
    - 마크다운 형식을 사용하지 말고 순수 텍스트로만 답변해 주세요.
  `;

  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: "application/pdf",
            data: base64Pdf
          }
        }
      ]
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

  try {
    return result.candidates[0].content.parts[0].text;
  } catch (e) {
    return "요약을 생성할 수 없습니다.";
  }
}

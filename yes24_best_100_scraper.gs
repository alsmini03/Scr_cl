/**
 * Yes24 종합 베스트 100 정보를 실시간으로 추출하여 구글 시트에 기록합니다.
 */

function fetchYes24Best100() {
  const url = "https://m.yes24.com/home/best?dispNo=001&tab=1&pageNo=1&pageSize=100";

  const response = UrlFetchApp.fetch(url, {
    "headers": {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
    }
  });

  const html = response.getContentText();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const itemBlocks = html.split('class="itemUnit').slice(1);

  if (itemBlocks.length === 0) return;

  sheet.clear();
  sheet.appendRow(["순위", "표지 사진", "제목", "저자", "출판사", "가격", "발행일자"]);

  const results = itemBlocks.map((block, index) => {
    const rank = index + 1;
    const coverUrl = (block.match(/data-original="([^"]+)"/) || ["", ""])[1];

    // 제목 정제
    let titleRaw = (block.match(/info_name">([\s\S]*?)<\/div>/) || ["", "제목 정보 없음"])[1];
    let title = titleRaw
      .replace(/<[^>]+>/g, "")
      .replace("[도서]", "")
      .replace(/[\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (title.includes("]")) title = title.split("]")[0].trim();

    const author = (block.match(/class="auth">([^<]+)<\/span>/) || ["", "저자 미상"])[1].trim();
    const publisher = (block.match(/info_pub">([^<]+)<\/span>/) || ["", "출판사 미상"])[1].trim();
    const date = (block.match(/info_date">([^<]+)<\/span>/) || ["", ""])[1].trim();
    const price = ((block.match(/yes_m">([^<]+)<\/em>/) || ["", ""])[1] || "").trim() + "원";

    return [rank, coverUrl ? `=IMAGE("${coverUrl}")` : "", title, author, publisher, price, date];
  });

  sheet.getRange(2, 1, results.length, 7).setValues(results);
  sheet.setRowHeights(2, results.length, 100);
  sheet.getRange(1, 1, 1, 7).setBackground("#1978e5").setFontColor("white").setFontWeight("bold");
}

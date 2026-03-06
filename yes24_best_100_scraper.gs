/**
 * Yes24 종합 베스트 100 정보를 실시간으로 추출하여 구글 시트에 기록합니다.
 *
 * 사용 방법:
 * 1. 구글 스프레드시트 생성
 * 2. 확장 프로그램 > Apps Script 클릭
 * 3. 이 코드 전체를 붙여넣고 저장
 * 4. 시트 새로고침 후 상단 '📊 도서 도구' 메뉴에서 실행
 */

function fetchYes24Best100() {
  const url = "https://m.yes24.com/home/best?dispNo=001&tab=1&pageNo=1&pageSize=100";

  // 1. 페이지 데이터 가져오기 (모바일 User-Agent 설정)
  const response = UrlFetchApp.fetch(url, {
    "headers": {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
    },
    "muteHttpExceptions": true
  });

  const html = response.getContentText();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // 2. 시트 초기화 및 제목행 설정
  sheet.clear();
  const headers = ["순위", "표지 사진", "제목", "저자", "출판사", "가격", "발행일자"];
  sheet.appendRow(headers);

  // 헤더 스타일 (파란색 배경, 흰색 글자)
  sheet.getRange(1, 1, 1, 7)
       .setBackground("#1978e5")
       .setFontColor("white")
       .setFontWeight("bold")
       .setHorizontalAlignment("center");

  // 3. 도서 항목별 데이터 추출 (Robust split approach)
  // Yes24 모바일은 각 도서가 class="itemUnit 으로 시작합니다.
  const itemBlocks = html.split('class="itemUnit').slice(1);

  if (itemBlocks.length === 0) {
    SpreadsheetApp.getUi().alert("데이터를 찾을 수 없습니다. 페이지 구조를 확인해 주세요.");
    return;
  }

  const results = [];

  itemBlocks.forEach((block, index) => {
    const rank = index + 1;

    // A. 표지 사진 (data-original 속성의 고화질 URL 추출)
    const coverMatch = block.match(/data-original="([^"]+)"/);
    const coverUrl = coverMatch ? coverMatch[1] : "";

    // B. 제목 (태그 제거 및 '[도서]' 머리말 삭제)
    let titleMatch = block.match(/info_name">([\s\S]*?)<\/div>/);
    let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").replace("[도서]", "").trim() : "제목 정보 없음";

    // C. 저자
    const authorMatch = block.match(/class="auth">([^<]+)<\/span>/);
    const author = authorMatch ? authorMatch[1].trim() : "저자 미상";

    // D. 출판사
    const pubMatch = block.match(/info_pub">([^<]+)<\/span>/);
    const publisher = pubMatch ? pubMatch[1].trim() : "출판사 미상";

    // E. 발행일자
    const dateMatch = block.match(/info_date">([^<]+)<\/span>/);
    const publishDate = dateMatch ? dateMatch[1].trim() : "";

    // F. 가격 (숫자 부분만 추출 후 '원' 추가)
    const priceMatch = block.match(/yes_m">([^<]+)<\/em>/);
    const price = priceMatch ? priceMatch[1].trim() + "원" : "";

    // 표지 사진 시각화 (구글 시트의 IMAGE 함수 사용)
    const coverFormula = coverUrl ? `=IMAGE("${coverUrl}")` : "";

    results.push([rank, coverFormula, title, author, publisher, price, publishDate]);
  });

  // 4. 시트에 데이터 일괄 쓰기
  if (results.length > 0) {
    sheet.getRange(2, 1, results.length, 7).setValues(results);
  }

  // 5. 서식 조정
  sheet.setRowHeights(2, results.length, 110);
  sheet.setColumnWidth(1, 50);
  sheet.setColumnWidth(2, 90);
  sheet.setColumnWidth(3, 300);
  sheet.setColumnWidth(4, 150);
  sheet.setColumnWidth(5, 120);
  sheet.setColumnWidth(6, 100);
  sheet.setColumnWidth(7, 120);

  sheet.getRange(2, 1, results.length, 7).setVerticalAlignment("middle");
  sheet.getRange(2, 1, results.length, 1).setHorizontalAlignment("center");
  sheet.getRange(2, 4, results.length, 4).setHorizontalAlignment("center");

  SpreadsheetApp.getUi().alert("성공적으로 " + results.length + "권의 정보를 가져왔습니다!");
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('📊 도서 도구')
      .addItem('Yes24 베스트 100 가져오기', 'fetchYes24Best100')
      .addToUi();
}

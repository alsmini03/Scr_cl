/**
 * Yes24 종합 베스트 100 정보를 바탕으로 구글 문서(Google Docs) 리포트를 생성합니다.
 *
 * 사용 방법:
 * 1. 구글 스프레드시트 또는 독립형 Apps Script 프로젝트 생성
 * 2. 이 코드 전체를 붙여넣고 저장
 * 3. fetchAndCreateBookDoc() 함수 실행
 * 4. 내 구글 드라이브에 'Yes24 베스트셀러 리포트 (날짜)' 파일이 생성됩니다.
 */

function fetchAndCreateBookDoc() {
  const url = "https://m.yes24.com/home/best?dispNo=001&tab=1&pageNo=1&pageSize=100";

  // 1. 데이터 가져오기
  const response = UrlFetchApp.fetch(url, {
    "headers": {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
    },
    "muteHttpExceptions": true
  });

  const html = response.getContentText();

  // 개선된 블록 추출 방식: itemUnit 클래스를 기준으로 나눕니다.
  const itemBlocks = html.split('class="itemUnit').slice(1);

  if (itemBlocks.length === 0) {
    Logger.log("데이터를 찾을 수 없습니다.");
    return;
  }

  // 2. 새 구글 문서 생성
  const today = Utilities.formatDate(new Date(), "GMT+9", "yyyy-MM-dd");
  const doc = DocumentApp.create('Yes24 종합 베스트셀러 100 리포트 (' + today + ')');
  const body = doc.getBody();

  // 3. 제목 및 서식 설정
  body.insertParagraph(0, 'Yes24 종합 베스트셀러 100 리포트')
      .setHeading(DocumentApp.ParagraphHeading.TITLE)
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph('생성일: ' + today)
      .setAlignment(DocumentApp.HorizontalAlignment.RIGHT)
      .setItalic(true);

  body.appendHorizontalRule();

  // 4. 도서 정보 추가
  itemBlocks.forEach((block, index) => {
    const rank = index + 1;

    // 데이터 추출
    const coverMatch = block.match(/data-original="([^"]+)"/);
    const coverUrl = coverMatch ? coverMatch[1] : "";

    let titleMatch = block.match(/info_name">([\s\S]*?)<\/div>/);
    let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").replace("[도서]", "").trim() : "제목 정보 없음";

    const authorMatch = block.match(/class="auth">([^<]+)<\/span>/);
    const author = authorMatch ? authorMatch[1].trim() : "저자 미상";

    const pubMatch = block.match(/info_pub">([^<]+)<\/span>/);
    const publisher = pubMatch ? pubMatch[1].trim() : "출판사 미상";

    const dateMatch = block.match(/info_date">([^<]+)<\/span>/);
    const publishDate = dateMatch ? dateMatch[1].trim() : "";

    const priceMatch = block.match(/yes_m">([^<]+)<\/em>/);
    const price = priceMatch ? priceMatch[1].trim() + "원" : "";

    // 문서에 삽입 (제목)
    const sectionTitle = body.appendParagraph(rank + '. ' + title);
    sectionTitle.setHeading(DocumentApp.ParagraphHeading.HEADING1).setSpacingBefore(30);

    // 표지 이미지 삽입 (PositionedImage 사용)
    if (coverUrl) {
      try {
        const resp = UrlFetchApp.fetch(coverUrl);
        const imgBlob = resp.getBlob();

        // 문단에 PositionedImage 추가
        const imgPara = body.appendParagraph("");
        const img = imgPara.addPositionedImage(imgBlob);

        // 이미지 크기 및 우측 레이아웃 조정
        const width = 90;
        const height = (img.getHeight() / img.getWidth()) * width;

        img.setWidth(width)
           .setHeight(height)
           .setLayout(DocumentApp.PositionedLayout.WRAP_TEXT)
           .setLeftOffset(360)
           .setTopOffset(0);

      } catch (e) {
        body.appendParagraph('[이미지 로드 실패]');
      }
    }

    const details = [
      '저자: ' + author,
      '출판사: ' + publisher,
      '발행일: ' + publishDate,
      '판매가: ' + price
    ].join('\n');

    const detailPara = body.appendParagraph(details);
    detailPara.setSpacingAfter(20);

    body.appendHorizontalRule();
  });

  // 5. 완료 알림
  const url_doc = doc.getUrl();
  Logger.log('문서 생성이 완료되었습니다: ' + url_doc);

  if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getUi()) {
    const htmlOutput = HtmlService.createHtmlOutput(
      '<p>구글 문서 리포트 생성이 완료되었습니다!</p><a href="' + url_doc + '" target="_blank">문서 열기</a>'
    ).setWidth(300).setHeight(100);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, '완료');
  }
}

/**
 * 메뉴 생성 (스프레드시트에서 사용 시)
 */
function onOpen() {
  if (typeof SpreadsheetApp !== 'undefined') {
    SpreadsheetApp.getUi().createMenu('📊 도서 도구')
        .addItem('Yes24 베스트 100 가져오기 (시트)', 'fetchYes24Best100')
        .addItem('구글 문서 리포트 생성 (Docs)', 'fetchAndCreateBookDoc')
        .addToUi();
  }
}

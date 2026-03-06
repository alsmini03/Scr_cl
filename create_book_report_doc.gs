/**
 * Yes24 종합 베스트 100 정보를 바탕으로 구글 문서(Google Docs) 리포트를 생성합니다.
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

    // 제목 정제 로직 강화
    let titleMatch = block.match(/info_name">([\s\S]*?)<\/div>/);
    let title = "제목 정보 없음";
    if (titleMatch) {
      title = titleMatch[1]
        .replace(/<[^>]+>/g, "")    // 태그 제거
        .replace("[도서]", "")       // 머리말 제거
        .replace(/[\n\r\t]/g, " ")  // 줄바꿈 제거
        .replace(/\s+/g, " ")       // 중복 공백 제거
        .trim();

      // 제목 내에 불필요하게 긴 설명(괴테 사례 등)이 대괄호로 묶여 있는 경우 처리
      if (title.includes("]")) {
        title = title.split("]")[0].trim();
      }
    }

    const authorMatch = block.match(/class="auth">([^<]+)<\/span>/);
    const author = authorMatch ? authorMatch[1].trim() : "저자 미상";

    const pubMatch = block.match(/info_pub">([^<]+)<\/span>/);
    const publisher = pubMatch ? pubMatch[1].trim() : "출판사 미상";

    const dateMatch = block.match(/info_date">([^<]+)<\/span>/);
    const publishDate = dateMatch ? dateMatch[1].trim() : "";

    const priceMatch = block.match(/yes_m">([^<]+)<\/em>/);
    const price = priceMatch ? priceMatch[1].trim() + "원" : "";

    // 문서에 삽입
    const sectionTitle = body.appendParagraph(rank + '. ' + title);
    sectionTitle.setHeading(DocumentApp.ParagraphHeading.HEADING1).setSpacingBefore(30);

    // 표지 이미지 삽입 (PositionedImage)
    if (coverUrl) {
      try {
        const resp = UrlFetchApp.fetch(coverUrl);
        const imgBlob = resp.getBlob();
        const imgPara = body.appendParagraph("");
        const img = imgPara.addPositionedImage(imgBlob);

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

    body.appendParagraph(details).setSpacingAfter(20);
    body.appendHorizontalRule();
  });

  Logger.log('문서 생성 완료: ' + doc.getUrl());
}

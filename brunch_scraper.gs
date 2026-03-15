/**
 * 브런치 블로그 스크래퍼 (Google Apps Script용)
 *
 * 주요 기능:
 * 1. 브런치 프로필 URL에서 RSS 주소 탐색 및 글 목록 추출
 * 2. 개별 글 URL에서 제목, 작성자, 작성일, 본문 추출
 */

/**
 * 브런치 프로필에서 최근 글 목록을 가져옵니다.
 * @param {string} profileUrl 브런치 프로필 주소 (예: https://brunch.co.kr/@socandy)
 * @return {Array} 글 목록 객체 배열
 */
function getBrunchPosts(profileUrl) {
  try {
    // 1. 프로필 페이지 소스 가져오기
    const response = UrlFetchApp.fetch(profileUrl, {
      headers: { "User-Agent": "facebookexternalhit/1.1" },
      muteHttpExceptions: true
    });
    const html = response.getContentText();

    // 2. RSS 주소 또는 userId 추출
    // RSS 링크 태그 찾기: <link rel="alternate" type="application/rss+xml" ... href="RSS_URL">
    let rssUrl = "";
    const rssMatch = html.match(/link[^>]+type="application\/rss\+xml"[^>]+href="([^"]+)"/);
    if (rssMatch) {
      rssUrl = rssMatch[1];
    } else {
      // userId 찾기: "userId":"UQ9"
      const userMatch = html.match(/"userId":\[[01],"([^"]+)"\]/);
      if (userMatch) {
        rssUrl = "https://brunch.co.kr/rss/@@" + userMatch[1];
      }
    }

    if (!rssUrl) throw new Error("RSS 주소를 찾을 수 없습니다.");

    // 3. RSS 피드 파싱
    const rssResponse = UrlFetchApp.fetch(rssUrl);
    const xml = rssResponse.getContentText();
    const document = XmlService.parse(xml);
    const root = document.getRootElement();
    const channel = root.getChild('channel');
    const items = channel.getChildren('item');

    const posts = items.map(item => {
      const title = item.getChildText('title');
      const link = item.getChildText('link');
      const pubDate = item.getChildText('pubDate');
      const description = item.getChildText('description');

      // 이미지 추출 (description 내 <img> 태그)
      let thumbnail = null;
      const imgMatch = description.match(/<img[^>]+src\s*=\s*"([^">]+)"/);
      if (imgMatch) thumbnail = imgMatch[1];

      return {
        title: title,
        url: link,
        publishedAt: pubDate,
        thumbnail: thumbnail
      };
    });

    return posts;
  } catch (e) {
    Logger.log("Error in getBrunchPosts: " + e.message);
    return [];
  }
}

/**
 * 개별 브런치 글의 상세 내용을 가져옵니다.
 * @param {string} postUrl 브런치 글 주소 (예: https://brunch.co.kr/@socandy/52)
 * @return {Object} 글 상세 정보 객체
 */
function getBrunchContent(postUrl) {
  try {
    const response = UrlFetchApp.fetch(postUrl, {
      headers: { "User-Agent": "facebookexternalhit/1.1" },
      muteHttpExceptions: true
    });
    const html = response.getContentText();

    // 제목 추출 (OG tag 우선)
    let title = "";
    const titleMatch = html.match(/meta property="og:title" content="([^"]+)"/);
    title = titleMatch ? titleMatch[1] : "";

    // 작성자 추출
    let author = "";
    const authorMatch = html.match(/meta name="author" content="([^"]+)"/);
    author = authorMatch ? authorMatch[1] : "";

    // 발행일 추출
    let date = "";
    const dateMatch = html.match(/meta property="article:published_time" content="([^"]+)"/);
    date = dateMatch ? dateMatch[1] : "";

    // 본문 추출 (단순 텍스트 및 이미지 마크다운 변환)
    // <div class="wrap_body">...</div> 사이의 내용 추출
    let content = "";
    const bodyStart = html.indexOf('class="wrap_body"');
    if (bodyStart !== -1) {
      const bodyEnd = html.indexOf('</div>', bodyStart);
      let bodyHtml = html.substring(bodyStart, bodyEnd);

      // <p>, <h4> 태그에서 텍스트 추출 및 <img> 태그 처리
      // 정규식을 이용한 간단한 처리 (실제 환경에 따라 보정이 필요할 수 있음)
      const parts = bodyHtml.match(/<(p|h4|img)[^>]*>.*?<\/\1>|<img[^>]*>/g) || [];

      parts.forEach(part => {
        if (part.startsWith('<img')) {
          const srcMatch = part.match(/src="([^"]+)"/);
          if (srcMatch) {
            let src = srcMatch[1];
            if (src.startsWith('//')) src = 'https:' + src;
            content += '![image](' + src + ')\n\n';
          }
        } else {
          // 태그 제거 후 텍스트만 추출
          const text = part.replace(/<[^>]+>/g, '').trim();
          if (text) content += text + '\n\n';
        }
      });
    }

    return {
      title: title,
      author: author,
      publishedAt: date,
      content: content.trim(),
      url: postUrl
    };
  } catch (e) {
    Logger.log("Error in getBrunchContent: " + e.message);
    return null;
  }
}

/**
 * 사용 예제: 스프레드시트에 실행 결과 기록
 */
function testBrunchScraper() {
  const profileUrl = "https://brunch.co.kr/@socandy";
  const posts = getBrunchPosts(profileUrl);

  if (posts.length > 0) {
    Logger.log("최신 글 제목: " + posts[0].title);

    // 첫 번째 글의 상세 내용 가져오기
    const detail = getBrunchContent(posts[0].url);
    if (detail) {
      Logger.log("본문 글자 수: " + detail.content.length);
      // Logger.log("본문 내용: " + detail.content);
    }
  } else {
    Logger.log("글 목록을 가져오지 못했습니다.");
  }
}

/**
 * 통합 블로그 스크래퍼 (Google Apps Script용)
 *
 * 지원 플랫폼: 네이버 블로그, 티스토리, 브런치
 * 기능:
 * 1. 글 목록 가져오기 (RSS 및 크롤링)
 * 2. 글 상세 내용 추출 (제목, 작성자, 작성일, 본문 마크다운)
 */

var BlogScraper = (function() {

  var USER_AGENT = "facebookexternalhit/1.1"; // 브런치 등에서 차단을 피하기 위해 사용

  /**
   * 블로그 타입 감지
   */
  function _detectType(url) {
    if (url.indexOf("blog.naver.com") !== -1) return "NAVER";
    if (url.indexOf("tistory.com") !== -1) return "TISTORY";
    if (url.indexOf("brunch.co.kr") !== -1) return "BRUNCH";
    return "UNKNOWN";
  }

  /**
   * HTML에서 특정 태그의 텍스트나 속성 추출 (간이 구현)
   */
  function _extractMeta(html, property) {
    var regex = new RegExp('<meta[^>]+(?:property|name)="' + property + '"[^>]+content="([^"]+)"', 'i');
    var match = html.match(regex);
    if (!match) {
      regex = new RegExp('<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="' + property + '"', 'i');
      match = html.match(regex);
    }
    return match ? match[1] : null;
  }

  /**
   * [목록] 네이버 블로그 글 목록 (RSS 활용)
   */
  function _listNaver(blogUrl) {
    var blogId = blogUrl.match(/blogId=([^&]+)/) ? blogUrl.match(/blogId=([^&]+)/)[1] : blogUrl.split('/').pop();
    var rssUrl = "https://rss.blog.naver.com/" + blogId + ".xml";
    var response = UrlFetchApp.fetch(rssUrl);
    var xml = response.getContentText();
    var document = XmlService.parse(xml);
    var root = document.getRootElement();
    var items = root.getChild('channel').getChildren('item');

    return items.map(function(item) {
      return {
        title: item.getChildText('title'),
        url: item.getChildText('link'),
        publishedAt: item.getChildText('pubDate'),
        author: root.getChild('channel').getChildText('title')
      };
    });
  }

  /**
   * [목록] 티스토리 글 목록 (RSS 또는 카테고리 크롤링)
   */
  function _listTistory(url) {
    if (url.indexOf('/category/') !== -1) {
      // 카테고리 크롤링 (간이 구현 - 실제로는 각 글을 fetch하여 메타데이터 보정 필요)
      var response = UrlFetchApp.fetch(url, { headers: { "User-Agent": USER_AGENT } });
      var html = response.getContentText();
      var posts = [];
      var regex = /https?:\/\/[^/]+\.tistory\.com\/m\/entry\/[^"]+/g;
      var matches = html.match(regex) || [];
      var uniqueLinks = Array.from(new Set(matches));

      return uniqueLinks.map(function(link) {
        return { url: link, title: "Tistory Post (Extract to see details)" };
      });
    } else {
      var blogId = url.match(/https?:\/\/([^.]+)\.tistory\.com/)[1];
      var rssUrl = "https://" + blogId + ".tistory.com/rss";
      var response = UrlFetchApp.fetch(rssUrl);
      var xml = response.getContentText();
      var document = XmlService.parse(xml);
      var channel = document.getRootElement().getChild('channel');
      var items = channel.getChildren('item');

      return items.map(function(item) {
        return {
          title: item.getChildText('title'),
          url: item.getChildText('link'),
          publishedAt: item.getChildText('pubDate'),
          author: item.getChildText('author') || channel.getChildText('title')
        };
      });
    }
  }

  /**
   * [목록] 브런치 글 목록 (RSS 탐색 및 파싱)
   */
  function _listBrunch(url) {
    var response = UrlFetchApp.fetch(url, { headers: { "User-Agent": USER_AGENT } });
    var html = response.getContentText();

    var rssUrl = "";
    var rssMatch = html.match(/link[^>]+type="application\/rss\+xml"[^>]+href="([^"]+)"/);
    if (rssMatch) {
      rssUrl = rssMatch[1];
    } else {
      var userMatch = html.match(/"userId":\[[01],"([^"]+)"\]/);
      if (userMatch) rssUrl = "https://brunch.co.kr/rss/@@" + userMatch[1];
    }

    if (!rssUrl) return [];

    var rssRes = UrlFetchApp.fetch(rssUrl);
    var xml = rssRes.getContentText();
    var document = XmlService.parse(xml);
    var channel = document.getRootElement().getChild('channel');
    var items = channel.getChildren('item');

    return items.map(function(item) {
      return {
        title: item.getChildText('title'),
        url: item.getChildText('link'),
        publishedAt: item.getChildText('pubDate'),
        author: channel.getChildText('title')
      };
    });
  }

  /**
   * [상세] 네이버 블로그 내용 추출
   */
  function _extractNaver(url) {
    // 모바일 주소로 변환
    if (url.indexOf("m.blog.naver.com") === -1) {
      url = url.replace("blog.naver.com", "m.blog.naver.com");
    }

    var response = UrlFetchApp.fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1" } });
    var html = response.getContentText();

    var title = _extractMeta(html, "og:title") || "";
    title = title.replace(/\s*:\s*네이버\s*블로그$/, "");

    var author = null;
    var authorMatch = html.match(/"authorNickname":"(.*?)"/);
    if (authorMatch) author = authorMatch[1];

    var date = _extractMeta(html, "og:regDate") || "";

    // 본문 추출 (se-main-container 내의 텍스트와 이미지)
    var content = "";
    var contentMatch = html.match(/<div[^>]+class="se-main-container"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
    if (contentMatch) {
      var body = contentMatch[1];
      // 이미지 추출 및 마크다운 변환
      body = body.replace(/<img[^>]+data-lazy-src="([^">?]+)[^>]*>/g, function(m, src) {
        return "\n![image](" + src + "?type=w800)\n";
      });
      // 텍스트 정제
      content = body.replace(/<[^>]+>/g, "\n").replace(/\n+/g, "\n\n").trim();
    }

    return { title: title, author: author, date: date, content: content, url: url };
  }

  /**
   * [상세] 티스토리 내용 추출
   */
  function _extractTistory(url) {
    if (url.indexOf("/m/") === -1 && url.indexOf("tistory.com/m") === -1) {
      var parts = url.split('/');
      var last = parts.pop();
      url = parts.join('/') + '/m/' + last;
    }

    var response = UrlFetchApp.fetch(url, { headers: { "User-Agent": USER_AGENT } });
    var html = response.getContentText();

    var title = _extractMeta(html, "og:title") || "";
    var author = null;
    var authorMatch = html.match(/"authorNickname":"(.*?)"/);
    if (authorMatch) author = authorMatch[1];

    var date = _extractMeta(html, "article:published_time") || "";

    var content = "";
    var bodyMatch = html.match(/<div[^>]+class="blogview_content"[^>]*>([\s\S]*?)<\/div>/);
    if (bodyMatch) {
      content = bodyMatch[1].replace(/<img[^>]+src="([^">]+)"[^>]*>/g, "\n![image]($1)\n")
                            .replace(/<[^>]+>/g, "\n").replace(/\n+/g, "\n\n").trim();
    }

    return { title: title, author: author, date: date, content: content, url: url };
  }

  /**
   * [상세] 브런치 내용 추출
   */
  function _extractBrunch(url) {
    var response = UrlFetchApp.fetch(url, { headers: { "User-Agent": USER_AGENT } });
    var html = response.getContentText();

    var title = _extractMeta(html, "og:title") || "";
    var author = _extractMeta(html, "author") || "";
    var date = _extractMeta(html, "article:published_time") || "";

    var content = "";
    var bodyMatch = html.match(/<div[^>]+class="wrap_body"[^>]*>([\s\S]*?)<\/div>/);
    if (bodyMatch) {
      content = bodyMatch[1].replace(/<img[^>]+src="([^">]+)"[^>]*>/g, function(m, src) {
        if (src.indexOf('//') === 0) src = 'https:' + src;
        return "\n![image](" + src + ")\n";
      }).replace(/<[^>]+>/g, "\n").replace(/\n+/g, "\n\n").trim();
    }

    return { title: title, author: author, date: date, content: content, url: url };
  }

  return {
    /**
     * 블로그 글 목록 가져오기
     * @param {string} url 블로그 홈 또는 카테고리 주소
     */
    list: function(url) {
      var type = _detectType(url);
      switch(type) {
        case "NAVER": return _listNaver(url);
        case "TISTORY": return _listTistory(url);
        case "BRUNCH": return _listBrunch(url);
        default: throw new Error("지원하지 않는 블로그 플랫폼입니다.");
      }
    },

    /**
     * 글 내용 추출하기
     * @param {string} url 개별 글 주소
     */
    extract: function(url) {
      var type = _detectType(url);
      switch(type) {
        case "NAVER": return _extractNaver(url);
        case "TISTORY": return _extractTistory(url);
        case "BRUNCH": return _extractBrunch(url);
        default: throw new Error("지원하지 않는 블로그 플랫폼입니다.");
      }
    }
  };
})();

/**
 * 사용 예제
 */
function testScraper() {
  // 1. 목록 테스트 (네이버)
  var naverPosts = BlogScraper.list("https://blog.naver.com/totcar");
  Logger.log("네이버 글 수: " + naverPosts.length);

  // 2. 상세 테스트 (네이버)
  if (naverPosts.length > 0) {
    var detail = BlogScraper.extract(naverPosts[0].url);
    Logger.log("제목: " + detail.title);
    Logger.log("작성자: " + detail.author);
    Logger.log("작성일: " + detail.date);
    // Logger.log("내용: " + detail.content.substring(0, 100));
  }

  // 3. 티스토리 카테고리 테스트
  var tistoryPosts = BlogScraper.list("https://goodfortune.tistory.com/m/category/%EC%83%81%EC%8B%9D%EA%B3%BC%20%EC%A7%80%EC%8B%9D%20%EC%82%AC%EC%9D%B4");
  Logger.log("티스토리 카테고리 글 수: " + tistoryPosts.length);
}

import { unstable_cache } from "next/cache";

// Google 뉴스 RSS 연동 (키 발급 불필요)
// https://news.google.com/rss/search?q=검색어&hl=ko&gl=KR&ceid=KR:ko
//
// 참고: 이건 구글의 공식 개발자 API가 아니라 RSS 피드입니다. 키 발급 없이 바로 쓸 수
// 있다는 장점이 있지만, 구글이 예고 없이 형식을 바꾸거나 접근을 막을 가능성이 이론상
// 있습니다. 서버(API route)에서만 호출하므로 CORS 문제는 없습니다.

function decodeEntities(str) {
  if (!str) return "";
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, "") // 남은 html 태그 제거 (description 안의 <a>, <font> 등)
    .trim();
}

function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!m) return "";
  return m[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

// 구글이 가끔 RSS 대신 확인·차단 페이지를 200으로 보내는데, fetch 캐시에 맡기면 그게 30분간 "기사 0건"으로 굳습니다.
// 그래서 요청은 캐시하지 않고, RSS 형식이 맞는 결과만 30분 저장합니다(unstable_cache는 throw한 결과를 저장하지 않음).
async function fetchNewsOnce(query, display = 12) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AlgoTuja/1.0)" },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Google 뉴스 RSS 오류: ${res.status}`);
  }

  const xml = await res.text();
  if (!xml.includes("<channel")) throw new Error("Google 뉴스 RSS 형식이 아닌 응답"); // 기사 0건인 정상 RSS는 그대로 통과
  const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);

  return itemBlocks.slice(0, display).map((block) => {
    const rawTitle = decodeEntities(extractTag(block, "title"));
    const link = extractTag(block, "link").trim();
    const pubDate = extractTag(block, "pubDate");
    const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/);
    const source = sourceMatch ? decodeEntities(sourceMatch[1]) : null;

    // 구글 뉴스 제목은 보통 "기사 제목 - 언론사명" 형태라, 언론사명은 분리해서 출처로 씁니다.
    let title = rawTitle;
    if (source && title.endsWith(` - ${source}`)) {
      title = title.slice(0, title.length - source.length - 3);
    }

    return {
      title,
      description: source ? `${source} 제공` : "",
      link,
      pubDate,
    };
  });
}

export const fetchNews = unstable_cache(fetchNewsOnce, ["news-v1"], { revalidate: 60 * 30 });

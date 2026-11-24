import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { fetchNews } from "@/lib/news";
import { fetchMajorDisclosures } from "@/lib/dart";
import { assessGrowthSignals } from "@/lib/ai";
import { scoreGrowth } from "@/lib/growth.mjs";
import { GROWTH_ENABLED } from "@/lib/flags";

// 미래 성장 신호: 성장 관련 기사 + 최근 6개월 주요 공시 → AI가 항목별 신호 판정 → 점수는 정해진 식으로 계산.
// 기사·공시가 자주 바뀌지 않아 6시간 저장합니다. 에러와, 기사·공시 중 한쪽이라도 못 받은 결과는 저장하지 않습니다.
export const maxDuration = 60;

const DAYS = 180; // 공시와 같은 기간(최근 6개월)의 기사만 근거로 씀
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
// 기사에 날짜를 붙이고 최근 6개월 것만 남김 (기사가 적은 회사는 검색에 몇 년 전 기사가 섞여 나옴)
function recentNews(items) {
  const since = Date.now() - DAYS * 86400000;
  return items
    .map((n) => ({ ...n, time: Date.parse(n.pubDate) }))
    .filter((n) => Number.isFinite(n.time) && n.time >= since)
    .map(({ time, ...n }) => ({ ...n, date: ymd(new Date(time)) }));
}

async function analyze({ companyName, corpCode, oneLiner, businesses }) {
  const [newsRes, docsRes] = await Promise.allSettled([
    fetchNews(`${companyName} 수주 OR 신사업 OR 증설 OR 규제 OR 수요`),
    fetchMajorDisclosures(corpCode, DAYS),
  ]);
  if (newsRes.status === "rejected" && docsRes.status === "rejected") {
    throw new Error(`기사·공시를 모두 불러오지 못했어요 (${newsRes.reason?.message})`);
  }
  let newsItems = newsRes.status === "fulfilled" ? recentNews(newsRes.value) : [];
  let newsError = newsRes.status === "rejected" ? newsRes.reason?.message : null;
  // 성장 키워드 검색이 비면 회사 이름만으로 다시 (회사에 따라 키워드 검색 결과가 0건일 때가 있음)
  if (!newsItems.length) newsItems = recentNews(await fetchNews(companyName).catch((e) => ((newsError = e.message), [])));
  const disclosures = docsRes.status === "fulfilled" ? docsRes.value : [];
  const docsError = docsRes.status === "rejected" ? docsRes.reason?.message : null;

  // 근거가 하나도 없으면 AI를 부르지 않음 (비용 절약, 지어내기 방지)
  const ai = newsItems.length || disclosures.length ? await assessGrowthSignals({ companyName, oneLiner, businesses, newsItems, disclosures }) : {};
  const resolve = (id) => {
    const m = /^([ND])(\d+)$/.exec(String(id));
    if (!m) return null;
    const item = m[1] === "N" ? newsItems[Number(m[2])] : disclosures[Number(m[2])];
    return item ? { type: m[1] === "N" ? "기사" : "공시", title: item.title, link: item.link, date: item.date ?? null } : null;
  };
  return { ...scoreGrowth(ai, resolve), sources: { news: newsItems.length, disclosures: disclosures.length, newsError: newsItems.length ? null : newsError, docsError } };
}
// 기사·공시 중 한쪽이라도 실패한 결과는 throw로 저장을 건너뛰고(unstable_cache는 throw를 저장하지 않음),
// 화면에는 그 결과를 "일부 근거만 반영"으로 보여 줌. 다음 요청 때 다시 시도됨
async function analyzeComplete(input) {
  const result = await analyze(input);
  if (result.sources.newsError || result.sources.docsError) throw Object.assign(new Error("일부 근거를 불러오지 못함"), { partial: result });
  return result;
}
const cachedAnalyze = unstable_cache(analyzeComplete, ["growth-v7"], { revalidate: 21600 });

export async function POST(request, { params }) {
  // 중지 상태면 기사·공시·AI를 하나도 부르지 않고 바로 거절 (비용 0)
  if (!GROWTH_ENABLED) return NextResponse.json({ error: "미래 성장 신호는 잠시 중지했어요." }, { status: 503 });
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }
  const { companyName, corpCode, oneLiner, businesses } = body || {};
  if (!/^\d{6}$/.test(params.ticker) || typeof corpCode !== "string" || !/^\d{8}$/.test(corpCode)) {
    return NextResponse.json({ error: "종목코드 또는 고유번호 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (typeof companyName !== "string" || !companyName.trim() || companyName.length > 100 || (oneLiner != null && (typeof oneLiner !== "string" || oneLiner.length > 500))) {
    return NextResponse.json({ error: "입력 형식이 올바르지 않거나 너무 깁니다." }, { status: 400 });
  }
  if (
    businesses != null &&
    (!Array.isArray(businesses) ||
      businesses.length > 20 ||
      businesses.some((b) => !b || typeof b.name !== "string" || b.name.length > 100 || typeof b.pct !== "number"))
  ) {
    return NextResponse.json({ error: "businesses 형식이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    return NextResponse.json(await cachedAnalyze({ companyName: companyName.trim(), corpCode, oneLiner: oneLiner || "", businesses: businesses || [] }));
  } catch (e) {
    if (e?.partial) return NextResponse.json({ ...e.partial, partial: true });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

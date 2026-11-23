import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { fetchNews } from "@/lib/news";
import { clusterNewsIntoIssues } from "@/lib/ai";

// STEP 3(최근 이슈)만 따로 처리하는 라우트입니다. 뉴스 수집 + AI 클러스터링이
// 시간이 걸려서, 페이지의 나머지 부분(STEP 1·2)이 먼저 뜬 뒤 이 부분만 별도로
// 로딩되도록 분리했습니다.
export const maxDuration = 60;

// AI 이슈 분석 결과를 30분 저장합니다. 에러는 저장되지 않습니다.
const cachedIssues = unstable_cache(clusterNewsIntoIssues, ["issues-v1"], { revalidate: 1800 });

export async function POST(request) {
  let companyName, oneLiner, businesses;
  try {
    ({ companyName, oneLiner, businesses } = await request.json());
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }
  if (typeof companyName !== "string" || !companyName.trim()) {
    return NextResponse.json({ error: "companyName이 필요합니다." }, { status: 400 });
  }
  if (companyName.length > 100 || (oneLiner != null && (typeof oneLiner !== "string" || oneLiner.length > 500))) {
    return NextResponse.json({ error: "입력 형식이 올바르지 않거나 너무 깁니다." }, { status: 400 });
  }
  // businesses: {name, pct} 배열, 최대 20개
  if (
    businesses != null &&
    (!Array.isArray(businesses) ||
      businesses.length > 20 ||
      businesses.some((b) => !b || typeof b.name !== "string" || b.name.length > 100 || typeof b.pct !== "number"))
  ) {
    return NextResponse.json({ error: "businesses 형식이 올바르지 않습니다." }, { status: 400 });
  }

  let news = [];
  let newsError = null;
  try {
    news = await fetchNews(companyName);
  } catch (e) {
    newsError = e.message;
  }

  let issues = [];
  let issuesError = null;
  if (news.length > 0) {
    try {
      issues = await cachedIssues({ companyName, oneLiner: oneLiner || "", businesses: businesses || [], newsItems: news });
    } catch (e) {
      issuesError = e.message;
    }
  }

  return NextResponse.json({ news, newsError, issues, issuesError });
}

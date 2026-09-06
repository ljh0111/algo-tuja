import { NextResponse } from "next/server";
import { fetchNews } from "@/lib/news";
import { clusterNewsIntoIssues } from "@/lib/ai";

// STEP 3(최근 이슈)만 따로 처리하는 라우트입니다. 뉴스 수집 + AI 클러스터링이
// 시간이 걸려서, 페이지의 나머지 부분(STEP 1·2)이 먼저 뜬 뒤 이 부분만 별도로
// 로딩되도록 분리했습니다.
export const maxDuration = 60;

export async function POST(request) {
  const { companyName, oneLiner, businesses } = await request.json();
  if (!companyName) {
    return NextResponse.json({ error: "companyName이 필요합니다." }, { status: 400 });
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
      issues = await clusterNewsIntoIssues({ companyName, oneLiner, businesses, newsItems: news });
    } catch (e) {
      issuesError = e.message;
    }
  }

  return NextResponse.json({ news, newsError, issues, issuesError });
}

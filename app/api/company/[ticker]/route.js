import { NextResponse } from "next/server";
import { getCompanyByTicker } from "@/lib/companies";
import { fetchFinancialHighlights } from "@/lib/dart";
import { generateCompanyProfile } from "@/lib/ai";
import { findCorpByTicker } from "@/lib/dartCorpList";

// 이 라우트는 "빠르게 뜨는 부분"만 담당합니다: 기업 기본 정보 + 재무 실적.
// 뉴스 수집·AI 이슈 분석은 원래 여기서 같이 처리했는데, AI가 뉴스를 분석하는 데
// 15~25초 정도 걸려서 전체 페이지가 그만큼 늦게 뜨는 문제가 있었습니다.
// 그래서 그 부분은 /api/company/[ticker]/issues 로 분리해 화면에서 STEP 3만 따로,
// 나중에 로딩하도록 바꿨습니다.
export const maxDuration = 60;

export async function GET(request, { params }) {
  const ticker = params.ticker;
  let company = getCompanyByTicker(ticker);
  let aiGenerated = false;

  if (!company) {
    // 손으로 정리해둔 4개 기업이 아니면, DART 고유번호 목록에서 종목을 찾고
    // AI가 그 자리에서 기업 프로필(설명·사업구조·체크포인트)을 생성합니다.
    let corp = null;
    try {
      corp = await findCorpByTicker(ticker);
    } catch (e) {
      return NextResponse.json({ error: `기업 목록을 불러오지 못했습니다: ${e.message}` }, { status: 500 });
    }
    if (!corp) {
      return NextResponse.json({ error: "등록되지 않은 종목코드입니다." }, { status: 404 });
    }

    try {
      const profile = await generateCompanyProfile({ companyName: corp.name, ticker });
      company = {
        ticker,
        corpCode: corp.corpCode,
        name: corp.name,
        industry: profile.industry,
        oneLiner: profile.oneLiner,
        products: profile.products,
        customers: profile.customers,
        competitors: profile.competitors,
        businesses: profile.businesses,
        businessExplain: profile.businessExplain,
        businessSource: "AI가 생성한 추정치입니다 — 실제 사업보고서로 검증이 필요합니다.",
        checkpoints: profile.checkpoints,
      };
      aiGenerated = true;
    } catch (e) {
      return NextResponse.json({ error: `기업 정보를 생성하지 못했습니다: ${e.message}` }, { status: 500 });
    }
  }

  let financials = null;
  let financialsError = null;
  try {
    financials = await fetchFinancialHighlights(company.corpCode);
  } catch (e) {
    financialsError = e.message;
  }

  return NextResponse.json({
    company,
    aiGenerated,
    financials,
    financialsError,
    fetchedAt: new Date().toISOString(),
  });
}

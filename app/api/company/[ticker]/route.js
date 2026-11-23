import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
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

// 재무는 분기마다, AI 프로필은 거의 안 바뀌니 하루 동안 서버에 저장해 둡니다 (DART 24개 요청이 매번 8초쯤 걸렸음).
// 에러로 끝난 호출은 저장되지 않아 다음 요청에서 다시 시도합니다.
const DAY = 86400;
const cachedFinancials = unstable_cache(fetchFinancialHighlights, ["dart-financials"], { revalidate: DAY });
// 검증을 캐시 함수 안에서 해서, 형식이 잘못된 AI 출력은 던져져 저장되지 않습니다.
const isStr = (v) => typeof v === "string" && v.trim() !== "";
async function generateValidProfile(args) {
  const p = await generateCompanyProfile(args);
  const ok =
    p && isStr(p.oneLiner) && isStr(p.industry) &&
    Array.isArray(p.businesses) && p.businesses.every((b) => b && isStr(b.name) && typeof b.pct === "number" && Number.isFinite(b.pct)) &&
    Array.isArray(p.checkpoints) && p.checkpoints.every((c) => c && isStr(c.title));
  if (!ok) throw new Error("AI 응답 형식이 올바르지 않습니다.");
  return p;
}
const cachedProfile = unstable_cache(generateValidProfile, ["ai-company-profile"], { revalidate: DAY });

export async function GET(request, { params }) {
  const ticker = params.ticker;
  let company = getCompanyByTicker(ticker);
  let aiGenerated = false;
  let prefetched = null; // 동시에 받아둔 재무 결과 (AI 생성 기업만)

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

    // 프로필(AI)과 재무(DART)는 서로 기다릴 필요가 없어 동시에 시작합니다.
    const [profileRes, finRes] = await Promise.allSettled([
      cachedProfile({ companyName: corp.name, ticker }),
      cachedFinancials(corp.corpCode),
    ]);
    if (profileRes.status === "rejected") {
      return NextResponse.json({ error: `기업 정보를 생성하지 못했습니다: ${profileRes.reason?.message}` }, { status: 500 });
    }
    const profile = profileRes.value;
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
    prefetched = finRes;
  }

  let financials = null;
  let financialsError = null;
  try {
    if (prefetched) {
      if (prefetched.status === "rejected") throw prefetched.reason;
      financials = prefetched.value;
    } else {
      financials = await cachedFinancials(company.corpCode);
    }
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

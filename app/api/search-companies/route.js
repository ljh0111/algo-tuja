import { NextResponse } from "next/server";
import { searchCorps } from "@/lib/dartCorpList";
import { COMPANY_LIST } from "@/lib/companies";

// Vercel 기본 함수 실행 제한(10초)을 늘립니다. DART 전체 상장사 목록을
// 처음 받아올 때(캐시가 없을 때)는 10초를 넘길 수 있어서 필요합니다.
export const maxDuration = 60;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ results: [] });

  try {
    const results = await searchCorps(q, 8);
    return NextResponse.json({ results });
  } catch (e) {
    // DART 고유번호 목록을 못 가져와도, 손으로 정리해둔 4개 기업 안에서는 검색되게 폴백합니다.
    const fallback = COMPANY_LIST.filter((c) => c.name.includes(q) || c.ticker.includes(q)).map((c) => ({
      name: c.name,
      ticker: c.ticker,
    }));
    return NextResponse.json({ results: fallback, error: e.message });
  }
}

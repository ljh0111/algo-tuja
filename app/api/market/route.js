import { NextResponse } from "next/server";
import { getMarketOverview } from "@/lib/market";

export const revalidate = 60; // 장중 값(네이버) 반영 주기. 공식 일별 데이터 요청은 각자 1시간 캐시
export const maxDuration = 30;

export async function GET() {
  try {
    return NextResponse.json(await getMarketOverview());
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

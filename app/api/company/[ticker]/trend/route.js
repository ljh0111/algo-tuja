import { NextResponse } from "next/server";
import { fetchFinancialTrend } from "@/lib/dart";

// DART에 연도별로 여러 번 조회해야 해서 시간이 좀 걸립니다.
export const maxDuration = 60;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const corpCode = searchParams.get("corpCode");
  if (!corpCode) {
    return NextResponse.json({ error: "corpCode가 필요합니다." }, { status: 400 });
  }
  try {
    const trend = await fetchFinancialTrend(corpCode);
    return NextResponse.json({ trend });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

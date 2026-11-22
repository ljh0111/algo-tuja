import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { fetchFinancialTrend } from "@/lib/dart";

// DART에 연도별로 여러 번 조회해야 해서 시간이 좀 걸립니다.
export const maxDuration = 60;

// 연도별 재무는 공시 때만 바뀌니 하루 동안 서버에 저장해 둡니다. 에러는 저장되지 않습니다.
const cachedTrend = unstable_cache(fetchFinancialTrend, ["dart-trend"], { revalidate: 86400 });

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const corpCode = searchParams.get("corpCode");
  if (!corpCode) {
    return NextResponse.json({ error: "corpCode가 필요합니다." }, { status: 400 });
  }
  try {
    const trend = await cachedTrend(corpCode);
    return NextResponse.json({ trend });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

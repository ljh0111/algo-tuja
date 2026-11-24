import { NextResponse } from "next/server";
import { getMarketOverview } from "@/lib/market";

// 요청마다 새로 계산합니다. ISR(revalidate)은 뒤에서 다시 만들다 실패하면 옛 응답을 몇 시간씩 계속 내줬음.
// 무거운 공식 데이터는 각자 1시간, 네이버 장중 값은 1분 저장돼 있어 매번 계산해도 가볍습니다.
export const dynamic = "force-dynamic";
// CDN은 5초만 저장(+5초 옛 값 허용): 같은 순간 방문자들은 한 번 계산을 나눠 쓰고, 값은 10초 안에 새로
const FRESH = { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=5" };
export const maxDuration = 30;

export async function GET() {
  try {
    return NextResponse.json(await getMarketOverview(), { headers: FRESH });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

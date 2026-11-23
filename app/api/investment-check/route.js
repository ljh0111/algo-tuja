import { NextResponse } from "next/server";
import { checkInvestmentLogic } from "@/lib/ai";

// Vercel 기본 함수 실행 제한(10초)을 늘립니다. AI 응답이 늦어지면 10초를 넘을 수 있습니다.
export const maxDuration = 60;

export async function POST(request) {
  try {
    const { companyName, context, userReason } = await request.json();

    if (typeof companyName !== "string" || typeof userReason !== "string" || !companyName.trim() || !userReason.trim()) {
      return NextResponse.json({ error: "companyName과 userReason이 필요합니다." }, { status: 400 });
    }
    if (context !== undefined && context !== null && typeof context !== "string") {
      return NextResponse.json({ error: "context 형식이 올바르지 않습니다." }, { status: 400 });
    }
    // 길이 제한: AI 비용·프롬프트 남용 방지
    if (companyName.length > 100 || userReason.length > 2000 || (context || "").length > 2000) {
      return NextResponse.json({ error: "입력이 너무 깁니다." }, { status: 413 });
    }

    const result = await checkInvestmentLogic({ companyName, context: context || "", userReason });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof SyntaxError) return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

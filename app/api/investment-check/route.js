import { NextResponse } from "next/server";
import { checkInvestmentLogic } from "@/lib/ai";

// Vercel 기본 함수 실행 제한(10초)을 늘립니다. AI 응답이 늦어지면 10초를 넘을 수 있습니다.
export const maxDuration = 60;

export async function POST(request) {
  const body = await request.json();
  const { companyName, context, userReason } = body;

  if (!companyName || !userReason?.trim()) {
    return NextResponse.json({ error: "companyName과 userReason이 필요합니다." }, { status: 400 });
  }

  try {
    const result = await checkInvestmentLogic({ companyName, context, userReason });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

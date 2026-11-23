import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { defineTerm } from "@/lib/ai";

export const maxDuration = 30;

// 같은 단어·문맥은 하루 동안 저장해 AI 호출을 줄입니다. 에러는 저장되지 않습니다.
const cachedDefine = unstable_cache(defineTerm, ["definition-v1"], { revalidate: 86400 });

export async function POST(request) {
  try {
    const { term, context } = await request.json();
    if (typeof term !== "string" || !term.trim()) {
      return NextResponse.json({ error: "term이 필요합니다." }, { status: 400 });
    }
    if (context !== undefined && context !== null && typeof context !== "string") {
      return NextResponse.json({ error: "context 형식이 올바르지 않습니다." }, { status: 400 });
    }
    if (term.length > 100 || (context || "").length > 2000) {
      return NextResponse.json({ error: "입력이 너무 깁니다." }, { status: 413 });
    }
    const result = await cachedDefine({ term: term.trim(), context: context || "" });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof SyntaxError) return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

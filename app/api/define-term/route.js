import { NextResponse } from "next/server";
import { defineTerm } from "@/lib/ai";

export const maxDuration = 30;

export async function POST(request) {
  const { term, context } = await request.json();
  if (!term?.trim()) {
    return NextResponse.json({ error: "term이 필요합니다." }, { status: 400 });
  }
  try {
    const result = await defineTerm({ term: term.trim(), context });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

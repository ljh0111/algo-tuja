import { NextResponse } from "next/server";
import { getMarketOverview } from "@/lib/market";

export const revalidate = 3600;
export const maxDuration = 30;

export async function GET() {
  try {
    return NextResponse.json(await getMarketOverview());
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getStockSentiment } from "@/lib/stockPrice";

export const revalidate = 3600;
export const maxDuration = 30;

export async function GET(_req, { params }) {
  try {
    return NextResponse.json(await getStockSentiment(params.ticker));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

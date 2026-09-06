import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function GET() {
  const report = {};

  // 1. 환경변수 확인
  const key = process.env.DART_API_KEY;
  report.dartKeyPresent = !!key;
  report.dartKeyPreview = key ? `${key.slice(0, 4)}...${key.slice(-4)} (길이 ${key.length})` : null;

  // 2. corpList.json 정적 파일이 실제로 로드되는지 확인
  try {
    const list = require("../../../lib/corpList.json");
    report.corpListLoaded = true;
    report.corpListCount = list.length;
  } catch (e) {
    report.corpListLoaded = false;
    report.corpListLoadError = e.message;
  }

  // 3. SK하이닉스(00164779) 2025년 사업보고서를 DART에 직접 요청해서 원본 응답을 그대로 보여줍니다.
  if (key) {
    for (const [label, year, fsDiv] of [
      ["CFS-2025", "2025", "CFS"],
      ["OFS-2025", "2025", "OFS"],
      ["CFS-2024", "2024", "CFS"],
    ]) {
      try {
        const url = new URL("https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json");
        url.searchParams.set("crtfc_key", key);
        url.searchParams.set("corp_code", "00164779");
        url.searchParams.set("bsns_year", year);
        url.searchParams.set("reprt_code", "11011");
        url.searchParams.set("fs_div", fsDiv);

        const started = Date.now();
        const res = await fetch(url.toString(), { cache: "no-store" });
        const data = await res.json();
        report[label] = {
          httpStatus: res.status,
          dartStatus: data.status,
          dartMessage: data.message,
          listLength: Array.isArray(data.list) ? data.list.length : 0,
          elapsedMs: Date.now() - started,
        };
      } catch (e) {
        report[label] = { error: e.message };
      }
    }
  }

  return NextResponse.json(report, { status: 200 });
}

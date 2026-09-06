// 상장기업 이름/종목코드 검색.
// 배포된 서버에서 매번 DART 전체 목록을 실시간으로 받으면 느리고(때로는 타임아웃),
// 사용자마다 대기 시간이 들쭉날쭉해져서 심사 데모에 위험합니다.
// 그래서 lib/corpList.json (scripts/fetch-corp-list.js로 미리 생성해 커밋해둔 정적 파일)을
// 우선 사용하고, 혹시 그 파일이 없을 때만 실시간 다운로드로 대체합니다.

import AdmZip from "adm-zip";

let staticList = null;
try {
  // 빌드 시점에 존재하면 그대로 번들에 포함됩니다.
  staticList = require("./corpList.json");
} catch (e) {
  staticList = null;
}

let cachedList = null;
let cachedAt = 0;
const TTL_MS = 1000 * 60 * 60 * 12;

async function downloadAndParse() {
  const key = process.env.DART_API_KEY;
  if (!key) throw new Error("DART_API_KEY가 설정되지 않았습니다 (.env.local 확인)");

  const url = new URL("https://opendart.fss.or.kr/api/corpCode.xml");
  url.searchParams.set("crtfc_key", key);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`DART 고유번호 목록 다운로드 실패: ${res.status}`);

  const buf = Buffer.from(await res.arrayBuffer());
  const zip = new AdmZip(buf);
  const entry = zip.getEntries().find((e) => e.entryName.toUpperCase().includes("CORPCODE"));
  if (!entry) throw new Error("zip 안에서 CORPCODE.xml을 찾지 못했습니다.");

  const xml = entry.getData().toString("utf8");
  const blocks = [...xml.matchAll(/<list>([\s\S]*?)<\/list>/g)].map((m) => m[1]);

  const get = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    return m ? m[1].trim() : "";
  };

  return blocks
    .map((block) => ({
      corpCode: get(block, "corp_code"),
      name: get(block, "corp_name"),
      ticker: get(block, "stock_code"),
    }))
    .filter((c) => /^\d{6}$/.test(c.ticker));
}

async function getCorpList() {
  if (staticList) return staticList; // 정적 파일이 있으면 그걸로 끝 (즉시 반환, 네트워크 요청 없음)

  const now = Date.now();
  if (cachedList && now - cachedAt < TTL_MS) return cachedList;
  cachedList = await downloadAndParse();
  cachedAt = now;
  return cachedList;
}

export async function searchCorps(query, limit = 8) {
  const q = query.trim();
  if (!q) return [];
  const list = await getCorpList();

  if (/^\d+$/.test(q)) {
    return list.filter((c) => c.ticker.startsWith(q)).slice(0, limit);
  }
  return list.filter((c) => c.name.includes(q)).slice(0, limit);
}

export async function findCorpByTicker(ticker) {
  const list = await getCorpList();
  return list.find((c) => c.ticker === ticker) || null;
}

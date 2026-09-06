// 이 스크립트는 배포 서버가 아니라, 개발자가 로컬에서 딱 한 번 실행하는 용도입니다.
// DART 고유번호 전체 목록(zip)을 받아서 lib/corpList.json 으로 저장해두면,
// 실제 배포된 서비스는 이 정적 파일을 그대로 읽기만 하면 되므로 매번 다운로드할 필요가 없어집니다.
//
// 실행 방법: .env.local 에 DART_API_KEY를 넣어둔 상태에서
//   npm run fetch:corps

require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

async function main() {
  const key = process.env.DART_API_KEY;
  if (!key) {
    console.error("DART_API_KEY가 없습니다. .env.local을 확인하세요.");
    process.exit(1);
  }

  console.log("DART 고유번호 목록 다운로드 중...");
  const url = new URL("https://opendart.fss.or.kr/api/corpCode.xml");
  url.searchParams.set("crtfc_key", key);

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error(`다운로드 실패: ${res.status}`);
    process.exit(1);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const zip = new AdmZip(buf);
  const entry = zip.getEntries().find((e) => e.entryName.toUpperCase().includes("CORPCODE"));
  if (!entry) {
    console.error("zip 안에서 CORPCODE.xml을 찾지 못했습니다.");
    process.exit(1);
  }

  const xml = entry.getData().toString("utf8");
  const blocks = [...xml.matchAll(/<list>([\s\S]*?)<\/list>/g)].map((m) => m[1]);

  const get = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    return m ? m[1].trim() : "";
  };

  const parsed = blocks
    .map((block) => ({
      corpCode: get(block, "corp_code"),
      name: get(block, "corp_name"),
      ticker: get(block, "stock_code"),
    }))
    .filter((c) => /^\d{6}$/.test(c.ticker));

  const outPath = path.join(__dirname, "..", "lib", "corpList.json");
  fs.writeFileSync(outPath, JSON.stringify(parsed));
  console.log(`완료: 상장기업 ${parsed.length}개를 ${outPath} 에 저장했습니다.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

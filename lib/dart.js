// DART 오픈API 연동
// 문서: https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS003&apiId=2019020
// 단일회사 전체 재무제표 (fnlttSinglAcntAll.json)

const TARGET_ACCOUNTS = ["매출액", "영업이익", "당기순이익"];

function parseAmount(str) {
  if (!str) return null;
  const n = Number(String(str).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function fetchOnce(corpCode, bsnsYear, reprtCode, fsDiv) {
  const key = process.env.DART_API_KEY;
  if (!key) throw new Error("DART_API_KEY가 설정되지 않았습니다 (.env.local 확인)");

  const url = new URL("https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json");
  url.searchParams.set("crtfc_key", key);
  url.searchParams.set("corp_code", corpCode);
  url.searchParams.set("bsns_year", bsnsYear);
  url.searchParams.set("reprt_code", reprtCode);
  url.searchParams.set("fs_div", fsDiv);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const data = await res.json();
  // status "000" = 정상, "013" = 조회된 데이터 없음, 그 외는 실제 에러(인증키/한도 등)
  if (data.status !== "000") {
    console.error(`[DART] ${corpCode} ${bsnsYear} ${fsDiv} 실패: status=${data.status} message=${data.message}`);
    if (data.status !== "013") {
      throw new Error(`DART 오류 (${data.status}): ${data.message || "알 수 없는 오류"}`);
    }
    return null;
  }
  return data.list || [];
}

// 최근 사업보고서(연간, 11011) 기준 매출액/영업이익/당기순이익을 가져옵니다.
// 당해년도 사업보고서가 아직 공시되지 않았을 수 있고, 특정 연도 하나만으로는 데이터가 안 잡히는
// 경우도 있어 최근 4개 연도, 사업보고서·반기·3분기보고서, CFS·OFS까지 폭넓게 시도합니다.
// (예전엔 이 조합을 하나씩 순서대로 시도해서, 앞쪽에서 안 잡히는 기업은 60초 제한을 넘겨 타임아웃이
// 났습니다. 그래서 모든 조합을 동시에 병렬로 요청하고, 그중 우선순위가 가장 높은 성공 결과를 씁니다.)
export async function fetchFinancialHighlights(corpCode) {
  const now = new Date();
  const candidateYears = [now.getFullYear() - 1, now.getFullYear() - 2, now.getFullYear() - 3, now.getFullYear() - 4];
  const reportCodes = [
    ["11011", "사업보고서(연간)"],
    ["11014", "3분기보고서"],
    ["11012", "반기보고서"],
  ];
  const fsDivs = ["CFS", "OFS"];

  // 우선순위 순서대로 조합 목록을 만듭니다 (최신 연도 > 연간보고서 > 연결재무제표 순으로 앞쪽 우선).
  const combos = [];
  for (const year of candidateYears) {
    for (const [reprtCode, reprtLabel] of reportCodes) {
      for (const fsDiv of fsDivs) {
        combos.push({ year, reprtCode, reprtLabel, fsDiv });
      }
    }
  }

  // 모든 조합을 동시에 요청합니다. 개별 요청 하나하나가 아니라, 가장 느린 요청 하나만큼만 기다리면 됩니다.
  const settled = await Promise.allSettled(
    combos.map((c) => fetchOnce(corpCode, String(c.year), c.reprtCode, c.fsDiv))
  );

  let lastError = null;
  for (let i = 0; i < combos.length; i++) {
    const result = settled[i];
    if (result.status === "rejected") {
      lastError = result.reason;
      continue;
    }
    const list = result.value;
    if (!list || list.length === 0) continue;

    const rows = list.filter((r) => TARGET_ACCOUNTS.includes(r.account_nm) && ["IS", "CIS"].includes(r.sj_div));
    if (rows.length === 0) continue;

    const byAccount = {};
    for (const r of rows) {
      if (byAccount[r.account_nm]) continue;
      byAccount[r.account_nm] = {
        thisYear: parseAmount(r.thstrm_amount),
        lastYear: parseAmount(r.frmtrm_amount),
        twoYearsAgo: parseAmount(r.bfefrmtrm_amount),
        unit: "원",
      };
    }
    if (!byAccount["매출액"]) continue;

    const { year, reprtLabel } = combos[i];
    return {
      fiscalYear: year,
      reportBasis: `${reprtLabel} 기준`,
      accounts: byAccount,
      source: `DART 오픈API · fnlttSinglAcntAll (${year}년 ${reprtLabel})`,
    };
  }

  // 모든 조합이 실패했고, 그중 진짜 에러(한도초과/인증키 등)가 있었다면 그 내용을 그대로 알려줍니다.
  if (lastError) throw lastError;
  return null;
}

// DART 사업보고서 하나를 조회하면 당기·전기·전전기(현재+과거 2개년) 데이터가 한 번에 들어있습니다.
// 이 점을 이용해서, 몇 년 간격을 둔 소수의 사업보고서만 조회해도 여러 해의 추이를 모을 수 있습니다.
// (매년 따로 조회하는 것보다 API 호출이 적어서 더 빠르고, 특정 연도 보고서 하나가 실패해도 영향이 적습니다.)
async function fetchOneYearWithFallback(corpCode, year) {
  // 연결재무제표(CFS)가 없는 경우(오래된 연도 등) 개별재무제표(OFS)로 대체합니다.
  let list = await fetchOnce(corpCode, String(year), "11011", "CFS");
  if (!list || list.length === 0) {
    list = await fetchOnce(corpCode, String(year), "11011", "OFS");
  }
  if (!list || list.length === 0) return null;

  const rows = list.filter((r) => TARGET_ACCOUNTS.includes(r.account_nm) && ["IS", "CIS"].includes(r.sj_div));
  if (rows.length === 0) return null;

  const byAccount = {};
  for (const r of rows) {
    if (byAccount[r.account_nm] !== undefined) continue;
    byAccount[r.account_nm] = {
      thisYear: parseAmount(r.thstrm_amount),
      lastYear: parseAmount(r.frmtrm_amount),
      twoYearsAgo: parseAmount(r.bfefrmtrm_amount),
    };
  }
  if (!byAccount["매출액"]) return null;
  return byAccount;
}

// 매출액/영업이익/당기순이익의 최근 여러 개년 추이를 가져옵니다 (재무 카드를 클릭했을 때 그래프용).
export async function fetchFinancialTrend(corpCode, yearsBack = 6) {
  const now = new Date();
  const latestFiledYear = now.getFullYear() - 1; // 아직 공시 안 된 당해년도는 제외

  // 사업보고서 하나당 3개년이 들어있으므로, 3년 간격으로 앵커 연도를 잡습니다.
  const anchorYears = [];
  for (let y = latestFiledYear; y > latestFiledYear - yearsBack; y -= 3) {
    anchorYears.push(y);
  }

  const byYear = {};
  const results = await Promise.all(anchorYears.map((year) => fetchOneYearWithFallback(corpCode, year)));

  // 가장 최근 연도 보고서가 아직 안 올라온 경우(1~3월) 한 해 앞 보고서로 첫 칸을 다시 시도합니다.
  if (!results[0]) {
    const prev = await fetchOneYearWithFallback(corpCode, anchorYears[0] - 1);
    if (prev) {
      results[0] = prev;
      anchorYears[0] -= 1; // 실제로 성공한 연도를 기준으로 앞선 두 해를 채웁니다.
    }
  }

  anchorYears.forEach((anchorYear, i) => {
    const byAccount = results[i];
    if (!byAccount) return;
    const offsets = [
      [anchorYear, "thisYear"],
      [anchorYear - 1, "lastYear"],
      [anchorYear - 2, "twoYearsAgo"],
    ];
    for (const [year, key] of offsets) {
      if (year < latestFiledYear - yearsBack + 1) continue;
      if (byYear[year]) continue; // 더 최근 앵커에서 이미 채운 값을 우선합니다.
      byYear[year] = {
        year,
        revenue: byAccount["매출액"]?.[key] ?? null,
        operatingProfit: byAccount["영업이익"]?.[key] ?? null,
        netIncome: byAccount["당기순이익"]?.[key] ?? null,
      };
    }
  });

  return Object.values(byYear)
    .filter((d) => d.revenue !== null)
    .sort((a, b) => a.year - b.year);
}

// 최근 주요 공시 중 성장·위축과 관련된 것만(수주·투자·신사업·악재). 미래 성장 신호의 근거로 씁니다.
// 요청은 캐시하지 않습니다(DART는 오류도 HTTP 200으로 보냄). 호출하는 쪽에서 성공 결과만 저장합니다.
const MAJOR_DISCLOSURE = /공급계약|시설투자|출자증권취득|유형자산취득|영업양수|영업양도|합병|분할|영업정지|생산중단|소송|해지|유상증자|감자|기술도입|기술이전|투자판단/;
export async function fetchMajorDisclosures(corpCode, days = 180) {
  const key = process.env.DART_API_KEY;
  if (!key) throw new Error("DART_API_KEY가 설정되지 않았습니다");
  const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
  // 큰 회사는 지분 변동 공시가 많아 최근 100건에 수주·투자 공시가 밀려남 → 종류별로 따로 조회
  // B: 주요사항보고(유상증자·소송·지분 취득 등), I: 거래소공시(공급계약·시설투자 등)
  const page = async (type) => {
    const url = new URL("https://opendart.fss.or.kr/api/list.json");
    url.searchParams.set("crtfc_key", key);
    url.searchParams.set("corp_code", corpCode);
    url.searchParams.set("bgn_de", ymd(new Date(Date.now() - days * 86400000)));
    url.searchParams.set("end_de", ymd(new Date()));
    url.searchParams.set("pblntf_ty", type);
    url.searchParams.set("page_count", "100");
    const res = await fetch(url.toString(), { cache: "no-store", signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    if (data.status === "013") return []; // 조회된 공시 없음
    if (data.status !== "000") throw new Error(`DART 공시목록 오류 (${data.status}): ${data.message || "알 수 없는 오류"}`);
    return data.list || [];
  };
  const rows = (await Promise.all([page("B"), page("I")])).flat();
  return rows
    .filter((r) => MAJOR_DISCLOSURE.test(r.report_nm))
    .sort((a, b) => b.rcept_dt.localeCompare(a.rcept_dt))
    .slice(0, 15)
    .map((r) => ({ date: r.rcept_dt, title: r.report_nm.replace(/\s+/g, " ").trim(), link: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${r.rcept_no}` }));
}

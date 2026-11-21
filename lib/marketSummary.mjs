// 메인 게이지 지표를 규칙으로 합쳐 "오늘의 시장 분위기"(얼마나 출렁이는지)를 한 줄로 요약합니다.
// 지표마다 출렁임 점수(0 평온 · 1 주의 · 2 경계)를 매기는 단순 규칙이라, 왜 그렇게 나왔는지 그대로 보여줄 수 있습니다.
// 시장이 얼마나 흔들리는지 설명할 뿐, 사거나 팔 때를 알려주지 않습니다(매수·매도 권유 금지).

const LEVELS = [
  { max: 0.25, key: "good", label: "잔잔함", title: "시장이 비교적 잔잔해요" },
  { max: 0.6, key: "neutral", label: "보통", title: "평소만큼 움직이고 있어요" },
  { max: 1.0, key: "caution", label: "출렁임", title: "시장이 평소보다 출렁이고 있어요" },
  { max: Infinity, key: "risk", label: "크게 출렁임", title: "시장이 크게 출렁이고 있어요" },
];

// 분위기 설명 뒤에는 늘 "내 회사·내 근거"로 시선을 돌립니다.
const NOTE = {
  good: "시장 전체보다 내가 고른 회사의 실적과 이슈가 주가에 더 크게 작용하기 쉬운 때예요.",
  neutral: "시장이 평소 수준일 때는 회사 자체의 실적과 이슈를 먼저 살펴보는 게 도움이 돼요.",
  caution: "시장이 출렁일 땐 가격 움직임보다 내 투자 근거가 여전히 유효한지 먼저 점검해 보세요.",
  risk: "가격이 크게 움직이기 쉬운 때예요. 내 투자 근거와 감당할 수 있는 손실 범위를 먼저 점검해 보세요.",
};

const fgState = (s) => (s < 25 ? "극단적 공포" : s < 45 ? "공포" : s <= 55 ? "중립" : s <= 75 ? "탐욕" : "극단적 탐욕");

/** @param {object} d /api/market 응답 */
export function summarizeMarket(d) {
  const reasons = [];
  // state: 게이지에 보이는 것과 같은 상태 이름 (예: "불안", "과매도")
  const add = (label, value, risk, state, text) => reasons.push({ label, value, risk, state, text });

  const fg = d?.fearGreed?.score;
  if (fg != null) {
    if (fg < 25) add("코스피 공포탐욕", fg, 2, fgState(fg), "투자자들이 크게 위축돼 가격 변동이 커지기 쉬워요.");
    else if (fg < 45) add("코스피 공포탐욕", fg, 1, fgState(fg), "매도 심리가 우세해요.");
    else if (fg <= 75) add("코스피 공포탐욕", fg, 0, fgState(fg), "심리가 한쪽으로 크게 쏠리지 않았어요.");
    else add("코스피 공포탐욕", fg, 1, fgState(fg), "과열돼 작은 소식에도 크게 흔들릴 수 있어요.");
  }

  const usfg = d?.usFearGreed?.score;
  if (usfg != null) {
    if (usfg < 25) add("미국 공포탐욕", usfg, 2, fgState(usfg), "미국 시장이 크게 위축돼 있어요. 국내 시장에도 영향을 주기 쉬워요.");
    else if (usfg < 45) add("미국 공포탐욕", usfg, 1, fgState(usfg), "미국 시장 심리가 위축돼 있어요.");
    else if (usfg <= 75) add("미국 공포탐욕", usfg, 0, fgState(usfg), "미국 시장 심리가 한쪽으로 크게 쏠리지 않았어요.");
    else add("미국 공포탐욕", usfg, 1, fgState(usfg), "미국 시장이 과열돼 있어요.");
  }

  const rsiReason = (label, value, who) => {
    if (value == null) return;
    const v = Math.round(value);
    if (value >= 70) add(label, v, 1, "과매수", `70 이상이에요. ${who} 단기간에 많이 올랐어요.`);
    else if (value <= 30) add(label, v, 1, "과매도", `30 이하예요. ${who} 단기간에 많이 내렸어요.`);
    else add(label, v, 0, "보통", `30~70 사이로 ${who} 과열도 침체도 아니에요.`);
  };
  rsiReason("코스피 RSI", d?.kospiRsi?.value, "코스피가");
  rsiReason("나스닥 RSI", d?.nasdaqRsi?.value, "미국 기술주가");

  const vix = d?.us?.vix?.value;
  if (vix != null) {
    const v = vix.toFixed(2);
    if (vix >= 30) add("VIX", v, 2, "크게 출렁", "30 이상으로 미국 시장의 불안이 매우 커요. 국내 시장에도 번지기 쉬워요.");
    else if (vix >= 20) add("VIX", v, 1, "출렁", "20~30 사이로 미국 시장의 불안이 평소보다 커요.");
    else add("VIX", v, 0, vix < 15 ? "잔잔" : "보통", "20 미만으로 미국 시장이 비교적 평온해요.");
  }

  const vxn = d?.us?.vxn?.value;
  if (vxn != null) {
    const v = vxn.toFixed(2);
    if (vxn >= 35) add("VXN", v, 2, "크게 출렁", "35 이상으로 미국 기술주 불안이 매우 커요. 국내 반도체·IT주에도 번지기 쉬워요.");
    else if (vxn >= 25) add("VXN", v, 1, "출렁", "25~35 사이로 미국 기술주 불안이 평소보다 커요.");
    else add("VXN", v, 0, vxn < 20 ? "잔잔" : "보통", "25 미만으로 미국 기술주는 비교적 평온해요.");
  }

  const hy = d?.us?.hy?.value;
  if (hy != null) {
    const v = `${hy.toFixed(2)}%p`;
    if (hy >= 7) add("하이일드 스프레드", v, 2, "위험", "7%p 이상으로 기업 부도 위험 우려가 커요.");
    else if (hy >= 5) add("하이일드 스프레드", v, 1, "경계", "5~7%p로 신용위험에 대한 경계가 커지고 있어요.");
    else add("하이일드 스프레드", v, 0, hy < 3.5 ? "낮음" : "보통", "5%p 미만으로 기업 신용 상황은 안정적이에요.");
  }

  const curve = d?.us?.t10y2y?.value;
  if (curve != null) {
    const v = `${curve.toFixed(2)}%p`;
    if (curve < 0) add("장단기 금리차", v, 1, "역전", "장단기 금리가 역전돼 있어요. 경기 둔화 우려 신호로 자주 언급돼요.");
    else add("장단기 금리차", v, 0, "정상", "역전되지 않았어요. 경기 우려 신호는 약해요.");
  }

  if (!reasons.length) return null;
  const risk = reasons.reduce((a, r) => a + r.risk, 0);
  // 지표 수가 늘어도 기준이 흔들리지 않게 지표당 평균 점수로 판단 (0 평온 ~ 2 경계)
  let idx = LEVELS.findIndex((l) => risk / reasons.length <= l.max);
  // 평균이 극단 신호를 희석하지 않게: 경계(2점) 지표가 2개 이상이면 한 단계 올림
  if (reasons.filter((r) => r.risk === 2).length >= 2) idx = Math.min(idx + 1, LEVELS.length - 1);
  const level = LEVELS[idx];
  return {
    level: level.key,
    label: level.label,
    title: level.title,
    note: NOTE[level.key],
    risk,
    reasons: reasons.sort((a, b) => b.risk - a.risk),
    partial: fg == null || d?.kospiRsi?.value == null, // 국내 지표가 빠진 요약인지
  };
}

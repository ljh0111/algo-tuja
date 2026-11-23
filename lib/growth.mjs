// 미래 성장 신호: AI가 항목별 신호(-2~+2)와 근거를 내면, 점수는 여기서 정해진 식으로만 계산합니다.
// (AI가 점수를 직접 정하지 않게 해서, 같은 신호면 늘 같은 점수가 나오도록)

export const GROWTH_FACTORS = [
  { key: "newBusiness", label: "신규 사업", desc: "새로 시작하거나 넓히는 사업" },
  { key: "orders", label: "신규 수주", desc: "공급계약·수주 공시와 소식" },
  { key: "demand", label: "수요 변화", desc: "주력 제품을 찾는 수요가 늘거나 줄어드는지" },
  { key: "technology", label: "기술 변화", desc: "신기술 개발·도입, 경쟁 기술의 등장" },
  { key: "policy", label: "정책·규제", desc: "정부 정책, 규제, 관세, 보조금" },
  { key: "headwind", label: "위축 요인", desc: "소송, 생산 차질, 경쟁 심화, 비용 부담 같은 걸림돌" },
];

export const SIGNAL_LABEL = { 2: "뚜렷한 긍정", 1: "긍정", 0: "중립", "-1": "부정", "-2": "뚜렷한 부정" };

/**
 * AI 응답을 검증·정리하고 종합 점수를 붙입니다.
 * - 항목은 GROWTH_FACTORS 6개만, 신호는 -2~+2 정수로 자름
 * - 근거(실제로 존재하는 기사·공시 번호)가 없는 항목은 중립(0)으로 바꿈: 근거 없는 판단을 점수에 넣지 않음
 * - 종합 점수 = 50 + 평균 신호 × 25 (0~100). 근거 있는 항목이 하나도 없으면 null
 * @param {{factors?: {key, signal, summary, evidence?: string[]}[], oneLine?: string}} ai AI 원본 응답
 * @param {(id: string) => object | null} resolve "N3"·"D1" 같은 근거 번호를 실제 기사·공시로 바꾸는 함수
 */
export function scoreGrowth(ai, resolve) {
  const byKey = new Map((Array.isArray(ai?.factors) ? ai.factors : []).map((f) => [f?.key, f]));
  const factors = GROWTH_FACTORS.map((def) => {
    const f = byKey.get(def.key) || {};
    const evidence = (Array.isArray(f.evidence) ? f.evidence : []).map(resolve).filter(Boolean).slice(0, 3);
    const raw = Math.round(Number(f.signal));
    const signal = evidence.length && Number.isFinite(raw) ? Math.max(-2, Math.min(2, raw)) : 0;
    return {
      ...def,
      signal,
      signalLabel: SIGNAL_LABEL[signal],
      summary: evidence.length && typeof f.summary === "string" ? f.summary : "최근 기사·공시에서 뚜렷한 근거를 찾지 못했어요.",
      evidence,
    };
  });
  const based = factors.filter((f) => f.evidence.length);
  const score = based.length ? Math.round(50 + (factors.reduce((a, f) => a + f.signal, 0) / factors.length) * 25) : null;
  return {
    score,
    label: score === null ? "판단 근거 부족" : score >= 65 ? "성장 신호 우세" : score >= 55 ? "다소 긍정" : score > 45 ? "엇갈림" : score > 35 ? "다소 부정" : "위축 신호 우세",
    oneLine: typeof ai?.oneLine === "string" ? ai.oneLine : "",
    factors,
    basedOn: based.length,
  };
}

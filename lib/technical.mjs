// 이동평균선(20·60·120·240일) 계산과 규칙 기반 차트 해석.
// 흔히 보는 기준(정배열/역배열, 240일선 위치, 골든·데드크로스)을 설명할 뿐 매수·매도 신호가 아닙니다.

export const MA_PERIODS = [20, 60, 120, 240];

/** @param {{date:string, close:number}[]} prices 날짜 오름차순 */
export function withMovingAverages(prices) {
  const sums = Object.fromEntries(MA_PERIODS.map((p) => [p, 0]));
  return prices.map((r, i) => {
    const row = { date: r.date, close: r.close };
    for (const p of MA_PERIODS) {
      sums[p] += r.close;
      if (i >= p) sums[p] -= prices[i - p].close;
      row[`ma${p}`] = i >= p - 1 ? Math.round((sums[p] / p) * 100) / 100 : null;
    }
    return row;
  });
}

const pct = (a, b) => ((a - b) / b) * 100;
const md = (d) => `${Number(d.slice(4, 6))}월 ${Number(d.slice(6, 8))}일`;

/** 최근 시점 기준 차트 해석. 이동평균이 모자라면 해당 항목은 건너뜁니다. */
export function analyzeChart(rows) {
  if (rows.length < 61) return null;
  const last = rows[rows.length - 1];
  const points = [];

  const { ma20, ma60, ma120, ma240 } = last;
  if ([ma20, ma60, ma120, ma240].every((v) => v != null)) {
    if (ma20 > ma60 && ma60 > ma120 && ma120 > ma240) {
      points.push({ key: "align", tone: "up", label: "정배열", text: "단기 이동평균선이 장기선 위에 차례로 놓인 정배열이에요. 상승 흐름이 이어지는 모양으로 봐요." });
    } else if (ma20 < ma60 && ma60 < ma120 && ma120 < ma240) {
      points.push({ key: "align", tone: "down", label: "역배열", text: "단기 이동평균선이 장기선 아래에 차례로 놓인 역배열이에요. 하락 흐름이 이어지는 모양으로 봐요." });
    } else {
      points.push({ key: "align", tone: "flat", label: "혼조", text: "이동평균선이 뒤섞여 있어요. 뚜렷한 방향 없이 흐름이 바뀌는 중일 수 있어요." });
    }
  }

  if (ma240 != null) {
    const gap = pct(last.close, ma240);
    points.push({
      key: "ma240",
      tone: gap >= 0 ? "up" : "down",
      label: `240일선 ${gap >= 0 ? "위" : "아래"} ${Math.abs(gap).toFixed(1)}%`,
      text: `주가가 약 1년 평균인 240일선보다 ${Math.abs(gap).toFixed(1)}% ${gap >= 0 ? "높아요. 장기 추세 위에 있다고 봐요." : "낮아요. 장기 추세 아래에 있다고 봐요."}`,
    });
  }

  if (ma60 != null) {
    const gap = pct(last.close, ma60);
    points.push({
      key: "ma60",
      tone: gap >= 0 ? "up" : "down",
      label: `60일선 ${gap >= 0 ? "위" : "아래"} ${Math.abs(gap).toFixed(1)}%`,
      text: `약 3개월 평균인 60일선과 비교하면 ${Math.abs(gap).toFixed(1)}% ${gap >= 0 ? "위에 있어요." : "아래에 있어요."}`,
    });
  }

  // 최근 20거래일 안의 20일선·60일선 교차
  for (let i = rows.length - 1; i > Math.max(0, rows.length - 21); i--) {
    const a = rows[i], b = rows[i - 1];
    if ([a.ma20, a.ma60, b.ma20, b.ma60].some((v) => v == null)) break;
    if (b.ma20 <= b.ma60 && a.ma20 > a.ma60) {
      points.push({ key: "cross", tone: "up", label: "골든크로스", text: `${md(a.date)}에 20일선이 60일선을 위로 뚫었어요(골든크로스). 단기 흐름이 좋아졌다는 신호로 흔히 봐요.` });
      break;
    }
    if (b.ma20 >= b.ma60 && a.ma20 < a.ma60) {
      points.push({ key: "cross", tone: "down", label: "데드크로스", text: `${md(a.date)}에 20일선이 60일선 아래로 내려갔어요(데드크로스). 단기 흐름이 약해졌다는 신호로 흔히 봐요.` });
      break;
    }
  }

  const up = points.filter((p) => p.tone === "up").length;
  const down = points.filter((p) => p.tone === "down").length;
  const headline = up > down ? "차트 흐름이 위쪽을 향하고 있어요" : down > up ? "차트 흐름이 아래쪽을 향하고 있어요" : "차트 흐름이 뚜렷하지 않아요";
  return { headline, tone: up > down ? "up" : down > up ? "down" : "flat", points };
}

// Anthropic Messages API를 서버(API route)에서만 호출합니다.
// 클라이언트로는 절대 ANTHROPIC_API_KEY가 노출되지 않습니다.

async function callClaude({ system, userText, maxTokens = 1200 }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다 (.env.local 확인)");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userText }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API 오류 (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = (data.content || []).map((b) => b.text || "").join("\n");
  // 모델이 JSON 문자열 값 안에 실제 줄바꿈을 그대로 넣는 경우가 있어 JSON.parse가 깨집니다.
  // 문자열 밖 줄바꿈은 공백으로 바꿔도 JSON 문법상 문제없으므로, 통째로 공백 처리해 정리합니다.
  const clean = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim()
    .replace(/\r?\n/g, " ");
  return JSON.parse(clean);
}

// 실제 최신 뉴스 목록(newsItems)을 근거로 3~5개의 핵심 이슈로 클러스터링하고,
// 각 이슈가 "뉴스 → 사업 → 실적"으로 왜 연결되는지 설명을 생성합니다.
// 반드시 주어진 뉴스에 근거해서만 답하도록 지시해 환각을 최소화합니다.
export async function clusterNewsIntoIssues({ companyName, oneLiner, businesses, newsItems }) {
  if (!newsItems || newsItems.length === 0) return [];

  const newsBlock = newsItems
    .map((n, i) => `[${i}] ${n.title} — ${n.description}`)
    .join("\n");

  const system = `당신은 초보 투자자에게 뉴스를 쉽게 설명해주는 금융 어시스턴트입니다.
아래 제공된 실제 뉴스 목록"만" 근거로 사용하세요. 목록에 없는 사실을 지어내지 마세요.
뉴스들을 3~5개의 핵심 이슈로 그룹핑하고, 각 이슈가 "뉴스 → 사업 → 실적"으로 왜 중요한지 설명하세요.
매수/매도 추천, 목표주가, 주가 방향 예측은 절대 하지 마세요.
아래 JSON 배열 형식으로만 답하세요. 다른 텍스트나 코드블록 표시 없이 순수 JSON만 출력하세요. 문자열 값 안에는 줄바꿈 문자를 절대 넣지 마세요 (한 문자열은 한 줄로).

[
  {
    "title": "이슈 제목 (짧게)",
    "chain": ["연결고리 1단계", "2단계", "3단계", "최종적으로 실적에 미치는 영향"],
    "explain": "초보자도 이해할 수 있는 2~3문장 설명",
    "newsIndexes": [해당 이슈에 근거가 된 뉴스의 번호들 (위 목록의 [번호])]
  }
]

기업 정보:
기업명: ${companyName}
한 줄 요약: ${oneLiner}
사업 구조: ${businesses.map((b) => `${b.name} ${b.pct}%`).join(", ")}`;

  const parsed = await callClaude({
    system,
    userText: `다음은 "${companyName}" 관련 최근 뉴스 목록입니다.\n\n${newsBlock}`,
    maxTokens: 3000,
  });

  // newsIndexes를 실제 뉴스 링크로 치환
  return (Array.isArray(parsed) ? parsed : []).map((issue) => ({
    title: issue.title,
    chain: issue.chain || [],
    explain: issue.explain || "",
    relatedNews: (issue.newsIndexes || [])
      .filter((i) => newsItems[i])
      .map((i) => ({ title: newsItems[i].title, link: newsItems[i].link })),
  }));
}

// 사용자가 입력한 자유서술형 투자 이유를 분석합니다.
export async function checkInvestmentLogic({ companyName, context, userReason }) {
  const system = `당신은 초보 투자자의 '투자 논리'를 점검해주는 금융 어시스턴트입니다.
절대로 매수·매도를 추천하거나 목표주가를 제시하지 마세요. "사세요", "파세요", "좋습니다" 같은
직접적 추천 표현도 쓰지 마세요. 사용자가 입력한 투자 이유를 분석해서, 아래 JSON 형식으로만 답하세요.
다른 텍스트나 코드블록 표시 없이 순수 JSON만 출력하세요.

{
  "reasonType": "기업 실적 | 산업 성장 | 기술 경쟁력 | 뉴스 | 주변 추천 | 유튜브 · SNS | 단순 기대감 | 가격 상승 | 배당 | 기타 중 하나",
  "understood": "AI가 이해한 사용자의 투자 논리를 1~2문장으로 정리",
  "confirmed": ["사용자 근거 중 이미 잘 확인한 부분 0~3개 (근거가 부실하면 빈 배열)"],
  "needsCheck": ["추가로 확인해보면 좋은 부분 2~4개, 회사 정보를 반영해서 구체적으로"],
  "checklist": ["투자 판단 전 확인해야 할 핵심 정보 3~5개"],
  "guidance": "공격적이지 않고 부드러운 톤의 종합 안내 문구 2~3문장. 최종 판단은 사용자 몫이라는 뉘앙스 포함."
}

회사 정보:
${context}`;

  return callClaude({
    system,
    userText: `내가 ${companyName}에 투자하려는 이유: ${userReason}`,
    maxTokens: 2000,
  });
}

// 손으로 정리해두지 않은 기업(4개 외)이 검색됐을 때, 그 자리에서 기업 프로필을 생성합니다.
// 반드시 화면에 "AI 생성" 표시를 해서 사용자가 이게 검증된 공시자료가 아니라는 걸 알 수 있게 해야 합니다.
export async function generateCompanyProfile({ companyName, ticker }) {
  const system = `당신은 한국 상장기업을 초보 투자자에게 쉽게 설명하는 금융 어시스턴트입니다.
아래 회사에 대해 일반적으로 알려진 공개 정보를 바탕으로 초보자용 설명을 만드세요.
확실하지 않은 수치는 대략적인 추정으로 표현하고, 근거 없는 구체적 숫자를 지어내지 마세요.
매수/매도 추천, 목표주가, 주가 방향 예측은 절대 하지 마세요.
아래 JSON 형식으로만 답하세요. 다른 텍스트나 코드블록 표시 없이 순수 JSON만 출력하세요.
문자열 값 안에는 줄바꿈 문자를 절대 넣지 마세요.

{
  "industry": "산업군 (짧게)",
  "oneLiner": "이 회사가 무엇을 하는 회사인지 2~3문장, 초보자가 이해하기 쉽게",
  "products": "대표 제품/서비스",
  "customers": "주요 고객",
  "competitors": "주요 경쟁사 2~4개",
  "businesses": [{"name": "사업부문명", "pct": 대략적인 매출비중 추정치(숫자, %)}],
  "businessExplain": "사업구조가 실적에 어떻게 연결되는지 2~3문장",
  "checkpoints": [{"title": "체크포인트 제목", "why": "왜 중요한지 1~2문장"}]
}
businesses는 2~5개, pct 합계가 대략 100이 되도록 하세요. checkpoints는 2~4개로 하세요.`;

  return callClaude({
    system,
    userText: `종목명: ${companyName} (종목코드 ${ticker})`,
    maxTokens: 1500,
  });
}

// 사용자가 화면에서 아무 단어/구절이나 드래그해서 선택했을 때, 그 자리에서 뜻을 설명합니다.
export async function defineTerm({ term, context }) {
  const system = `당신은 금융 초보자가 글을 읽다가 모르는 단어나 표현을 만났을 때 쉽게 설명해주는 어시스턴트입니다.
사용자가 화면에서 방금 선택한 단어나 문구의 의미를 1~2문장으로, 전문용어를 최대한 풀어서 설명하세요.
일반 단어라 특별히 설명할 게 없다면 그 사실을 짧게 알려주세요.
매수/매도 추천이나 투자 판단은 하지 마세요.
아래 JSON 형식으로만 답하세요. 다른 텍스트나 코드블록 표시 없이 순수 JSON만 출력하세요.
문자열 값 안에는 줄바꿈 문자를 넣지 마세요.

{"explanation": "설명 1~2문장"}

참고 문맥(이 단어가 등장한 화면): ${context || "정보 없음"}`;

  return callClaude({
    system,
    userText: `이 단어/문구를 설명해줘: "${term}"`,
    maxTokens: 300,
  });
}

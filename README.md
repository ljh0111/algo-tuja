# 알고투자 — AI 기업 이해 & 투자 논리 점검 (2026 금융 AI Challenge MVP)

## 이 프로젝트가 실시간으로 하는 일

- **재무 실적(매출액/영업이익/당기순이익)**: DART 오픈API에서 실시간 조회
- **최신 뉴스**: Google 뉴스 RSS에서 실시간 조회 (키 발급 불필요)
  - 원래는 네이버 뉴스 검색 API를 쓰려 했지만, 2026년 7월 31일부로 네이버가 검색 API를
    "NAVER API HUB"(네이버클라우드플랫폼, 종량제·별도 가입 필요)로 이전하면서 기존
    개발자센터에서는 더 이상 무료로 즉시 발급받을 수 없게 됐습니다. 대회 마감까지 시간이
    촉박해 우선 키 없이 바로 되는 Google 뉴스 RSS로 대체했습니다. 나중에 여유가 되면
    `lib/news.js`만 NAVER API HUB 연동으로 교체하면 됩니다.
- **핵심 이슈 클러스터링 & "왜 중요한가" 설명**: 위에서 가져온 실제 뉴스를 근거로 Claude가 실시간 생성 (뉴스에 없는 내용은 지어내지 않도록 프롬프트로 제한)
- **AI 투자 논리 점검**: 사용자가 입력한 투자 이유를 Claude가 실시간 분석

사업부문별 매출 비중(파이차트)과 체크포인트는 `lib/companies.js`에 미리 정리해둔 값입니다. DART가
이 정보를 구조화된 형태로 제공하지 않기 때문에, 분기마다 사업보고서를 보고 직접 업데이트해야 합니다.

---

## 1. API 키 2개 발급받기 (본인이 직접 해야 하는 부분)

| 키 | 발급처 | 비고 |
|---|---|---|
| `DART_API_KEY` | https://opendart.fss.or.kr → 회원가입 → 인증키 신청 | 무료, 즉시 발급 |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → API Keys | 유료(사용량 기반), 이 프로젝트 규모면 비용이 매우 낮음 |

(뉴스는 Google 뉴스 RSS를 써서 키가 필요 없습니다.)

발급받은 키는 프로젝트 루트의 `.env.local` 파일에 넣습니다 (`.env.local.example`을 복사해서 사용).

```bash
cp .env.local.example .env.local
# .env.local 파일을 열어서 실제 키 값으로 채워넣기
```

## 2. 로컬에서 실행해보기

터미널(명령 프롬프트)에서 이 프로젝트 폴더로 이동한 뒤:

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속 → 검색창에 "삼성전자" 입력 → 정상적으로 실적/뉴스/이슈가 뜨는지 확인합니다.

## 3. Vercel에 배포해서 공모전 제출용 URL 만들기

1. 이 프로젝트 폴더를 깃허브(GitHub) 저장소로 올립니다.
   ```bash
   git init
   git add .
   git commit -m "init"
   ```
   깃허브에서 새 저장소를 만든 뒤 안내에 따라 push 합니다.

2. https://vercel.com 에 깃허브 계정으로 로그인 → "Add New Project" → 방금 만든 저장소 선택 → Import.

3. 배포 설정 화면에서 **Environment Variables**에 아래 2개를 똑같이 추가합니다.
   - `DART_API_KEY`
   - `ANTHROPIC_API_KEY`

4. "Deploy" 클릭 → 몇 분 후 `https://프로젝트이름.vercel.app` 형태의 URL이 생성됩니다.
   이 URL이 daker.ai 제출 폼에 넣을 **배포 URL**입니다.

## 4. 기업 검색 범위

검색은 코스피·코스닥 **전체 상장기업**으로 열려 있습니다 (`lib/dartCorpList.js`가 DART 고유번호
전체 목록을 받아와 이름/종목코드로 찾습니다).

- `lib/companies.js`에 손으로 정리해둔 **삼성전자·SK하이닉스·현대자동차·NAVER 4개**는 사업부문별
  매출 비중과 체크포인트까지 사람이 확인한 값을 그대로 씁니다. 여기에 같은 형식으로 객체를 추가하면
  해당 기업도 큐레이션 데이터로 취급됩니다.
- **그 외 모든 기업**은 검색되는 순간 AI가 그 자리에서 기업 설명·사업구조 추정치·체크포인트를
  생성합니다 (`lib/ai.js`의 `generateCompanyProfile`). 화면에 "AI가 생성한 기업 정보입니다" 배지가
  자동으로 뜨니 사용자가 구분할 수 있습니다.
- 재무 실적(DART)과 최신 뉴스·이슈 분석은 원래도 모든 기업에 대해 동적으로 동작합니다.

새 의존성으로 `adm-zip`이 추가됐으니, 코드를 받으신 뒤 `npm install`을 한 번 더 실행해야 합니다.

## 5. 문제가 생기면

- 기업 상세 페이지가 "데이터를 불러오지 못했습니다"라고 뜨면 → `.env.local`(로컬) 또는
  Vercel의 Environment Variables(배포)에 `DART_API_KEY`, `ANTHROPIC_API_KEY`가 정확히
  들어갔는지 확인하세요.
- 뉴스/이슈가 안 뜨면 → Google 뉴스 RSS가 일시적으로 응답을 안 줬을 수 있습니다. 새로고침해보고,
  계속 안 되면 `lib/news.js`의 fetch 응답을 콘솔에 찍어 형식이 바뀌었는지 확인하세요.
- 재무 데이터가 비어있으면 → 해당 연도 사업보고서가 아직 DART에 공시되지 않았을 수 있습니다
  (`lib/dart.js`의 `candidateYears`가 최근 2개 연도를 순서대로 시도합니다).
- AI 이슈/투자논리 점검이 실패하면 → Anthropic 콘솔에서 API 키 잔액(크레딧)을 확인하세요.

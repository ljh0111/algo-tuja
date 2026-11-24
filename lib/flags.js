// 미래 성장 신호(AI 비용 발생) 스위치. 기본은 꺼짐(중지).
// 다시 켜려면 Vercel 환경변수 NEXT_PUBLIC_GROWTH_ENABLED=true 를 넣고 다시 배포하세요.
// (NEXT_PUBLIC_ 값은 빌드 때 화면 코드에도 들어가서, API 차단과 화면 숨김이 같은 값을 씀)
export const GROWTH_ENABLED = process.env.NEXT_PUBLIC_GROWTH_ENABLED === "true";

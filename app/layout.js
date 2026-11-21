import "./globals.css";

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

export const metadata = {
  title: "알고투자 — 내가 투자하려는 회사, 정말 알고 있나요?",
  description: "AI가 기업과 뉴스를 이해하기 쉽게 설명하고, 당신의 투자 논리를 점검합니다.",
  // 애드센스 사이트 소유 확인용 메타 태그
  ...(ADSENSE_CLIENT && { other: { "google-adsense-account": ADSENSE_CLIENT } }),
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* 애드센스 심사 크롤러가 찾을 수 있게 <head>에 일반 script로 (next/script는 data-nscript 경고가 납니다) */}
        {ADSENSE_CLIENT && (
          <script
            async
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          />
        )}
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}

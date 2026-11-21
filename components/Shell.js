"use client";

import Link from "next/link";

export default function Shell({ children }) {
  return (
    <div className="min-h-screen w-full bg-paper">
      <header className="z-30 border-b border-[#DCE6F7] bg-[#EEF4FD]/95 backdrop-blur lg:sticky lg:top-0">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 sm:px-6 lg:max-w-6xl lg:px-8">
          <Link href="/" className="flex min-h-11 items-center gap-2" aria-label="알고투자 홈">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">알</div>
            <span className="whitespace-nowrap font-serif text-sm font-semibold text-ink">알고투자</span>
          </Link>
        </div>
      </header>

      {children}

      <footer className="border-t border-line px-6 py-8 text-center text-xs leading-relaxed text-ink-faint">
        <p className="font-medium text-ink-soft">AI가 대신 투자하지 않습니다. 알고 투자할 수 있게 도와드립니다.</p>
        <p className="mt-2">재무: 금융감독원 DART · 시세: 금융위원회(공공데이터포털) · 국내 지표: 한국은행 ECOS · 미국 지표: FRED · 뉴스: Google 뉴스</p>
        <p className="mt-1">본 서비스는 정보 제공 목적이며 특정 종목의 매수·매도를 권유하지 않습니다.</p>
        <p className="mt-2">
          <Link href="/privacy" className="inline-flex min-h-11 items-center font-medium text-ink-soft underline underline-offset-2 hover:text-ink">개인정보처리방침</Link>
        </p>
      </footer>
    </div>
  );
}

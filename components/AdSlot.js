"use client";

import { useEffect } from "react";

// Google AdSense 광고 자리. 환경변수(게시자 ID·광고 단위 ID)가 없으면 아무것도 그리지 않습니다.
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT; // 예: ca-pub-1234567890123456

export default function AdSlot({ slot, className = "" }) {
  useEffect(() => {
    if (!ADSENSE_CLIENT || !slot) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // 광고 차단기 등으로 실패해도 페이지는 그대로
    }
  }, [slot]);

  if (!ADSENSE_CLIENT || !slot) return null;
  return (
    <aside aria-label="광고" className={`w-full overflow-hidden rounded-2xl bg-paper-raised p-3 ${className}`}>
      <div className="mb-1 text-[10px] font-medium text-ink-faint">광고</div>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}

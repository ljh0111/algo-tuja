import { Loader2 } from "lucide-react";
import Shell from "@/components/Shell";

// 검색에서 회사를 누르면 서버 응답을 기다리지 않고 바로 이 화면으로 넘어갑니다 (없으면 이전 화면이 멈춘 듯 보임)
export default function Loading() {
  return (
    <Shell>
      <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center" role="status">
        <Loader2 size={22} className="animate-spin text-amber" aria-hidden="true" />
        <div className="mt-3 text-sm text-ink-soft">기업 정보와 재무 데이터를 불러오는 중...</div>
      </div>
    </Shell>
  );
}

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, X } from "lucide-react";

// containerRef 안에서 사용자가 텍스트를 드래그 선택했을 때만 작은 "설명보기" 버튼이 뜹니다.
// 평소에는 화면에 아무것도 표시되지 않아 방해가 되지 않습니다.
export default function TermLookup({ containerRef, context }) {
  const [selection, setSelection] = useState(null); // { text, x, y }
  const [popup, setPopup] = useState(null); // { text, status, explanation }
  const reqId = useRef(0); // 닫거나 새로 찾으면 이전 응답은 무시
  const closePopup = () => {
    reqId.current++;
    setPopup(null);
  };

  useEffect(() => {
    function handleSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelection(null);
        return;
      }
      const text = sel.toString().trim();
      // 너무 짧거나(선택 실수) 너무 긴 선택(문단 전체)은 무시합니다.
      if (!text || text.length < 2 || text.length > 25) {
        setSelection(null);
        return;
      }
      const anchorNode = sel.anchorNode;
      if (!containerRef.current || !anchorNode || !containerRef.current.contains(anchorNode)) {
        setSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setSelection(null);
        return;
      }
      setSelection({ text, x: rect.left + rect.width / 2, y: rect.top });
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [containerRef]);

  const lookup = useCallback(async () => {
    if (!selection) return;
    const term = selection.text;
    const id = ++reqId.current;
    setPopup({ text: term, status: "loading", explanation: "" });
    setSelection(null);
    window.getSelection()?.removeAllRanges();

    try {
      const res = await fetch("/api/define-term", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term, context }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "설명을 가져오지 못했어요.");
      if (id !== reqId.current) return;
      setPopup({ text: term, status: "done", explanation: data.explanation });
    } catch (e) {
      if (id !== reqId.current) return;
      setPopup({ text: term, status: "error", explanation: "" });
    }
  }, [selection, context]);

  return (
    <>
      {selection && (
        <button
          onClick={lookup}
          className="fixed z-40 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-white shadow-lg"
          style={{ left: selection.x, top: selection.y - 10, background: "#191F28" }}
        >
          용어 설명
        </button>
      )}

      {popup && (
        <div className="fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-80">
          <div className="animate-sheet-up rounded-xl border p-4 shadow-xl" style={{ background: "#FFFFFF", borderColor: "#E5E8EB" }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: "#3182F6" }}>{popup.text}</span>
              <button onClick={closePopup} aria-label="닫기" className="rounded-full p-1.5 hover:bg-black/5">
                <X size={16} style={{ color: "#5B6573" }} />
              </button>
            </div>
            {popup.status === "loading" && (
              <div className="flex items-center gap-2 text-xs" style={{ color: "#5B6573" }}>
                <Loader2 size={13} className="animate-spin" /> 설명을 찾는 중...
              </div>
            )}
            {popup.status === "done" && (
              <p className="text-sm leading-relaxed" style={{ color: "#191F28" }}>{popup.explanation}</p>
            )}
            {popup.status === "error" && (
              <p className="text-xs" style={{ color: "#C0392B" }}>설명을 가져오지 못했어요. 다시 시도해주세요.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

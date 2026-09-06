"use client";

import { useEffect, useState, useCallback } from "react";
import { Sparkles, Loader2, X } from "lucide-react";

// containerRef 안에서 사용자가 텍스트를 드래그 선택했을 때만 작은 "설명보기" 버튼이 뜹니다.
// 평소에는 화면에 아무것도 표시되지 않아 방해가 되지 않습니다.
export default function TermLookup({ containerRef, context }) {
  const [selection, setSelection] = useState(null); // { text, x, y }
  const [popup, setPopup] = useState(null); // { text, status, explanation }

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
      setPopup({ text: term, status: "done", explanation: data.explanation });
    } catch (e) {
      setPopup({ text: term, status: "error", explanation: "" });
    }
  }, [selection, context]);

  return (
    <>
      {selection && (
        <button
          onClick={lookup}
          className="fixed z-40 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-white shadow-lg"
          style={{ left: selection.x, top: selection.y - 10, background: "#16233F" }}
        >
          <Sparkles size={12} /> 설명보기
        </button>
      )}

      {popup && (
        <div className="fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-80">
          <div className="rounded-3xl border p-4 shadow-xl" style={{ background: "#FFFFFF", borderColor: "#E4E6E1" }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: "#C98A2E" }}>{popup.text}</span>
              <button onClick={() => setPopup(null)}>
                <X size={16} style={{ color: "#8A90A0" }} />
              </button>
            </div>
            {popup.status === "loading" && (
              <div className="flex items-center gap-2 text-xs" style={{ color: "#8A90A0" }}>
                <Loader2 size={13} className="animate-spin" /> 설명을 찾는 중...
              </div>
            )}
            {popup.status === "done" && (
              <p className="text-sm leading-relaxed" style={{ color: "#16233F" }}>{popup.explanation}</p>
            )}
            {popup.status === "error" && (
              <p className="text-xs" style={{ color: "#B5493A" }}>설명을 가져오지 못했어요. 다시 시도해주세요.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

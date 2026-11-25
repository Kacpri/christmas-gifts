"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

const THRESHOLD = 120;

export function ScrollToBottomButton({
  boxRef,
}: {
  boxRef: RefObject<HTMLDivElement | null>;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => {
      setShow(el.scrollHeight - el.scrollTop - el.clientHeight > THRESHOLD);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [boxRef]);

  const scrollToBottom = useCallback(() => {
    const el = boxRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [boxRef]);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={scrollToBottom}
      aria-label="Przewiń na dół"
      className="absolute bottom-3 right-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-input-line bg-surface text-muted shadow-md hover:bg-mist"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 5v14" />
        <path d="M19 12l-7 7-7-7" />
      </svg>
    </button>
  );
}

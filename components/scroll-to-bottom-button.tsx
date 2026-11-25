"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

const THRESHOLD = 120;

export function ScrollToBottomButton({
  boxRef,
  messageCount,
  threadKey,
  lastSenderIsMe,
}: {
  boxRef: RefObject<HTMLDivElement | null>;
  messageCount: number;
  threadKey: string;
  lastSenderIsMe: boolean;
}) {
  const [show, setShow] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const prevCountRef = useRef(messageCount);
  const prevKeyRef = useRef(threadKey);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => {
      const away = el.scrollHeight - el.scrollTop - el.clientHeight > THRESHOLD;
      setShow(away);
      if (!away) setNewCount(0);
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

  useEffect(() => {
    const keyChanged = prevKeyRef.current !== threadKey;
    prevKeyRef.current = threadKey;
    const prev = prevCountRef.current;
    prevCountRef.current = messageCount;
    if (keyChanged) {
      setNewCount(0);
      return;
    }
    if (messageCount > prev) {
      if (lastSenderIsMe) return;
      const el = boxRef.current;
      const away = el
        ? el.scrollHeight - el.scrollTop - el.clientHeight > THRESHOLD
        : true;
      if (away) setNewCount((c) => c + (messageCount - prev));
    }
  }, [messageCount, threadKey, lastSenderIsMe, boxRef]);

  const scrollToBottom = useCallback(() => {
    const el = boxRef.current;
    if (!el) return;
    setNewCount(0);
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [boxRef]);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={scrollToBottom}
      aria-label={
        newCount > 0
          ? `Przewiń na dół (${newCount} nowe wiadomości)`
          : "Przewiń na dół"
      }
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
      {newCount > 0 && (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#14532d] px-1 text-[10px] font-bold leading-none text-white dark:bg-accent">
          {newCount}
        </span>
      )}
    </button>
  );
}

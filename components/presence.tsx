"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

export function Presence({
  open,
  children,
  className = "",
  onClick,
  backdrop = false,
  sheetClassName = "",
  sheetFrom = "translate-y-full opacity-0",
  sheetTo = "translate-y-0 opacity-100",
  sheetOnClick,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  backdrop?: boolean;
  sheetClassName?: string;
  sheetFrom?: string;
  sheetTo?: string;
  sheetOnClick?: (e: MouseEvent<HTMLDivElement>) => void;
}) {
  const [rendered, setRendered] = useState(open);
  const [shown, setShown] = useState(false);
  const lastChildren = useRef<ReactNode>(null);

  useEffect(() => {
    if (children != null && children !== false) {
      lastChildren.current = children;
    }
  }, [children]);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setShown(true))
      );
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = window.setTimeout(() => setRendered(false), 220);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!rendered) return null;

  return (
    <div className={className} onClick={onClick}>
      {backdrop && (
        <div
          aria-hidden
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
            shown ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      <div
        className={`transition-all duration-200 ease-out motion-reduce:transition-none ${sheetClassName} ${
          shown ? sheetTo : sheetFrom
        }`}
        onClick={sheetOnClick}
      >
        {open ? children : lastChildren.current}
      </div>
    </div>
  );
}

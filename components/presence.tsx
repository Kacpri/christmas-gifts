"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

const backdropStack: object[] = [];

export function Presence({
  open,
  children,
  className = "",
  style,
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
  style?: CSSProperties;
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
  const idRef = useRef<object>(null);
  if (idRef.current === null) idRef.current = {};
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

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

  useEffect(() => {
    if (!open || !backdrop) return;
    const id = idRef.current!;
    backdropStack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && backdropStack[backdropStack.length - 1] === id) {
        onClickRef.current?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      const i = backdropStack.indexOf(id);
      if (i !== -1) backdropStack.splice(i, 1);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, backdrop]);

  if (!rendered) return null;

  return (
    <div className={className} style={style} onClick={onClick}>
      {backdrop && (
        <div
          aria-hidden
          className={`absolute inset-0 touch-none bg-black/40 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
            shown ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      <div
        role={backdrop ? "dialog" : undefined}
        aria-modal={backdrop ? true : undefined}
        className={`transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${sheetClassName} ${
          shown ? sheetTo : sheetFrom
        }`}
        onClick={sheetOnClick}
      >
        {open ? children : lastChildren.current}
      </div>
    </div>
  );
}

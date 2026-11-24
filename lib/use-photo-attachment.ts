"use client";

import { useEffect, useRef, useState } from "react";

import { CHAT_PHOTO_MAX_BYTES, CHAT_PHOTO_TYPES } from "@/lib/chat-photo";

export function usePhotoAttachment() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function pick(f: File | null) {
    if (!f) {
      clear();
      return;
    }
    if (!CHAT_PHOTO_TYPES[f.type]) {
      setError("Dozwolone formaty: JPG, PNG, WebP.");
      return;
    }
    if (f.size > CHAT_PHOTO_MAX_BYTES) {
      setError("Zdjęcie może mieć maks. 4 MB.");
      return;
    }
    setError(null);
    setFile(f);
    setDims(null);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    const img = new Image();
    img.onload = () =>
      setDims({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = url;
  }

  function clear() {
    setFile(null);
    setError(null);
    setPreviewUrl(null);
    setDims(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return {
    file,
    error,
    previewUrl,
    dims,
    inputRef,
    pick,
    clear,
    hasPhoto: file != null,
  };
}

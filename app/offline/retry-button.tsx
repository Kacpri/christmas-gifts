"use client";

export function RetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-2 rounded-xl bg-cream px-5 py-2.5 text-sm font-medium text-[#0d4024] shadow-sm transition-colors hover:bg-cream/90"
    >
      Spróbuj ponownie
    </button>
  );
}

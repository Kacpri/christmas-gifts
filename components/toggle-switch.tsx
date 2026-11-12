export function ToggleSwitch({
  on,
  disabled,
}: {
  on: boolean;
  disabled?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        on ? "bg-cream" : "bg-cream/25"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full transition-transform ${
          on ? "translate-x-[22px] bg-[#0d4024]" : "translate-x-0.5 bg-cream/80"
        }`}
      />
    </span>
  );
}

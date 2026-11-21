export function ToggleSwitch({
  on,
  disabled,
  tone = "dark",
}: {
  on: boolean;
  disabled?: boolean;
  tone?: "dark" | "light";
}) {
  const track =
    tone === "light"
      ? on
        ? "bg-accent"
        : "bg-[#a9b5ac]"
      : on
        ? "bg-cream"
        : "bg-cream/25";
  const knob = tone === "light" ? "bg-white" : on ? "bg-[#0d4024]" : "bg-cream/80";

  return (
    <span
      aria-hidden
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${track} ${disabled ? "opacity-50" : ""}`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full transition-transform ${
          on ? "translate-x-[22px]" : "translate-x-0.5"
        } ${knob}`}
      />
    </span>
  );
}

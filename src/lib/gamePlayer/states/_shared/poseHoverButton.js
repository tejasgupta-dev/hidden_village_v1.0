"use client";

export default function PoseHoverButton({
  children,
  className = "",
  hoverMS = 800,
  disabled = false,
  ...props
}) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={[
        "next-button",                 // IMPORTANT: PoseCursor matches this
        "relative overflow-hidden",     // needed for progress bar
        "rounded-3xl ring-2 ring-white/20",
        "transition-all duration-150",
        disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-white/10",
        className,
      ].join(" ")}
      data-pose-hover-ms={hoverMS}     // per-button dwell time
      style={{
        ...(props.style ?? {}),
        // PoseCursor will set --pose-progress on the hovered element
        ["--pose-progress"]: 0,
      }}
    >
      {/* progress bar */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 bottom-0 h-[6px] w-full bg-white/10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 bottom-0 h-[6px] bg-green-500/80"
        style={{
          width: "calc(var(--pose-progress) * 100%)",
          transition: "width 50ms linear",
        }}
      />

      <span className="relative z-10">{children}</span>
    </button>
  );
}

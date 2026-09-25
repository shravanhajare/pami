"use client";

import { cn } from "cn";

// UISegmentedControl: a grey track with a raised "thumb" that slides under
// the selected segment.
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
  "aria-label"?: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("relative grid h-8 rounded-[9px] bg-fill p-0.5", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0.5 rounded-[7px] bg-card-2 shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)] transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "relative z-[1] flex items-center justify-center gap-1.5 rounded-[7px] text-[13px] font-medium transition-colors",
            option.value === value ? "text-foreground" : "text-foreground/80",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

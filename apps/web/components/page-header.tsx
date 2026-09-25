import { cn } from "cn";

// The iOS large title (34pt bold) with an optional eyebrow line above it —
// the "THURSDAY, 25 SEPTEMBER" treatment Apple uses in Fitness and News.
export function PageHeader({
  title,
  eyebrow,
  subtitle,
  accessory,
  className,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  subtitle?: React.ReactNode;
  accessory?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-3 px-1", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[34px] leading-[41px] font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[15px] text-muted-foreground">{subtitle}</p>}
      </div>
      {accessory && <div className="shrink-0 pb-1.5">{accessory}</div>}
    </div>
  );
}

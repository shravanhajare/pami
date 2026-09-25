import * as React from "react";
import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "cn";

// iOS "inset grouped" lists — the Settings-app building block: a rounded
// card of 44pt+ rows with hairline separators inset past the icon, an
// uppercase footnote header above and an optional explanatory footer below.

export function ListSection({
  title,
  footer,
  action,
  className,
  children,
}: {
  title?: React.ReactNode;
  footer?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-1.5", className)}>
      {(title || action) && (
        <div className="flex items-end justify-between px-4">
          {title && (
            <h2 className="text-[13px] font-normal tracking-wide text-muted-foreground uppercase">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      <div className="overflow-hidden rounded-xl bg-card">{children}</div>
      {footer && <p className="px-4 text-[13px] leading-snug text-muted-foreground">{footer}</p>}
    </section>
  );
}

// The Settings-app icon: a white glyph on a colored rounded square.
export function IconBadge({
  icon: Icon,
  className,
  size = "md",
}: {
  icon: LucideIcon;
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center text-white",
        size === "md" ? "size-[29px] rounded-[7px]" : "size-10 rounded-[10px]",
        className ?? "bg-ios-gray",
      )}
    >
      <Icon className={size === "md" ? "size-[18px]" : "size-6"} strokeWidth={2} />
    </span>
  );
}

type RowProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  detail?: React.ReactNode;
  destructive?: boolean;
  chevron?: boolean;
  className?: string;
};

function RowBody({ icon, title, subtitle, detail, destructive, chevron }: RowProps) {
  return (
    <>
      {icon}
      {/* The hairline lives on the text column, so it starts after the
          icon — exactly how UITableView insets its separators. */}
      <span className="flex min-h-11 min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 group-not-first/row:shadow-[inset_0_0.5px_0_var(--border)]">
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-[17px] leading-snug",
              destructive && "text-destructive",
            )}
          >
            {title}
          </span>
          {subtitle && (
            <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
              {subtitle}
            </span>
          )}
        </span>
        {detail !== undefined && (
          <span className="max-w-[55%] shrink-0 truncate text-right text-[17px] text-muted-foreground">
            {detail}
          </span>
        )}
        {chevron && <ChevronRight className="-mr-1 size-5 shrink-0 text-label-3" strokeWidth={2.5} />}
      </span>
    </>
  );
}

const rowClass = "group/row flex w-full items-center gap-3 pl-4 text-left";

export function ListRow(props: RowProps) {
  return (
    <div className={cn(rowClass, props.className)}>
      <RowBody {...props} />
    </div>
  );
}

export function ListLinkRow({
  href,
  external,
  ...props
}: RowProps & { href: string; external?: boolean }) {
  const className = cn(rowClass, "transition-colors active:bg-fill", props.className);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        <RowBody chevron {...props} />
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      <RowBody chevron {...props} />
    </Link>
  );
}

export function ListButtonRow({
  onClick,
  disabled,
  ...props
}: RowProps & { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        rowClass,
        "transition-colors active:bg-fill disabled:opacity-40",
        props.className,
      )}
    >
      <RowBody {...props} />
    </button>
  );
}

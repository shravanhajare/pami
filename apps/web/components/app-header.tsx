"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

function subscribeScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

// Past this the page's large title has slid under the bar, so the bar
// takes over the title — the UINavigationBar large-title handoff.
const TITLE_HANDOFF_PX = 44;

export function AppHeader({ links }: { links: { href: string; label: string; title: string }[] }) {
  const pathname = usePathname();
  const scrolled = useSyncExternalStore(subscribeScroll, () => window.scrollY > 4, () => false);
  const showTitle = useSyncExternalStore(
    subscribeScroll,
    () => window.scrollY > TITLE_HANDOFF_PX,
    () => false,
  );
  const current = links.find((l) => pathname === l.href || pathname.startsWith(`${l.href}/`));

  return (
    <header
      className={cn(
        "sticky top-0 z-20 transition-[background-color,box-shadow] duration-200",
        scrolled ? "ios-material hairline-b" : "bg-transparent",
      )}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="relative mx-auto flex h-11 max-w-3xl items-center justify-between px-4 sm:h-14 sm:px-6">
        <Link
          href="/dashboard"
          className="hidden items-center gap-2 text-[17px] font-semibold tracking-tight sm:flex"
        >
          <span className="pami-gradient flex size-7 items-center justify-center rounded-[8px] text-sm text-black shadow-sm">
            P
          </span>
          PAMI
        </Link>

        {/* Phones: the compact centered title that fades in on scroll. */}
        <p
          aria-hidden
          className={cn(
            "absolute inset-x-16 truncate text-center text-[17px] font-semibold transition-opacity duration-200 sm:hidden",
            showTitle ? "opacity-100" : "opacity-0",
          )}
        >
          {current?.title}
        </p>

        <nav aria-label="Main" className="hidden gap-0.5 rounded-full bg-fill p-1 text-[13px] font-medium sm:flex">
          {links.map((link) => {
            const active = link === current;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-1.5 transition-colors",
                  active ? "bg-card-2 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

// Outline glyphs for idle tabs, filled for the selected one — the SF
// Symbols convention iOS tab bars follow.
const ICONS: Record<string, { idle: React.ReactNode; active: React.ReactNode }> = {
  "/dashboard": {
    idle: <path d="M3.5 11 12 3.8l8.5 7.2M5.5 9.5V19a1.5 1.5 0 0 0 1.5 1.5h3V15h4v5.5h3a1.5 1.5 0 0 0 1.5-1.5V9.5" />,
    active: (
      <path
        fill="currentColor"
        d="M11.3 3.3a1 1 0 0 1 1.4 0l8.6 7.7a.8.8 0 0 1-.5 1.4H19.5V19a2 2 0 0 1-2 2h-3v-5.5a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1V21h-3a2 2 0 0 1-2-2v-6.6H3.2a.8.8 0 0 1-.5-1.4Z"
      />
    ),
  },
  "/tasks": {
    idle: (
      <>
        <path d="M20.5 11.5a8.5 8.5 0 0 1-12.2 7.7L3.5 20.5l1.3-4.4a8.5 8.5 0 1 1 15.7-4.6Z" />
        <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" strokeWidth={2.6} />
      </>
    ),
    active: (
      <>
        <path fill="currentColor" d="M20.5 11.5a8.5 8.5 0 0 1-12.2 7.7L3.5 20.5l1.3-4.4a8.5 8.5 0 1 1 15.7-4.6Z" />
        <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" stroke="var(--background)" strokeWidth={2.6} />
      </>
    ),
  },
  "/mac": {
    idle: (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8.5 20h7M12 16v4" />
      </>
    ),
    active: (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" fill="currentColor" />
        <path d="M8.5 20h7M12 16v4" />
      </>
    ),
  },
  "/remote": {
    idle: (
      <>
        <rect x="2" y="4" width="14" height="10" rx="1.8" />
        <path d="M6 18h6" />
        <rect x="16.5" y="10.5" width="5.5" height="10" rx="1.5" />
      </>
    ),
    active: (
      <>
        <rect x="2" y="4" width="14" height="10" rx="1.8" fill="currentColor" />
        <path d="M6 18h6" />
        <rect x="16.5" y="10.5" width="5.5" height="10" rx="1.5" fill="currentColor" />
      </>
    ),
  },
  "/settings": {
    idle: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </>
    ),
    active: (
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    ),
  },
};

const TEXT_ENTRY = new Set(["text", "search", "email", "url", "password", "tel", "number"]);

function isTextEntry(el: EventTarget | null): boolean {
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return TEXT_ENTRY.has(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

export function MobileTabBar({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();

  // Flags <html data-keyboard="open"> while a text field has focus on a
  // touch screen, which slides this bar away (see globals.css) and lets
  // the Tasks composer sit right on top of the keyboard.
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const root = document.documentElement;
    let blurTimer: ReturnType<typeof setTimeout> | undefined;
    const onFocusIn = (e: FocusEvent) => {
      if (!isTextEntry(e.target)) return;
      clearTimeout(blurTimer);
      root.dataset.keyboard = "open";
    };
    // Deferred so tabbing between two fields doesn't flash the bar.
    const onFocusOut = () => {
      blurTimer = setTimeout(() => {
        if (!isTextEntry(document.activeElement)) delete root.dataset.keyboard;
      }, 80);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      clearTimeout(blurTimer);
      delete root.dataset.keyboard;
    };
  }, []);

  return (
    <nav
      data-slot="tab-bar"
      aria-label="Main"
      className="liquid-glass fixed inset-x-3 z-30 mx-auto flex h-[62px] max-w-md items-stretch rounded-full p-1 transition-[transform,opacity] duration-300 sm:hidden"
      style={{ bottom: "var(--tabbar-offset)" }}
    >
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        const icon = ICONS[link.href];
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium transition-colors duration-200 active:bg-white/10",
              active ? "bg-white/[0.09] text-tint" : "text-foreground/85",
            )}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="size-[25px]"
            >
              {active ? icon?.active : icon?.idle}
            </svg>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

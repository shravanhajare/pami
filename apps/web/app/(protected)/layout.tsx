import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MobileTabBar } from "@/components/mobile-tab-bar";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tasks", label: "Tasks" },
  { href: "/mac", label: "Mac" },
  { href: "/remote", label: "Remote" },
  { href: "/settings", label: "Settings" },
];

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts already redirects unauthenticated requests away from these
  // routes; this is the defense-in-depth check close to the data.
  if (!user) redirect("/login");

  return (
    <div className="flex flex-1 flex-col">
      <header
        className="pami-glass sticky top-0 z-10 flex items-center justify-between px-4 py-3 sm:px-6"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="pami-gradient flex size-7 items-center justify-center rounded-lg text-sm text-white">
            P
          </span>
          PAMI
        </Link>
        {/* Full nav in the header on wider screens; small screens get the
            bottom tab bar instead, so this would just be redundant there. */}
        <nav className="hidden gap-1 text-sm sm:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-8">
        {children}
      </main>

      <MobileTabBar links={NAV_LINKS} />
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
      <header className="pami-glass sticky top-0 z-10 flex items-center justify-between px-6 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="pami-gradient flex size-7 items-center justify-center rounded-lg text-sm text-white">
            P
          </span>
          PAMI
        </Link>
        <nav className="flex gap-1 text-sm">
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Dashboard
          </Link>
          <Link
            href="/mac"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Mac
          </Link>
          <Link
            href="/settings"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Settings
          </Link>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8">
        {children}
      </main>
    </div>
  );
}

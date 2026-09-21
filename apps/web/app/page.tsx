import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="pami-gradient flex size-16 items-center justify-center rounded-2xl shadow-lg shadow-purple-500/20">
        <span className="text-2xl font-semibold text-white">P</span>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight">PAMI</h1>
        <p className="max-w-md text-muted-foreground">
          Your personal AI agent. Always on your Mac, activated when you need
          it.
        </p>
      </div>
      {/* Base UI's Button enforces button semantics and shouldn't wrap a
          link (see components/ui/button.tsx) — style the Link directly
          with the same variant classes instead. */}
      <Link
        href={user ? "/dashboard" : "/login"}
        className={buttonVariants({ size: "lg" })}
      >
        {user ? "Open Dashboard" : "Log in"}
      </Link>
    </div>
  );
}

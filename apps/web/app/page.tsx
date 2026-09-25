import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-7 px-6 text-center">
      <div className="pami-gradient flex size-24 items-center justify-center rounded-[26px] shadow-xl shadow-black/50">
        <span className="text-[40px] font-bold text-black">P</span>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-[34px] leading-tight font-bold tracking-tight">PAMI</h1>
        <p className="max-w-xs text-[17px] text-muted-foreground">
          Your personal AI agent. Always on your Mac, activated when you need
          it.
        </p>
      </div>
      {/* Base UI's Button enforces button semantics and shouldn't wrap a
          link (see components/ui/button.tsx) — style the Link directly
          with the same variant classes instead. */}
      <Link
        href={user ? "/dashboard" : "/login"}
        className={buttonVariants({
          className: "pressable h-12 w-full max-w-xs rounded-xl text-[17px] font-semibold",
        })}
      >
        {user ? "Open PAMI" : "Sign In"}
      </Link>
    </div>
  );
}

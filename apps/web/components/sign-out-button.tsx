"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ListButtonRow } from "@/components/ui/list";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <ListButtonRow
      destructive
      title={<span className="block text-center">Sign Out</span>}
      onClick={handleSignOut}
    />
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { LiveActivityProvider } from "@/components/live-activity";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { ResumeRefresh } from "@/components/resume-refresh";

// `label` is the tab name, `title` what the compact nav bar shows once
// the page's large title scrolls away.
const NAV_LINKS = [
  { href: "/dashboard", label: "Home", title: "Home" },
  { href: "/tasks", label: "Tasks", title: "Tasks" },
  { href: "/mac", label: "Mac", title: "Mac" },
  { href: "/remote", label: "Remote", title: "Remote" },
  { href: "/settings", label: "Settings", title: "Settings" },
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
    <LiveActivityProvider userId={user.id}>
      <div className="flex flex-1 flex-col">
        <AppHeader links={NAV_LINKS} />

        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-1 pb-[calc(var(--tabbar-space)+1.5rem)] sm:px-6 sm:pt-6">
          {children}
        </main>

        <MobileTabBar links={NAV_LINKS} />
        <ResumeRefresh />
      </div>
    </LiveActivityProvider>
  );
}

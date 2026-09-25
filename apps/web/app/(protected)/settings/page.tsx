import { Laptop, Monitor } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { IconBadge, ListLinkRow, ListSection } from "@/components/ui/list";
import { SignOutButton } from "@/components/sign-out-button";
import { VoiceSettingsForm } from "@/components/voice-settings-form";
import { PushSettingsForm } from "@/components/push-settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("voice_responses_enabled, display_name")
    .eq("id", user!.id)
    .single();

  const name = profile?.display_name?.trim() || user!.email?.split("@")[0] || "PAMI";

  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Settings" />

      {/* The Apple Account card at the top of iOS Settings. */}
      <div className="flex items-center gap-3.5 rounded-xl bg-card px-4 py-3.5">
        <span className="pami-gradient flex size-14 shrink-0 items-center justify-center rounded-full text-[22px] font-semibold text-black uppercase">
          {name.charAt(0)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[20px] leading-tight font-semibold">{name}</p>
          <p className="truncate text-[13px] text-muted-foreground">{user!.email}</p>
        </div>
      </div>

      <ListSection title="Voice" footer="Applies everywhere — your paired Mac and this website.">
        <VoiceSettingsForm
          userId={user!.id}
          initialEnabled={profile?.voice_responses_enabled ?? true}
        />
      </ListSection>

      <ListSection
        title="Notifications"
        footer="Get a push notification on this device the moment PAMI needs your approval for something on the Mac."
      >
        <PushSettingsForm userId={user!.id} />
      </ListSection>

      <ListSection title="Devices">
        <ListLinkRow href="/mac" icon={<IconBadge icon={Laptop} className="bg-ios-gray" />} title="Paired Macs" />
        <ListLinkRow href="/remote" icon={<IconBadge icon={Monitor} className="bg-ios-blue" />} title="Remote Screen" />
      </ListSection>

      <ListSection>
        <SignOutButton />
      </ListSection>
    </div>
  );
}

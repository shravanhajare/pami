import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";
import { VoiceSettingsForm } from "@/components/voice-settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("voice_responses_enabled")
    .eq("id", user!.id)
    .single();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Your account and PAMI&rsquo;s behavior.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Voice</CardTitle>
          <CardDescription>Control whether PAMI talks back.</CardDescription>
        </CardHeader>
        <CardContent>
          <VoiceSettingsForm
            userId={user!.id}
            initialEnabled={profile?.voice_responses_enabled ?? true}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground break-all">{user!.email}</p>
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}

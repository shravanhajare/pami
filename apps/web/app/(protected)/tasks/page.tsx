import { createClient } from "@/lib/supabase/server";
import { MacOfflineBanner } from "@/components/mac-offline-banner";
import { TaskList } from "@/components/task-list";
import { VoiceResponseSpeaker } from "@/components/voice-response-speaker";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // ?q=… prefills the composer (dashboard suggestion chips); ?ask focuses it.
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const autoFocus = "ask" in params || q !== undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: tasks }, { data: profile }, { data: devices }] = await Promise.all([
    supabase.from("tasks").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("profiles").select("voice_responses_enabled").eq("id", user!.id).single(),
    supabase.from("devices").select("*").order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <VoiceResponseSpeaker
        userId={user!.id}
        initialEnabled={profile?.voice_responses_enabled ?? true}
        knownTaskIds={(tasks ?? []).map((t) => t.id)}
      />
      <TaskList
        userId={user!.id}
        initialTasks={tasks ?? []}
        initialText={q}
        autoFocus={autoFocus}
        banner={<MacOfflineBanner userId={user!.id} initialDevices={devices ?? []} />}
      />
    </>
  );
}

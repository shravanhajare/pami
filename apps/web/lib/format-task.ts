// Shared display formatting for task rows — used by TaskList (tasks tab)
// and the dashboard's recent-activity teaser, so both read the type/status
// vocabulary from HeartbeatLoop.execute() (apps/mac/Sources/PamiMac/
// HeartbeatLoop.swift) the same way.
const TYPE_LABELS: Record<string, string> = {
  ask: "Ask",
  manual_activation: "Activate",
  calendar_today: "Calendar",
  create_note: "Note",
  create_reminder: "Reminder",
  system_command: "Command",
  lock_screen: "Lock screen",
  volume_get: "Volume",
  volume_set: "Volume",
  music_control: "Music",
  clipboard_get: "Clipboard",
  clipboard_set: "Clipboard",
  quit_app: "Quit app",
  battery_status: "Battery",
  quick_command: "Mac control",
};

export function formatTaskType(type: string): string {
  return TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);

  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function insertTask(
  userId: string,
  fields: { type: string; title: string; prompt?: string },
) {
  const supabase = createClient();
  return supabase.from("tasks").insert({
    user_id: userId,
    source: "web",
    status: "pending",
    ...fields,
  });
}

export function QuickActions({ userId }: { userId: string }) {
  const [calendarPending, setCalendarPending] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [notePending, setNotePending] = useState(false);
  const [reminderText, setReminderText] = useState("");
  const [reminderPending, setReminderPending] = useState(false);
  const [command, setCommand] = useState("");
  const [commandPending, setCommandPending] = useState(false);

  async function checkCalendar() {
    setCalendarPending(true);
    await insertTask(userId, {
      type: "calendar_today",
      title: "What's on my calendar today?",
    });
    setCalendarPending(false);
  }

  async function createNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteTitle.trim()) return;
    setNotePending(true);
    await insertTask(userId, {
      type: "create_note",
      title: noteTitle,
      prompt: noteBody,
    });
    setNotePending(false);
    setNoteTitle("");
    setNoteBody("");
  }

  async function createReminder(e: React.FormEvent) {
    e.preventDefault();
    if (!reminderText.trim()) return;
    setReminderPending(true);
    await insertTask(userId, {
      type: "create_reminder",
      title: reminderText,
      prompt: reminderText,
    });
    setReminderPending(false);
    setReminderText("");
  }

  async function runCommand(e: React.FormEvent) {
    e.preventDefault();
    if (!command.trim()) return;
    setCommandPending(true);
    await insertTask(userId, {
      type: "system_command",
      title: command,
      prompt: command,
    });
    setCommandPending(false);
    setCommand("");
  }

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            onClick={checkCalendar}
            disabled={calendarPending}
          >
            {calendarPending ? "Checking…" : "What's on today?"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createNote} className="flex flex-col gap-2">
            <Input
              placeholder="Title"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
            />
            <Input
              placeholder="Content"
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={notePending || !noteTitle.trim()}
            >
              {notePending ? "Creating…" : "Create note"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reminders</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createReminder} className="flex flex-col gap-2">
            <Input
              placeholder="Remind me to…"
              value={reminderText}
              onChange={(e) => setReminderText(e.target.value)}
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={reminderPending || !reminderText.trim()}
            >
              {reminderPending ? "Creating…" : "Create reminder"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run a command</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={runCommand} className="flex flex-col gap-2">
            <Input
              placeholder="e.g. git status"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={commandPending || !command.trim()}
            >
              {commandPending ? "Sending…" : "Run"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Read-only commands run immediately. Anything else needs your
              approval below first.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

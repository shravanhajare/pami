"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PairDeviceForm() {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    const supabase = createClient();
    const { error } = await supabase.functions.invoke("device-pair-confirm", {
      body: { pairing_code: code.trim() },
    });

    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
    setCode("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="pairing-code">Pairing code from your Mac</Label>
        <Input
          id="pairing-code"
          placeholder="ABC-123"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          required
        />
      </div>
      <Button type="submit" disabled={pending || !code}>
        {pending ? "Pairing…" : "Add this Mac"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && (
        <p className="text-sm text-muted-foreground">Mac paired.</p>
      )}
    </form>
  );
}

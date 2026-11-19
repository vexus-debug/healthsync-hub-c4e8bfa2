import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { sendTestSms, buildResultSms } from "@/lib/sms.functions";

const PING = "GreenLabs test: your SMS alerts are working.";

const SmsTest = () => {
  const { profile, loading } = useAuth();
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(PING);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error: string | null; raw: string | null } | null>(null);
  if (loading) return null;
  const isSenior = (profile?.role ?? "").toLowerCase().includes("senior");
  if (!isSenior) return <Navigate to="/dashboard" replace />;

  const send = async () => {
    setBusy(true); setResult(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token;
      if (!accessToken) { setResult({ ok: false, error: "Please sign in again", raw: null }); return; }
      setResult(await sendTestSms({ data: { phone, message, accessToken } }));
    } catch (e: any) {
      setResult({ ok: false, error: e?.message ?? "Failed", raw: null });
    } finally { setBusy(false); }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">SMS Test</h1>
        <p className="text-sm text-muted-foreground mt-1">Send a test alert through Kudi SMS</p>
      </div>
      <Card className="border-border/60 shadow-soft max-w-2xl">
        <CardHeader><CardTitle className="text-base">Send test SMS</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Phone number</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08012345678" inputMode="tel" /></div>
          <div className="flex gap-2 flex-wrap">
            <Button type="button" variant="outline" size="sm" onClick={() => setMessage(PING)}>Quick ping</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setMessage(buildResultSms("Test", "TEST-0001"))}>Result ready preview</Button>
          </div>
          <div>
            <Label>Message</Label>
            <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={640} />
            <p className="text-xs text-muted-foreground mt-1">{message.length} characters · {Math.max(1, Math.ceil(message.length / 160))} SMS page(s)</p>
          </div>
          <Button variant="hero" className="w-full" disabled={busy || !phone || !message} onClick={send}>{busy ? "Sending…" : "Send test SMS"}</Button>
          {result && (
            <div className={`rounded-lg border p-3 text-sm ${result.ok ? "border-primary/40 bg-primary/5" : "border-destructive/40 bg-destructive/5"}`}>
              <p className="font-medium">{result.ok ? "Sent successfully" : `Failed: ${result.error}`}</p>
              {result.raw && <pre className="mt-2 text-xs whitespace-pre-wrap break-all text-muted-foreground">{result.raw}</pre>}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default SmsTest;

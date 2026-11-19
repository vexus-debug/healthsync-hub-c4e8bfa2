import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const SITE_URL = "https://greenlabs.com.ng";

export function normalizeNgPhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (/^234\d{10}$/.test(digits)) return digits;
  if (/^0\d{10}$/.test(digits)) return "234" + digits.slice(1);
  if (/^\d{10}$/.test(digits)) return "234" + digits;
  return null;
}

export function buildResultSms(name: string, serial: string): string {
  const first = (name || "").trim().split(/\s+/)[0] || "Patient";
  return `Dear ${first}, your lab result (Ref: ${serial}) is ready at Green Medical Diagnostics. View it here: ${SITE_URL}/results?serial=${encodeURIComponent(serial)}`;
}

export const sendResultSms = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ serial: z.string().min(1), accessToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    const token = process.env["KUDI_SMS_TOKEN"];
    const sender = process.env["KUDI_SMS_SENDER_ID"] || "GreenLabs";
    if (!url || !key) return { ok: false, error: "Database not configured" };
    if (!token) return { ok: false, error: "SMS gateway not configured" };

    const db = createClient(url, key, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
    });
    const { data: u, error: authErr } = await db.auth.getUser(data.accessToken);
    if (authErr || !u?.user) return { ok: false, error: "Not signed in" };

    const { data: form, error } = await db
      .from("test_forms")
      .select("serial, patient_name, phone")
      .eq("serial", data.serial)
      .maybeSingle();
    if (error || !form) return { ok: false, error: "Test form not found" };

    const phone = normalizeNgPhone((form as any).phone ?? "");
    if (!phone) return { ok: false, error: "Patient has no valid phone number" };

    const body = new FormData();
    body.append("token", token);
    body.append("senderID", sender);
    body.append("recipients", phone);
    body.append("message", buildResultSms((form as any).patient_name, (form as any).serial));
    body.append("gateway", "2");

    try {
      const res = await fetch("https://my.kudisms.net/api/sms", { method: "POST", body });
      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch { /* not json */ }
      const okStatus = json ? String(json.status ?? "").toLowerCase() === "success" || json.error_code === "000" : res.ok;
      if (!res.ok || !okStatus) {
        console.error("Kudi SMS failed", res.status, text);
        return { ok: false, error: json?.msg || json?.message || "SMS gateway rejected the message" };
      }
      return { ok: true, error: null };
    } catch (e) {
      console.error("Kudi SMS error", e);
      return { ok: false, error: "Could not reach SMS gateway" };
    }
  });

export const sendTestSms = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ phone: z.string().min(1).max(20), message: z.string().min(1).max(640), accessToken: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    const token = process.env["KUDI_SMS_TOKEN"];
    const sender = process.env["KUDI_SMS_SENDER_ID"] || "GreenLabs";
    if (!url || !key) return { ok: false, error: "Database not configured", raw: null as string | null };
    if (!token) return { ok: false, error: "SMS gateway not configured (KUDI_SMS_TOKEN missing)", raw: null };

    const db = createClient(url, key, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
    });
    const { data: u, error: authErr } = await db.auth.getUser(data.accessToken);
    if (authErr || !u?.user) return { ok: false, error: "Not signed in", raw: null };
    const [{ data: prof }, { data: roles }] = await Promise.all([
      db.from("profiles").select("role, active").eq("user_id", u.user.id).maybeSingle(),
      db.from("user_roles").select("role").eq("user_id", u.user.id),
    ]);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "lab_admin");
    const isSenior = (prof as any)?.active !== false && String((prof as any)?.role ?? "").toLowerCase().includes("senior");
    if (!isAdmin && !isSenior) return { ok: false, error: "Only admins can send test SMS", raw: null };

    const phone = normalizeNgPhone(data.phone);
    if (!phone) return { ok: false, error: "Invalid Nigerian phone number", raw: null };

    const body = new FormData();
    body.append("token", token);
    body.append("senderID", sender);
    body.append("recipients", phone);
    body.append("message", data.message);
    body.append("gateway", "2");
    try {
      const res = await fetch("https://my.kudisms.net/api/sms", { method: "POST", body });
      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch { /* not json */ }
      const okStatus = json ? String(json.status ?? "").toLowerCase() === "success" || json.error_code === "000" : res.ok;
      if (!res.ok || !okStatus) return { ok: false, error: json?.msg || json?.message || `Gateway error (${res.status})`, raw: text.slice(0, 1000) };
      return { ok: true, error: null, raw: text.slice(0, 1000) };
    } catch {
      return { ok: false, error: "Could not reach SMS gateway", raw: null };
    }
  });

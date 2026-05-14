import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendResend } from "../_shared/resend.ts";
import { reminderDigestHtml, type TaskRow } from "../_shared/templates.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function turkeyDateString(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const headerSecret = req.headers.get("x-cron-secret");
  let urlSecret: string | null = null;
  try {
    urlSecret = new URL(req.url).searchParams.get("secret");
  } catch {
    urlSecret = null;
  }
  const got = headerSecret ?? urlSecret;
  if (!cronSecret || got !== cronSecret) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) {
    return new Response(JSON.stringify({ error: "Supabase ortam değişkenleri eksik" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const daysAhead = Math.min(14, Math.max(0, parseInt(Deno.env.get("REMINDER_DAYS_AHEAD") ?? "2", 10) || 2));

  const now = new Date();
  const todayTr = turkeyDateString(now);
  const end = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  end.setDate(end.getDate() + daysAhead);
  const endTr = turkeyDateString(end);

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tasks, error: taskErr } = await admin
    .from("tasks")
    .select("id,title,deadline,category,user_id,assigned_to")
    .gte("deadline", todayTr)
    .lte("deadline", endTr)
    .neq("status", "Done");

  if (taskErr) {
    return new Response(JSON.stringify({ error: taskErr.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const list = (tasks ?? []) as Array<{
    id: string;
    title: string;
    deadline: string;
    category: string | null;
    user_id: string;
    assigned_to: string | null;
  }>;

  if (list.length === 0) {
    return new Response(JSON.stringify({ ok: true, emails: 0, message: "Görev yok" }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const byUser = new Map<string, TaskRow[]>();
  for (const t of list) {
    const uid = t.assigned_to ?? t.user_id;
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid)!.push({
      title: t.title,
      deadline: t.deadline,
      category: t.category,
    });
  }

  let sent = 0;
  for (const [userId, userTasks] of byUser) {
    const { error: digErr } = await admin.from("mail_digest_sent").insert({
      user_id: userId,
      digest_date: todayTr,
    });
    if (digErr?.code === "23505") {
      continue;
    }
    if (digErr) {
      console.error("digest insert", digErr);
      continue;
    }

    const { data: udata, error: uerr } = await admin.auth.admin.getUserById(userId);
    const address = udata?.user?.email;
    if (uerr || !address) {
      await admin.from("mail_digest_sent").delete().eq("user_id", userId).eq("digest_date", todayTr);
      continue;
    }

    const subject = `Yaklaşan görevlerin (${todayTr} – ${endTr})`;
    const html = reminderDigestHtml(userTasks, todayTr, endTr);
    try {
      await sendResend(address, subject, html);
      sent++;
    } catch (e) {
      console.error("Resend", e);
      await admin.from("mail_digest_sent").delete().eq("user_id", userId).eq("digest_date", todayTr);
    }
  }

  return new Response(JSON.stringify({ ok: true, emails: sent, users: byUser.size }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

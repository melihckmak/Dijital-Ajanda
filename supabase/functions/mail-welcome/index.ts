import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendResend } from "../_shared/resend.ts";
import { welcomeHtml } from "../_shared/templates.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-database-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const dbHookSecret = Deno.env.get("DB_WEBHOOK_SECRET");

  if (!url || !anon || !serviceRole) {
    return new Response(JSON.stringify({ error: "Supabase ortam değişkenleri eksik" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown> = {};
  try {
    const t = await req.text();
    if (t) body = JSON.parse(t) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const webhookHdr = req.headers.get("x-database-webhook-secret");
  const authHeader = req.headers.get("Authorization") ?? "";

  let userId: string | null = null;

  if (dbHookSecret && webhookHdr === dbHookSecret) {
    const evtType = typeof body.type === "string" ? body.type : (typeof body.eventType === "string" ? body.eventType : "");
    if (evtType.toUpperCase() !== "INSERT" || body.table !== "profiles") {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const rec = body.record as Record<string, unknown> | undefined;
    const id = typeof rec?.id === "string" ? rec.id : null;
    if (!id) {
      return new Response(JSON.stringify({ error: "Geçersiz webhook gövdesi" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    userId = id;
  } else if (authHeader.startsWith("Bearer ")) {
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user?.id) {
      return new Response(JSON.stringify({ error: "Yetkisiz" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    userId = user.id;
  } else {
    return new Response(JSON.stringify({ error: "Yetkisiz" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: adminUser, error: adminErr } = await admin.auth.admin.getUserById(userId);
  if (adminErr || !adminUser.user?.email) {
    return new Response(JSON.stringify({ error: "Kullanıcı e-postası alınamadı" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const email = adminUser.user.email;

  const { data: profile } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const displayName = (profile?.full_name as string | undefined) ?? "";

  const { error: insErr } = await admin.from("welcome_mail_sent").insert({ user_id: userId });
  if (insErr?.code === "23505") {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "already_sent" }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  if (insErr) {
    return new Response(JSON.stringify({ error: insErr.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    await sendResend(email, "Dijital Ajanda'ya hoş geldin", welcomeHtml(displayName));
  } catch (e) {
    await admin.from("welcome_mail_sent").delete().eq("user_id", userId);
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, sent: true }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

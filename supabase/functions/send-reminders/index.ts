import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

const json = { "Content-Type": "application/json" };

type Reminder = { to: string; name: string };

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildHtml(name: string): string {
  const firstName = name.split(" ")[0] ?? name;
  return `<div style="font-family:Arial,sans-serif;background-color:#fffaf3;color:#333">
  <div style="max-width:600px;margin:auto;background:white;border-radius:10px;padding:20px">
    <div style="text-align:center;margin-bottom:25px">
      <img src="https://christmas-gifts-opal.vercel.app/santa.jpg" alt="Święty Mikołaj" style="width:140px;height:auto;border-radius:8px;display:inline-block">
    </div>
    <p style="font-size:16px">Hej <b>${esc(firstName)}</b>!</p>
    <p style="font-size:16px;line-height:1.5">
      Przypominamy, że wciąż nie potwierdziłeś gotowości do świątecznego losowania.
    </p>
    <p style="font-size:16px;line-height:1.5">
      Dodaj minimum dwa życzenia i temat prezentu, a następnie potwierdź gotowość:
    </p>
    <p style="text-align:center;margin:20px 0">
      <a href="https://christmas-gifts-opal.vercel.app" style="background:#b91c1c;color:#fff;font-size:15px;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Wejdź do aplikacji</a>
    </p>
    <p style="font-size:16px;margin-top:20px">
      Pozdrawiam ciepło,<br>
      <b>Święty Mikołaj 🎅</b>
    </p>
    <hr style="margin:30px 0;border:none;border-top:1px dashed #ccc">
    <p style="font-size:13px;color:#777;text-align:center">
      🎁 To automatyczne przypomnienie — proszę nie odpowiadać na tę wiadomość.<br>
      Wesołych Świąt! 🌟
    </p>
  </div>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: json,
    });
  }

  const token = (req.headers.get("Authorization") ?? "").replace(
    /^Bearer /,
    ""
  );
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: json,
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_organizer")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_organizer) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: json,
    });
  }

  let body: { reminders?: Reminder[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: json,
    });
  }
  const reminders = body.reminders ?? [];
  if (!Array.isArray(reminders) || reminders.length === 0) {
    return new Response(JSON.stringify({ error: "Brak przypomnień do wysłania" }), {
      status: 400,
      headers: json,
    });
  }
  if (reminders.length > 50) {
    return new Response(JSON.stringify({ error: "Za dużo przypomnień" }), {
      status: 400,
      headers: json,
    });
  }

  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");
  if (!smtpUser || !smtpPass) {
    return new Response(
      JSON.stringify({ error: "SMTP nie skonfigurowany (sekret SMTP_USER/SMTP_PASS)" }),
      { status: 500, headers: json }
    );
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const results: { to: string; ok: boolean; error?: string }[] = [];
  for (const r of reminders) {
    if (!r.to || !r.name) {
      results.push({ to: r.to ?? "?", ok: false, error: "brak danych" });
      continue;
    }
    try {
      await transporter.sendMail({
        from: `"Święty Mikołaj" <${smtpUser}>`,
        to: r.to,
        subject: "Przypomnienie: gotowość do świątecznego losowania",
        html: buildHtml(r.name),
      });
      results.push({ to: r.to, ok: true });
    } catch (err) {
      results.push({
        to: r.to,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return new Response(JSON.stringify({ results }), { headers: json });
});

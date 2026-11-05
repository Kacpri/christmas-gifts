import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

const json = { "Content-Type": "application/json" };

type Wish = { text: string; price: number | null; link: string | null };

type EmailPayload = {
  to: string;
  name: string;
  listPerson: string;
  listWishes: Wish[];
  themePerson: string;
  theme: string;
};

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatPrice(price: number | null): string {
  if (price == null) return "";
  return (
    price.toLocaleString("pl-PL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " zł"
  );
}

function buildHtml(e: EmailPayload): string {
  const firstName = e.name.split(" ")[0] ?? e.name;
  const items = (e.listWishes ?? [])
    .map((w) => {
      const bits = [`<span>${esc(w.text)}</span>`];
      if (w.price != null) {
        bits.push(`<span style="color:#777">(${formatPrice(w.price)})</span>`);
      }
      if (w.link) {
        bits.push(
          `<a href="${esc(w.link)}" style="color:#b91c1c">link</a>`
        );
      }
      return `<li style="font-size:15px;line-height:1.6">${bits.join(" ")}</li>`;
    })
    .join("");
  const listBlock = items
    ? `<ol style="font-size:15px;line-height:1.6;padding-left:22px;margin:10px 0">${items}</ol>`
    : `<p style="font-size:15px;color:#777">Ta osoba jeszcze nie dodała życzeń — zaskocz ją czymś od siebie! 🎁</p>`;

  return `<div style="font-family:Arial,sans-serif;background-color:#fffaf3;color:#333">
  <div style="max-width:600px;margin:auto;background:white;border-radius:10px;padding:20px">
    <div style="text-align:center;margin-bottom:25px">
      <div style="font-size:56px;line-height:1">🎅</div>
    </div>
    <p style="font-size:16px">Hej <b>${esc(firstName)}</b>!</p>
    <p style="font-size:16px;line-height:1.5">
      Losowanie się odbyło! W te Święta kupujesz:
    </p>
    <p style="font-size:16px;line-height:1.5">
      🎁 <b>Prezent z listy</b> — dla <b>${esc(e.listPerson)}</b>.
    </p>
    ${listBlock}
    <p style="font-size:16px;line-height:1.5">
      🎄 <b>Prezent tematyczny</b> — dla <b>${esc(e.themePerson)}</b>.<br>
      Temat: <em>${esc(e.theme)}</em>
    </p>
    <p style="font-size:16px;margin-top:30px">
      Pozdrawiam ciepło,<br>
      <b>Święty Mikołaj 🎅</b>
    </p>
    <hr style="margin:30px 0;border:none;border-top:1px dashed #ccc">
    <p style="font-size:13px;color:#777;text-align:center">
      🎁 Wylosowano automatycznie — proszę nie odpowiadać na tę wiadomość.<br>
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

  let body: { emails?: EmailPayload[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: json,
    });
  }
  const emails = body.emails ?? [];
  if (!Array.isArray(emails) || emails.length === 0) {
    return new Response(JSON.stringify({ error: "Brak maili do wysłania" }), {
      status: 400,
      headers: json,
    });
  }
  if (emails.length > 50) {
    return new Response(JSON.stringify({ error: "Za dużo maili" }), {
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
  for (const e of emails) {
    if (!e.to || !e.name) {
      results.push({ to: e.to ?? "?", ok: false, error: "brak danych" });
      continue;
    }
    try {
      await transporter.sendMail({
        from: `"Święty Mikołaj" <${smtpUser}>`,
        to: e.to,
        subject: "Wynik losowania prezentów",
        html: buildHtml(e),
      });
      results.push({ to: e.to, ok: true });
    } catch (err) {
      results.push({
        to: e.to,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return new Response(JSON.stringify({ results }), { headers: json });
});

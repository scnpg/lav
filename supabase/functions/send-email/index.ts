// Lav: send-email Edge Function - Supabase Auth's "Send Email" hook.
//
// Why this exists: Supabase's built-in/default mailer enforces a hard,
// non-configurable rate limit (confirmed by direct testing against the
// hosted project: 2 emails/hour, HTTP 429 over_email_send_rate_limit) that
// blocks the entire signup/recovery/etc request outright, not just the
// email. That cap applies specifically to GoTrue's own mailer - once this
// hook is wired up (see README "Auth email hook setup"), GoTrue stops using
// its own mailer for every auth email and calls this function instead, which
// sends via Resend's API directly. The cap this function is subject to is
// whatever Resend's own plan allows (their free tier alone is far above 2/hr).
//
// This function does NOT go live on its own: Supabase Auth only calls it
// once the hook is enabled and pointed at this function's URL in the
// Dashboard (Authentication > Hooks > Send Email hook), which also mints the
// SEND_EMAIL_HOOK_SECRET this function verifies every request against - that
// secret doesn't exist until generated there, so this one step can't be
// scripted from the CLI. See the README for the exact steps.
//
// Payload verification uses the Standard Webhooks spec (same one Supabase's
// own docs example uses) - this is NOT the same signing scheme as Postgres
// Changes/Storage webhooks elsewhere in this project.

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

interface EmailData {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new?: string;
  token_hash_new?: string;
}

interface HookUser {
  email: string;
}

Deno.serve(async (req: Request) => {
  const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  // Must be an address at a domain verified in Resend - same constraint as
  // supabase/config.toml's [auth.email.smtp] admin_email, and same default
  // placeholder (Resend's shared onboarding@resend.dev works for testing but
  // gets rejected/spam-filtered for real recipients).
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "Lav <onboarding@resend.dev>";

  if (!hookSecret || !resendApiKey || !supabaseUrl) {
    console.error("Missing SEND_EMAIL_HOOK_SECRET, RESEND_API_KEY, or SUPABASE_URL in function environment");
    return hookErrorResponse(500, "Server misconfigured");
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  let user: HookUser;
  let emailData: EmailData;
  try {
    // Webhook expects the secret without its "v1,whsec_" prefix.
    const wh = new Webhook(hookSecret.replace("v1,whsec_", ""));
    const verified = wh.verify(payload, headers) as { user: HookUser; email_data: EmailData };
    user = verified.user;
    emailData = verified.email_data;
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return hookErrorResponse(401, "Invalid webhook signature");
  }

  const { subject, html } = renderEmail(user.email, emailData, supabaseUrl);

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromEmail, to: [user.email], subject, html }),
  });

  if (!resendRes.ok) {
    console.error("Resend send failed:", resendRes.status, await resendRes.text());
    return hookErrorResponse(500, "Could not send email");
  }

  return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
});

function buildActionLink(supabaseUrl: string, tokenHash: string, actionType: string, redirectTo: string): string {
  const url = new URL(`${supabaseUrl}/auth/v1/verify`);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", actionType);
  url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

// Only the action types this app actually triggers (signup confirmation,
// password recovery - see signUpWithPassword/requestPasswordReset in
// src/lib/auth.tsx) get bespoke copy. Anything else still gets a working
// link, just with generic wording, rather than silently failing to send.
function renderEmail(
  toEmail: string,
  emailData: EmailData,
  supabaseUrl: string
): { subject: string; html: string } {
  const link = buildActionLink(supabaseUrl, emailData.token_hash, emailData.email_action_type, emailData.redirect_to);

  switch (emailData.email_action_type) {
    case "signup":
      return {
        subject: "Confirm your email for Lav",
        html: `<p>Tap the link below to confirm ${escapeHtml(toEmail)} and finish creating your Lav account:</p><p><a href="${link}">Confirm email</a></p>`,
      };
    case "recovery":
      return {
        subject: "Reset your Lav password",
        html: `<p>Tap the link below to set a new password for your Lav account:</p><p><a href="${link}">Reset password</a></p><p>If you didn't request this, you can ignore this email.</p>`,
      };
    default:
      return {
        subject: "Your Lav sign-in link",
        html: `<p>Tap the link below to continue:</p><p><a href="${link}">Continue</a></p>`,
      };
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Shape GoTrue expects back on failure, so it can surface a real error
// instead of a generic one - see Supabase Auth Hooks error-response docs.
function hookErrorResponse(httpCode: number, message: string): Response {
  return new Response(JSON.stringify({ error: { http_code: httpCode, message } }), {
    status: httpCode,
    headers: { "Content-Type": "application/json" },
  });
}

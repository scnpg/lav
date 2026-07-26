#!/usr/bin/env node
// Verifies a Resend API key + connection work BEFORE wiring it into
// Supabase's SMTP settings (supabase/config.toml or the hosted project's
// Dashboard) - see README "Email setup (Resend SMTP)". Plain fetch() against
// Resend's REST API, no SDK dependency - Node 20+ (this repo's floor, see
// root package.json "engines") has fetch built in, and the API is a single
// POST.
//
// Usage:
//   RESEND_API_KEY=re_xxx node scripts/test-resend-auth.js you@example.com
//   (or: pnpm test:resend -- you@example.com)
//
// If you haven't verified a sending domain in Resend yet, the default
// "from" address below (onboarding@resend.dev, Resend's own shared testing
// domain) only delivers when "to" is the same email address your Resend
// account is registered under - that's a Resend-side anti-abuse
// restriction, not a bug here. Once you verify your own domain in the
// Resend dashboard, set RESEND_FROM to an address at it and "to" can be
// anyone.

const apiKey = process.env.RESEND_API_KEY;
const to = process.argv[2];
const from = process.env.RESEND_FROM || "onboarding@resend.dev";

function usageAndExit() {
  console.error("Usage: RESEND_API_KEY=re_xxx node scripts/test-resend-auth.js you@example.com");
  process.exit(1);
}

if (!apiKey) {
  console.error("Missing RESEND_API_KEY.");
  usageAndExit();
}
if (!to) {
  console.error("Missing recipient email.");
  usageAndExit();
}

async function main() {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Lav App <${from}>`,
      to: [to],
      subject: "Lav / Resend test email",
      html: "<p>If you're reading this, RESEND_API_KEY works and Resend can reach this inbox.</p>",
    }),
  });

  // Read the body once as text, then try to parse it - calling both
  // response.json() and response.text() on the same Response after one has
  // failed throws ("body stream already read"), so this avoids that
  // entirely rather than trying to catch it.
  const rawBody = await response.text();
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    body = null;
  }

  if (!response.ok) {
    console.error(`Resend API returned ${response.status}:`, body ?? rawBody);
    process.exit(1);
  }

  console.log(`Sent. Resend email id: ${body?.id ?? "(no id in response)"}`);
  console.log(`Check ${to}'s inbox (and spam folder).`);
}

main().catch((err) => {
  console.error("Request to Resend failed:", err);
  process.exit(1);
});

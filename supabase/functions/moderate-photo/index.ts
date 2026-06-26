// Lav: moderate-photo Edge Function
//
// Photo lifecycle (see README "Photo moderation"):
//   1. Mobile app uploads the file to the bathroom-photo-quarantine bucket
//      and inserts a bathroom_photos row (status='pending').
//   2. Mobile app calls this function with { photo_id }.
//   3. This function downloads the file (service role, bypasses RLS),
//      runs it through the configured moderation provider, and writes
//      moderation_status / moderation_provider / moderation_result.
//   4. An admin reviews the photo in /admin regardless of the automated
//      result and flips status to 'approved' or 'rejected'. Only that admin
//      action (not this function) can make a photo public - see the
//      sync_photo_public_flag trigger and bathroom_photos RLS policies in
//      supabase/migrations.
//
// This function intentionally never touches bathroom_photos.status: the
// automated scan is a triage signal for the admin queue, not a publish
// decision.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { runModeration } from "./providers.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let photoId: string | undefined;
  try {
    const body = await req.json();
    photoId = body?.photo_id;
  } catch {
    return jsonResponse({ error: "Invalid JSON body, expected { photo_id }" }, 400);
  }

  if (!photoId) {
    return jsonResponse({ error: "photo_id is required" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in function environment");
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  // Service role client: deliberately bypasses RLS. This function is the one
  // place that's allowed to - it never returns the raw row to the caller,
  // only a small status summary (see the final response below).
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: photo, error: fetchError } = await admin
    .from("bathroom_photos")
    .select("id, storage_path, bathroom_id")
    .eq("id", photoId)
    .single();

  if (fetchError || !photo) {
    return jsonResponse({ error: "Photo not found" }, 404);
  }

  const { data: fileData, error: downloadError } = await admin.storage
    .from("bathroom-photo-quarantine")
    .download(photo.storage_path);

  if (downloadError || !fileData) {
    console.error("Could not download photo from quarantine bucket:", downloadError);
    return jsonResponse({ error: "Could not load photo from storage" }, 500);
  }

  const bytes = new Uint8Array(await fileData.arrayBuffer());

  let result;
  try {
    result = await runModeration(bytes, photoId);
  } catch (err) {
    console.error("Moderation provider threw unexpectedly:", err);
    result = {
      provider: "mock",
      moderationStatus: "needs_human_review" as const,
      raw: { provider: "mock", flagged: true, reasons: ["moderation_provider_error"] },
    };
  }

  const { error: updateError } = await admin
    .from("bathroom_photos")
    .update({
      moderation_status: result.moderationStatus,
      moderation_provider: result.provider,
      moderation_result: result.raw,
    })
    .eq("id", photoId);

  if (updateError) {
    console.error("Could not write moderation result:", updateError);
    return jsonResponse({ error: "Could not save moderation result" }, 500);
  }

  // admin_id is null here on purpose - this is a system/automated event, not
  // an admin action. See moderation_events in supabase/migrations/0002_tables.sql.
  await admin.from("moderation_events").insert({
    photo_id: photoId,
    bathroom_id: photo.bathroom_id,
    admin_id: null,
    action: "automated_scan",
    notes: `Provider: ${result.provider}. Result: ${result.moderationStatus}.`,
  });

  return jsonResponse({
    photo_id: photoId,
    moderation_status: result.moderationStatus,
    provider: result.provider,
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

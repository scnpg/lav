// Provider abstraction for automated bathroom photo moderation.
//
// CONTENT_MODERATION_PROVIDER selects the backend: "mock" | "google_vision" |
// "aws_rekognition". Real providers are implemented below, but neither is
// required to run Lav locally: with no provider configured (or credentials
// missing), everything falls back to the mock provider so the full pipeline
// (upload -> scan -> admin queue -> approve/reject) works end-to-end with
// zero external services. See README "Moderation setup".
//
// IMPORTANT: moderation_status is a triage signal only. It never publishes a
// photo by itself - only an admin flipping bathroom_photos.status to
// 'approved' does that (enforced by RLS + the sync_photo_public_flag
// trigger). A "scan_passed" mock result is just as gated behind admin review
// as a "needs_human_review" one.
//
// TODO(production): consider face detection/blurring for bystanders, a
// second-pass human review SLA, and retention limits on raw provider
// responses (they may contain sensitive classification data).

export type ModerationStatus = "scan_passed" | "scan_failed" | "needs_human_review";

export interface ModerationResult {
  provider: string;
  moderationStatus: ModerationStatus;
  raw: Record<string, unknown>;
}

export async function runModeration(bytes: Uint8Array, photoId: string): Promise<ModerationResult> {
  const configured = (Deno.env.get("CONTENT_MODERATION_PROVIDER") ?? "mock").toLowerCase();

  if (configured === "google_vision" && Deno.env.get("GOOGLE_CLOUD_VISION_API_KEY")) {
    try {
      return await runGoogleVision(bytes);
    } catch (err) {
      console.error("Google Vision moderation failed, falling back to mock:", err);
      return runMock(photoId);
    }
  }

  if (
    configured === "aws_rekognition" &&
    Deno.env.get("AWS_ACCESS_KEY_ID") &&
    Deno.env.get("AWS_SECRET_ACCESS_KEY")
  ) {
    try {
      return await runAwsRekognition(bytes);
    } catch (err) {
      console.error("AWS Rekognition moderation failed, falling back to mock:", err);
      return runMock(photoId);
    }
  }

  // Dev-mode scaffold: no provider configured, or its credentials are missing.
  return runMock(photoId);
}

// ---------------------------------------------------------------------------
// Mock provider: deterministic-but-varied fake results (keyed off the photo
// id) so the admin moderation queue has something realistic to triage
// without calling any external API.
// ---------------------------------------------------------------------------
function runMock(photoId: string): ModerationResult {
  const hash = Array.from(photoId).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const bucket = hash % 5;

  if (bucket === 0) {
    return {
      provider: "mock",
      moderationStatus: "needs_human_review",
      raw: {
        provider: "mock",
        flagged: true,
        reasons: ["possible_occupied_stall"],
        categories: { adult: "UNLIKELY", racy: "POSSIBLE", violence: "VERY_UNLIKELY" },
      },
    };
  }

  return {
    provider: "mock",
    moderationStatus: "scan_passed",
    raw: {
      provider: "mock",
      flagged: false,
      categories: { adult: "VERY_UNLIKELY", racy: "VERY_UNLIKELY", violence: "VERY_UNLIKELY" },
    },
  };
}

// ---------------------------------------------------------------------------
// Google Cloud Vision SafeSearch
// https://cloud.google.com/vision/docs/detecting-safe-search
// TODO(production): swap the raw API key for a service-account OAuth token
// if you need IAM-scoped credentials instead of a project-wide API key.
// ---------------------------------------------------------------------------
async function runGoogleVision(bytes: Uint8Array): Promise<ModerationResult> {
  const apiKey = Deno.env.get("GOOGLE_CLOUD_VISION_API_KEY");
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64Image = btoa(binary);

  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64Image },
          features: [{ type: "SAFE_SEARCH_DETECTION" }],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Google Vision API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const safeSearch = data?.responses?.[0]?.safeSearchAnnotation ?? {};

  const HIGH_RISK = ["LIKELY", "VERY_LIKELY"];
  const REVIEW_RISK = ["POSSIBLE"];
  const fields = ["adult", "racy", "violence"];

  const hasHighRisk = fields.some((key) => HIGH_RISK.includes(safeSearch[key]));
  const needsReview = fields.some((key) => REVIEW_RISK.includes(safeSearch[key]));

  const moderationStatus: ModerationStatus = hasHighRisk || needsReview ? "needs_human_review" : "scan_passed";

  return {
    provider: "google_vision",
    moderationStatus,
    raw: { provider: "google_vision", safeSearch },
  };
}

// ---------------------------------------------------------------------------
// AWS Rekognition DetectModerationLabels
// https://docs.aws.amazon.com/rekognition/latest/dg/moderation.html
// Uses Deno's npm: specifier support (Supabase Edge Functions run on Deno
// with npm compatibility) rather than hand-rolled SigV4 signing.
// ---------------------------------------------------------------------------
async function runAwsRekognition(bytes: Uint8Array): Promise<ModerationResult> {
  const { RekognitionClient, DetectModerationLabelsCommand } = await import(
    "npm:@aws-sdk/client-rekognition@3"
  );

  const client = new RekognitionClient({
    region: Deno.env.get("AWS_REGION") ?? "us-east-1",
    credentials: {
      accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
      secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
    },
  });

  const result = await client.send(new DetectModerationLabelsCommand({ Image: { Bytes: bytes } }));
  const labels = result.ModerationLabels ?? [];
  const HUMAN_REVIEW_THRESHOLD = 60;
  const needsReview = labels.some((l: { Confidence?: number }) => (l.Confidence ?? 0) >= HUMAN_REVIEW_THRESHOLD);

  return {
    provider: "aws_rekognition",
    moderationStatus: needsReview ? "needs_human_review" : "scan_passed",
    raw: { provider: "aws_rekognition", labels },
  };
}

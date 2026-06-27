// ---------------------------------------------------------------------------
// Anti-spam / frequency rules for the bathroom-existence verification
// prompt. Constants + comments only - nothing here is enforced yet, there
// is no backend tracking who has been asked what. See
// docs/BATHROOM_INVENTORY_AND_VERIFICATION_STRATEGY.md Section 5 for the
// full rules this is a UI-only preview of.
//
// TODO(verification): once Supabase exists, enforce these server-side:
//   - a real geofence check against the user's last known location
//   - a per-user daily/rolling prompt counter
//   - a per-(user, candidate) "already asked" record so the same person is
//     never asked about the same candidate twice
//   - the actual consensus/admin-review logic that decides when a
//     candidate flips to verified/rejected (strategy doc Section 5, rule 6)
//     - never a single yes/no/maybe answer by itself (rule 5)
//   - the points/Cartographer-progress payout, which only happens once a
//     candidate's *final* outcome is known and matches the user's answer
//     (rule 7) - this mock UI never awards anything, see the confirmation
//     copy in VerificationCard.tsx
// ---------------------------------------------------------------------------

/** Never prompt a user about a candidate further than this from them. */
export const MAX_PROMPT_DISTANCE_MILES = 10;

/** Reasonable frequency cap - opt-in and low-friction, never a spam loop. */
export const MAX_PROMPTS_PER_USER_PER_DAY = 2;

/**
 * Once a user has answered (or dismissed) a prompt for a given candidate,
 * they should never be asked about that exact candidate again. This mock
 * UI has no backend/session tracking yet, so every card below always shows
 * in this preview build - the rule is documented here for whoever wires up
 * the real prompt queue.
 */
export const NEVER_REPEAT_SAME_CANDIDATE_TO_SAME_USER = true;

/**
 * A single yes/no/maybe answer is never enough to verify or reject a
 * candidate by itself. Promotion to verified/rejected requires consensus
 * across multiple answers, plus admin review, source reliability, duplicate
 * detection, and report history (strategy doc Section 5, rule 6).
 */
export const REQUIRES_CONSENSUS_AND_ADMIN_REVIEW = true;

// ---------------------------------------------------------------------------
// Moderation notes (strategy doc Section 6). Nothing here is enforced in
// this mock UI - a yes/no/maybe tap has no free text attached - but any
// future free-text comment on a response, and any user-submitted candidate
// this pipeline eventually surfaces, must pass through the same moderation
// pipeline as everything else in the app:
//   - slurs, hate speech, targeted harassment, explicit sexual content, and
//     spam get blocked/flagged before ever reaching another user.
//   - an unusual or absurd-sounding venue name is NEVER auto-rejected on
//     its own - real venues have genuinely strange names. It contributes to
//     a moderation score and routes to admin review instead of an
//     automatic rejection.
//   - impossible coordinates and suspicious repeated submissions from one
//     user route to admin review - they don't get silently dropped or
//     silently auto-accepted either way.
// ---------------------------------------------------------------------------

/**
 * demo.ts - Demo mode constants and helpers.
 *
 * WHY: Judges for the Clocked challenge (and anyone trying the app) need
 * to walk through it without an authorized email or a real Upwork account.
 * The demo user signs in with one click (POST /api/auth/demo, no email),
 * and sees only sample data under the demo profile. The demo profile has
 * no Upwork OAuth tokens, so the worker never fetches real jobs for it,
 * and the demo user can never touch Farid's real jobs because every
 * business query is scoped to the current user's profile.
 *
 * The demo user is a real row in the users table (email below) with its
 * own profile and seeded demo jobs, scores, drafts, and portfolio items.
 * See the demo seed SQL in the goal files for the seeded data.
 */

/** The demo user's email. It is not a real mailbox; nobody signs in by email. */
export const DEMO_USER_EMAIL = 'demo@upwork-auto-bidder.demo';

/** The demo profile's Upwork profile ID. It is not a real Upwork profile. */
export const DEMO_UPWORK_PROFILE_ID = 'demo-upwork-profile';

/** True when the given email belongs to the demo user. */
export function isDemoEmail(email: string | null | undefined): boolean {
  return email === DEMO_USER_EMAIL;
}

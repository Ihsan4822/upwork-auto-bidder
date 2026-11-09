import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { requireSession, getCurrentProfile } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  // Scope to the current user's profile so a user only sees their own
  // stats. The demo user sees only the demo profile's counts.
  const profile = await getCurrentProfile(sessionResult.user.id);
  if (!profile) {
    return NextResponse.json({
      totalJobs: 0,
      filteredOut: 0,
      scoredPending: 0,
      draftReady: 0,
      skipped: 0,
      submitted: 0,
      totalScored: 0,
      applyCount: 0,
      boostCount: 0,
    });
  }

  const fallback = {
    totalJobs: 0,
    filteredOut: 0,
    scoredPending: 0,
    draftReady: 0,
    skipped: 0,
    submitted: 0,
    totalScored: 0,
    applyCount: 0,
    boostCount: 0,
  };

  try {
    const timeout = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 1500),
    );

    const dataPromise = Promise.all([
      prisma.job.count({ where: { profileId: profile.id } }),
      prisma.job.count({ where: { profileId: profile.id, status: 'FILTERED_OUT' } }),
      prisma.job.count({ where: { profileId: profile.id, status: 'SCORED_PENDING' } }),
      prisma.job.count({ where: { profileId: profile.id, status: 'DRAFT_READY' } }),
      prisma.job.count({ where: { profileId: profile.id, status: 'SKIPPED' } }),
      prisma.job.count({ where: { profileId: profile.id, status: 'SUBMITTED_MANUALLY' } }),
      prisma.jobScore.count({ where: { profileId: profile.id } }),
      prisma.jobScore.count({ where: { profileId: profile.id, label: 'APPLY' } }),
      prisma.jobScore.count({ where: { profileId: profile.id, label: 'APPLY_PLUS_BOOST' } }),
    ]);

    const res = await Promise.race([dataPromise, timeout]);
    if (!res) return NextResponse.json(fallback);

    const [
      totalJobs,
      filteredOut,
      scoredPending,
      draftReady,
      skipped,
      submitted,
      totalScored,
      applyCount,
      boostCount,
    ] = res;

    return NextResponse.json({
      totalJobs,
      filteredOut,
      scoredPending,
      draftReady,
      skipped,
      submitted,
      totalScored,
      applyCount,
      boostCount,
    });
  } catch {
    return NextResponse.json(fallback);
  }
}

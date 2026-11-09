import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { calculateAnalyticsSummary } from '@upwork-bidder/core';
import { requireSession, getCurrentProfile } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  // Scope to the current user's profile so a user only sees their own
  // analytics. The demo user sees only the demo profile's numbers.
  const profile = await getCurrentProfile(sessionResult.user.id);
  if (!profile) {
    return NextResponse.json({ summary: null, submittedJobs: [] });
  }

  try {
    const totalJobs = await prisma.job.count({ where: { profileId: profile.id } });
    const filteredOutCount = await prisma.job.count({
      where: { profileId: profile.id, status: 'FILTERED_OUT' },
    });
    const scoredCount = await prisma.jobScore.count({ where: { profileId: profile.id } });
    const draftedCount = await prisma.draft.count({ where: { profileId: profile.id } });
    const approvedCount = await prisma.job.count({
      where: { profileId: profile.id, status: 'APPROVED' },
    });
    const submittedManuallyCount = await prisma.job.count({
      where: { profileId: profile.id, status: 'SUBMITTED_MANUALLY' },
    });

    const entries = await prisma.analyticsEntry.findMany({
      where: { profileId: profile.id },
      select: {
        clientViewed: true,
        clientReplied: true,
        connectsSpent: true,
      },
    });

    const summary = calculateAnalyticsSummary({
      totalJobs,
      filteredOutCount,
      scoredCount,
      draftedCount,
      approvedCount,
      submittedManuallyCount,
      entries,
    });

    // Also fetch list of manually submitted jobs with their tracking status
    const submittedJobs = await prisma.job.findMany({
      where: {
        profileId: profile.id,
        status: { in: ['APPROVED', 'SUBMITTED_MANUALLY'] },
      },
      orderBy: { updatedAt: 'desc' },
      take: 25,
      include: {
        analyticsEntry: true,
      },
    });

    return NextResponse.json({ summary, submittedJobs });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Database error' },
      { status: 500 },
    );
  }
}

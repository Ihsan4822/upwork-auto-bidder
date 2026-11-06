import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { calculateAnalyticsSummary } from '@upwork-bidder/core';
import { requireSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  try {
    const totalJobs = await prisma.job.count();
    const filteredOutCount = await prisma.job.count({ where: { status: 'FILTERED_OUT' } });
    const scoredCount = await prisma.jobScore.count();
    const draftedCount = await prisma.draft.count();
    const approvedCount = await prisma.job.count({ where: { status: 'APPROVED' } });
    const submittedManuallyCount = await prisma.job.count({ where: { status: 'SUBMITTED_MANUALLY' } });

    const entries = await prisma.analyticsEntry.findMany({
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

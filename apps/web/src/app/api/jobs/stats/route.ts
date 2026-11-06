import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { requireSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
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
      prisma.job.count(),
      prisma.job.count({ where: { status: 'FILTERED_OUT' } }),
      prisma.job.count({ where: { status: 'SCORED_PENDING' } }),
      prisma.job.count({ where: { status: 'DRAFT_READY' } }),
      prisma.job.count({ where: { status: 'SKIPPED' } }),
      prisma.job.count({ where: { status: 'SUBMITTED_MANUALLY' } }),
      prisma.jobScore.count(),
      prisma.jobScore.count({ where: { label: 'APPLY' } }),
      prisma.jobScore.count({ where: { label: 'APPLY_PLUS_BOOST' } }),
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

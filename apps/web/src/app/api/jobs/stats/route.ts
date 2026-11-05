import { NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';

export async function GET() {
  try {
    const totalJobs = await prisma.job.count();
    const filteredOut = await prisma.job.count({ where: { status: 'FILTERED_OUT' } });
    const scoredPending = await prisma.job.count({ where: { status: 'SCORED_PENDING' } });
    const draftReady = await prisma.job.count({ where: { status: 'DRAFT_READY' } });
    const skipped = await prisma.job.count({ where: { status: 'SKIPPED' } });
    const submitted = await prisma.job.count({ where: { status: 'SUBMITTED_MANUALLY' } });

    const totalScored = await prisma.jobScore.count();
    const applyCount = await prisma.jobScore.count({ where: { label: 'APPLY' } });
    const boostCount = await prisma.jobScore.count({ where: { label: 'APPLY_PLUS_BOOST' } });

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
}

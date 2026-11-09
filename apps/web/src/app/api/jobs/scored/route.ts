import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { requireSession, getCurrentProfile } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  // Scope to the current user's profile so a user only sees their own
  // scores. The demo user sees only the demo profile's scores.
  const profile = await getCurrentProfile(sessionResult.user.id);
  if (!profile) {
    return NextResponse.json({ scores: [] });
  }

  try {
    const scoredJobs = await prisma.jobScore.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        job: {
          select: {
            upworkJobId: true,
            title: true,
            description: true,
            budgetType: true,
            budgetAmountFixed: true,
            hourlyRateMin: true,
            hourlyRateMax: true,
            clientCountry: true,
            clientTotalSpend: true,
            clientHireRate: true,
            paymentVerified: true,
            proposalCount: true,
            jobUrl: true,
            status: true,
          },
        },
      },
    });

    // Deduplicate by jobId: keep only the latest score per unique job
    const seenJobIds = new Set<string>();
    const latestScores = [];
    for (const score of scoredJobs) {
      if (!seenJobIds.has(score.jobId)) {
        seenJobIds.add(score.jobId);
        latestScores.push(score);
      }
    }

    return NextResponse.json({ scores: latestScores });
  } catch (err: unknown) {
    return NextResponse.json(
      { scores: [], error: err instanceof Error ? err.message : 'Database error' },
      { status: 500 },
    );
  }
}

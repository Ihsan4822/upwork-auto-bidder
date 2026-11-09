import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { requireSession, getCurrentProfile } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  // Scope to the current user's profile so a user only sees their own
  // filtered jobs. The demo user sees only the demo profile's jobs.
  const profile = await getCurrentProfile(sessionResult.user.id);
  if (!profile) {
    return NextResponse.json({ jobs: [] });
  }

  try {
    const jobs = await prisma.job.findMany({
      where: { status: 'FILTERED_OUT', profileId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        upworkJobId: true,
        title: true,
        description: true,
        budgetType: true,
        budgetAmountFixed: true,
        hourlyRateMin: true,
        hourlyRateMax: true,
        clientCountry: true,
        paymentVerified: true,
        filterReason: true,
        createdAt: true,
        jobUrl: true,
      },
    });

    return NextResponse.json({ jobs });
  } catch (err: unknown) {
    return NextResponse.json(
      { jobs: [], error: err instanceof Error ? err.message : 'Database error' },
      { status: 500 },
    );
  }
}

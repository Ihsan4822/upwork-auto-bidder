import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { requireSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  try {
    const scoredJobs = await prisma.jobScore.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
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

    return NextResponse.json({ scores: scoredJobs });
  } catch (err: unknown) {
    return NextResponse.json(
      { scores: [], error: err instanceof Error ? err.message : 'Database error' },
      { status: 500 },
    );
  }
}

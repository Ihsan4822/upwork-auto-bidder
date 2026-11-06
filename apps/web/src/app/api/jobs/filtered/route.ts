import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { requireSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  try {
    const jobs = await prisma.job.findMany({
      where: { status: 'FILTERED_OUT' },
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

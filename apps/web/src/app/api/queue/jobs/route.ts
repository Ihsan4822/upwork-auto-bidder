import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { requireSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');

  try {
    const whereClause: Record<string, unknown> = {};

    if (statusFilter && statusFilter !== 'ALL') {
      whereClause.status = statusFilter;
    } else {
      // Default to queue actionable states
      whereClause.status = {
        in: ['DRAFT_READY', 'IN_REVIEW', 'APPROVED', 'SUBMITTED_MANUALLY', 'SKIPPED'],
      };
    }

    const jobs = await prisma.job.findMany({
      where: whereClause,
      // Priority order by source, alphabetical: 'INVITATION' first, then
      // 'NOTIFICATION', then 'SEARCH'. A client-invited job sits on top,
      // followed by Upwork's own matched jobs (the notification bell), then
      // the broad saved-search results.
      orderBy: [{ source: 'asc' }, { postedAt: 'desc' }],
      take: 50,
      include: {
        scores: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        drafts: {
          orderBy: { version: 'desc' },
          take: 1,
          include: {
            portfolioItem: true,
          },
        },
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

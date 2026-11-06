import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { requireSession } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  const { jobId } = await params;

  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        scores: {
          orderBy: { createdAt: 'desc' },
        },
        drafts: {
          orderBy: { version: 'desc' },
          include: {
            portfolioItem: true,
          },
        },
        reviewActions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const portfolioItems = await prisma.portfolioItem.findMany({
      where: { profileId: job.profileId, isActive: true },
    });

    return NextResponse.json({ job, portfolioItems });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Database error' },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, connectsSpent, clientViewed, clientReplied, notes } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const entry = await prisma.analyticsEntry.upsert({
      where: { jobId },
      update: {
        connectsSpent: typeof connectsSpent === 'number' ? connectsSpent : undefined,
        clientViewed: typeof clientViewed === 'boolean' ? clientViewed : undefined,
        clientReplied: typeof clientReplied === 'boolean' ? clientReplied : undefined,
        notes: typeof notes === 'string' ? notes : undefined,
      },
      create: {
        profileId: job.profileId,
        jobId,
        connectsSpent: typeof connectsSpent === 'number' ? connectsSpent : null,
        clientViewed: typeof clientViewed === 'boolean' ? clientViewed : null,
        clientReplied: typeof clientReplied === 'boolean' ? clientReplied : null,
        notes: typeof notes === 'string' ? notes : null,
        submittedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, entry });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Database error' },
      { status: 500 },
    );
  }
}

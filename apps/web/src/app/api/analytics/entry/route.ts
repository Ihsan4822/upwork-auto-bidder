import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';

const AnalyticsEntrySchema = z.object({
  jobId: z.string().min(1),
  connectsSpent: z.number().int().nonnegative().optional(),
  clientViewed: z.boolean().optional(),
  clientReplied: z.boolean().optional(),
  isSubmitted: z.boolean().optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  try {
    let rawBody;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const parseResult = AnalyticsEntrySchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: parseResult.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { jobId, connectsSpent, clientViewed, clientReplied, isSubmitted, notes } =
      parseResult.data;

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
        ...(isSubmitted ? { submittedAt: new Date() } : {}),
      },
      create: {
        profileId: job.profileId,
        jobId,
        connectsSpent: typeof connectsSpent === 'number' ? connectsSpent : null,
        clientViewed: typeof clientViewed === 'boolean' ? clientViewed : null,
        clientReplied: typeof clientReplied === 'boolean' ? clientReplied : null,
        notes: typeof notes === 'string' ? notes : null,
        submittedAt: isSubmitted ? new Date() : null, // Only set if explicitly marked submitted
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

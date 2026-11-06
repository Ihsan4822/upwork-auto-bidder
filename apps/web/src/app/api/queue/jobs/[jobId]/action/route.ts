import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { getNextDraftVersion, countWords, isValidTransition, QueueState } from '@upwork-bidder/core';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';

const ActionSchema = z.object({
  action: z.enum(['SAVE_DRAFT_VERSION', 'APPROVE', 'SKIP', 'MARK_SUBMITTED']),
  draftText: z.string().optional(),
  portfolioItemId: z.string().nullable().optional(),
  note: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  const { user } = sessionResult;
  const { jobId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const parseResult = ActionSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid request payload', details: parseResult.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { action, draftText, portfolioItemId, note } = parseResult.data;

  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        drafts: {
          select: { version: true },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const currentStatus = job.status as QueueState;

    if (action === 'SAVE_DRAFT_VERSION') {
      if (!draftText || typeof draftText !== 'string' || !draftText.trim()) {
        return NextResponse.json({ error: 'Draft text is required' }, { status: 400 });
      }

      // Check transition if status is changing to IN_REVIEW
      if (currentStatus !== 'IN_REVIEW' && !isValidTransition(currentStatus, 'IN_REVIEW')) {
        return NextResponse.json(
          { error: `Illegal state transition from ${currentStatus} to IN_REVIEW` },
          { status: 400 },
        );
      }

      // SECTION 4, MODULE 4 RULE: "Editing a draft creates a new version, it never overwrites the old one"
      const existingVersions = job.drafts.map((d) => d.version);
      const nextVersion = getNextDraftVersion(existingVersions);
      const wordCount = countWords(draftText);

      const newDraft = await prisma.draft.create({
        data: {
          profileId: job.profileId,
          jobId: job.id,
          version: nextVersion,
          draftText: draftText.trim(),
          status: 'IN_REVIEW',
          portfolioItemId: portfolioItemId || null,
          wordCount,
        },
      });

      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'IN_REVIEW' },
      });

      await prisma.reviewAction.create({
        data: {
          profileId: job.profileId,
          jobId: job.id,
          action: 'EDITED_DRAFT',
          actorId: user.id,
          note: note || `Created draft version ${nextVersion}`,
          metadata: { newVersion: nextVersion, wordCount },
        },
      });

      return NextResponse.json({ success: true, draft: newDraft });
    }

    if (action === 'APPROVE') {
      if (!isValidTransition(currentStatus, 'APPROVED')) {
        return NextResponse.json(
          { error: `Illegal state transition from ${currentStatus} to APPROVED` },
          { status: 400 },
        );
      }

      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'APPROVED' },
      });

      await prisma.reviewAction.create({
        data: {
          profileId: job.profileId,
          jobId: job.id,
          action: 'APPROVED',
          actorId: user.id,
          note: note || 'Approved proposal for manual submission on Upwork',
        },
      });

      return NextResponse.json({ success: true, status: 'APPROVED' });
    }

    if (action === 'SKIP') {
      if (!isValidTransition(currentStatus, 'SKIPPED')) {
        return NextResponse.json(
          { error: `Illegal state transition from ${currentStatus} to SKIPPED` },
          { status: 400 },
        );
      }

      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'SKIPPED' },
      });

      await prisma.reviewAction.create({
        data: {
          profileId: job.profileId,
          jobId: job.id,
          action: 'SKIPPED',
          actorId: user.id,
          note: note || 'Skipped by human reviewer',
        },
      });

      return NextResponse.json({ success: true, status: 'SKIPPED' });
    }

    if (action === 'MARK_SUBMITTED') {
      if (!isValidTransition(currentStatus, 'SUBMITTED_MANUALLY')) {
        return NextResponse.json(
          { error: `Illegal state transition from ${currentStatus} to SUBMITTED_MANUALLY. Job must be APPROVED first.` },
          { status: 400 },
        );
      }

      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'SUBMITTED_MANUALLY' },
      });

      await prisma.analyticsEntry.upsert({
        where: { jobId: job.id },
        update: {
          submittedAt: new Date(),
        },
        create: {
          profileId: job.profileId,
          jobId: job.id,
          submittedAt: new Date(),
        },
      });

      await prisma.reviewAction.create({
        data: {
          profileId: job.profileId,
          jobId: job.id,
          action: 'MARKED_SUBMITTED',
          actorId: user.id,
          note: note || 'Manually submitted on Upwork',
        },
      });

      return NextResponse.json({ success: true, status: 'SUBMITTED_MANUALLY' });
    }

    return NextResponse.json({ error: `Unknown queue action: ${action}` }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Database error' },
      { status: 500 },
    );
  }
}

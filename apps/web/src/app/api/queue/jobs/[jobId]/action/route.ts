import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { getNextDraftVersion, countWords } from '@upwork-bidder/core';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const body = await request.json();
  const { action, draftText, portfolioItemId, note } = body;

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

    if (action === 'SAVE_DRAFT_VERSION') {
      if (!draftText || typeof draftText !== 'string') {
        return NextResponse.json({ error: 'Draft text is required' }, { status: 400 });
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
          actorId: 'FARID_MALIK',
          note: note || `Created draft version ${nextVersion}`,
          metadata: { newVersion: nextVersion, wordCount },
        },
      });

      return NextResponse.json({ success: true, draft: newDraft });
    }

    if (action === 'APPROVE') {
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'APPROVED' },
      });

      await prisma.reviewAction.create({
        data: {
          profileId: job.profileId,
          jobId: job.id,
          action: 'APPROVED',
          actorId: 'FARID_MALIK',
          note: note || 'Approved proposal for manual submission on Upwork',
        },
      });

      return NextResponse.json({ success: true, status: 'APPROVED' });
    }

    if (action === 'SKIP') {
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'SKIPPED' },
      });

      await prisma.reviewAction.create({
        data: {
          profileId: job.profileId,
          jobId: job.id,
          action: 'SKIPPED',
          actorId: 'FARID_MALIK',
          note: note || 'Skipped by human reviewer',
        },
      });

      return NextResponse.json({ success: true, status: 'SKIPPED' });
    }

    if (action === 'MARK_SUBMITTED') {
      // SECTION 2, RULE 8 & SECTION 4, MODULE 6:
      // Farid copies the approved draft, goes to Upwork himself, submits manually.
      // App then lets him mark it as submitted, with the time, for analytics only.
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
          actorId: 'FARID_MALIK',
          note: note || 'Manually submitted on Upwork by Farid Malik',
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

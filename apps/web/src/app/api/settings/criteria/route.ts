import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { requireSession } from '@/lib/auth';
import {
  CriteriaSchema,
  parseStoredCriteria,
  criteriaToStoredPairs,
  DEFAULT_JOB_CRITERIA,
} from '@upwork-bidder/core';

/** Human-readable descriptions stored alongside each setting row. */
const CRITERIA_DESCRIPTIONS: Record<string, string> = {
  hourlyRateFloorUsd: 'Minimum hourly rate (USD) a job must offer to pass the hard filters.',
  fixedPriceFloorUsd: 'Minimum fixed-price budget (USD) a job must offer to pass the hard filters.',
  clientMinTotalSpendUsd: 'Minimum client lifetime spend (USD). 0 means no minimum.',
  paymentVerifiedRequired: 'Whether a job must have a payment-verified client to pass the hard filters.',
  nicheKeywords: 'Niche keywords (JSON array) a job title or description must match to be relevant.',
};

async function readCriteria() {
  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: Object.keys(CRITERIA_DESCRIPTIONS),
      },
    },
  });
  const stored: Record<string, string | undefined> = {};
  for (const row of rows) {
    stored[row.key] = row.value;
  }
  return parseStoredCriteria(stored);
}

export async function GET(request: NextRequest) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  try {
    const criteria = await readCriteria();
    return NextResponse.json({ criteria });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        criteria: { ...DEFAULT_JOB_CRITERIA },
        error: err instanceof Error ? err.message : 'Database error',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  try {
    const body: unknown = await request.json();
    const parsed = CriteriaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid criteria',
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const criteria = parsed.data;
    const pairs = criteriaToStoredPairs(criteria);
    for (const [key, value] of Object.entries(pairs)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: {
          key,
          value,
          description: CRITERIA_DESCRIPTIONS[key] ?? null,
        },
      });
    }

    return NextResponse.json({ criteria });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save criteria' },
      { status: 500 },
    );
  }
}

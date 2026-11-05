import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';

export async function GET() {
  try {
    const items = await prisma.portfolioItem.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ items });
  } catch (err: unknown) {
    return NextResponse.json(
      { items: [], error: err instanceof Error ? err.message : 'Database error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, nicheTags, link } = body;

    if (!title || !link) {
      return NextResponse.json({ error: 'Title and link are required' }, { status: 400 });
    }

    const profile = await prisma.profile.findFirst();
    if (!profile) {
      return NextResponse.json({ error: 'No profile registered' }, { status: 400 });
    }

    const item = await prisma.portfolioItem.create({
      data: {
        profileId: profile.id,
        title: title.trim(),
        nicheTags: Array.isArray(nicheTags) ? nicheTags : [],
        link: link.trim(),
        isActive: true,
      },
    });

    return NextResponse.json({ item });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create portfolio item' },
      { status: 500 },
    );
  }
}

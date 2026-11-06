import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { requireSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

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
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  const { user } = sessionResult;

  try {
    const body = await request.json();
    const { title, nicheTags, link } = body;

    if (!title || !link) {
      return NextResponse.json({ error: 'Title and link are required' }, { status: 400 });
    }

    let profile = await prisma.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      profile = await prisma.profile.create({
        data: {
          userId: user.id,
          upworkProfileId: `profile_${user.id}`,
          displayName: user.email.split('@')[0],
          niches: [
            'Amazon Listing Images',
            'A+ Content / EBC',
            'Storefront Design',
            'Brand Story Design',
            'Packaging & Box Design',
          ],
          connectionStatus: 'DISCONNECTED',
        },
      });
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

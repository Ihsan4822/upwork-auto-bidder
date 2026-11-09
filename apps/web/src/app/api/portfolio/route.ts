import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';
import { requireSession, getCurrentProfile } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  // Scope to the current user's profile so a user only sees their own
  // portfolio items. The demo user sees only the demo profile's items.
  const profile = await getCurrentProfile(sessionResult.user.id);
  if (!profile) {
    return NextResponse.json({ items: [] });
  }

  try {
    const items = await prisma.portfolioItem.findMany({
      where: { profileId: profile.id },
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

export async function DELETE(request: NextRequest) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  const { user } = sessionResult;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Portfolio item ID is required' }, { status: 400 });
  }

  try {
    const existingItem = await prisma.portfolioItem.findUnique({
      where: { id },
      include: {
        profile: {
          select: { userId: true },
        },
      },
    });

    if (!existingItem) {
      return NextResponse.json({ error: 'Portfolio item not found' }, { status: 404 });
    }

    if (existingItem.profile.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to delete this portfolio item' },
        { status: 403 },
      );
    }

    await prisma.portfolioItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Portfolio item deleted successfully' });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete portfolio item' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  const { user } = sessionResult;

  try {
    const body = await request.json();
    const { id, isActive } = body;

    if (!id || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'ID and isActive boolean are required' }, { status: 400 });
    }

    const existingItem = await prisma.portfolioItem.findUnique({
      where: { id },
      include: {
        profile: {
          select: { userId: true },
        },
      },
    });

    if (!existingItem) {
      return NextResponse.json({ error: 'Portfolio item not found' }, { status: 404 });
    }

    if (existingItem.profile.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to modify this portfolio item' },
        { status: 403 },
      );
    }

    const updated = await prisma.portfolioItem.update({
      where: { id },
      data: { isActive },
    });

    return NextResponse.json({ item: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update portfolio item' },
      { status: 500 },
    );
  }
}

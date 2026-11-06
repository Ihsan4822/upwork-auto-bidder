import { NextResponse } from 'next/server';
import { prisma } from '@upwork-bidder/db';

export async function POST() {
  try {
    const profile = await prisma.profile.findFirst();

    if (!profile) {
      return NextResponse.json({ success: true, message: 'No profile found' });
    }

    // SECTION 2, RULE 7: "disconnecting must delete the stored token at once"
    // Delete all tokens for this profile permanently
    await prisma.oauthToken.deleteMany({
      where: { profileId: profile.id },
    });

    // Update connection status
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        connectionStatus: 'DISCONNECTED',
      },
    });

    // Audit log (Section C11)
    await prisma.reviewAction.create({
      data: {
        profileId: profile.id,
        jobId: null,
        action: 'DISCONNECTED_UPWORK',
        actorId: profile.userId,
        note: 'OAuth token deleted and Upwork connection terminated by user action.',
      },
    });

    return NextResponse.json({
      success: true,
      profileId: profile.id,
      message: 'Token deleted and profile disconnected successfully.',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to disconnect from Upwork',
      },
      { status: 500 },
    );
  }
}

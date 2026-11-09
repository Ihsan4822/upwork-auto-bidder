import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { isDemoEmail } from '@/lib/demo';

export async function GET(request: NextRequest) {
  const sessionResult = await requireSession(request);
  if (sessionResult.errorResponse) {
    return sessionResult.errorResponse;
  }

  const { user } = sessionResult;
  // Return ONLY id, email, and the demo flag. Never leak tokens, hashes, or allowlist.
  return NextResponse.json({
    id: user.id,
    email: user.email,
    isDemo: isDemoEmail(user.email),
  });
}

/**
 * seed.ts — Fake seed data for development and testing.
 *
 * WHY: Section D10 of the brief requires seed data to be clearly fake and
 * labelled, never mixed with Farid's real jobs or samples.
 *
 * All seed data is clearly marked SEED DATA.
 * Run with: pnpm db:seed
 */

import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_SAVED_SEARCHES,
  FEATURE_FLAG_DEFAULTS,
  FEATURE_FLAG_KEYS,
  FIXED_PRICE_FLOOR_USD,
  HOURLY_RATE_FLOOR_USD,
  DEFAULT_POLL_INTERVAL_MINUTES,
  SETTINGS_KEYS,
} from '@upwork-bidder/config';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with fake test data...');
  console.log('⚠️  ALL DATA BELOW IS FAKE SEED DATA — NOT REAL JOBS OR SAMPLES');

  // ── Settings (fee floors and feature flags) ────────────────────────────────
  console.log('→ Seeding settings...');
  const settingsToSeed = [
    {
      key: SETTINGS_KEYS.HOURLY_RATE_FLOOR_USD,
      value: String(HOURLY_RATE_FLOOR_USD),
      description: 'Minimum hourly rate (USD). Reject jobs below this floor.',
    },
    {
      key: SETTINGS_KEYS.FIXED_PRICE_FLOOR_USD,
      value: String(FIXED_PRICE_FLOOR_USD),
      description: 'Minimum fixed-price budget (USD). Reject jobs below this floor.',
    },
    {
      key: SETTINGS_KEYS.DEFAULT_POLL_INTERVAL_MINUTES,
      value: String(DEFAULT_POLL_INTERVAL_MINUTES),
      description: 'How often the worker polls Upwork MCP (minutes).',
    },
    {
      key: FEATURE_FLAG_KEYS.ENABLE_AI_SCORING,
      value: String(FEATURE_FLAG_DEFAULTS.enableAiScoring),
      description: 'Enable AI scoring of filtered jobs.',
    },
    {
      key: FEATURE_FLAG_KEYS.ENABLE_DRAFT_ENGINE,
      value: String(FEATURE_FLAG_DEFAULTS.enableDraftEngine),
      description: 'Enable auto-drafting of APPLY/APPLY_PLUS_BOOST jobs.',
    },
    {
      key: FEATURE_FLAG_KEYS.ENABLE_ANALYTICS,
      value: String(FEATURE_FLAG_DEFAULTS.enableAnalytics),
      description: 'Enable the analytics module.',
    },
  ];

  for (const setting of settingsToSeed) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, description: setting.description },
      create: setting,
    });
  }

  // ── Seed user (fake) ───────────────────────────────────────────────────────
  console.log('→ Seeding fake user...');
  const seedUser = await prisma.user.upsert({
    where: { email: 'farid@example.dev' },
    update: {},
    create: {
      email: 'farid@example.dev', // FAKE — SEED DATA ONLY
    },
  });

  // ── Seed profile (fake) ────────────────────────────────────────────────────
  console.log('→ Seeding fake profile...');
  const seedProfile = await prisma.profile.upsert({
    where: { upworkProfileId: 'SEED_PROFILE_001' },
    update: {},
    create: {
      userId: seedUser.id,
      upworkProfileId: 'SEED_PROFILE_001', // FAKE — SEED DATA ONLY
      displayName: 'Farid Malik [SEED]',
      niches: ['Amazon A Plus Content', 'Listing Images', 'Storefront Design'],
      connectionStatus: 'DISCONNECTED',
    },
  });

  // ── Seed saved searches (defaults from config) ─────────────────────────────
  console.log('→ Seeding saved searches...');
  for (const search of DEFAULT_SAVED_SEARCHES) {
    const existing = await prisma.savedSearch.findFirst({
      where: { profileId: seedProfile.id, name: search.name },
    });
    if (!existing) {
      await prisma.savedSearch.create({
        data: {
          profileId: seedProfile.id,
          name: search.name,
          queryText: search.queryText,
          isActive: search.isActive,
          pollIntervalMinutes: search.pollIntervalMinutes,
        },
      });
    }
  }

  // ── Seed portfolio items (fake) ────────────────────────────────────────────
  console.log('→ Seeding fake portfolio items...');
  const fakePortfolioItems = [
    {
      title: '[SEED] Sample A Plus Content Project',
      nicheTags: ['Amazon A Plus Content', 'Premium A Plus'],
      link: 'https://example.com/seed-portfolio-aplus', // FAKE LINK — SEED DATA
    },
    {
      title: '[SEED] Sample Storefront Design Project',
      nicheTags: ['Storefront Design', 'Brand Story'],
      link: 'https://example.com/seed-portfolio-storefront', // FAKE LINK — SEED DATA
    },
  ];

  for (const item of fakePortfolioItems) {
    const existing = await prisma.portfolioItem.findFirst({
      where: { profileId: seedProfile.id, title: item.title },
    });
    if (!existing) {
      await prisma.portfolioItem.create({
        data: { profileId: seedProfile.id, ...item },
      });
    }
  }

  // ── Seed a fake job (for UI development) ──────────────────────────────────
  console.log('→ Seeding fake job for UI development...');
  await prisma.job.upsert({
    where: { upworkJobId: 'SEED_JOB_001' },
    update: {},
    create: {
      profileId: seedProfile.id,
      upworkJobId: 'SEED_JOB_001', // FAKE — SEED DATA ONLY
      title: '[SEED] Need Amazon A Plus Content Designer for 5 ASINs',
      description:
        '[SEED DATA] Looking for an experienced A Plus Content designer for our brand. ' +
        'We sell premium kitchen products on Amazon and need 5 A Plus pages created. ' +
        'Budget is flexible for the right designer.',
      budgetType: 'FIXED',
      budgetAmountFixed: 500,
      clientCountry: 'United States',
      clientTotalSpend: 15000,
      clientHireRate: 0.72,
      paymentVerified: true,
      proposalCount: 3,
      postedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      skills: ['Amazon A+ Content', 'Graphic Design', 'Adobe Photoshop'],
      jobUrl: 'https://www.upwork.com/jobs/SEED_JOB_001', // FAKE URL
      status: 'NEW',
    },
  });

  console.log('✅ Seed complete. All data above is FAKE — for development only.');
  console.log(`   Seed user email: farid@example.dev`);
  console.log(`   Seed profile ID: ${seedProfile.id}`);
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

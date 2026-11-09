-- Add source column to jobs (INVITATION vs SEARCH)
-- Invitations are jobs where a client invited Farid directly. They are
-- fetched first each poll cycle and shown on top of the review queue.
-- Existing rows default to SEARCH, which is what the saved-search poll
-- has always produced.
ALTER TABLE "jobs" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'SEARCH';

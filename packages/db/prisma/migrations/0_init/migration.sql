-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "magic_link_token" TEXT,
    "magic_link_expires_at" TIMESTAMP(3),
    "login_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "upwork_profile_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "niches" TEXT[],
    "connection_status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "last_connected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_tokens" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "encrypted_access_token" TEXT NOT NULL,
    "encrypted_refresh_token" TEXT,
    "scopes_granted" TEXT[],
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_searches" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query_text" TEXT NOT NULL,
    "filters" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "poll_interval_minutes" INTEGER,
    "last_polled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "upwork_job_id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "budget_type" TEXT,
    "budget_amount_fixed" DECIMAL(65,30),
    "hourly_rate_min" DECIMAL(65,30),
    "hourly_rate_max" DECIMAL(65,30),
    "client_country" TEXT,
    "client_total_spend" DECIMAL(65,30),
    "client_hire_rate" DECIMAL(65,30),
    "payment_verified" BOOLEAN,
    "proposal_count" INTEGER,
    "posted_at" TIMESTAMP(3),
    "skills" TEXT[],
    "job_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "filter_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_scores" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reasons" JSONB NOT NULL,
    "model_name" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drafts" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "draft_text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "failure_reason" TEXT,
    "portfolio_item_id" TEXT,
    "word_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_items" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "niche_tags" TEXT[],
    "link" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_actions" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "job_id" TEXT,
    "action" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_entries" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "client_viewed" BOOLEAN,
    "client_replied" BOOLEAN,
    "connects_spent" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_upwork_profile_id_key" ON "profiles"("upwork_profile_id");

-- CreateIndex
CREATE INDEX "profiles_user_id_idx" ON "profiles"("user_id");

-- CreateIndex
CREATE INDEX "oauth_tokens_profile_id_idx" ON "oauth_tokens"("profile_id");

-- CreateIndex
CREATE INDEX "saved_searches_profile_id_is_active_idx" ON "saved_searches"("profile_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_upwork_job_id_key" ON "jobs"("upwork_job_id");

-- CreateIndex
CREATE INDEX "jobs_profile_id_status_idx" ON "jobs"("profile_id", "status");

-- CreateIndex
CREATE INDEX "jobs_profile_id_created_at_idx" ON "jobs"("profile_id", "created_at");

-- CreateIndex
CREATE INDEX "job_scores_job_id_idx" ON "job_scores"("job_id");

-- CreateIndex
CREATE INDEX "job_scores_profile_id_label_idx" ON "job_scores"("profile_id", "label");

-- CreateIndex
CREATE INDEX "drafts_job_id_idx" ON "drafts"("job_id");

-- CreateIndex
CREATE INDEX "drafts_profile_id_status_idx" ON "drafts"("profile_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "drafts_job_id_version_key" ON "drafts"("job_id", "version");

-- CreateIndex
CREATE INDEX "portfolio_items_profile_id_is_active_idx" ON "portfolio_items"("profile_id", "is_active");

-- CreateIndex
CREATE INDEX "review_actions_job_id_idx" ON "review_actions"("job_id");

-- CreateIndex
CREATE INDEX "review_actions_profile_id_action_idx" ON "review_actions"("profile_id", "action");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_entries_job_id_key" ON "analytics_entries"("job_id");

-- CreateIndex
CREATE INDEX "analytics_entries_profile_id_idx" ON "analytics_entries"("profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_scores" ADD CONSTRAINT "job_scores_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_portfolio_item_id_fkey" FOREIGN KEY ("portfolio_item_id") REFERENCES "portfolio_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_actions" ADD CONSTRAINT "review_actions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_actions" ADD CONSTRAINT "review_actions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_entries" ADD CONSTRAINT "analytics_entries_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_entries" ADD CONSTRAINT "analytics_entries_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


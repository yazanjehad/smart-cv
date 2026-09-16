-- Auth + RBAC refactor.
--   * User becomes a real JWT account (email + passwordHash + role + isActive)
--     instead of the previous opaque guest `sessionToken` identity.
--   * Every account gets a 1-1 `Subscription` billing/entitlement record.
-- NOTE: hand-reviewed because of the data-preserving steps below.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'RECRUITER', 'JOB_SEEKER');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE_TRIAL', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- DropIndex
DROP INDEX "users_sessionToken_key";

-- Data fix (must run before `email SET NOT NULL`): guest rows created by the
-- pre-JWT session flow never carried an email and can no longer authenticate,
-- so they cannot be migrated into an account.
DELETE FROM "users" WHERE "email" IS NULL;

-- AlterTable
-- `passwordHash` is added with a temporary sentinel default so pre-existing
-- accounts survive the NOT NULL constraint; the default is dropped below.
ALTER TABLE "users" DROP COLUMN "sessionToken",
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "passwordHash" TEXT NOT NULL DEFAULT '!',
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'JOB_SEEKER',
ALTER COLUMN "email" SET NOT NULL;

-- Data fix (development environment): accounts that existed before this
-- migration keep their email/credits and receive the temporary password
-- "SmartCv!2026" so they can sign in to the new JWT flow. Rotate it after the
-- first login (or update `passwordHash` via the auth API).
UPDATE "users"
SET "passwordHash" = '$2b$10$zSs6u.2IPxFT0DixEDjKkOlyXYEXoT4Qldp7LmJH/1J57nM2ttHVe'
WHERE "passwordHash" = '!';

ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP DEFAULT;

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE_TRIAL',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "creditsPerCycle" INTEGER NOT NULL DEFAULT 5,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable backfill: every already-migrated account gets a FREE_TRIAL
-- subscription mirroring its current credit balance.
INSERT INTO "subscriptions" (
    "id", "userId", "plan", "status", "creditsPerCycle", "creditsUsed",
    "currentPeriodStart", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text, "id", 'FREE_TRIAL', 'ACTIVE', 5, 0,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users";

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_plan_idx" ON "subscriptions"("plan");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SHORTLISTED', 'MATCHED', 'REJECTED');

-- AlterTable
ALTER TABLE "match_results" ADD COLUMN     "status" "MatchStatus" NOT NULL DEFAULT 'SHORTLISTED';

-- CreateIndex
CREATE INDEX "match_results_status_idx" ON "match_results"("status");

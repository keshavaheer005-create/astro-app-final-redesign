-- Per-chart data + Supabase auth link
--
-- 1. User.authId links an app user to a Supabase auth user (Google / email+OTP).
-- 2. Journal check-ins, Acharya chat, weekly letters and decision checks now
--    belong to ONE birth chart, so every saved chart keeps its own data.
--    Existing rows are attached to the user's active chart (else their oldest
--    chart) so nothing is lost. Rows of users with no chart stay chartId = NULL.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "authId" TEXT;
CREATE UNIQUE INDEX "User_authId_key" ON "User"("authId");

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "chartId" TEXT;
ALTER TABLE "DailyCheckIn" ADD COLUMN "chartId" TEXT;
ALTER TABLE "WeeklyReflection" ADD COLUMN "chartId" TEXT;
ALTER TABLE "DecisionCheck" ADD COLUMN "chartId" TEXT;

-- Backfill: active chart first, otherwise the oldest chart of that user
UPDATE "ChatMessage" t SET "chartId" = (
  SELECT c."id" FROM "BirthChart" c WHERE c."userId" = t."userId"
  ORDER BY c."isPrimary" DESC, c."createdAt" ASC LIMIT 1);
UPDATE "DailyCheckIn" t SET "chartId" = (
  SELECT c."id" FROM "BirthChart" c WHERE c."userId" = t."userId"
  ORDER BY c."isPrimary" DESC, c."createdAt" ASC LIMIT 1);
UPDATE "WeeklyReflection" t SET "chartId" = (
  SELECT c."id" FROM "BirthChart" c WHERE c."userId" = t."userId"
  ORDER BY c."isPrimary" DESC, c."createdAt" ASC LIMIT 1);
UPDATE "DecisionCheck" t SET "chartId" = (
  SELECT c."id" FROM "BirthChart" c WHERE c."userId" = t."userId"
  ORDER BY c."isPrimary" DESC, c."createdAt" ASC LIMIT 1);

-- Uniqueness is now per chart instead of per user
DROP INDEX "DailyCheckIn_userId_date_key";
DROP INDEX "WeeklyReflection_userId_weekStartDate_language_key";
CREATE UNIQUE INDEX "DailyCheckIn_chartId_date_key" ON "DailyCheckIn"("chartId", "date");
CREATE UNIQUE INDEX "WeeklyReflection_chartId_weekStartDate_language_key" ON "WeeklyReflection"("chartId", "weekStartDate", "language");

-- Indexes
CREATE INDEX "ChatMessage_chartId_createdAt_idx" ON "ChatMessage"("chartId", "createdAt");
CREATE INDEX "WeeklyReflection_userId_weekStartDate_idx" ON "WeeklyReflection"("userId", "weekStartDate");
CREATE INDEX "DecisionCheck_chartId_createdAt_idx" ON "DecisionCheck"("chartId", "createdAt");

-- Foreign keys (deleting a chart deletes that chart's own data)
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "BirthChart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyCheckIn" ADD CONSTRAINT "DailyCheckIn_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "BirthChart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyReflection" ADD CONSTRAINT "WeeklyReflection_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "BirthChart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DecisionCheck" ADD CONSTRAINT "DecisionCheck_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "BirthChart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

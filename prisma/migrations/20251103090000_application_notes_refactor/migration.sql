-- AlterTable
ALTER TABLE "Application" ADD COLUMN "bidderNote" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Application" ADD COLUMN "checkNote" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Application" ADD COLUMN "checkResult" TEXT NOT NULL DEFAULT 'pending';

UPDATE "Application" SET "bidderNote" = COALESCE("notes", '');
UPDATE "Application" SET "checkResult" = 'ok' WHERE "checkStatus" = 'checked';
UPDATE "Application" SET "checkResult" = 'bad' WHERE "checkStatus" = 'rejected';
UPDATE "Application" SET "checkStatus" = 'reviewed' WHERE "checkStatus" IN ('checked', 'rejected');

ALTER TABLE "Application" DROP COLUMN "notes";
ALTER TABLE "Application" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "superAdmin" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "memberId" DROP NOT NULL;

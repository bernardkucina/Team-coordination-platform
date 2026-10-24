-- CreateEnum
CREATE TYPE "WorkLocation" AS ENUM ('hub', 'remote');

-- AlterTable
ALTER TABLE "ActiveTimer" ADD COLUMN     "location" "WorkLocation";

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "reason" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "deadline" DATE,
ADD COLUMN     "neededRoles" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "location" "WorkLocation";

-- CreateTable
CREATE TABLE "CalendarSync" (
    "id" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3),
    "result" TEXT,
    "error" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarSync_pkey" PRIMARY KEY ("id")
);

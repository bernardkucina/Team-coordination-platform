-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'planned');

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "meetUrl" TEXT;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "neededRoles",
ADD COLUMN     "mainArea" TEXT NOT NULL DEFAULT 'strategy',
ADD COLUMN     "number" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "roles" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "status" "ProjectStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "tagline" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "rank" INTEGER;

-- CreateTable
CREATE TABLE "MemberArea" (
    "memberId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberArea_pkey" PRIMARY KEY ("memberId","areaId")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "projectId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("projectId","memberId")
);

-- CreateTable
CREATE TABLE "ProjectInterest" (
    "projectId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectInterest_pkey" PRIMARY KEY ("projectId","memberId")
);

-- CreateIndex
CREATE INDEX "ProjectMember_memberId_idx" ON "ProjectMember"("memberId");

-- AddForeignKey
ALTER TABLE "MemberArea" ADD CONSTRAINT "MemberArea_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInterest" ADD CONSTRAINT "ProjectInterest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInterest" ADD CONSTRAINT "ProjectInterest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;


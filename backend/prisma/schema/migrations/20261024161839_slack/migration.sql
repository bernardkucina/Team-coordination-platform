-- CreateEnum
CREATE TYPE "SlackMessageKind" AS ENUM ('reminder', 'followup');

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "slackEmail" TEXT,
ADD COLUMN     "slackUserId" TEXT;

-- CreateTable
CREATE TABLE "SlackMessage" (
    "id" SERIAL NOT NULL,
    "kind" "SlackMessageKind" NOT NULL,
    "meetingId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "scheduledMessageId" TEXT NOT NULL,
    "postAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlackMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlackMessage_kind_meetingId_memberId_key" ON "SlackMessage"("kind", "meetingId", "memberId");

-- AddForeignKey
ALTER TABLE "SlackMessage" ADD CONSTRAINT "SlackMessage_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlackMessage" ADD CONSTRAINT "SlackMessage_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

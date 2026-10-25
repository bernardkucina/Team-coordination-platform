-- CreateTable
CREATE TABLE "MakeupDuty" (
    "meetingId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "dueOn" DATE NOT NULL,
    "taskId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MakeupDuty_pkey" PRIMARY KEY ("meetingId","memberId")
);

-- CreateTable
CREATE TABLE "HubAddress" (
    "ip" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HubAddress_pkey" PRIMARY KEY ("ip")
);

-- CreateIndex
CREATE INDEX "MakeupDuty_memberId_idx" ON "MakeupDuty"("memberId");

-- AddForeignKey
ALTER TABLE "MakeupDuty" ADD CONSTRAINT "MakeupDuty_meetingId_memberId_fkey" FOREIGN KEY ("meetingId", "memberId") REFERENCES "AttendanceRecord"("meetingId", "memberId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakeupDuty" ADD CONSTRAINT "MakeupDuty_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- CreateTable
CREATE TABLE "WeeklyCheckIn" (
    "id" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "effort" INTEGER NOT NULL,
    "freshness" INTEGER NOT NULL,
    "soreness" INTEGER NOT NULL,
    "enjoyment" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyCheckIn_weekStart_key" ON "WeeklyCheckIn"("weekStart");

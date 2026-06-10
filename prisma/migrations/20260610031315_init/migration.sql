-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER NOT NULL,
    "avgPace" DOUBLE PRECISION,
    "avgHeartRate" INTEGER,
    "maxHeartRate" INTEGER,
    "sport" TEXT NOT NULL DEFAULT 'Run',
    "coordinates" JSONB,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Activity_externalId_key" ON "Activity"("externalId");

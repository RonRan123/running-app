-- CreateTable
CREATE TABLE "ActivityStream" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "time" JSONB NOT NULL,
    "heartrate" JSONB,
    "velocity" JSONB,
    "altitude" JSONB,
    "cadence" JSONB,
    "distance" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "age" INTEGER,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaceGoal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "goalTime" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaceGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityStream_activityId_key" ON "ActivityStream"("activityId");

-- AddForeignKey
ALTER TABLE "ActivityStream" ADD CONSTRAINT "ActivityStream_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

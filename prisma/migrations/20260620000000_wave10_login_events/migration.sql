-- CreateTable
CREATE TABLE "LoginEvent" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "country" TEXT,
    "city" TEXT,

    CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

-- AlterTable: optional resting / max heart rate, and the plan's check-in tags.
-- IF NOT EXISTS keeps this safe on databases already synced with `prisma db push`.
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "restingHr" INTEGER;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "maxHr" INTEGER;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "checkIn" JSONB;

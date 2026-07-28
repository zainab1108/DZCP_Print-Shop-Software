-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'STAFF';

-- Backfill: any pre-existing user is the bootstrap owner — make them ADMIN.
UPDATE "User" SET "role" = 'ADMIN';

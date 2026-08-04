-- CreateEnum
CREATE TYPE "DecorationMethod" AS ENUM ('SCREEN_PRINT', 'DTF', 'EMBROIDERY', 'LASER_ENGRAVING', 'PROMOTIONAL');

-- AlterTable
ALTER TABLE "PriceGrid" ADD COLUMN     "method" "DecorationMethod" NOT NULL DEFAULT 'SCREEN_PRINT';

-- CreateIndex
CREATE INDEX "PriceGrid_method_idx" ON "PriceGrid"("method");

-- CreateTable
CREATE TABLE "SetupFeeTier" (
    "id" TEXT NOT NULL,
    "gridId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "fee" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetupFeeTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SetupFeeTier_gridId_idx" ON "SetupFeeTier"("gridId");

-- CreateIndex
CREATE UNIQUE INDEX "SetupFeeTier_gridId_tier_key" ON "SetupFeeTier"("gridId", "tier");

-- AddForeignKey
ALTER TABLE "SetupFeeTier" ADD CONSTRAINT "SetupFeeTier_gridId_fkey" FOREIGN KEY ("gridId") REFERENCES "PriceGrid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

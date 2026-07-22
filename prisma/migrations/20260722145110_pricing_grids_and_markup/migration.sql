-- CreateTable
CREATE TABLE "PriceGrid" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tierLabel" TEXT NOT NULL DEFAULT 'Colors',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceGrid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceCell" (
    "id" TEXT NOT NULL,
    "gridId" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "tier" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "PriceCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkupRule" (
    "id" TEXT NOT NULL,
    "minCost" DECIMAL(12,2) NOT NULL,
    "multiplier" DECIMAL(6,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarkupRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceCell_gridId_idx" ON "PriceCell"("gridId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceCell_gridId_minQuantity_tier_key" ON "PriceCell"("gridId", "minQuantity", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "MarkupRule_minCost_key" ON "MarkupRule"("minCost");

-- AddForeignKey
ALTER TABLE "PriceCell" ADD CONSTRAINT "PriceCell_gridId_fkey" FOREIGN KEY ("gridId") REFERENCES "PriceGrid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

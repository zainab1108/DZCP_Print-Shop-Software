-- CreateEnum
CREATE TYPE "Carrier" AS ENUM ('UPS', 'USPS', 'FEDEX', 'DHL', 'OTHER');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED');

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "carrier" "Carrier" NOT NULL DEFAULT 'OTHER',
    "service" TEXT,
    "trackingNumber" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "weightOz" INTEGER,
    "shipToName" TEXT,
    "shipToLine1" TEXT,
    "shipToLine2" TEXT,
    "shipToCity" TEXT,
    "shipToState" TEXT,
    "shipToPostalCode" TEXT,
    "shipToCountry" TEXT,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shipment_jobId_idx" ON "Shipment"("jobId");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

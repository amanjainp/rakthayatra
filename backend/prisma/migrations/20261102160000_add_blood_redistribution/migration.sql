-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REDISTRIBUTION_ALERT';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BloodComponent" AS ENUM ('WHOLE_BLOOD', 'PACKED_RBC', 'PLASMA', 'PLATELETS', 'CRYOPRECIPITATE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RedistributionUrgency" AS ENUM ('ROUTINE', 'URGENT', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RedistributionStatus" AS ENUM ('REQUESTED', 'MATCHING', 'PROPOSED', 'AWAITING_APPROVAL', 'APPROVED', 'RESERVED', 'READY_FOR_DISPATCH', 'DISPATCHED', 'IN_TRANSIT', 'RECEIVED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable BloodInventory
ALTER TABLE "BloodInventory" ALTER COLUMN "bloodBankId" DROP NOT NULL;
ALTER TABLE "BloodInventory" ADD COLUMN IF NOT EXISTS "hospitalId" TEXT;
ALTER TABLE "BloodInventory" ADD COLUMN IF NOT EXISTS "componentType" "BloodComponent" NOT NULL DEFAULT 'WHOLE_BLOOD';
ALTER TABLE "BloodInventory" ADD COLUMN IF NOT EXISTS "collectionDate" TIMESTAMP(3);
ALTER TABLE "BloodInventory" ADD COLUMN IF NOT EXISTS "batchNumber" TEXT;
ALTER TABLE "BloodInventory" ADD COLUMN IF NOT EXISTS "storageTemp" TEXT;

-- CreateTable RedistributionRequest
CREATE TABLE IF NOT EXISTS "RedistributionRequest" (
    "id" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "destinationFacilityType" TEXT NOT NULL,
    "destinationHospitalId" TEXT,
    "destinationBloodBankId" TEXT,
    "bloodGroup" "BloodGroup" NOT NULL,
    "componentType" "BloodComponent" NOT NULL DEFAULT 'WHOLE_BLOOD',
    "unitsRequired" INTEGER NOT NULL,
    "urgency" "RedistributionUrgency" NOT NULL DEFAULT 'ROUTINE',
    "status" "RedistributionStatus" NOT NULL DEFAULT 'REQUESTED',
    "requiredBy" TIMESTAMP(3) NOT NULL,
    "minRemainingShelfLifeDays" INTEGER NOT NULL DEFAULT 3,
    "deliveryAddress" TEXT NOT NULL,
    "deliveryLatitude" DOUBLE PRECISION NOT NULL,
    "deliveryLongitude" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "specialHandlingNotes" TEXT,
    "additionalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RedistributionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable RedistributionProposal
CREATE TABLE IF NOT EXISTS "RedistributionProposal" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "proposerUserId" TEXT NOT NULL,
    "sourceFacilityType" TEXT NOT NULL,
    "sourceHospitalId" TEXT,
    "sourceBloodBankId" TEXT,
    "bloodGroup" "BloodGroup" NOT NULL,
    "componentType" "BloodComponent" NOT NULL,
    "unitsProposed" INTEGER NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "proposedInventoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "estimatedDistanceKm" DOUBLE PRECISION,
    "estimatedTransitMins" INTEGER,
    "notes" TEXT,
    "rejectionReason" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RedistributionProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable RedistributionTransfer
CREATE TABLE IF NOT EXISTS "RedistributionTransfer" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "sourceFacilityType" TEXT NOT NULL,
    "sourceHospitalId" TEXT,
    "sourceBloodBankId" TEXT,
    "destinationFacilityType" TEXT NOT NULL,
    "destinationHospitalId" TEXT,
    "destinationBloodBankId" TEXT,
    "bloodGroup" "BloodGroup" NOT NULL,
    "componentType" "BloodComponent" NOT NULL,
    "unitsApproved" INTEGER NOT NULL,
    "unitsDispatched" INTEGER,
    "unitsReceived" INTEGER,
    "status" "RedistributionStatus" NOT NULL DEFAULT 'RESERVED',
    "shipmentReference" TEXT,
    "dispatcherName" TEXT,
    "dispatchedByUserId" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "transportVehicleDetails" TEXT,
    "temperatureCheckConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "coldChainNotes" TEXT,
    "expectedArrivalAt" TIMESTAMP(3),
    "inTransitUpdatedAt" TIMESTAMP(3),
    "inTransitNotes" TEXT,
    "receivedByUserId" TEXT,
    "receiverStaffName" TEXT,
    "receivedAt" TIMESTAMP(3),
    "conditionVerified" BOOLEAN NOT NULL DEFAULT false,
    "hasDiscrepancy" BOOLEAN NOT NULL DEFAULT false,
    "discrepancyReason" TEXT,
    "damagedUnits" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RedistributionTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable RedistributionAllocation
CREATE TABLE IF NOT EXISTS "RedistributionAllocation" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "originalInventoryId" TEXT,
    "bloodGroup" "BloodGroup" NOT NULL,
    "componentType" "BloodComponent" NOT NULL,
    "unitsAllocated" INTEGER NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "reservedByUserId" TEXT NOT NULL,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "RedistributionAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable RedistributionEvent
CREATE TABLE IF NOT EXISTS "RedistributionEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "transferId" TEXT,
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "actorInstitutionId" TEXT,
    "actorInstitutionName" TEXT,
    "action" TEXT NOT NULL,
    "previousState" TEXT,
    "newState" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedistributionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BloodInventory_hospitalId_idx" ON "BloodInventory"("hospitalId");
CREATE INDEX IF NOT EXISTS "BloodInventory_bloodGroup_componentType_status_idx" ON "BloodInventory"("bloodGroup", "componentType", "status");
CREATE INDEX IF NOT EXISTS "RedistributionRequest_status_idx" ON "RedistributionRequest"("status");
CREATE INDEX IF NOT EXISTS "RedistributionRequest_bloodGroup_componentType_status_idx" ON "RedistributionRequest"("bloodGroup", "componentType", "status");
CREATE INDEX IF NOT EXISTS "RedistributionRequest_destinationHospitalId_idx" ON "RedistributionRequest"("destinationHospitalId");
CREATE INDEX IF NOT EXISTS "RedistributionRequest_destinationBloodBankId_idx" ON "RedistributionRequest"("destinationBloodBankId");
CREATE INDEX IF NOT EXISTS "RedistributionRequest_createdAt_idx" ON "RedistributionRequest"("createdAt");
CREATE INDEX IF NOT EXISTS "RedistributionProposal_requestId_idx" ON "RedistributionProposal"("requestId");
CREATE INDEX IF NOT EXISTS "RedistributionProposal_sourceHospitalId_idx" ON "RedistributionProposal"("sourceHospitalId");
CREATE INDEX IF NOT EXISTS "RedistributionProposal_sourceBloodBankId_idx" ON "RedistributionProposal"("sourceBloodBankId");
CREATE INDEX IF NOT EXISTS "RedistributionProposal_status_idx" ON "RedistributionProposal"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "RedistributionTransfer_proposalId_key" ON "RedistributionTransfer"("proposalId");
CREATE UNIQUE INDEX IF NOT EXISTS "RedistributionTransfer_shipmentReference_key" ON "RedistributionTransfer"("shipmentReference");
CREATE UNIQUE INDEX IF NOT EXISTS "RedistributionTransfer_idempotencyKey_key" ON "RedistributionTransfer"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "RedistributionTransfer_requestId_idx" ON "RedistributionTransfer"("requestId");
CREATE INDEX IF NOT EXISTS "RedistributionTransfer_sourceHospitalId_idx" ON "RedistributionTransfer"("sourceHospitalId");
CREATE INDEX IF NOT EXISTS "RedistributionTransfer_sourceBloodBankId_idx" ON "RedistributionTransfer"("sourceBloodBankId");
CREATE INDEX IF NOT EXISTS "RedistributionTransfer_destinationHospitalId_idx" ON "RedistributionTransfer"("destinationHospitalId");
CREATE INDEX IF NOT EXISTS "RedistributionTransfer_destinationBloodBankId_idx" ON "RedistributionTransfer"("destinationBloodBankId");
CREATE INDEX IF NOT EXISTS "RedistributionTransfer_status_idx" ON "RedistributionTransfer"("status");
CREATE INDEX IF NOT EXISTS "RedistributionAllocation_transferId_idx" ON "RedistributionAllocation"("transferId");
CREATE INDEX IF NOT EXISTS "RedistributionAllocation_inventoryId_idx" ON "RedistributionAllocation"("inventoryId");
CREATE INDEX IF NOT EXISTS "RedistributionEvent_requestId_idx" ON "RedistributionEvent"("requestId");
CREATE INDEX IF NOT EXISTS "RedistributionEvent_transferId_idx" ON "RedistributionEvent"("transferId");
CREATE INDEX IF NOT EXISTS "RedistributionEvent_actorUserId_idx" ON "RedistributionEvent"("actorUserId");
CREATE INDEX IF NOT EXISTS "RedistributionEvent_createdAt_idx" ON "RedistributionEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "BloodInventory" ADD CONSTRAINT "BloodInventory_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "HospitalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedistributionRequest" ADD CONSTRAINT "RedistributionRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedistributionRequest" ADD CONSTRAINT "RedistributionRequest_destinationHospitalId_fkey" FOREIGN KEY ("destinationHospitalId") REFERENCES "HospitalProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RedistributionRequest" ADD CONSTRAINT "RedistributionRequest_destinationBloodBankId_fkey" FOREIGN KEY ("destinationBloodBankId") REFERENCES "BloodBankProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RedistributionProposal" ADD CONSTRAINT "RedistributionProposal_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RedistributionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedistributionProposal" ADD CONSTRAINT "RedistributionProposal_proposerUserId_fkey" FOREIGN KEY ("proposerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedistributionProposal" ADD CONSTRAINT "RedistributionProposal_sourceHospitalId_fkey" FOREIGN KEY ("sourceHospitalId") REFERENCES "HospitalProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RedistributionProposal" ADD CONSTRAINT "RedistributionProposal_sourceBloodBankId_fkey" FOREIGN KEY ("sourceBloodBankId") REFERENCES "BloodBankProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RedistributionTransfer" ADD CONSTRAINT "RedistributionTransfer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RedistributionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedistributionTransfer" ADD CONSTRAINT "RedistributionTransfer_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "RedistributionProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedistributionTransfer" ADD CONSTRAINT "RedistributionTransfer_sourceHospitalId_fkey" FOREIGN KEY ("sourceHospitalId") REFERENCES "HospitalProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RedistributionTransfer" ADD CONSTRAINT "RedistributionTransfer_sourceBloodBankId_fkey" FOREIGN KEY ("sourceBloodBankId") REFERENCES "BloodBankProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RedistributionTransfer" ADD CONSTRAINT "RedistributionTransfer_destinationHospitalId_fkey" FOREIGN KEY ("destinationHospitalId") REFERENCES "HospitalProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RedistributionTransfer" ADD CONSTRAINT "RedistributionTransfer_destinationBloodBankId_fkey" FOREIGN KEY ("destinationBloodBankId") REFERENCES "BloodBankProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RedistributionAllocation" ADD CONSTRAINT "RedistributionAllocation_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "RedistributionTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedistributionAllocation" ADD CONSTRAINT "RedistributionAllocation_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "BloodInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedistributionEvent" ADD CONSTRAINT "RedistributionEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RedistributionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedistributionEvent" ADD CONSTRAINT "RedistributionEvent_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "RedistributionTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedistributionEvent" ADD CONSTRAINT "RedistributionEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


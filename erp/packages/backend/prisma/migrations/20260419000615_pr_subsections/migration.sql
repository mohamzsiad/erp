-- CreateEnum
CREATE TYPE "ShortCloseStatus" AS ENUM ('NONE', 'PARTIAL', 'FULL');

-- CreateEnum
CREATE TYPE "LeadTimeSource" AS ENUM ('SYSTEM', 'MANUAL');

-- AlterTable
ALTER TABLE "prl_lines" ADD COLUMN     "expectedDeliveryDate" TIMESTAMP(3),
ADD COLUMN     "leadTimeDays" INTEGER,
ADD COLUMN     "leadTimeSource" "LeadTimeSource" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN     "shortCloseReason" TEXT,
ADD COLUMN     "shortCloseStatus" "ShortCloseStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "shortClosedAt" TIMESTAMP(3),
ADD COLUMN     "shortClosedById" TEXT,
ADD COLUMN     "shortClosedQty" DECIMAL(18,3) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "pr_delivery_schedules" (
    "id" TEXT NOT NULL,
    "prlLineId" TEXT NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "locationId" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pr_delivery_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pr_account_details" (
    "id" TEXT NOT NULL,
    "prlLineId" TEXT NOT NULL,
    "glAccountId" TEXT NOT NULL,
    "costCentreId" TEXT NOT NULL,
    "projectCode" VARCHAR(50),
    "percentage" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(18,3) NOT NULL,
    "budgetYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pr_account_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pr_alternate_items" (
    "id" TEXT NOT NULL,
    "prlLineId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "grade1" VARCHAR(50),
    "grade2" VARCHAR(50),
    "uom" VARCHAR(20),
    "approxPrice" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pr_alternate_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pr_line_attachments" (
    "id" TEXT NOT NULL,
    "prlLineId" TEXT NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "blobName" VARCHAR(500) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pr_line_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pr_delivery_schedules_prlLineId_idx" ON "pr_delivery_schedules"("prlLineId");

-- CreateIndex
CREATE INDEX "pr_account_details_prlLineId_idx" ON "pr_account_details"("prlLineId");

-- CreateIndex
CREATE INDEX "pr_alternate_items_prlLineId_idx" ON "pr_alternate_items"("prlLineId");

-- CreateIndex
CREATE INDEX "pr_line_attachments_prlLineId_idx" ON "pr_line_attachments"("prlLineId");

-- AddForeignKey
ALTER TABLE "pr_delivery_schedules" ADD CONSTRAINT "pr_delivery_schedules_prlLineId_fkey" FOREIGN KEY ("prlLineId") REFERENCES "prl_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_delivery_schedules" ADD CONSTRAINT "pr_delivery_schedules_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_account_details" ADD CONSTRAINT "pr_account_details_prlLineId_fkey" FOREIGN KEY ("prlLineId") REFERENCES "prl_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_account_details" ADD CONSTRAINT "pr_account_details_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_account_details" ADD CONSTRAINT "pr_account_details_costCentreId_fkey" FOREIGN KEY ("costCentreId") REFERENCES "cost_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_alternate_items" ADD CONSTRAINT "pr_alternate_items_prlLineId_fkey" FOREIGN KEY ("prlLineId") REFERENCES "prl_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_alternate_items" ADD CONSTRAINT "pr_alternate_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pr_line_attachments" ADD CONSTRAINT "pr_line_attachments_prlLineId_fkey" FOREIGN KEY ("prlLineId") REFERENCES "prl_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "item_supplier_xrefs" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierCode" VARCHAR(50),
    "supplierDesc" VARCHAR(300),
    "uom" VARCHAR(20),
    "unitPrice" DECIMAL(18,3),
    "currency" VARCHAR(10),
    "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
    "minOrderQty" DECIMAL(18,3),
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_supplier_xrefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_attachments" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "url" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" VARCHAR(100),
    "description" VARCHAR(500),
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "item_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_supplier_xrefs_itemId_idx" ON "item_supplier_xrefs"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "item_supplier_xrefs_itemId_supplierId_key" ON "item_supplier_xrefs"("itemId", "supplierId");

-- CreateIndex
CREATE INDEX "item_attachments_itemId_idx" ON "item_attachments"("itemId");

-- AddForeignKey
ALTER TABLE "item_supplier_xrefs" ADD CONSTRAINT "item_supplier_xrefs_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_supplier_xrefs" ADD CONSTRAINT "item_supplier_xrefs_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_attachments" ADD CONSTRAINT "item_attachments_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

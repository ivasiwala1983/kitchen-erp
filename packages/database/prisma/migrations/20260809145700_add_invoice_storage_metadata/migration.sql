-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "invoiceFileName" TEXT,
ADD COLUMN     "invoiceMimeType" TEXT,
ADD COLUMN     "invoiceSize" INTEGER,
ADD COLUMN     "invoiceStoragePath" TEXT,
ADD COLUMN     "invoiceUploadedAt" TIMESTAMP(3),
ADD COLUMN     "invoiceUploadedBy" UUID;

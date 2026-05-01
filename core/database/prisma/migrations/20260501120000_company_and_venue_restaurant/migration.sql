-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "orgNumberNormalized" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_orgNumberNormalized_key" ON "Company"("orgNumberNormalized");

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "venueSubtype" TEXT,
ADD COLUMN     "venueSubtypeOther" TEXT,
ADD COLUMN     "establishmentLocation" TEXT,
ADD COLUMN     "offeringsDescription" TEXT;

-- CreateIndex
CREATE INDEX "Restaurant_companyId_idx" ON "Restaurant"("companyId");

-- AddForeignKey
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "preferredRestaurantId" TEXT;

-- CreateIndex
CREATE INDEX "User_preferredRestaurantId_idx" ON "User"("preferredRestaurantId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_preferredRestaurantId_fkey" FOREIGN KEY ("preferredRestaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

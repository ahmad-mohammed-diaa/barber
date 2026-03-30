/*
  Warnings:

  - A unique constraint covering the columns `[barberId,clientId,orderId]` on the table `BarberRating` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `orderId` to the `BarberRating` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "BarberRating_barberId_clientId_key";

-- AlterTable
ALTER TABLE "BarberRating" ADD COLUMN     "orderId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "BarberRating_barberId_clientId_orderId_key" ON "BarberRating"("barberId", "clientId", "orderId");

-- AddForeignKey
ALTER TABLE "BarberRating" ADD CONSTRAINT "BarberRating_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

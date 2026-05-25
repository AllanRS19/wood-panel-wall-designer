-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'OPERATOR');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'UPLOADED', 'ARRANGING', 'PROOFING', 'APPROVED', 'PRINTED', 'SHIPPED');

-- CreateEnum
CREATE TYPE "PaperSize" AS ENUM ('A4', 'LETTER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "wallWidthMm" DOUBLE PRECISION NOT NULL,
    "wallHeightMm" DOUBLE PRECISION NOT NULL,
    "paperSize" "PaperSize" NOT NULL DEFAULT 'A4',
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "widthPx" INTEGER,
    "heightPx" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Panel" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "canvasSizeId" TEXT NOT NULL,
    "xMm" DOUBLE PRECISION NOT NULL,
    "yMm" DOUBLE PRECISION NOT NULL,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Panel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvasSize" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "widthMm" DOUBLE PRECISION NOT NULL,
    "heightMm" DOUBLE PRECISION NOT NULL,
    "thicknessMm" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolePosition" (
    "id" TEXT NOT NULL,
    "canvasSizeId" TEXT NOT NULL,
    "xMm" DOUBLE PRECISION NOT NULL,
    "yMm" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Hanging point',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HolePosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Panel" ADD CONSTRAINT "Panel_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Panel" ADD CONSTRAINT "Panel_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Panel" ADD CONSTRAINT "Panel_canvasSizeId_fkey" FOREIGN KEY ("canvasSizeId") REFERENCES "CanvasSize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolePosition" ADD CONSTRAINT "HolePosition_canvasSizeId_fkey" FOREIGN KEY ("canvasSizeId") REFERENCES "CanvasSize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

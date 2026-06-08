CREATE TABLE "PublicLetter" (
    "id" SERIAL NOT NULL,
    "nickname" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "content" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PublicLetter_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PublicLetter_visible_createdAt_idx" ON "PublicLetter"("visible", "createdAt");

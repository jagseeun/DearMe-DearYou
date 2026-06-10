ALTER TABLE "Letter" ADD COLUMN IF NOT EXISTS "favorite" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PublicLetter" ADD COLUMN IF NOT EXISTS "pinHash" TEXT;

CREATE TABLE IF NOT EXISTS "LetterDraft" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "content" TEXT,
    "videoUrl" TEXT,
    "imageUrl" TEXT,
    "signatureData" TEXT,
    "deliveryEmail" TEXT,
    "emailTheme" TEXT NOT NULL DEFAULT 'dark',
    "recipientEmail" TEXT,
    "recipientName" TEXT,
    "toOther" BOOLEAN NOT NULL DEFAULT false,
    "openDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" INTEGER NOT NULL,

    CONSTRAINT "LetterDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LetterDraft_authorId_key" ON "LetterDraft"("authorId");

ALTER TABLE "LetterDraft" DROP CONSTRAINT IF EXISTS "LetterDraft_authorId_fkey";
ALTER TABLE "LetterDraft" ADD CONSTRAINT "LetterDraft_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

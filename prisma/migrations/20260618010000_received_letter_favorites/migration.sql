CREATE TABLE IF NOT EXISTS "ReceivedLetterFavorite" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "letterId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceivedLetterFavorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReceivedLetterFavorite_memberId_letterId_key"
ON "ReceivedLetterFavorite"("memberId", "letterId");

CREATE INDEX IF NOT EXISTS "ReceivedLetterFavorite_letterId_idx"
ON "ReceivedLetterFavorite"("letterId");

ALTER TABLE "ReceivedLetterFavorite" DROP CONSTRAINT IF EXISTS "ReceivedLetterFavorite_memberId_fkey";
ALTER TABLE "ReceivedLetterFavorite" ADD CONSTRAINT "ReceivedLetterFavorite_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReceivedLetterFavorite" DROP CONSTRAINT IF EXISTS "ReceivedLetterFavorite_letterId_fkey";
ALTER TABLE "ReceivedLetterFavorite" ADD CONSTRAINT "ReceivedLetterFavorite_letterId_fkey"
FOREIGN KEY ("letterId") REFERENCES "Letter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

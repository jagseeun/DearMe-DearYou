ALTER TABLE "Letter" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "Letter" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;
ALTER TABLE "Letter" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Letter" ADD COLUMN IF NOT EXISTS "signatureData" TEXT;
ALTER TABLE "Letter" ADD COLUMN IF NOT EXISTS "recipientEmail" TEXT;
ALTER TABLE "Letter" ADD COLUMN IF NOT EXISTS "recipientName" TEXT;
ALTER TABLE "Letter" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Letter' AND column_name = 'content'
  ) THEN
    ALTER TABLE "Letter" ALTER COLUMN "content" DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Letter' AND column_name = 'title'
  ) THEN
    ALTER TABLE "Letter" ALTER COLUMN "title" DROP NOT NULL;
    ALTER TABLE "Letter" ALTER COLUMN "title" SET DEFAULT '';
  END IF;
END $$;

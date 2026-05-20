-- Add login tracking for the random teacher-letter audience.
ALTER TABLE "Member" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- Existing members are included in the first teacher-letter event.
UPDATE "Member" SET "lastLoginAt" = CURRENT_TIMESTAMP WHERE "lastLoginAt" IS NULL;

-- Teacher-authored letters are reusable source messages.
CREATE TABLE "TeacherLetter" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "teacherName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "authorId" INTEGER NOT NULL,

    CONSTRAINT "TeacherLetter_pkey" PRIMARY KEY ("id")
);

-- One row per member permanently enforces at most one teacher letter.
CREATE TABLE "TeacherLetterDelivery" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "teacherLetterId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "TeacherLetterDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherLetterDelivery_memberId_key" ON "TeacherLetterDelivery"("memberId");

ALTER TABLE "TeacherLetter" ADD CONSTRAINT "TeacherLetter_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeacherLetterDelivery" ADD CONSTRAINT "TeacherLetterDelivery_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeacherLetterDelivery" ADD CONSTRAINT "TeacherLetterDelivery_teacherLetterId_fkey"
FOREIGN KEY ("teacherLetterId") REFERENCES "TeacherLetter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "PublicLetter"
SET "updatedAt" = "createdAt"
WHERE "updatedAt" > "createdAt";

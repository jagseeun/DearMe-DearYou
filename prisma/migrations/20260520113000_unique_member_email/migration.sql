UPDATE "Member" SET "email" = NULL WHERE "email" = '';

WITH duplicate_emails AS (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (PARTITION BY "email" ORDER BY id ASC) AS row_number
    FROM "Member"
    WHERE "email" IS NOT NULL
  ) ranked
  WHERE row_number > 1
)
UPDATE "Member"
SET "email" = NULL
WHERE id IN (SELECT id FROM duplicate_emails);

CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");

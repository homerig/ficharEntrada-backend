ALTER TABLE "Usuario"
ADD COLUMN "email" TEXT,
ADD COLUMN "reset_code_hash" TEXT,
ADD COLUMN "reset_code_expires_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

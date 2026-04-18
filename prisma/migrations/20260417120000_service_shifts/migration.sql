CREATE TABLE "ServicioTurno" (
    "id" SERIAL NOT NULL,
    "servicio_id" INTEGER NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServicioTurno_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServicioTurno_servicio_id_hora_inicio_key" ON "ServicioTurno"("servicio_id", "hora_inicio");
CREATE INDEX "ServicioTurno_servicio_id_orden_hora_inicio_idx" ON "ServicioTurno"("servicio_id", "orden", "hora_inicio");

ALTER TABLE "ServicioTurno"
ADD CONSTRAINT "ServicioTurno_servicio_id_fkey"
FOREIGN KEY ("servicio_id") REFERENCES "Servicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ServicioTurno" ("servicio_id", "hora_inicio", "orden")
SELECT "id", "hora_entrada_limite", 0
FROM "Servicio"
WHERE "hora_entrada_limite" IS NOT NULL
  AND BTRIM("hora_entrada_limite") <> '';

-- Migration: create_reputation_config
-- Fase 0: Mover config de reputación de localStorage a Supabase
-- Creado: 2026-05-09

-- 1. Crear tabla
CREATE TABLE IF NOT EXISTS public.reputation_config (
  id SERIAL PRIMARY KEY,
  param TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Índice para búsqueda por param
CREATE INDEX IF NOT EXISTS idx_reputation_config_param ON public.reputation_config (param);

-- 3. RLS
ALTER TABLE public.reputation_config ENABLE ROW LEVEL SECURITY;

-- Admins (role_id = 3) y moderadores (role_id = 2) pueden leer
CREATE POLICY "admins_mods_read_reputation_config"
  ON public.reputation_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role_id IN (2, 3)
        AND users.is_active = true
    )
  );

-- Solo admins (role_id = 3) pueden insertar/actualizar
CREATE POLICY "admins_insert_reputation_config"
  ON public.reputation_config FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role_id = 3
        AND users.is_active = true
    )
  );

CREATE POLICY "admins_update_reputation_config"
  ON public.reputation_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role_id = 3
        AND users.is_active = true
    )
  );

-- 4. Seed: valores por defecto del proyecto
INSERT INTO public.reputation_config (param, value, note) VALUES
  ('Puntos por upvote recibido',       '+5',  'Cuando otro usuario valida tu publicación'),
  ('Puntos por downvote recibido',      '-3',  'Cuando otro usuario rechaza tu publicación'),
  ('Puntos por publicar precio',        '+2',  'Al crear una nueva publicación de precio'),
  ('Umbral Usuario Verificado',         '10',  'Mínimo de puntos para publicar sin restricciones'),
  ('Umbral para rol Moderador',         '500', 'Puntos mínimos para asignación automática'),
  ('Penalización por reporte aceptado', '-10', 'Cuando un reporte contra el usuario es validado')
ON CONFLICT (param) DO NOTHING;

-- 5. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reputation_config_updated_at ON public.reputation_config;

CREATE TRIGGER trg_reputation_config_updated_at
  BEFORE UPDATE ON public.reputation_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- DOWN
-- =============================================================================
DROP TRIGGER IF EXISTS trg_reputation_config_updated_at ON public.reputation_config;
DROP FUNCTION IF EXISTS public.set_updated_at();
DROP TABLE IF EXISTS public.reputation_config CASCADE;

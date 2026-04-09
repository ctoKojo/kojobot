ALTER TABLE public.levels ADD COLUMN IF NOT EXISTS certificate_config JSONB DEFAULT '{}';

COMMENT ON COLUMN public.levels.certificate_config IS 'Certificate name overlay config: name_y_percent (from bottom 0-100), font_size, font_color_hex';
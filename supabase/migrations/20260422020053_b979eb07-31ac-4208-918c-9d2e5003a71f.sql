
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_templates_name_key') THEN
    ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_name_key UNIQUE (name);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.render_default_email_html(
  p_intro text, p_vars jsonb, p_rtl boolean
) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_rows text := '';
  v_row jsonb;
  v_dir text := CASE WHEN p_rtl THEN ' dir="rtl"' ELSE '' END;
  v_align text := CASE WHEN p_rtl THEN ';text-align:right' ELSE '' END;
  v_title text := CASE WHEN p_rtl THEN 'أكاديمية Kojobot' ELSE 'Kojobot Academy' END;
BEGIN
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_vars) LOOP
    v_rows := v_rows || format(
      '<div style="padding:8px 0;border-bottom:1px solid #eee%s"><span style="color:#666;font-size:13px;display:inline-block;width:35%%">%s</span><span style="color:#111;font-weight:500;font-size:14px">{{%s}}</span></div>',
      v_align, v_row->>'label', v_row->>'key'
    );
  END LOOP;
  RETURN format(
    '<!DOCTYPE html><html%s><body style="background:#f5f7fb;font-family:-apple-system,Segoe UI,sans-serif;padding:24px"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.05)%s"><div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:18px;border-radius:8px;font-weight:600;margin:-32px -32px 24px">%s</div><p style="color:#111;font-size:15px;line-height:1.6">%s</p><div style="margin:20px 0">%s</div><p style="color:#999;font-size:12px;text-align:center;margin-top:24px">© %s</p></div></body></html>',
    v_dir, v_align, v_title, p_intro, v_rows, v_title
  );
END $$;

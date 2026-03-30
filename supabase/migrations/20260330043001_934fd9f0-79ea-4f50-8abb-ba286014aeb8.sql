
CREATE TABLE public.layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  resolution_width integer NOT NULL DEFAULT 1920,
  resolution_height integer NOT NULL DEFAULT 1080,
  background_color text NOT NULL DEFAULT '#1a1a2e',
  layout_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage own company layouts"
  ON public.layouts FOR ALL TO authenticated
  USING (company_id IN (SELECT profiles.company_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Super admin can manage all layouts"
  ON public.layouts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

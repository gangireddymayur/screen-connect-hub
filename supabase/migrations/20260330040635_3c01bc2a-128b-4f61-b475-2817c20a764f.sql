
-- Devices/Screens table
CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'offline',
  location text,
  resolution text DEFAULT '1920x1080',
  orientation text DEFAULT 'landscape',
  last_seen_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage own company devices"
  ON public.devices FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Super admin can manage all devices"
  ON public.devices FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Content table
CREATE TABLE public.content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'image',
  file_url text,
  file_size bigint,
  duration integer DEFAULT 10,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage own company content"
  ON public.content FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Super admin can manage all content"
  ON public.content FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Playlists table
CREATE TABLE public.playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage own company playlists"
  ON public.playlists FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Super admin can manage all playlists"
  ON public.playlists FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Playlist items (content in a playlist)
CREATE TABLE public.playlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  duration integer DEFAULT 10,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage playlist items via playlist"
  ON public.playlist_items FOR ALL TO authenticated
  USING (playlist_id IN (
    SELECT id FROM public.playlists WHERE company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Super admin can manage all playlist items"
  ON public.playlist_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Schedules table
CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  start_time time NOT NULL DEFAULT '00:00',
  end_time time NOT NULL DEFAULT '23:59',
  days_of_week integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage own company schedules"
  ON public.schedules FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Super admin can manage all schedules"
  ON public.schedules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Storage bucket for content uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('content', 'content', true);

CREATE POLICY "Admins can upload content files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'content');

CREATE POLICY "Anyone can view content files"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'content');

CREATE POLICY "Admins can delete own content files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'content');

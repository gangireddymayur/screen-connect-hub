
ALTER TABLE public.devices ADD COLUMN pairing_code text UNIQUE;
ALTER TABLE public.devices ADD COLUMN is_paired boolean NOT NULL DEFAULT false;

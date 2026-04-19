-- Allow devices to exist before being claimed by a company.
-- TV generates a row first (company_id NULL), then admin claims it.
ALTER TABLE public.devices ALTER COLUMN company_id DROP NOT NULL;

-- RLS: allow anonymous role to insert orphan devices (no company yet) via edge function service role,
-- but for safety also restrict SELECT/UPDATE on orphan rows to service role only.
-- The existing "Admins can manage own company devices" policy already excludes NULL company_id rows
-- (because NULL is never IN a subquery), so orphan rows are invisible to admins until claimed.
-- No additional policy needed — service role bypasses RLS.

-- Index to speed up code lookup
CREATE INDEX IF NOT EXISTS idx_devices_pairing_code ON public.devices(pairing_code) WHERE pairing_code IS NOT NULL;
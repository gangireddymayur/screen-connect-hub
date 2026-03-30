
-- Drop playlist_items first (depends on playlists)
DROP TABLE IF EXISTS public.playlist_items;

-- Remove playlist_id foreign key and column from schedules
ALTER TABLE public.schedules DROP COLUMN IF EXISTS playlist_id;

-- Drop playlists table
DROP TABLE IF EXISTS public.playlists;

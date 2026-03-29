
-- Replace overly permissive insert policy with a scoped one
DROP POLICY "Allow insert for auth trigger" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

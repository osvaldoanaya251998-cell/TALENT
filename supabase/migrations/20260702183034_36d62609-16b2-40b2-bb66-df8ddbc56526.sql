
-- Fix search_path on trigger fn
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Storage policies for 'applications' bucket
CREATE POLICY "anyone can upload applications" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'applications');

CREATE POLICY "admins can read applications files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'applications' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "admins can delete applications files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'applications' AND public.has_role(auth.uid(),'admin'));

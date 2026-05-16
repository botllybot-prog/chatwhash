-- Allow station owners to manage only their own station services
CREATE POLICY "Owners insert own station services"
ON public.services
FOR INSERT
TO authenticated
WITH CHECK (
  station_id = public.get_owner_station_id(auth.uid())
);

CREATE POLICY "Owners update own station services"
ON public.services
FOR UPDATE
TO authenticated
USING (
  station_id = public.get_owner_station_id(auth.uid())
)
WITH CHECK (
  station_id = public.get_owner_station_id(auth.uid())
);

CREATE POLICY "Owners delete own station services"
ON public.services
FOR DELETE
TO authenticated
USING (
  station_id = public.get_owner_station_id(auth.uid())
);

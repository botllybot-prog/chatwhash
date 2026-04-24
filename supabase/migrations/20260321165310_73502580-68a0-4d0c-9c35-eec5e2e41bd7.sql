-- Allow station owners to update booking status for their own station
CREATE POLICY "Owners update own station bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (station_id = get_owner_station_id(auth.uid()))
WITH CHECK (station_id = get_owner_station_id(auth.uid()));

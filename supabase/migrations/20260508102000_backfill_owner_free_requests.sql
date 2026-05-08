UPDATE public.station_owners
SET
  free_requests_quota = 20,
  free_requests_used = 0
WHERE COALESCE(free_requests_quota, 0) = 0
  AND COALESCE(free_requests_used, 0) = 0;

UPDATE public.stations AS station
SET
  is_active = true,
  suspension_reason = null,
  suspended_at = null
FROM public.station_owners AS owner
WHERE owner.station_id = station.id
  AND owner.free_requests_quota > owner.free_requests_used
  AND station.suspension_reason = 'free_quota_exhausted';

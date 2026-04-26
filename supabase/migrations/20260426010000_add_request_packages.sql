ALTER TABLE public.station_owners
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS outstanding_debt numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS free_requests_quota integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS free_requests_used integer NOT NULL DEFAULT 0;

ALTER TABLE public.station_owners
DROP CONSTRAINT IF EXISTS station_owners_free_requests_quota_check;

ALTER TABLE public.station_owners
ADD CONSTRAINT station_owners_free_requests_quota_check
CHECK (free_requests_quota >= 0);

ALTER TABLE public.station_owners
DROP CONSTRAINT IF EXISTS station_owners_free_requests_used_check;

ALTER TABLE public.station_owners
ADD CONSTRAINT station_owners_free_requests_used_check
CHECK (free_requests_used >= 0);

ALTER TABLE public.stations
ADD COLUMN IF NOT EXISTS suspension_reason text,
ADD COLUMN IF NOT EXISTS suspended_at timestamp with time zone;

ALTER TABLE public.stations
DROP CONSTRAINT IF EXISTS stations_suspension_reason_check;

ALTER TABLE public.stations
ADD CONSTRAINT stations_suspension_reason_check
CHECK (
  suspension_reason IS NULL OR suspension_reason IN (
    'manual',
    'free_quota_exhausted',
    'package_exhausted',
    'subscription_expired'
  )
);

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS package_code text,
ADD COLUMN IF NOT EXISTS request_limit integer,
ADD COLUMN IF NOT EXISTS requests_used integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS warning_sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS exhausted_notified_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone DEFAULT now();

ALTER TABLE public.subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_request_limit_check;

ALTER TABLE public.subscriptions
ADD CONSTRAINT subscriptions_request_limit_check
CHECK (request_limit IS NULL OR request_limit > 0);

ALTER TABLE public.subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_requests_used_check;

ALTER TABLE public.subscriptions
ADD CONSTRAINT subscriptions_requests_used_check
CHECK (requests_used >= 0);

UPDATE public.subscriptions
SET
  package_code = COALESCE(package_code, CASE plan
    WHEN 'basic' THEN 'starter_20'
    WHEN 'pro' THEN 'growth_50'
    WHEN 'premium' THEN 'scale_110'
    ELSE 'starter_20'
  END),
  request_limit = COALESCE(request_limit, CASE plan
    WHEN 'basic' THEN 20
    WHEN 'pro' THEN 50
    WHEN 'premium' THEN 110
    ELSE 20
  END),
  paid_at = COALESCE(paid_at, created_at)
WHERE package_code IS NULL OR request_limit IS NULL OR paid_at IS NULL;

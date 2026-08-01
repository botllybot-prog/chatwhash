-- Optional. Offer media metadata is stored in Netlify Blobs (see
-- netlify/edge-functions/offer-media.ts), so offers save their images and videos
-- whether or not these columns exist. When they do exist the admin offers page
-- mirrors the media into them for anything that reads offer_details directly.
alter table public.offer_details
  add column if not exists media_key text,
  add column if not exists media_url text,
  add column if not exists media_type text,
  add column if not exists media_name text;

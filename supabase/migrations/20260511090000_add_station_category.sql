alter table public.stations
add column if not exists category text not null default 'car_wash'
check (category in ('car_wash', 'delivery_wash', 'car_care_center', 'maintenance_center'));

comment on column public.stations.category is 'Business category: car_wash, delivery_wash, car_care_center, maintenance_center.';

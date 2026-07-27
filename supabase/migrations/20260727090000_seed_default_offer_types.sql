insert into public.offer_types (name)
select default_type.name
from (values ('Single'), ('Slider')) as default_type(name)
where not exists (
  select 1
  from public.offer_types existing
  where lower(existing.name) = lower(default_type.name)
);

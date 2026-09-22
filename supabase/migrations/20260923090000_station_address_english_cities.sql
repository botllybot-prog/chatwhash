-- The station city dropdown now saves the English city name in stations.address.
-- Convert stations saved with the Arabic city name so the dropdown matches them.
UPDATE public.stations AS s
SET address = c.en
FROM (VALUES
  ('بغداد', 'Baghdad'),
  ('أربيل', 'Erbil'),
  ('البصرة', 'Basra'),
  ('الموصل', 'Mosul'),
  ('السليمانية', 'Sulaymaniyah'),
  ('كركوك', 'Kirkuk'),
  ('كربلاء', 'Karbala'),
  ('النجف', 'Najaf'),
  ('دهوك', 'Duhok'),
  ('الرمادي', 'Ramadi'),
  ('تكريت', 'Tikrit'),
  ('الناصرية', 'Nasiriyah'),
  ('العمارة', 'Amarah'),
  ('الديوانية', 'Diwaniyah'),
  ('الكوت', 'Kut'),
  ('السماوة', 'Samawah'),
  ('الحلة', 'Hilla'),
  ('الفلوجة', 'Fallujah'),
  ('بعقوبة', 'Baqubah')
) AS c(ar, en)
WHERE btrim(s.address) = c.ar;

-- The mobile app's city picker used governorate names (e.g. "Nineveh") that
-- don't match the offer cities (e.g. "Mosul"), so those customers never saw
-- city-targeted offers. The app now uses the offer city list; map saved
-- governorate names to their capital city.
WITH mapping(old_name, city) AS (
  VALUES
    ('Nineveh', 'Mosul'),
    ('Anbar', 'Ramadi'),
    ('Babylon', 'Hilla'),
    ('Diyala', 'Baqubah'),
    ('Maysan', 'Amarah'),
    ('Muthanna', 'Samawah'),
    ('Qadisiyyah', 'Diwaniyah'),
    ('Saladin', 'Tikrit'),
    ('Thi Qar', 'Nasiriyah'),
    ('Wasit', 'Kut')
)
UPDATE public.customer_profiles AS p
SET city = m.city
FROM mapping AS m
WHERE btrim(p.city) = m.old_name;

WITH mapping(old_name, city) AS (
  VALUES
    ('Nineveh', 'Mosul'),
    ('Anbar', 'Ramadi'),
    ('Babylon', 'Hilla'),
    ('Diyala', 'Baqubah'),
    ('Maysan', 'Amarah'),
    ('Muthanna', 'Samawah'),
    ('Qadisiyyah', 'Diwaniyah'),
    ('Saladin', 'Tikrit'),
    ('Thi Qar', 'Nasiriyah'),
    ('Wasit', 'Kut')
)
UPDATE public.stations AS s
SET address = m.city
FROM mapping AS m
WHERE btrim(s.address) = m.old_name;

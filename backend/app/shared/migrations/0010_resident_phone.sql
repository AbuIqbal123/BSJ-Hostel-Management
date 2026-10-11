-- Optional resident own phone (E.164). Distinct from required guardian_phone.

ALTER TABLE residents ADD COLUMN phone TEXT CHECK (
  phone IS NULL
  OR (
    length(phone) BETWEEN 9 AND 16
    AND substr(phone, 1, 2) GLOB '+[1-9]'
    AND replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
      substr(phone, 2),
      '0', ''), '1', ''), '2', ''), '3', ''), '4', ''), '5', ''), '6', ''), '7', ''), '8', ''), '9', '') = ''
  )
);

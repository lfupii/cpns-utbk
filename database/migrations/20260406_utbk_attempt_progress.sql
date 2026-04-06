ALTER TABLE test_attempts
ADD COLUMN active_section_order INT NULL AFTER status,
ADD COLUMN active_section_started_at TIMESTAMP NULL AFTER active_section_order;

UPDATE test_attempts ta
JOIN test_packages tp ON tp.id = ta.package_id
SET ta.active_section_order = COALESCE(NULLIF(ta.active_section_order, 0), 1),
    ta.active_section_started_at = COALESCE(ta.active_section_started_at, ta.start_time)
WHERE tp.test_mode = 'utbk_sectioned'
  AND (
    ta.active_section_order IS NULL
    OR ta.active_section_order <= 0
    OR ta.active_section_started_at IS NULL
  );

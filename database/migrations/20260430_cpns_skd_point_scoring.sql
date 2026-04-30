SET @add_score_details_json = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'test_results'
        AND column_name = 'score_details_json'
    ),
    'SELECT 1',
    'ALTER TABLE test_results ADD COLUMN score_details_json LONGTEXT NULL AFTER percentage'
  )
);
PREPARE stmt FROM @add_score_details_json;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_question_image_url = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'questions'
        AND column_name = 'question_image_url'
    ),
    'SELECT 1',
    'ALTER TABLE questions ADD COLUMN question_image_url VARCHAR(1000) NULL AFTER question_text'
  )
);
PREPARE stmt FROM @add_question_image_url;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_option_image_url = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'question_options'
        AND column_name = 'option_image_url'
    ),
    'SELECT 1',
    'ALTER TABLE question_options ADD COLUMN option_image_url VARCHAR(1000) NULL AFTER option_text'
  )
);
PREPARE stmt FROM @add_option_image_url;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

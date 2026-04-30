SET @add_score_details_json = (
  SELECT IF(
    NOT EXISTS(
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'test_results'
    )
    OR EXISTS(
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

SET @add_question_option_score_weight = (
  SELECT IF(
    NOT EXISTS(
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'question_options'
    )
    OR EXISTS(
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'question_options'
        AND column_name = 'score_weight'
    ),
    'SELECT 1',
    'ALTER TABLE question_options ADD COLUMN score_weight TINYINT NULL AFTER is_correct'
  )
);
PREPARE stmt FROM @add_question_option_score_weight;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_question_option_draft_score_weight = (
  SELECT IF(
    NOT EXISTS(
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'question_option_drafts'
    )
    OR EXISTS(
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'question_option_drafts'
        AND column_name = 'score_weight'
    ),
    'SELECT 1',
    'ALTER TABLE question_option_drafts ADD COLUMN score_weight TINYINT NULL AFTER is_correct'
  )
);
PREPARE stmt FROM @add_question_option_draft_score_weight;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_learning_option_score_weight = (
  SELECT IF(
    NOT EXISTS(
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'learning_section_question_options'
    )
    OR EXISTS(
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'learning_section_question_options'
        AND column_name = 'score_weight'
    ),
    'SELECT 1',
    'ALTER TABLE learning_section_question_options ADD COLUMN score_weight TINYINT NULL AFTER is_correct'
  )
);
PREPARE stmt FROM @add_learning_option_score_weight;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_learning_option_draft_score_weight = (
  SELECT IF(
    NOT EXISTS(
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'learning_section_question_option_drafts'
    )
    OR EXISTS(
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'learning_section_question_option_drafts'
        AND column_name = 'score_weight'
    ),
    'SELECT 1',
    'ALTER TABLE learning_section_question_option_drafts ADD COLUMN score_weight TINYINT NULL AFTER is_correct'
  )
);
PREPARE stmt FROM @add_learning_option_draft_score_weight;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

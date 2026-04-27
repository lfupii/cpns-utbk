SET @add_questions_explanation_notes = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'questions'
        AND column_name = 'explanation_notes'
    ),
    'SELECT 1',
    'ALTER TABLE questions ADD COLUMN explanation_notes LONGTEXT NULL AFTER difficulty'
  )
);
PREPARE stmt FROM @add_questions_explanation_notes;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_question_drafts_explanation_notes = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'question_drafts'
        AND column_name = 'explanation_notes'
    ),
    'SELECT 1',
    'ALTER TABLE question_drafts ADD COLUMN explanation_notes LONGTEXT NULL AFTER difficulty'
  )
);
PREPARE stmt FROM @add_question_drafts_explanation_notes;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

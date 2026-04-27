ALTER TABLE learning_section_questions
  ADD COLUMN explanation_notes LONGTEXT NULL AFTER difficulty;

ALTER TABLE learning_section_question_drafts
  ADD COLUMN explanation_notes LONGTEXT NULL AFTER difficulty;

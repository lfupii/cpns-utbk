ALTER TABLE learning_section_questions
ADD COLUMN question_image_url VARCHAR(1000) DEFAULT NULL AFTER question_text;

ALTER TABLE learning_section_question_options
ADD COLUMN option_image_url VARCHAR(1000) DEFAULT NULL AFTER option_text;

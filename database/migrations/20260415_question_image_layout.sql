ALTER TABLE questions
ADD COLUMN question_image_layout VARCHAR(20) NOT NULL DEFAULT 'top' AFTER question_image_url;

ALTER TABLE test_packages
  ADD COLUMN IF NOT EXISTS test_mode VARCHAR(50) NULL AFTER time_limit,
  ADD COLUMN IF NOT EXISTS workflow_config LONGTEXT NULL AFTER test_mode;

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS section_code VARCHAR(100) NULL AFTER difficulty,
  ADD COLUMN IF NOT EXISTS section_name VARCHAR(150) NULL AFTER section_code,
  ADD COLUMN IF NOT EXISTS section_order INT NOT NULL DEFAULT 1 AFTER section_name,
  ADD COLUMN IF NOT EXISTS question_order INT NOT NULL DEFAULT 0 AFTER section_order;

UPDATE test_packages
SET
  test_mode = 'cpns_cat',
  time_limit = 100,
  workflow_config = '{"label":"CPNS CAT","allow_random_navigation":true,"save_behavior":"manual_next","manual_finish":true,"total_duration_minutes":100,"sections":[{"code":"twk","name":"TWK","order":1,"duration_minutes":null,"target_question_count":30},{"code":"tiu","name":"TIU","order":2,"duration_minutes":null,"target_question_count":35},{"code":"tkp","name":"TKP","order":3,"duration_minutes":null,"target_question_count":45}]}'
WHERE LOWER(name) LIKE '%cpns%';

UPDATE test_packages
SET
  test_mode = 'utbk_sectioned',
  time_limit = 195,
  workflow_config = '{"label":"UTBK Bertahap","allow_random_navigation":false,"save_behavior":"auto","manual_finish":false,"total_duration_minutes":195,"sections":[{"code":"tps_penalaran_induktif","name":"Penalaran Induktif","session_name":"Tes Potensi Skolastik (TPS)","session_order":1,"order":1,"duration_minutes":10,"target_question_count":10},{"code":"tps_penalaran_deduktif","name":"Penalaran Deduktif","session_name":"Tes Potensi Skolastik (TPS)","session_order":1,"order":2,"duration_minutes":10,"target_question_count":10},{"code":"tps_penalaran_kuantitatif","name":"Penalaran Kuantitatif","session_name":"Tes Potensi Skolastik (TPS)","session_order":1,"order":3,"duration_minutes":10,"target_question_count":10},{"code":"tps_ppu","name":"Pengetahuan dan Pemahaman Umum","session_name":"Tes Potensi Skolastik (TPS)","session_order":1,"order":4,"duration_minutes":15,"target_question_count":20},{"code":"tps_pbm","name":"Pemahaman Bacaan dan Menulis","session_name":"Tes Potensi Skolastik (TPS)","session_order":1,"order":5,"duration_minutes":25,"target_question_count":20},{"code":"tps_pk","name":"Pengetahuan Kuantitatif","session_name":"Tes Potensi Skolastik (TPS)","session_order":1,"order":6,"duration_minutes":20,"target_question_count":20},{"code":"literasi_indonesia","name":"Literasi dalam Bahasa Indonesia","session_name":"Tes Literasi","session_order":2,"order":7,"duration_minutes":42.5,"target_question_count":30},{"code":"literasi_inggris","name":"Literasi dalam Bahasa Inggris","session_name":"Tes Literasi","session_order":2,"order":8,"duration_minutes":20,"target_question_count":20},{"code":"penalaran_matematika","name":"Penalaran Matematika","session_name":"Tes Literasi","session_order":2,"order":9,"duration_minutes":42.5,"target_question_count":20}]}'
WHERE LOWER(name) LIKE '%utbk%';

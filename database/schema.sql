-- Canonical database setup for Ujiin
-- This single file recreates the schema and inserts the initial data
-- that matches the current app: 2 active packages (CPNS Intensif and UTBK Intensif).

CREATE DATABASE IF NOT EXISTS cpns_utbk_2026
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE cpns_utbk_2026;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS test_results;
DROP TABLE IF EXISTS user_answers;
DROP TABLE IF EXISTS test_attempts;
DROP TABLE IF EXISTS learning_progress;
DROP TABLE IF EXISTS learning_section_question_options;
DROP TABLE IF EXISTS learning_section_questions;
DROP TABLE IF EXISTS learning_materials;
DROP TABLE IF EXISTS user_access;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS question_options;
DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS test_packages;
DROP TABLE IF EXISTS test_categories;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  phone VARCHAR(15),
  birth_date DATE,
  email_verified_at TIMESTAMP NULL,
  email_verification_token VARCHAR(64) UNIQUE DEFAULT NULL,
  email_verification_sent_at TIMESTAMP NULL,
  email_verification_expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE system_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE test_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE test_packages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  category_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price INT NOT NULL,
  duration_days INT DEFAULT 30,
  max_attempts INT DEFAULT 1,
  question_count INT NOT NULL,
  time_limit INT NOT NULL COMMENT 'dalam menit',
  test_mode VARCHAR(50) DEFAULT NULL,
  workflow_config LONGTEXT,
  is_temporarily_disabled TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES test_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE questions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  package_id INT NOT NULL,
  question_text LONGTEXT NOT NULL,
  question_image_url VARCHAR(1000) DEFAULT NULL,
  question_image_layout VARCHAR(20) NOT NULL DEFAULT 'top',
  question_type ENUM('single_choice', 'multiple_choice') DEFAULT 'single_choice',
  difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
  explanation_notes LONGTEXT NULL,
  section_code VARCHAR(100) DEFAULT NULL,
  section_name VARCHAR(150) DEFAULT NULL,
  section_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (package_id) REFERENCES test_packages(id) ON DELETE CASCADE,
  INDEX (package_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE question_options (
  id INT PRIMARY KEY AUTO_INCREMENT,
  question_id INT NOT NULL,
  option_letter VARCHAR(5) NOT NULL,
  option_text LONGTEXT NOT NULL,
  option_image_url VARCHAR(1000) DEFAULT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  score_weight TINYINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  INDEX (question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  package_id INT NOT NULL,
  amount INT NOT NULL,
  payment_method VARCHAR(50),
  midtrans_order_id VARCHAR(100) UNIQUE,
  midtrans_transaction_id VARCHAR(100) UNIQUE,
  status ENUM('pending', 'completed', 'failed', 'expired') DEFAULT 'pending',
  payment_proof_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES test_packages(id) ON DELETE CASCADE,
  INDEX (user_id),
  INDEX (package_id),
  INDEX (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_access (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  package_id INT NOT NULL,
  transaction_id INT NOT NULL,
  access_status ENUM('active', 'expired', 'revoked') DEFAULT 'active',
  access_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES test_packages(id) ON DELETE CASCADE,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_package (user_id, package_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE learning_progress (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  package_id INT NOT NULL,
  section_code VARCHAR(100) NOT NULL,
  milestone_type VARCHAR(50) NOT NULL,
  metadata LONGTEXT NULL,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES test_packages(id) ON DELETE CASCADE,
  UNIQUE KEY unique_learning_milestone (user_id, package_id, section_code, milestone_type),
  INDEX (user_id, package_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE learning_materials (
  id INT PRIMARY KEY AUTO_INCREMENT,
  package_id INT NOT NULL,
  section_code VARCHAR(100) NOT NULL,
  title VARCHAR(150) NOT NULL,
  content_json LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (package_id) REFERENCES test_packages(id) ON DELETE CASCADE,
  UNIQUE KEY unique_learning_material (package_id, section_code),
  INDEX (package_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE learning_section_questions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  package_id INT NOT NULL,
  section_code VARCHAR(100) NOT NULL,
  question_text LONGTEXT NOT NULL,
  question_image_url VARCHAR(1000) DEFAULT NULL,
  difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
  explanation_notes LONGTEXT NULL,
  question_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (package_id) REFERENCES test_packages(id) ON DELETE CASCADE,
  INDEX (package_id, section_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE learning_section_question_options (
  id INT PRIMARY KEY AUTO_INCREMENT,
  question_id INT NOT NULL,
  option_letter VARCHAR(5) NOT NULL,
  option_text LONGTEXT NOT NULL,
  option_image_url VARCHAR(1000) DEFAULT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  score_weight TINYINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (question_id) REFERENCES learning_section_questions(id) ON DELETE CASCADE,
  INDEX (question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE test_attempts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  package_id INT NOT NULL,
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP NULL,
  status ENUM('ongoing', 'completed', 'abandoned') DEFAULT 'ongoing',
  active_section_order INT NULL,
  active_section_started_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES test_packages(id) ON DELETE CASCADE,
  INDEX (user_id, package_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_answers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  attempt_id INT NOT NULL,
  question_id INT NOT NULL,
  selected_option_id INT,
  is_correct BOOLEAN,
  answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (selected_option_id) REFERENCES question_options(id) ON DELETE SET NULL,
  UNIQUE KEY unique_attempt_question (attempt_id, question_id),
  INDEX (attempt_id, question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attempt_question_flags (
  id INT PRIMARY KEY AUTO_INCREMENT,
  attempt_id INT NOT NULL,
  question_id INT NOT NULL,
  is_marked_review BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  UNIQUE KEY unique_attempt_question_flag (attempt_id, question_id),
  INDEX (attempt_id, question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE test_results (
  id INT PRIMARY KEY AUTO_INCREMENT,
  attempt_id INT NOT NULL UNIQUE,
  user_id INT NOT NULL,
  package_id INT NOT NULL,
  total_questions INT NOT NULL,
  correct_answers INT NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  score_details_json LONGTEXT NULL,
  time_taken INT COMMENT 'dalam detik',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES test_packages(id) ON DELETE CASCADE,
  INDEX (user_id, package_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE question_reports (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  package_id INT NOT NULL,
  tryout_attempt_id INT NULL,
  section_test_attempt_id INT NULL,
  assessment_type ENUM('tryout', 'mini_test') NOT NULL,
  target_type ENUM('question', 'explanation') NOT NULL,
  origin_context VARCHAR(50) NOT NULL DEFAULT 'tryout_active',
  question_id INT NOT NULL,
  question_number INT NULL,
  section_code VARCHAR(100) NULL,
  section_label VARCHAR(150) NULL,
  reported_content_snapshot LONGTEXT NULL,
  message LONGTEXT NULL,
  image_url VARCHAR(1000) NULL,
  image_path VARCHAR(1000) NULL,
  status ENUM('open', 'reviewed', 'resolved') NOT NULL DEFAULT 'open',
  admin_note LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES test_packages(id) ON DELETE CASCADE,
  INDEX (package_id, status),
  INDEX (assessment_type, target_type),
  INDEX (question_id),
  INDEX (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_questions_package ON questions(package_id);
CREATE INDEX idx_test_attempts_user_package ON test_attempts(user_id, package_id);
CREATE INDEX idx_test_results_user ON test_results(user_id);

INSERT INTO test_categories (name, description) VALUES
('CPNS 2026', 'Tryout test untuk CAT CPNS 2026'),
('UTBK 2026', 'Tryout test untuk UTBK 2026');

INSERT INTO test_packages (
  category_id,
  name,
  description,
  price,
  duration_days,
  max_attempts,
  question_count,
  time_limit,
  test_mode,
  workflow_config
) VALUES
(
  1,
  'CPNS Intensif',
  'Paket demo CPNS dengan simulasi soal dan evaluasi hasil.',
  10000,
  30,
  1,
  30,
  100,
  'cpns_cat',
  '{"label":"CPNS CAT","allow_random_navigation":true,"save_behavior":"manual_next","manual_finish":true,"total_duration_minutes":100,"sections":[{"code":"twk","name":"TWK","order":1,"duration_minutes":null,"target_question_count":30},{"code":"tiu","name":"TIU","order":2,"duration_minutes":null,"target_question_count":35},{"code":"tkp","name":"TKP","order":3,"duration_minutes":null,"target_question_count":45}]}'
),
(
  2,
  'UTBK Intensif',
  'Paket demo UTBK dengan latihan dasar TPS dan penalaran.',
  5000,
  30,
  1,
  10,
  195,
  'utbk_sectioned',
  '{"label":"UTBK Bertahap","allow_random_navigation":false,"save_behavior":"auto","manual_finish":false,"total_duration_minutes":195,"sections":[{"code":"tps_penalaran_induktif","name":"Penalaran Induktif","session_name":"Tes Potensi Skolastik (TPS)","session_order":1,"order":1,"duration_minutes":10,"target_question_count":10},{"code":"tps_penalaran_deduktif","name":"Penalaran Deduktif","session_name":"Tes Potensi Skolastik (TPS)","session_order":1,"order":2,"duration_minutes":10,"target_question_count":10},{"code":"tps_penalaran_kuantitatif","name":"Penalaran Kuantitatif","session_name":"Tes Potensi Skolastik (TPS)","session_order":1,"order":3,"duration_minutes":10,"target_question_count":10},{"code":"tps_ppu","name":"Pengetahuan dan Pemahaman Umum","session_name":"Tes Potensi Skolastik (TPS)","session_order":1,"order":4,"duration_minutes":15,"target_question_count":20},{"code":"tps_pbm","name":"Pemahaman Bacaan dan Menulis","session_name":"Tes Potensi Skolastik (TPS)","session_order":1,"order":5,"duration_minutes":25,"target_question_count":20},{"code":"tps_pk","name":"Pengetahuan Kuantitatif","session_name":"Tes Potensi Skolastik (TPS)","session_order":1,"order":6,"duration_minutes":20,"target_question_count":20},{"code":"literasi_indonesia","name":"Literasi dalam Bahasa Indonesia","session_name":"Tes Literasi","session_order":2,"order":7,"duration_minutes":42.5,"target_question_count":30},{"code":"literasi_inggris","name":"Literasi dalam Bahasa Inggris","session_name":"Tes Literasi","session_order":2,"order":8,"duration_minutes":20,"target_question_count":20},{"code":"penalaran_matematika","name":"Penalaran Matematika","session_name":"Tes Literasi","session_order":2,"order":9,"duration_minutes":42.5,"target_question_count":20}]}'
);

INSERT INTO questions (package_id, question_text, question_type, difficulty) VALUES
(1, 'Kata "isyarat" dalam kalimat "Dia memberikan isyarat untuk keluar" memiliki arti...', 'single_choice', 'easy'),
(1, 'Antonim dari kata "efisien" adalah...', 'single_choice', 'medium'),
(1, 'Sinonim dari kata "pragmatis" adalah...', 'single_choice', 'medium'),
(1, 'Dalam kalimat "Kami memiliki kesempatan emas untuk berkembang", kata "emas" bermakna...', 'single_choice', 'easy'),
(1, 'Kalimat yang paling efektif adalah...', 'single_choice', 'hard'),
(1, 'What is the meaning of "ambiguous"?', 'single_choice', 'medium'),
(1, 'Choose the correct sentence:', 'single_choice', 'medium'),
(1, 'The word "notorious" means...', 'single_choice', 'medium'),
(1, 'Which is the synonym of "persevere"?', 'single_choice', 'hard'),
(1, 'Complete the sentence: "If I were you, I _____ accept that offer."', 'single_choice', 'medium'),
(1, 'Semua kucing adalah hewan berbulu. Miaw adalah kucing. Maka...', 'single_choice', 'easy'),
(1, 'Jika A > B dan B > C, maka...', 'single_choice', 'easy'),
(1, 'Deret berikutnya dari: 2, 4, 8, 16, 32, ... adalah', 'single_choice', 'easy'),
(1, 'Pernyataan mana yang kontradiksi dengan "Semua siswa rajin"?', 'single_choice', 'medium'),
(1, 'Jika harga naik 20% dari Rp 100.000, berapa harga sekarang?', 'single_choice', 'easy'),
(1, 'Kata "isyarat" dalam kalimat "Dia memberikan isyarat untuk keluar" memiliki arti...', 'single_choice', 'easy'),
(1, 'Antonim dari kata "efisien" adalah...', 'single_choice', 'medium'),
(1, 'Sinonim dari kata "pragmatis" adalah...', 'single_choice', 'medium'),
(1, 'Dalam kalimat "Kami memiliki kesempatan emas untuk berkembang", kata "emas" bermakna...', 'single_choice', 'easy'),
(1, 'Kalimat yang paling efektif adalah...', 'single_choice', 'hard'),
(1, 'What is the meaning of "ambiguous"?', 'single_choice', 'medium'),
(1, 'Choose the correct sentence:', 'single_choice', 'medium'),
(1, 'The word "notorious" means...', 'single_choice', 'medium'),
(1, 'Which is the synonym of "persevere"?', 'single_choice', 'hard'),
(1, 'Complete the sentence: "If I were you, I _____ accept that offer."', 'single_choice', 'medium'),
(1, 'Semua kucing adalah hewan berbulu. Miaw adalah kucing. Maka...', 'single_choice', 'easy'),
(1, 'Jika A > B dan B > C, maka...', 'single_choice', 'easy'),
(1, 'Deret berikutnya dari: 2, 4, 8, 16, 32, ... adalah', 'single_choice', 'easy'),
(1, 'Pernyataan mana yang kontradiksi dengan "Semua siswa rajin"?', 'single_choice', 'medium'),
(1, 'Jika harga naik 20% dari Rp 100.000, berapa harga sekarang?', 'single_choice', 'easy'),
(2, 'Jika rata-rata 4 bilangan adalah 18 dan tiga bilangan pertama berjumlah 50, maka bilangan keempat adalah...', 'single_choice', 'easy'),
(2, 'Semua peserta tryout disiplin. Sebagian peserta tryout mengikuti kelas malam. Kesimpulan yang pasti benar adalah...', 'single_choice', 'medium'),
(2, 'Pilih pasangan kata yang hubungannya paling mirip: "arsip : dokumen" ...', 'single_choice', 'medium'),
(2, 'Nilai x yang memenuhi 3x - 7 = 20 adalah...', 'single_choice', 'easy'),
(2, 'Kalimat yang paling efektif adalah...', 'single_choice', 'medium'),
(2, 'The best synonym for "precise" is...', 'single_choice', 'easy'),
(2, 'Deret berikutnya dari 5, 8, 13, 20, 29, ... adalah...', 'single_choice', 'medium'),
(2, 'Jika 2p + q = 19 dan p = 7, maka nilai q adalah...', 'single_choice', 'easy'),
(2, 'Bacalah pernyataan berikut: "Semua data valid tersimpan rapi. Sebagian data tersimpan rapi dapat diakses publik." Kesimpulan yang benar adalah...', 'single_choice', 'hard'),
(2, 'Sebuah buku didiskon 20% sehingga harganya menjadi Rp64.000. Harga awal buku tersebut adalah...', 'single_choice', 'medium');

INSERT INTO question_options (question_id, option_letter, option_text, is_correct) VALUES
(1, 'A', 'Tanda tangan', 0),
(1, 'B', 'Gerak tangan atau badan untuk memberi tahu sesuatu', 1),
(1, 'C', 'Pesan tertulis', 0),
(1, 'D', 'Surat pemberitahuan', 0),
(1, 'E', 'Dokumen resmi', 0),
(2, 'A', 'Mubazir', 1),
(2, 'B', 'Hemat', 0),
(2, 'C', 'Cermat', 0),
(2, 'D', 'Tepat', 0),
(2, 'E', 'Cepat', 0),
(3, 'A', 'Praktis', 1),
(3, 'B', 'Teoritis', 0),
(3, 'C', 'Idealis', 0),
(3, 'D', 'Romantis', 0),
(3, 'E', 'Skeptis', 0),
(4, 'A', 'Berwarna emas', 0),
(4, 'B', 'Sangat berharga dan langka', 1),
(4, 'C', 'Berkilau', 0),
(4, 'D', 'Sulit dicari', 0),
(4, 'E', 'Penuh kemewahan', 0),
(5, 'A', 'Mereka akan pergi ke sekolah malam nanti.', 0),
(5, 'B', 'Di antara pohon itu ada sebuah rumah tua.', 1),
(5, 'C', 'Sehabis makan, kami belajar bersama di rumah.', 0),
(5, 'D', 'Untuk mencapai sukses, kerja keras adalah kunci.', 0),
(5, 'E', 'Adik saya seorang guru yang mengajar.', 0),
(6, 'A', 'Clear and direct', 0),
(6, 'B', 'Having more than one meaning; unclear', 1),
(6, 'C', 'Easy to understand', 0),
(6, 'D', 'Complicated', 0),
(6, 'E', 'Mysterious', 0),
(7, 'A', 'She have go to the store.', 0),
(7, 'B', 'She has gone to the store.', 1),
(7, 'C', 'She ha gone to the store.', 0),
(7, 'D', 'She have been going to the store.', 0),
(7, 'E', 'She is go to the store.', 0),
(8, 'A', 'Famous for good reasons', 0),
(8, 'B', 'Famous for bad reasons; infamous', 1),
(8, 'C', 'Not well known', 0),
(8, 'D', 'Forgotten', 0),
(8, 'E', 'Unpopular', 0),
(9, 'A', 'Give up', 0),
(9, 'B', 'Continue firmly; persist', 1),
(9, 'C', 'Hesitate', 0),
(9, 'D', 'Delay', 0),
(9, 'E', 'Refuse', 0),
(10, 'A', 'would accept', 1),
(10, 'B', 'will accept', 0),
(10, 'C', 'have accepted', 0),
(10, 'D', 'accept', 0),
(10, 'E', 'will have accepted', 0),
(11, 'A', 'Miaw bukan hewan berbulu.', 0),
(11, 'B', 'Miaw adalah hewan berbulu.', 1),
(11, 'C', 'Miaw mungkin hewan berbulu.', 0),
(11, 'D', 'Tidak dapat ditarik kesimpulan.', 0),
(11, 'E', 'Miaw adalah kucing gunung.', 0),
(12, 'A', 'A < C', 1),
(12, 'B', 'A = C', 0),
(12, 'C', 'C > A', 0),
(12, 'D', 'Tidak dapat ditentukan.', 0),
(12, 'E', 'A ≥ C', 0),
(13, 'A', '48', 0),
(13, 'B', '60', 0),
(13, 'C', '64', 1),
(13, 'D', '72', 0),
(13, 'E', '80', 0),
(14, 'A', 'Ada siswa yang tidak rajin.', 1),
(14, 'B', 'Semua siswa tidak rajin.', 0),
(14, 'C', 'Sebagian siswa rajin.', 0),
(14, 'D', 'Tidak ada siswa yang rajin.', 0),
(14, 'E', 'Beberapa siswa sangat rajin.', 0),
(15, 'A', 'Rp 110.000', 0),
(15, 'B', 'Rp 115.000', 0),
(15, 'C', 'Rp 120.000', 1),
(15, 'D', 'Rp 125.000', 0),
(15, 'E', 'Rp 130.000', 0),
(16, 'A', 'Tanda tangan', 0),
(16, 'B', 'Gerak tangan atau badan untuk memberi tahu sesuatu', 1),
(16, 'C', 'Pesan tertulis', 0),
(16, 'D', 'Surat pemberitahuan', 0),
(16, 'E', 'Dokumen resmi', 0),
(17, 'A', 'Mubazir', 1),
(17, 'B', 'Hemat', 0),
(17, 'C', 'Cermat', 0),
(17, 'D', 'Tepat', 0),
(17, 'E', 'Cepat', 0),
(18, 'A', 'Praktis', 1),
(18, 'B', 'Teoritis', 0),
(18, 'C', 'Idealis', 0),
(18, 'D', 'Romantis', 0),
(18, 'E', 'Skeptis', 0),
(19, 'A', 'Berwarna emas', 0),
(19, 'B', 'Sangat berharga dan langka', 1),
(19, 'C', 'Berkilau', 0),
(19, 'D', 'Sulit dicari', 0),
(19, 'E', 'Penuh kemewahan', 0),
(20, 'A', 'Mereka akan pergi ke sekolah malam nanti.', 0),
(20, 'B', 'Di antara pohon itu ada sebuah rumah tua.', 1),
(20, 'C', 'Sehabis makan, kami belajar bersama di rumah.', 0),
(20, 'D', 'Untuk mencapai sukses, kerja keras adalah kunci.', 0),
(20, 'E', 'Adik saya seorang guru yang mengajar.', 0),
(21, 'A', 'Clear and direct', 0),
(21, 'B', 'Having more than one meaning; unclear', 1),
(21, 'C', 'Easy to understand', 0),
(21, 'D', 'Complicated', 0),
(21, 'E', 'Mysterious', 0),
(22, 'A', 'She have go to the store.', 0),
(22, 'B', 'She has gone to the store.', 1),
(22, 'C', 'She ha gone to the store.', 0),
(22, 'D', 'She have been going to the store.', 0),
(22, 'E', 'She is go to the store.', 0),
(23, 'A', 'Famous for good reasons', 0),
(23, 'B', 'Famous for bad reasons; infamous', 1),
(23, 'C', 'Not well known', 0),
(23, 'D', 'Forgotten', 0),
(23, 'E', 'Unpopular', 0),
(24, 'A', 'Give up', 0),
(24, 'B', 'Continue firmly; persist', 1),
(24, 'C', 'Hesitate', 0),
(24, 'D', 'Delay', 0),
(24, 'E', 'Refuse', 0),
(25, 'A', 'would accept', 1),
(25, 'B', 'will accept', 0),
(25, 'C', 'have accepted', 0),
(25, 'D', 'accept', 0),
(25, 'E', 'will have accepted', 0),
(26, 'A', 'Miaw bukan hewan berbulu.', 0),
(26, 'B', 'Miaw adalah hewan berbulu.', 1),
(26, 'C', 'Miaw mungkin hewan berbulu.', 0),
(26, 'D', 'Tidak dapat ditarik kesimpulan.', 0),
(26, 'E', 'Miaw adalah kucing gunung.', 0),
(27, 'A', 'A < C', 1),
(27, 'B', 'A = C', 0),
(27, 'C', 'C > A', 0),
(27, 'D', 'Tidak dapat ditentukan.', 0),
(27, 'E', 'A ≥ C', 0),
(28, 'A', '48', 0),
(28, 'B', '60', 0),
(28, 'C', '64', 1),
(28, 'D', '72', 0),
(28, 'E', '80', 0),
(29, 'A', 'Ada siswa yang tidak rajin.', 1),
(29, 'B', 'Semua siswa tidak rajin.', 0),
(29, 'C', 'Sebagian siswa rajin.', 0),
(29, 'D', 'Tidak ada siswa yang rajin.', 0),
(29, 'E', 'Beberapa siswa sangat rajin.', 0),
(30, 'A', 'Rp 110.000', 0),
(30, 'B', 'Rp 115.000', 0),
(30, 'C', 'Rp 120.000', 1),
(30, 'D', 'Rp 125.000', 0),
(30, 'E', 'Rp 130.000', 0),
(31, 'A', '18', 0),
(31, 'B', '20', 0),
(31, 'C', '22', 1),
(31, 'D', '24', 0),
(31, 'E', '26', 0),
(32, 'A', 'Sebagian yang mengikuti kelas malam disiplin.', 1),
(32, 'B', 'Semua yang disiplin mengikuti kelas malam.', 0),
(32, 'C', 'Tidak ada yang mengikuti kelas malam.', 0),
(32, 'D', 'Sebagian peserta tidak disiplin.', 0),
(32, 'E', 'Semua peserta mengikuti kelas malam.', 0),
(33, 'A', 'perpustakaan : buku', 1),
(33, 'B', 'kursi : duduk', 0),
(33, 'C', 'pena : menulis', 0),
(33, 'D', 'layar : cahaya', 0),
(33, 'E', 'meja : kayu', 0),
(34, 'A', '7', 0),
(34, 'B', '8', 0),
(34, 'C', '9', 1),
(34, 'D', '10', 0),
(34, 'E', '11', 0),
(35, 'A', 'Para siswa-siswa sedang belajar bersama.', 0),
(35, 'B', 'Kami membahas rencana itu secara bersama-sama.', 0),
(35, 'C', 'Panitia segera mengumumkan hasil seleksi.', 1),
(35, 'D', 'Mereka naik ke atas panggung utama.', 0),
(35, 'E', 'Dia adalah merupakan juara umum.', 0),
(36, 'A', 'accurate', 1),
(36, 'B', 'careless', 0),
(36, 'C', 'ordinary', 0),
(36, 'D', 'uncertain', 0),
(36, 'E', 'lengthy', 0),
(37, 'A', '36', 0),
(37, 'B', '38', 0),
(37, 'C', '40', 1),
(37, 'D', '42', 0),
(37, 'E', '44', 0),
(38, 'A', '3', 0),
(38, 'B', '4', 0),
(38, 'C', '5', 1),
(38, 'D', '6', 0),
(38, 'E', '7', 0),
(39, 'A', 'Semua data valid dapat diakses publik.', 0),
(39, 'B', 'Sebagian data yang dapat diakses publik tersimpan rapi.', 1),
(39, 'C', 'Tidak ada data valid yang dapat diakses publik.', 0),
(39, 'D', 'Semua data tersimpan rapi adalah valid.', 0),
(39, 'E', 'Sebagian data valid tidak tersimpan rapi.', 0),
(40, 'A', 'Rp76.000', 0),
(40, 'B', 'Rp78.000', 0),
(40, 'C', 'Rp80.000', 1),
(40, 'D', 'Rp82.000', 0),
(40, 'E', 'Rp84.000', 0);

ALTER TABLE users
  ADD COLUMN email_verified_at TIMESTAMP NULL AFTER birth_date,
  ADD COLUMN email_verification_token VARCHAR(64) UNIQUE DEFAULT NULL AFTER email_verified_at,
  ADD COLUMN email_verification_sent_at TIMESTAMP NULL AFTER email_verification_token,
  ADD COLUMN email_verification_expires_at TIMESTAMP NULL AFTER email_verification_sent_at;

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

UPDATE users
SET email_verified_at = COALESCE(email_verified_at, created_at)
WHERE email_verified_at IS NULL;

DELETE FROM users;

INSERT INTO users (email, password, full_name, role, email_verified_at)
VALUES (
  'REMOVED_ADMIN_EMAIL',
  'REMOVED_ADMIN_PASSWORD_HASH',
  'Admin Ujiin',
  'admin',
  NOW()
);

INSERT INTO system_settings (setting_key, setting_value)
VALUES (
  'default_admin_reset_v1',
  JSON_OBJECT('email', 'REMOVED_ADMIN_EMAIL', 'completed_at', NOW())
)
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- ============================================================
-- Digital Signage SaaS — MariaDB Schema
-- Import via Plesk → phpMyAdmin → Import tab
-- Target DB: mayur_  (MariaDB 10.6)
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------- USERS ----------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(255) DEFAULT NULL,
  `company_id` CHAR(36) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- USER ROLES ----------
DROP TABLE IF EXISTS `user_roles`;
CREATE TABLE `user_roles` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `role` ENUM('super_admin','admin') NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_user_role` (`user_id`, `role`),
  INDEX `idx_roles_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- COMPANIES ----------
DROP TABLE IF EXISTS `companies`;
CREATE TABLE `companies` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `contact_email` VARCHAR(255) DEFAULT NULL,
  `plan` ENUM('starter','pro','enterprise') NOT NULL DEFAULT 'starter',
  `max_screens` INT NOT NULL DEFAULT 10,
  `status` ENUM('active','suspended','archived') NOT NULL DEFAULT 'active',
  `timezone` VARCHAR(64) NOT NULL DEFAULT 'UTC',
  `logo_url` TEXT DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_by` CHAR(36) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_companies_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- LAYOUTS ----------
DROP TABLE IF EXISTS `layouts`;
CREATE TABLE `layouts` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `company_id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `resolution_width` INT NOT NULL DEFAULT 1920,
  `resolution_height` INT NOT NULL DEFAULT 1080,
  `background_color` VARCHAR(16) NOT NULL DEFAULT '#000000',
  `layout_data` LONGTEXT NOT NULL,    -- JSON serialized
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_layouts_company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- DEVICES ----------
DROP TABLE IF EXISTS `devices`;
CREATE TABLE `devices` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `company_id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `location` VARCHAR(255) DEFAULT NULL,
  `status` ENUM('online','offline','pending') NOT NULL DEFAULT 'pending',
  `layout_id` CHAR(36) DEFAULT NULL,
  `is_paired` TINYINT(1) NOT NULL DEFAULT 0,
  `pairing_code` VARCHAR(16) DEFAULT NULL,
  `orientation` ENUM('landscape','portrait') NOT NULL DEFAULT 'landscape',
  `resolution` VARCHAR(32) NOT NULL DEFAULT '1920x1080',
  `last_seen_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_devices_company` (`company_id`),
  INDEX `idx_devices_pairing` (`pairing_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- CONTENT ----------
DROP TABLE IF EXISTS `content`;
CREATE TABLE `content` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `company_id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `type` ENUM('image','video','url') NOT NULL,
  `file_url` TEXT NOT NULL,
  `file_size` BIGINT DEFAULT 0,
  `duration` INT DEFAULT 10,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_content_company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- SCHEDULES ----------
DROP TABLE IF EXISTS `schedules`;
CREATE TABLE `schedules` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `company_id` CHAR(36) NOT NULL,
  `device_id` CHAR(36) DEFAULT NULL,
  `layout_id` CHAR(36) DEFAULT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `days_of_week` VARCHAR(32) NOT NULL DEFAULT '1,2,3,4,5',  -- CSV of 0-6
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_schedules_company` (`company_id`),
  INDEX `idx_schedules_device` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- SEED DATA
-- Default super admin login: super@demo.com / ChangeMe123!
-- Password hash is bcrypt of "ChangeMe123!" — change it after first login.
-- ============================================================

INSERT INTO `companies` (`id`, `name`, `contact_email`, `plan`, `max_screens`, `status`) VALUES
('11111111-1111-1111-1111-111111111111', 'Acme Corp', 'admin@acme.com', 'pro', 25, 'active');

INSERT INTO `users` (`id`, `email`, `password_hash`, `full_name`, `company_id`) VALUES
('00000000-0000-0000-0000-000000000001', 'super@demo.com',  '$2b$10$E5l5Z8Ck0kQyqQyHwUkj1u3aPq3v8VYxFvN8rB7Wnv2yQF5q2eXKa', 'Super Admin', NULL),
('00000000-0000-0000-0000-000000000002', 'admin@acme.com',  '$2b$10$E5l5Z8Ck0kQyqQyHwUkj1u3aPq3v8VYxFvN8rB7Wnv2yQF5q2eXKa', 'Acme Admin',  '11111111-1111-1111-1111-111111111111');

INSERT INTO `user_roles` (`id`, `user_id`, `role`) VALUES
(UUID(), '00000000-0000-0000-0000-000000000001', 'super_admin'),
(UUID(), '00000000-0000-0000-0000-000000000002', 'admin');

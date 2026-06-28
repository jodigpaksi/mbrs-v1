/*
 Navicat Premium Dump SQL

 Source Server         : localhost
 Source Server Type    : MySQL
 Source Server Version : 100432 (10.4.32-MariaDB)
 Source Host           : localhost:3306
 Source Schema         : mbrs_db

 Target Server Type    : MySQL
 Target Server Version : 100432 (10.4.32-MariaDB)
 File Encoding         : 65001

 Date: 29/06/2026 06:02:40
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for activity_logs
-- ----------------------------
DROP TABLE IF EXISTS `activity_logs`;
CREATE TABLE `activity_logs`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NULL DEFAULT NULL,
  `action` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_type` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `subject_id` bigint UNSIGNED NULL DEFAULT NULL,
  `description` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `activity_logs_user_id_foreign`(`user_id` ASC) USING BTREE,
  INDEX `activity_logs_action_index`(`action` ASC) USING BTREE,
  INDEX `activity_logs_category_index`(`category` ASC) USING BTREE,
  INDEX `activity_logs_created_at_index`(`created_at` ASC) USING BTREE,
  CONSTRAINT `activity_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 179 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of activity_logs
-- ----------------------------
INSERT INTO `activity_logs` VALUES (1, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: feature_ai_chat', '{\"changes\":{\"feature_ai_chat\":{\"old\":\"true\",\"new\":\"false\"}}}', '127.0.0.1', '2026-06-27 11:44:40');
INSERT INTO `activity_logs` VALUES (2, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: feature_ai_chat', '{\"changes\":{\"feature_ai_chat\":{\"old\":\"false\",\"new\":\"true\"}}}', '127.0.0.1', '2026-06-27 11:44:42');
INSERT INTO `activity_logs` VALUES (3, 1, 'booking.cancelled', 'booking', 'Booking', 223, 'Cancelled \"B\" in Room 101 (27 Jun, 18:00)', '{\"room\":\"Room 101\",\"title\":\"B\",\"start_at\":\"2026-06-27 18:00:00\"}', '127.0.0.1', '2026-06-27 11:45:09');
INSERT INTO `activity_logs` VALUES (4, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_enabled', '{\"changes\":{\"anti_ghost_enabled\":{\"old\":null,\"new\":\"true\"}}}', '127.0.0.1', '2026-06-27 11:54:32');
INSERT INTO `activity_logs` VALUES (5, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_mode', '{\"changes\":{\"anti_ghost_mode\":{\"old\":null,\"new\":\"kiosk\"}}}', '127.0.0.1', '2026-06-27 11:54:42');
INSERT INTO `activity_logs` VALUES (6, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_enabled', '{\"changes\":{\"anti_ghost_enabled\":{\"old\":\"true\",\"new\":\"false\"}}}', '127.0.0.1', '2026-06-27 11:55:36');
INSERT INTO `activity_logs` VALUES (7, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_enabled', '{\"changes\":{\"anti_ghost_enabled\":{\"old\":\"false\",\"new\":\"true\"}}}', '127.0.0.1', '2026-06-27 11:56:05');
INSERT INTO `activity_logs` VALUES (8, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: web_confirm_enabled', '{\"changes\":{\"web_confirm_enabled\":{\"old\":null,\"new\":\"true\"}}}', '127.0.0.1', '2026-06-27 12:20:01');
INSERT INTO `activity_logs` VALUES (9, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: web_confirm_enabled', '{\"changes\":{\"web_confirm_enabled\":{\"old\":\"true\",\"new\":\"false\"}}}', '127.0.0.1', '2026-06-27 12:20:03');
INSERT INTO `activity_logs` VALUES (10, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: web_confirm_enabled', '{\"changes\":{\"web_confirm_enabled\":{\"old\":\"false\",\"new\":\"true\"}}}', '127.0.0.1', '2026-06-27 12:20:08');
INSERT INTO `activity_logs` VALUES (11, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":null,\"new\":\"5\"}}}', '127.0.0.1', '2026-06-27 12:27:45');
INSERT INTO `activity_logs` VALUES (12, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"5\",\"new\":\"0\"}}}', '127.0.0.1', '2026-06-27 12:28:02');
INSERT INTO `activity_logs` VALUES (13, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"0\",\"new\":\"5\"}}}', '127.0.0.1', '2026-06-27 12:28:13');
INSERT INTO `activity_logs` VALUES (14, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"5\",\"new\":\"6\"}}}', '127.0.0.1', '2026-06-27 12:28:15');
INSERT INTO `activity_logs` VALUES (15, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"6\",\"new\":\"15\"}}}', '127.0.0.1', '2026-06-27 12:28:21');
INSERT INTO `activity_logs` VALUES (16, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"15\",\"new\":\"13\"}}}', '127.0.0.1', '2026-06-27 12:28:30');
INSERT INTO `activity_logs` VALUES (17, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"13\",\"new\":\"20\"}}}', '127.0.0.1', '2026-06-27 12:28:34');
INSERT INTO `activity_logs` VALUES (18, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"20\",\"new\":\"10\"}}}', '127.0.0.1', '2026-06-27 12:28:43');
INSERT INTO `activity_logs` VALUES (19, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"10\",\"new\":\"15\"}}}', '127.0.0.1', '2026-06-27 12:28:45');
INSERT INTO `activity_logs` VALUES (20, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"15\",\"new\":\"20\"}}}', '127.0.0.1', '2026-06-27 12:28:49');
INSERT INTO `activity_logs` VALUES (21, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_after', '{\"changes\":{\"anti_ghost_window_after\":{\"old\":null,\"new\":\"15\"}}}', '127.0.0.1', '2026-06-27 12:28:58');
INSERT INTO `activity_logs` VALUES (22, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"20\",\"new\":\"19\"}}}', '127.0.0.1', '2026-06-27 12:29:01');
INSERT INTO `activity_logs` VALUES (23, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"19\",\"new\":\"10\"}}}', '127.0.0.1', '2026-06-27 12:29:06');
INSERT INTO `activity_logs` VALUES (24, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"10\",\"new\":\"20\"}}}', '127.0.0.1', '2026-06-27 12:29:12');
INSERT INTO `activity_logs` VALUES (25, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_after', '{\"changes\":{\"anti_ghost_window_after\":{\"old\":\"15\",\"new\":\"10\"}}}', '127.0.0.1', '2026-06-27 12:30:41');
INSERT INTO `activity_logs` VALUES (26, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"20\",\"new\":\"18\"}}}', '127.0.0.1', '2026-06-27 12:30:46');
INSERT INTO `activity_logs` VALUES (27, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"18\",\"new\":\"20\"}}}', '127.0.0.1', '2026-06-27 12:30:47');
INSERT INTO `activity_logs` VALUES (28, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"20\",\"new\":\"9\"}}}', '127.0.0.1', '2026-06-27 12:32:34');
INSERT INTO `activity_logs` VALUES (29, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"9\",\"new\":\"8\"}}}', '127.0.0.1', '2026-06-27 12:32:36');
INSERT INTO `activity_logs` VALUES (30, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"8\",\"new\":\"11\"}}}', '127.0.0.1', '2026-06-27 12:32:37');
INSERT INTO `activity_logs` VALUES (31, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"11\",\"new\":\"5\"}}}', '127.0.0.1', '2026-06-27 12:32:39');
INSERT INTO `activity_logs` VALUES (32, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"5\",\"new\":\"15\"}}}', '127.0.0.1', '2026-06-27 12:32:41');
INSERT INTO `activity_logs` VALUES (33, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"15\",\"new\":\"16\"}}}', '127.0.0.1', '2026-06-27 12:32:44');
INSERT INTO `activity_logs` VALUES (34, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"16\",\"new\":\"17\"}}}', '127.0.0.1', '2026-06-27 12:32:47');
INSERT INTO `activity_logs` VALUES (35, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"17\",\"new\":\"19\"}}}', '127.0.0.1', '2026-06-27 12:32:51');
INSERT INTO `activity_logs` VALUES (36, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_before', '{\"changes\":{\"anti_ghost_window_before\":{\"old\":\"19\",\"new\":\"15\"}}}', '127.0.0.1', '2026-06-27 12:32:52');
INSERT INTO `activity_logs` VALUES (37, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_enabled', '{\"changes\":{\"anti_ghost_enabled\":{\"old\":\"true\",\"new\":\"false\"}}}', '127.0.0.1', '2026-06-27 12:34:17');
INSERT INTO `activity_logs` VALUES (38, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_enabled', '{\"changes\":{\"anti_ghost_enabled\":{\"old\":\"false\",\"new\":\"true\"}}}', '127.0.0.1', '2026-06-27 12:34:18');
INSERT INTO `activity_logs` VALUES (39, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: allow_book_for_others', '{\"changes\":{\"allow_book_for_others\":{\"old\":\"true\",\"new\":\"false\"}}}', '127.0.0.1', '2026-06-27 12:34:20');
INSERT INTO `activity_logs` VALUES (40, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: allow_book_for_others', '{\"changes\":{\"allow_book_for_others\":{\"old\":\"false\",\"new\":\"true\"}}}', '127.0.0.1', '2026-06-27 12:34:21');
INSERT INTO `activity_logs` VALUES (41, 2, 'booking.cancelled', 'booking', 'Booking', 170, 'Cancelled \"Daily Progress Meeting\" in Room 203 (28 Jun, 12:00)', '{\"room\":\"Room 203\",\"title\":\"Daily Progress Meeting\",\"start_at\":\"2026-06-28 12:00:00\"}', '127.0.0.1', '2026-06-28 00:36:07');
INSERT INTO `activity_logs` VALUES (42, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: allow_book_for_others', '{\"changes\":{\"allow_book_for_others\":{\"old\":\"true\",\"new\":\"false\"}}}', '127.0.0.1', '2026-06-28 00:37:14');
INSERT INTO `activity_logs` VALUES (43, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: allow_book_for_others', '{\"changes\":{\"allow_book_for_others\":{\"old\":\"false\",\"new\":\"true\"}}}', '127.0.0.1', '2026-06-28 00:37:15');
INSERT INTO `activity_logs` VALUES (44, NULL, 'booking.ghost_released', 'booking', 'Booking', 168, 'Ghost booking auto-cancelled: #168 — Daily Meeting Progress', '{\"room_id\":19,\"start_at\":\"2026-06-28T07:00:00.000000Z\"}', '127.0.0.1', '2026-06-28 00:42:51');
INSERT INTO `activity_logs` VALUES (45, NULL, 'booking.ghost_released', 'booking', 'Booking', 219, 'Ghost booking auto-cancelled: #219 — KKKKK', '{\"room_id\":7,\"start_at\":\"2026-06-28T07:00:00.000000Z\"}', '127.0.0.1', '2026-06-28 00:42:51');
INSERT INTO `activity_logs` VALUES (46, NULL, 'booking.ghost_released', 'booking', 'Booking', 224, 'Ghost booking auto-cancelled: #224 — Test Kiosk', '{\"room_id\":16,\"start_at\":\"2026-06-28T07:30:00.000000Z\"}', '127.0.0.1', '2026-06-28 00:42:51');
INSERT INTO `activity_logs` VALUES (47, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_after', '{\"changes\":{\"anti_ghost_window_after\":{\"old\":\"10\",\"new\":\"20\"}}}', '127.0.0.1', '2026-06-28 00:46:04');
INSERT INTO `activity_logs` VALUES (48, NULL, 'booking.ghost_released', 'booking', 'Booking', 225, 'Ghost booking auto-cancelled: #225 — Test auto-release', '{\"room_id\":19,\"start_at\":\"2026-06-28T07:30:00.000000Z\"}', '127.0.0.1', '2026-06-28 00:50:02');
INSERT INTO `activity_logs` VALUES (49, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_after', '{\"changes\":{\"anti_ghost_window_after\":{\"old\":\"20\",\"new\":\"10\"}}}', '127.0.0.1', '2026-06-28 01:30:36');
INSERT INTO `activity_logs` VALUES (50, NULL, 'booking.ghost_released', 'booking', 'Booking', 226, 'Ghost booking auto-cancelled: #226 — AUTO-RELASE \"FOR\"', '{\"room_id\":19,\"start_at\":\"2026-06-28T08:30:00.000000Z\"}', '127.0.0.1', '2026-06-28 01:40:02');
INSERT INTO `activity_logs` VALUES (51, NULL, 'booking.ghost_released', 'booking', 'Booking', 227, 'Ghost booking auto-cancelled: #227 — Auto-rel', '{\"room_id\":7,\"start_at\":\"2026-06-28T08:30:00.000000Z\"}', '127.0.0.1', '2026-06-28 01:40:02');
INSERT INTO `activity_logs` VALUES (52, 1, 'booking.dispute_submitted', 'booking', 'Booking', 227, 'Dispute submitted for ghost-released booking #227 — Auto-rel', '{\"user_id\":1}', '127.0.0.1', '2026-06-28 01:47:35');
INSERT INTO `activity_logs` VALUES (53, 1, 'booking.dispute_approved', 'booking', 'Booking', 227, 'Dispute approved for booking #227 — Auto-rel', '{\"resolved_by\":1}', '127.0.0.1', '2026-06-28 01:59:02');
INSERT INTO `activity_logs` VALUES (54, NULL, 'booking.ghost_released', 'booking', 'Booking', 227, 'Ghost booking auto-cancelled: #227 — Auto-rel', '{\"room_id\":7,\"start_at\":\"2026-06-28T08:30:00.000000Z\"}', '127.0.0.1', '2026-06-28 02:00:03');
INSERT INTO `activity_logs` VALUES (55, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_after', '{\"changes\":{\"anti_ghost_window_after\":{\"old\":\"10\",\"new\":\"6\"}}}', '127.0.0.1', '2026-06-28 02:03:16');
INSERT INTO `activity_logs` VALUES (56, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_window_after', '{\"changes\":{\"anti_ghost_window_after\":{\"old\":\"6\",\"new\":\"5\"}}}', '127.0.0.1', '2026-06-28 02:03:18');
INSERT INTO `activity_logs` VALUES (57, NULL, 'booking.ghost_released', 'booking', 'Booking', 228, 'Ghost booking auto-cancelled: #228 — HAHAH', '{\"room_id\":19,\"start_at\":\"2026-06-28T09:00:00.000000Z\"}', '127.0.0.1', '2026-06-28 02:05:02');
INSERT INTO `activity_logs` VALUES (58, NULL, 'booking.ghost_released', 'booking', 'Booking', 229, 'Ghost booking auto-cancelled: #229 — WEW', '{\"room_id\":7,\"start_at\":\"2026-06-28T09:00:00.000000Z\"}', '127.0.0.1', '2026-06-28 02:05:02');
INSERT INTO `activity_logs` VALUES (59, NULL, 'booking.ghost_released', 'booking', 'Booking', 230, 'Ghost booking auto-cancelled: #230 — AAAA', '{\"room_id\":16,\"start_at\":\"2026-06-28T09:00:00.000000Z\"}', '127.0.0.1', '2026-06-28 02:05:02');
INSERT INTO `activity_logs` VALUES (60, 4, 'booking.dispute_submitted', 'booking', 'Booking', 228, 'Dispute submitted for ghost-released booking #228 — HAHAH', '{\"user_id\":4}', '127.0.0.1', '2026-06-28 02:08:27');
INSERT INTO `activity_logs` VALUES (61, 4, 'booking.dispute_submitted', 'booking', 'Booking', 226, 'Dispute submitted for ghost-released booking #226 — AUTO-RELASE \"FOR\"', '{\"user_id\":4}', '127.0.0.1', '2026-06-28 02:08:43');
INSERT INTO `activity_logs` VALUES (62, 4, 'booking.dispute_approved', 'booking', 'Booking', 228, 'Dispute approved for booking #228 — HAHAH', '{\"resolved_by\":4}', '127.0.0.1', '2026-06-28 02:08:59');
INSERT INTO `activity_logs` VALUES (63, 4, 'booking.dispute_approved', 'booking', 'Booking', 226, 'Dispute approved for booking #226 — AUTO-RELASE \"FOR\"', '{\"resolved_by\":4}', '127.0.0.1', '2026-06-28 02:09:00');
INSERT INTO `activity_logs` VALUES (64, NULL, 'booking.ghost_released', 'booking', 'Booking', 226, 'Ghost booking auto-cancelled: #226 — AUTO-RELASE \"FOR\"', '{\"room_id\":19,\"start_at\":\"2026-06-28T08:30:00.000000Z\"}', '127.0.0.1', '2026-06-28 02:09:03');
INSERT INTO `activity_logs` VALUES (65, NULL, 'booking.ghost_released', 'booking', 'Booking', 228, 'Ghost booking auto-cancelled: #228 — HAHAH', '{\"room_id\":19,\"start_at\":\"2026-06-28T09:00:00.000000Z\"}', '127.0.0.1', '2026-06-28 02:09:03');
INSERT INTO `activity_logs` VALUES (66, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_enabled', '{\"changes\":{\"anti_ghost_enabled\":{\"old\":\"true\",\"new\":\"false\"}}}', '127.0.0.1', '2026-06-28 02:17:42');
INSERT INTO `activity_logs` VALUES (67, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_enabled', '{\"changes\":{\"anti_ghost_enabled\":{\"old\":\"false\",\"new\":\"true\"}}}', '127.0.0.1', '2026-06-28 02:17:44');
INSERT INTO `activity_logs` VALUES (68, 4, 'booking.created_for', 'booking', 'Booking', 237, 'Booked Room 204 for Anita Wijaya — \"LOL\"', '{\"room\":\"Room 204\",\"booked_for\":\"Anita Wijaya\",\"start_at\":\"2026-06-28 09:30:00\"}', '127.0.0.1', '2026-06-28 02:27:21');
INSERT INTO `activity_logs` VALUES (69, NULL, 'booking.ghost_released', 'booking', 'Booking', 233, 'Ghost booking auto-cancelled: #233 — TEST AUTO RELEASED1', '{\"room_id\":19,\"start_at\":\"2026-06-28T09:30:00.000000Z\"}', '127.0.0.1', '2026-06-28 02:35:01');
INSERT INTO `activity_logs` VALUES (70, NULL, 'booking.ghost_released', 'booking', 'Booking', 234, 'Ghost booking auto-cancelled: #234 — KATY PERY', '{\"room_id\":7,\"start_at\":\"2026-06-28T09:30:00.000000Z\"}', '127.0.0.1', '2026-06-28 02:35:01');
INSERT INTO `activity_logs` VALUES (71, NULL, 'booking.ghost_released', 'booking', 'Booking', 237, 'Ghost booking auto-cancelled: #237 — LOL', '{\"room_id\":16,\"start_at\":\"2026-06-28T09:30:00.000000Z\"}', '127.0.0.1', '2026-06-28 02:35:01');
INSERT INTO `activity_logs` VALUES (72, NULL, 'user.login', 'user', 'User', 1, 'User Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 02:35:14');
INSERT INTO `activity_logs` VALUES (73, NULL, 'user.login', 'user', 'User', 4, 'User Ayu Restiana signed in', NULL, '127.0.0.1', '2026-06-28 02:35:19');
INSERT INTO `activity_logs` VALUES (74, NULL, 'user.login', 'user', 'User', 1, 'User Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 02:47:58');
INSERT INTO `activity_logs` VALUES (75, NULL, 'user.login', 'user', 'User', 4, 'User Ayu Restiana signed in', NULL, '127.0.0.1', '2026-06-28 02:48:03');
INSERT INTO `activity_logs` VALUES (76, NULL, 'user.login', 'user', 'User', 1, 'User Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 03:00:01');
INSERT INTO `activity_logs` VALUES (77, NULL, 'user.login', 'user', 'User', 4, 'User Ayu Restiana signed in', NULL, '127.0.0.1', '2026-06-28 03:03:32');
INSERT INTO `activity_logs` VALUES (78, NULL, 'user.login', 'user', 'User', 1, 'User Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 03:08:25');
INSERT INTO `activity_logs` VALUES (79, NULL, 'user.login', 'user', 'User', 2, 'User Jessica Miller signed in', NULL, '127.0.0.1', '2026-06-28 03:12:09');
INSERT INTO `activity_logs` VALUES (80, NULL, 'user.login', 'user', 'User', 1, 'User Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 03:35:03');
INSERT INTO `activity_logs` VALUES (81, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_mode', '{\"changes\":{\"anti_ghost_mode\":{\"old\":\"kiosk\",\"new\":\"kiosk,sensor\"}}}', '127.0.0.1', '2026-06-28 03:35:27');
INSERT INTO `activity_logs` VALUES (82, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_enabled', '{\"changes\":{\"anti_ghost_enabled\":{\"old\":\"true\",\"new\":\"false\"}}}', '127.0.0.1', '2026-06-28 03:37:21');
INSERT INTO `activity_logs` VALUES (83, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_enabled', '{\"changes\":{\"anti_ghost_enabled\":{\"old\":\"false\",\"new\":\"true\"}}}', '127.0.0.1', '2026-06-28 03:37:23');
INSERT INTO `activity_logs` VALUES (84, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_mode', '{\"changes\":{\"anti_ghost_mode\":{\"old\":\"kiosk,sensor\",\"new\":\"sensor\"}}}', '127.0.0.1', '2026-06-28 03:37:40');
INSERT INTO `activity_logs` VALUES (85, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_mode', '{\"changes\":{\"anti_ghost_mode\":{\"old\":\"sensor\",\"new\":\"kiosk,sensor\"}}}', '127.0.0.1', '2026-06-28 03:37:44');
INSERT INTO `activity_logs` VALUES (86, NULL, 'user.login', 'user', 'User', 1, 'User Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 03:47:31');
INSERT INTO `activity_logs` VALUES (87, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 03:59:12');
INSERT INTO `activity_logs` VALUES (88, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 04:04:58');
INSERT INTO `activity_logs` VALUES (89, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: sensor_api_token', '{\"changes\":{\"sensor_api_token\":{\"old\":\"Zr7jRHd7JCfXHwVmwwD2p7rPoEvHGGAl\",\"new\":\"37bd99b4aeb6db80d705d40f8d11d67d\"}}}', '127.0.0.1', '2026-06-28 04:05:13');
INSERT INTO `activity_logs` VALUES (90, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 04:11:02');
INSERT INTO `activity_logs` VALUES (91, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_mode', '{\"changes\":{\"anti_ghost_mode\":{\"old\":\"kiosk,sensor\",\"new\":\"kiosk\"}}}', '127.0.0.1', '2026-06-28 04:16:56');
INSERT INTO `activity_logs` VALUES (92, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: web_confirm_enabled', '{\"changes\":{\"web_confirm_enabled\":{\"old\":\"true\",\"new\":\"false\"}}}', '127.0.0.1', '2026-06-28 04:17:13');
INSERT INTO `activity_logs` VALUES (93, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: web_confirm_enabled', '{\"changes\":{\"web_confirm_enabled\":{\"old\":\"false\",\"new\":\"true\"}}}', '127.0.0.1', '2026-06-28 04:17:15');
INSERT INTO `activity_logs` VALUES (94, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_enabled', '{\"changes\":{\"anti_ghost_enabled\":{\"old\":\"true\",\"new\":\"false\"}}}', '127.0.0.1', '2026-06-28 04:20:26');
INSERT INTO `activity_logs` VALUES (95, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_enabled', '{\"changes\":{\"anti_ghost_enabled\":{\"old\":\"false\",\"new\":\"true\"}}}', '127.0.0.1', '2026-06-28 04:20:29');
INSERT INTO `activity_logs` VALUES (96, 1, 'user.logout', 'user', 'User', 1, 'Admin Anita Wijaya signed out', NULL, '127.0.0.1', '2026-06-28 04:23:43');
INSERT INTO `activity_logs` VALUES (97, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 04:23:46');
INSERT INTO `activity_logs` VALUES (98, 1, 'user.logout', 'user', 'User', 1, 'Admin Anita Wijaya signed out', NULL, '127.0.0.1', '2026-06-28 04:44:17');
INSERT INTO `activity_logs` VALUES (99, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 06:06:04');
INSERT INTO `activity_logs` VALUES (100, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 06:13:13');
INSERT INTO `activity_logs` VALUES (101, 1, 'user.logout', 'user', 'User', 1, 'Admin Anita Wijaya signed out', NULL, '127.0.0.1', '2026-06-28 06:13:29');
INSERT INTO `activity_logs` VALUES (102, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 06:17:12');
INSERT INTO `activity_logs` VALUES (103, 1, 'user.logout', 'user', 'User', 1, 'Admin Anita Wijaya signed out', NULL, '127.0.0.1', '2026-06-28 06:19:53');
INSERT INTO `activity_logs` VALUES (104, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 06:25:01');
INSERT INTO `activity_logs` VALUES (105, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 06:26:24');
INSERT INTO `activity_logs` VALUES (106, 1, 'user.logout', 'user', 'User', 1, 'Admin Anita Wijaya signed out', NULL, '127.0.0.1', '2026-06-28 06:26:54');
INSERT INTO `activity_logs` VALUES (107, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 06:28:08');
INSERT INTO `activity_logs` VALUES (108, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_enabled', '{\"changes\":{\"anti_ghost_enabled\":{\"old\":\"true\",\"new\":\"false\"}}}', '127.0.0.1', '2026-06-28 06:35:54');
INSERT INTO `activity_logs` VALUES (109, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_enabled', '{\"changes\":{\"anti_ghost_enabled\":{\"old\":\"false\",\"new\":\"true\"}}}', '127.0.0.1', '2026-06-28 06:36:00');
INSERT INTO `activity_logs` VALUES (110, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 06:40:06');
INSERT INTO `activity_logs` VALUES (111, 1, 'user.logout', 'user', 'User', 1, 'Admin Anita Wijaya signed out', NULL, '127.0.0.1', '2026-06-28 06:41:02');
INSERT INTO `activity_logs` VALUES (112, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 06:43:18');
INSERT INTO `activity_logs` VALUES (113, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 06:46:46');
INSERT INTO `activity_logs` VALUES (114, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 07:05:22');
INSERT INTO `activity_logs` VALUES (115, 1, 'data.exported', 'data', NULL, NULL, 'Exported 7 user records (incl. credentials)', '{\"type\":\"users\",\"count\":7}', '127.0.0.1', '2026-06-28 07:06:03');
INSERT INTO `activity_logs` VALUES (116, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 07:28:18');
INSERT INTO `activity_logs` VALUES (117, 1, 'data.exported', 'data', NULL, NULL, 'Exported 7 user records (incl. credentials)', '{\"type\":\"users\",\"count\":7}', '127.0.0.1', '2026-06-28 07:28:48');
INSERT INTO `activity_logs` VALUES (118, 1, 'data.exported', 'data', NULL, NULL, 'Exported 7 user records (incl. credentials)', '{\"type\":\"users\",\"count\":7}', '127.0.0.1', '2026-06-28 07:29:51');
INSERT INTO `activity_logs` VALUES (119, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 07:35:46');
INSERT INTO `activity_logs` VALUES (120, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_mode', '{\"changes\":{\"anti_ghost_mode\":{\"old\":\"kiosk\",\"new\":\"kiosk,sensor\"}}}', '127.0.0.1', '2026-06-28 07:37:17');
INSERT INTO `activity_logs` VALUES (121, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_mode', '{\"changes\":{\"anti_ghost_mode\":{\"old\":\"kiosk,sensor\",\"new\":\"kiosk\"}}}', '127.0.0.1', '2026-06-28 07:37:18');
INSERT INTO `activity_logs` VALUES (122, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_mode', '{\"changes\":{\"anti_ghost_mode\":{\"old\":\"kiosk\",\"new\":\"kiosk,sensor\"}}}', '127.0.0.1', '2026-06-28 07:37:18');
INSERT INTO `activity_logs` VALUES (123, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_mode', '{\"changes\":{\"anti_ghost_mode\":{\"old\":\"kiosk,sensor\",\"new\":\"kiosk\"}}}', '127.0.0.1', '2026-06-28 07:38:24');
INSERT INTO `activity_logs` VALUES (124, 1, 'user.logout', 'user', 'User', 1, 'Admin Anita Wijaya signed out', NULL, '127.0.0.1', '2026-06-28 07:43:28');
INSERT INTO `activity_logs` VALUES (125, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 07:44:01');
INSERT INTO `activity_logs` VALUES (126, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 08:25:33');
INSERT INTO `activity_logs` VALUES (127, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 08:31:50');
INSERT INTO `activity_logs` VALUES (128, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 08:36:17');
INSERT INTO `activity_logs` VALUES (129, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 08:46:01');
INSERT INTO `activity_logs` VALUES (130, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_enabled', '{\"changes\":{\"log_auto_export_enabled\":{\"old\":null,\"new\":\"true\"}}}', '127.0.0.1', '2026-06-28 08:50:02');
INSERT INTO `activity_logs` VALUES (131, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_time', '{\"changes\":{\"log_auto_export_time\":{\"old\":null,\"new\":\"01:00\"}}}', '127.0.0.1', '2026-06-28 08:50:15');
INSERT INTO `activity_logs` VALUES (132, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_time', '{\"changes\":{\"log_auto_export_time\":{\"old\":\"01:00\",\"new\":\"15:00\"}}}', '127.0.0.1', '2026-06-28 08:50:16');
INSERT INTO `activity_logs` VALUES (133, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_time', '{\"changes\":{\"log_auto_export_time\":{\"old\":\"15:00\",\"new\":\"15:05\"}}}', '127.0.0.1', '2026-06-28 08:50:18');
INSERT INTO `activity_logs` VALUES (134, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_time', '{\"changes\":{\"log_auto_export_time\":{\"old\":\"15:05\",\"new\":\"15:52\"}}}', '127.0.0.1', '2026-06-28 08:50:18');
INSERT INTO `activity_logs` VALUES (135, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_time', '{\"changes\":{\"log_auto_export_time\":{\"old\":\"15:52\",\"new\":\"15:53\"}}}', '127.0.0.1', '2026-06-28 08:50:31');
INSERT INTO `activity_logs` VALUES (136, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 08:55:29');
INSERT INTO `activity_logs` VALUES (137, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_enabled, web_confirm_enabled', '{\"changes\":{\"anti_ghost_enabled\":{\"old\":\"true\",\"new\":\"false\"},\"web_confirm_enabled\":{\"old\":\"true\",\"new\":\"false\"}}}', '127.0.0.1', '2026-06-28 08:56:29');
INSERT INTO `activity_logs` VALUES (138, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: anti_ghost_enabled, web_confirm_enabled', '{\"changes\":{\"anti_ghost_enabled\":{\"old\":\"false\",\"new\":\"true\"},\"web_confirm_enabled\":{\"old\":\"false\",\"new\":\"true\"}}}', '127.0.0.1', '2026-06-28 08:56:31');
INSERT INTO `activity_logs` VALUES (139, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_interval', '{\"changes\":{\"log_auto_export_interval\":{\"old\":null,\"new\":\"weekly\"}}}', '127.0.0.1', '2026-06-28 08:59:34');
INSERT INTO `activity_logs` VALUES (140, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_interval', '{\"changes\":{\"log_auto_export_interval\":{\"old\":\"weekly\",\"new\":\"daily\"}}}', '127.0.0.1', '2026-06-28 08:59:35');
INSERT INTO `activity_logs` VALUES (141, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_time', '{\"changes\":{\"log_auto_export_time\":{\"old\":\"15:53\",\"new\":\"01:53\"}}}', '127.0.0.1', '2026-06-28 08:59:43');
INSERT INTO `activity_logs` VALUES (142, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_time', '{\"changes\":{\"log_auto_export_time\":{\"old\":\"01:53\",\"new\":\"16:53\"}}}', '127.0.0.1', '2026-06-28 08:59:43');
INSERT INTO `activity_logs` VALUES (143, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_time', '{\"changes\":{\"log_auto_export_time\":{\"old\":\"16:53\",\"new\":\"16:00\"}}}', '127.0.0.1', '2026-06-28 08:59:44');
INSERT INTO `activity_logs` VALUES (144, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_time', '{\"changes\":{\"log_auto_export_time\":{\"old\":\"16:00\",\"new\":\"16:05\"}}}', '127.0.0.1', '2026-06-28 08:59:46');
INSERT INTO `activity_logs` VALUES (145, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_time', '{\"changes\":{\"log_auto_export_time\":{\"old\":\"16:05\",\"new\":\"16:06\"}}}', '127.0.0.1', '2026-06-28 08:59:57');
INSERT INTO `activity_logs` VALUES (146, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_time', '{\"changes\":{\"log_auto_export_time\":{\"old\":\"16:06\",\"new\":\"16:05\"}}}', '127.0.0.1', '2026-06-28 08:59:59');
INSERT INTO `activity_logs` VALUES (147, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_time', '{\"changes\":{\"log_auto_export_time\":{\"old\":\"16:05\",\"new\":\"16:06\"}}}', '127.0.0.1', '2026-06-28 09:00:09');
INSERT INTO `activity_logs` VALUES (148, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_time', '{\"changes\":{\"log_auto_export_time\":{\"old\":\"16:06\",\"new\":\"16:05\"}}}', '127.0.0.1', '2026-06-28 09:00:12');
INSERT INTO `activity_logs` VALUES (149, NULL, 'booking.ghost_released', 'booking', 'Booking', 238, 'Ghost booking auto-cancelled: #238 — TEST AUTO-', '{\"room_id\":19,\"start_at\":\"2026-06-28T16:00:00.000000Z\"}', '127.0.0.1', '2026-06-28 09:05:03');
INSERT INTO `activity_logs` VALUES (150, NULL, 'booking.ghost_released', 'booking', 'Booking', 239, 'Ghost booking auto-cancelled: #239 — EEEEE', '{\"room_id\":7,\"start_at\":\"2026-06-28T16:00:00.000000Z\"}', '127.0.0.1', '2026-06-28 09:05:03');
INSERT INTO `activity_logs` VALUES (151, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 09:09:53');
INSERT INTO `activity_logs` VALUES (152, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_time', '{\"changes\":{\"log_auto_export_time\":{\"old\":\"16:05\",\"new\":\"16:13\"}}}', '127.0.0.1', '2026-06-28 09:10:47');
INSERT INTO `activity_logs` VALUES (153, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_time', '{\"changes\":{\"log_auto_export_time\":{\"old\":\"16:13\",\"new\":\"16:15\"}}}', '127.0.0.1', '2026-06-28 09:13:37');
INSERT INTO `activity_logs` VALUES (154, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_time', '{\"changes\":{\"log_auto_export_time\":{\"old\":\"16:15\",\"new\":\"16:19\"}}}', '127.0.0.1', '2026-06-28 09:17:16');
INSERT INTO `activity_logs` VALUES (155, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_enabled', '{\"changes\":{\"log_auto_export_enabled\":{\"old\":\"true\",\"new\":\"false\"}}}', '127.0.0.1', '2026-06-28 09:22:31');
INSERT INTO `activity_logs` VALUES (156, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_enabled', '{\"changes\":{\"log_auto_export_enabled\":{\"old\":\"false\",\"new\":\"true\"}}}', '127.0.0.1', '2026-06-28 09:22:33');
INSERT INTO `activity_logs` VALUES (157, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_time', '{\"changes\":{\"log_auto_export_time\":{\"old\":\"16:19\",\"new\":\"16:25\"}}}', '127.0.0.1', '2026-06-28 09:22:44');
INSERT INTO `activity_logs` VALUES (158, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_time', '{\"changes\":{\"log_auto_export_time\":{\"old\":\"16:25\",\"new\":\"16:32\"}}}', '127.0.0.1', '2026-06-28 09:30:35');
INSERT INTO `activity_logs` VALUES (159, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_time', '{\"changes\":{\"log_auto_export_time\":{\"old\":\"16:32\",\"new\":\"16:35\"}}}', '127.0.0.1', '2026-06-28 09:32:50');
INSERT INTO `activity_logs` VALUES (160, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 09:43:37');
INSERT INTO `activity_logs` VALUES (161, 1, 'settings.updated', 'settings', NULL, NULL, 'Updated settings: log_auto_export_time', '{\"changes\":{\"log_auto_export_time\":{\"old\":\"16:35\",\"new\":\"16:50\"}}}', '127.0.0.1', '2026-06-28 09:47:33');
INSERT INTO `activity_logs` VALUES (162, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 09:50:51');
INSERT INTO `activity_logs` VALUES (163, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 09:56:02');
INSERT INTO `activity_logs` VALUES (164, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 10:15:32');
INSERT INTO `activity_logs` VALUES (165, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 10:29:19');
INSERT INTO `activity_logs` VALUES (166, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 12:01:29');
INSERT INTO `activity_logs` VALUES (167, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 12:02:24');
INSERT INTO `activity_logs` VALUES (168, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 12:03:12');
INSERT INTO `activity_logs` VALUES (169, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 12:19:54');
INSERT INTO `activity_logs` VALUES (170, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 12:42:20');
INSERT INTO `activity_logs` VALUES (171, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 12:44:30');
INSERT INTO `activity_logs` VALUES (172, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 12:47:42');
INSERT INTO `activity_logs` VALUES (173, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 12:51:02');
INSERT INTO `activity_logs` VALUES (174, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 12:52:30');
INSERT INTO `activity_logs` VALUES (175, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 12:55:04');
INSERT INTO `activity_logs` VALUES (176, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 13:00:20');
INSERT INTO `activity_logs` VALUES (177, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 13:09:13');
INSERT INTO `activity_logs` VALUES (178, NULL, 'user.login', 'user', 'User', 1, 'Admin Anita Wijaya signed in', NULL, '127.0.0.1', '2026-06-28 22:37:32');

-- ----------------------------
-- Table structure for admin_buildings
-- ----------------------------
DROP TABLE IF EXISTS `admin_buildings`;
CREATE TABLE `admin_buildings`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `building_id` bigint UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `admin_buildings_user_id_building_id_unique`(`user_id` ASC, `building_id` ASC) USING BTREE,
  INDEX `admin_buildings_building_id_foreign`(`building_id` ASC) USING BTREE,
  CONSTRAINT `admin_buildings_building_id_foreign` FOREIGN KEY (`building_id`) REFERENCES `buildings` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `admin_buildings_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 12 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of admin_buildings
-- ----------------------------
INSERT INTO `admin_buildings` VALUES (1, 4, 3, NULL, NULL);
INSERT INTO `admin_buildings` VALUES (2, 4, 2, NULL, NULL);
INSERT INTO `admin_buildings` VALUES (3, 5, 2, NULL, NULL);
INSERT INTO `admin_buildings` VALUES (4, 5, 3, NULL, NULL);
INSERT INTO `admin_buildings` VALUES (5, 6, 1, NULL, NULL);
INSERT INTO `admin_buildings` VALUES (6, 7, 3, NULL, NULL);
INSERT INTO `admin_buildings` VALUES (7, 7, 2, NULL, NULL);
INSERT INTO `admin_buildings` VALUES (10, 2, 2, NULL, NULL);

-- ----------------------------
-- Table structure for bookings
-- ----------------------------
DROP TABLE IF EXISTS `bookings`;
CREATE TABLE `bookings`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `room_id` bigint UNSIGNED NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `booked_for` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `booked_for_user_id` bigint UNSIGNED NULL DEFAULT NULL,
  `start_at` datetime NOT NULL,
  `end_at` datetime NOT NULL,
  `status` enum('confirmed','tentative','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'confirmed',
  `presence_confirmed_at` timestamp NULL DEFAULT NULL,
  `type` enum('internal','external','maintenance','repairment') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'internal',
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `cancel_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `dispute_status` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `dispute_note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `disputed_at` timestamp NULL DEFAULT NULL,
  `dispute_resolved_at` timestamp NULL DEFAULT NULL,
  `archived_at` timestamp NULL DEFAULT NULL,
  `series_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `series_skipped_dates` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `dispute_resolved_by` bigint UNSIGNED NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `bookings_user_id_foreign`(`user_id` ASC) USING BTREE,
  INDEX `bookings_room_id_foreign`(`room_id` ASC) USING BTREE,
  INDEX `bookings_series_id_index`(`series_id` ASC) USING BTREE,
  INDEX `bookings_booked_for_user_id_foreign`(`booked_for_user_id` ASC) USING BTREE,
  INDEX `bookings_dispute_resolved_by_foreign`(`dispute_resolved_by` ASC) USING BTREE,
  CONSTRAINT `bookings_booked_for_user_id_foreign` FOREIGN KEY (`booked_for_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `bookings_dispute_resolved_by_foreign` FOREIGN KEY (`dispute_resolved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `bookings_room_id_foreign` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `bookings_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 241 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of bookings
-- ----------------------------
INSERT INTO `bookings` VALUES (95, 2, 19, 'ASDVX', 'asdasdas asdasdasdsa', NULL, NULL, '2026-06-20 07:00:00', '2026-06-20 09:00:00', 'cancelled', NULL, 'internal', '2026-06-20 08:36:17', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-19 23:46:59', '2026-06-20 08:36:17', NULL);
INSERT INTO `bookings` VALUES (96, 2, 19, 'Meeting with PCA & TEF, for clarification ASDM', 'asdas asdasdas', NULL, NULL, '2026-06-20 09:00:00', '2026-06-20 10:30:00', 'cancelled', NULL, 'internal', '2026-06-20 08:36:26', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-19 23:47:10', '2026-06-20 08:36:26', NULL);
INSERT INTO `bookings` VALUES (97, 2, 7, 'Rocky', 'ashh fhfhfhf fgf', NULL, NULL, '2026-06-20 07:00:00', '2026-06-20 09:00:00', 'tentative', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-19 23:47:22', '2026-06-20 02:08:13', NULL);
INSERT INTO `bookings` VALUES (98, 2, 7, '123', 'asdasdas', NULL, NULL, '2026-06-20 11:30:00', '2026-06-20 13:30:00', 'cancelled', NULL, 'external', '2026-06-20 08:36:08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-19 23:47:58', '2026-06-20 08:36:08', NULL);
INSERT INTO `bookings` VALUES (99, 2, 16, 'afasd', 'asdasdasdas', NULL, NULL, '2026-06-20 07:00:00', '2026-06-20 08:00:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20 00:06:17', '2026-06-20 00:06:17', NULL);
INSERT INTO `bookings` VALUES (100, 2, 7, '3535', '12312321', NULL, NULL, '2026-06-20 09:00:00', '2026-06-20 10:00:00', 'cancelled', NULL, 'internal', '2026-06-20 03:31:42', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20 00:06:37', '2026-06-20 03:31:42', NULL);
INSERT INTO `bookings` VALUES (101, 2, 7, '636363', '34324234324', NULL, NULL, '2026-06-20 10:00:00', '2026-06-20 11:30:00', 'cancelled', NULL, 'internal', '2026-06-20 03:31:52', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20 00:06:43', '2026-06-20 03:31:52', NULL);
INSERT INTO `bookings` VALUES (102, 2, 19, '999999', '636363636', NULL, NULL, '2026-06-20 17:00:00', '2026-06-20 18:30:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20 00:06:51', '2026-06-20 10:31:38', NULL);
INSERT INTO `bookings` VALUES (103, 2, 7, '123123', '125152352', NULL, NULL, '2026-06-20 17:00:00', '2026-06-20 18:30:00', 'cancelled', NULL, 'internal', '2026-06-20 10:50:44', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20 00:06:57', '2026-06-20 10:50:44', NULL);
INSERT INTO `bookings` VALUES (104, 2, 16, 'yrththg', 'hghghghg', NULL, NULL, '2026-06-20 08:00:00', '2026-06-20 09:30:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20 00:07:03', '2026-06-20 00:07:03', NULL);
INSERT INTO `bookings` VALUES (105, 2, 16, '12312312', '1231231221', NULL, NULL, '2026-06-20 09:30:00', '2026-06-20 12:00:00', 'cancelled', NULL, 'internal', '2026-06-20 03:31:02', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20 00:07:08', '2026-06-20 03:31:02', NULL);
INSERT INTO `bookings` VALUES (106, 2, 19, 'Project Hail Mary 2026', 'asdasda asdas fgfgf', NULL, NULL, '2026-06-21 07:00:00', '2026-06-21 09:00:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20 03:58:51', '2026-06-20 03:58:51', NULL);
INSERT INTO `bookings` VALUES (107, 2, 16, 'Testing Booking for', 'a;lkfdgdf efgdfgdfgdfgfddf', 'Agus Febri', NULL, '2026-06-20 15:00:00', '2026-06-20 18:30:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20 04:36:43', '2026-06-20 10:31:32', NULL);
INSERT INTO `bookings` VALUES (108, 2, 7, 'Daily Meeting Progress', 'asdslk fhfh fhfhfh', NULL, NULL, '2026-06-20 09:00:00', '2026-06-20 12:00:00', 'cancelled', NULL, 'internal', '2026-06-26 03:10:35', NULL, NULL, NULL, NULL, NULL, NULL, '54111c7e-9909-41f9-8b11-ae0baa1a568c', NULL, '2026-06-20 10:20:48', '2026-06-26 03:10:35', NULL);
INSERT INTO `bookings` VALUES (109, 2, 7, 'Daily Meeting Progress', 'asdslk fhfh fhfhfh', NULL, NULL, '2026-06-21 09:00:00', '2026-06-21 12:00:00', 'cancelled', NULL, 'internal', '2026-06-26 03:10:35', NULL, NULL, NULL, NULL, NULL, NULL, '54111c7e-9909-41f9-8b11-ae0baa1a568c', NULL, '2026-06-20 10:20:49', '2026-06-26 03:10:35', NULL);
INSERT INTO `bookings` VALUES (110, 2, 7, 'Daily Meeting Progress', 'asdslk fhfh fhfhfh', NULL, NULL, '2026-06-22 09:00:00', '2026-06-22 12:00:00', 'cancelled', NULL, 'internal', '2026-06-26 03:10:35', NULL, NULL, NULL, NULL, NULL, NULL, '54111c7e-9909-41f9-8b11-ae0baa1a568c', NULL, '2026-06-20 10:20:49', '2026-06-26 03:10:35', NULL);
INSERT INTO `bookings` VALUES (112, 5, 15, 'Disnaker Visit', 'asdas asfasfadfsd', NULL, NULL, '2026-06-21 13:30:00', '2026-06-21 15:00:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20 11:03:45', '2026-06-21 05:11:03', NULL);
INSERT INTO `bookings` VALUES (113, 5, 15, 'ABC asdf', 'lgkflg f345453', NULL, NULL, '2026-06-21 12:00:00', '2026-06-21 13:30:00', 'confirmed', NULL, 'external', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20 11:25:47', '2026-06-20 11:25:47', NULL);
INSERT INTO `bookings` VALUES (114, 5, 14, 'Remember Entertainm', 'lkfghf gfas asdas', 'em.arius', 7, '2026-06-21 12:00:00', '2026-06-21 16:00:00', 'confirmed', NULL, 'external', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-20 11:39:37', '2026-06-21 05:10:49', NULL);
INSERT INTO `bookings` VALUES (123, 5, 16, 'Daily Meeting Progress', 'asdas lksdfgdf', 'Anita Wijaya', 1, '2026-06-22 07:00:00', '2026-06-22 09:00:00', 'cancelled', NULL, 'external', '2026-06-21 01:38:12', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 01:25:49', '2026-06-21 01:38:12', NULL);
INSERT INTO `bookings` VALUES (124, 5, 14, 'ASDM Meeting', 'lfklfh sdfsd sdfsdfsdfsd', 'Anita Wijaya', 1, '2026-06-22 07:00:00', '2026-06-22 11:00:00', 'cancelled', NULL, 'external', '2026-06-21 01:40:44', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 01:38:28', '2026-06-21 01:40:44', NULL);
INSERT INTO `bookings` VALUES (125, 5, 15, 'WAWAWA', 'laklkfgdf gdfgdf', 'Anita Wijaya', 1, '2026-06-22 07:00:00', '2026-06-22 12:00:00', 'cancelled', NULL, 'external', '2026-06-21 01:41:28', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 01:41:07', '2026-06-21 01:41:28', NULL);
INSERT INTO `bookings` VALUES (126, 5, 14, 'Rocky !!', 'lk;sgsdf gdfgdfg', NULL, NULL, '2026-06-22 07:00:00', '2026-06-22 10:00:00', 'cancelled', NULL, 'internal', '2026-06-21 02:03:40', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 01:58:49', '2026-06-21 02:03:40', NULL);
INSERT INTO `bookings` VALUES (127, 5, 14, 'ABC ROCKY!!!', 'l;kkdfg dfgdfgdfgdf dfgdf', NULL, NULL, '2026-06-22 07:00:00', '2026-06-22 09:00:00', 'tentative', NULL, 'external', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 02:03:58', '2026-06-21 02:25:31', NULL);
INSERT INTO `bookings` VALUES (128, 5, 15, 'LLLLFGFGFG', 'l;khkfghjfgihfg fghfghfghfghfghfg', NULL, NULL, '2026-06-22 07:30:00', '2026-06-22 11:00:00', 'cancelled', NULL, 'internal', '2026-06-21 02:05:18', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 02:04:41', '2026-06-21 02:05:18', NULL);
INSERT INTO `bookings` VALUES (129, 5, 15, 'GGGG', 'sdfsdfsdfsd', 'Anita Wijaya', 1, '2026-06-22 07:00:00', '2026-06-22 08:00:00', 'cancelled', NULL, 'external', '2026-06-21 02:31:50', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 02:26:00', '2026-06-21 02:31:50', NULL);
INSERT INTO `bookings` VALUES (130, 5, 15, 'HHHH', 'asdasdas', NULL, NULL, '2026-06-22 07:00:00', '2026-06-22 09:30:00', 'cancelled', NULL, 'internal', '2026-06-21 02:34:24', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 02:33:52', '2026-06-21 02:34:24', NULL);
INSERT INTO `bookings` VALUES (131, 5, 15, 'KLSFGKLDFKGDF', 'sdflgdfgdf dfgdfgfdgdfgdf', 'Anita Wijaya', 1, '2026-06-22 07:00:00', '2026-06-22 09:00:00', 'cancelled', NULL, 'external', '2026-06-21 02:38:02', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 02:34:41', '2026-06-21 02:38:02', NULL);
INSERT INTO `bookings` VALUES (132, 5, 15, 'Edge of tomorrow', 'lkgldfgdf dfgdfgdfg', NULL, NULL, '2026-06-22 07:00:00', '2026-06-22 08:30:00', 'cancelled', NULL, 'external', '2026-06-21 02:38:38', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 02:38:22', '2026-06-21 02:38:38', NULL);
INSERT INTO `bookings` VALUES (133, 5, 15, 'Selena Gomez', 'sd;kljfgs sgs sdgdfgdfgfdgdf', 'Anita Wijaya', 1, '2026-06-22 07:00:00', '2026-06-22 08:30:00', 'cancelled', NULL, 'external', '2026-06-21 02:41:03', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 02:38:59', '2026-06-21 02:41:03', NULL);
INSERT INTO `bookings` VALUES (134, 5, 15, 'KKKK', 'lflgkdjf dfgdfgfddf', 'Anita Wijaya', 1, '2026-06-22 07:00:00', '2026-06-22 08:00:00', 'cancelled', NULL, 'internal', '2026-06-21 02:54:33', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 02:41:18', '2026-06-21 02:54:33', NULL);
INSERT INTO `bookings` VALUES (135, 5, 15, 'asdasdasd', 'gdfgdfgdfgdf', 'Anita Wijaya', 1, '2026-06-22 11:30:00', '2026-06-22 13:00:00', 'cancelled', NULL, 'internal', '2026-06-21 02:44:32', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 02:42:05', '2026-06-21 02:44:32', NULL);
INSERT INTO `bookings` VALUES (136, 5, 15, 'GDGS#', 'asdasdasdsa', 'Anita Wijaya', 1, '2026-06-22 11:30:00', '2026-06-22 14:30:00', 'cancelled', NULL, 'internal', '2026-06-21 02:46:57', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 02:45:04', '2026-06-21 02:46:57', NULL);
INSERT INTO `bookings` VALUES (137, 5, 15, 'JJJJJ', 'sdfsdfsdfsd', 'Anita Wijaya', 1, '2026-06-22 09:00:00', '2026-06-22 11:30:00', 'cancelled', NULL, 'external', '2026-06-21 02:50:03', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 02:47:10', '2026-06-21 02:50:03', NULL);
INSERT INTO `bookings` VALUES (138, 5, 15, 'AVICI', ';kljlsdf sdfsdfsdf', NULL, NULL, '2026-06-22 07:00:00', '2026-06-22 08:00:00', 'cancelled', NULL, 'external', '2026-06-21 02:55:51', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 02:54:50', '2026-06-21 02:55:51', NULL);
INSERT INTO `bookings` VALUES (139, 5, 15, 'DGGG', 'sdfsfsdfsd', 'Anita Wijaya', 1, '2026-06-22 07:00:00', '2026-06-22 09:30:00', 'cancelled', NULL, 'external', '2026-06-21 02:59:29', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 02:57:25', '2026-06-21 02:59:29', NULL);
INSERT INTO `bookings` VALUES (140, 5, 15, 'MARIO BROSS', 'lskdfsdf sdfsdfsdfsd', 'Anita Wijaya', 1, '2026-06-22 07:00:00', '2026-06-22 09:30:00', 'cancelled', NULL, 'external', '2026-06-21 03:05:01', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 03:02:29', '2026-06-21 03:05:01', NULL);
INSERT INTO `bookings` VALUES (141, 5, 15, 'Night Night11', 'sdfsdf hjgfhjfhfg', 'Anita Wijaya', 1, '2026-06-22 07:00:00', '2026-06-22 09:30:00', 'cancelled', NULL, 'external', '2026-06-21 03:06:21', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 03:05:58', '2026-06-21 03:06:21', NULL);
INSERT INTO `bookings` VALUES (142, 5, 15, 'JJJSDSSD', 'asdasdasd', 'Anita Wijaya', 1, '2026-06-22 07:00:00', '2026-06-22 10:00:00', 'cancelled', NULL, 'external', '2026-06-21 03:09:57', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 03:09:33', '2026-06-21 03:09:57', NULL);
INSERT INTO `bookings` VALUES (143, 5, 19, 'DFSFDS', 'fsdfsdfsdfsd', 'Anita Wijaya', 1, '2026-06-22 07:00:00', '2026-06-22 09:00:00', 'cancelled', NULL, 'external', '2026-06-21 03:17:31', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 03:14:05', '2026-06-21 03:17:31', NULL);
INSERT INTO `bookings` VALUES (144, 5, 15, 'AAA NEED TO KNOW', 'asdasdasdasdas', 'Anita Wijaya', 1, '2026-06-22 07:00:00', '2026-06-22 09:30:00', 'cancelled', NULL, 'external', '2026-06-21 03:22:53', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 03:21:20', '2026-06-21 03:22:53', NULL);
INSERT INTO `bookings` VALUES (145, 5, 15, 'WEERERERE asd', 'asdasdas', 'Anita Wijaya', 1, '2026-06-22 07:00:00', '2026-06-22 10:00:00', 'confirmed', NULL, 'external', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 03:26:32', '2026-06-21 03:26:32', NULL);
INSERT INTO `bookings` VALUES (146, 5, 16, 'GGG', 'asdasdasda', NULL, NULL, '2026-09-19 08:00:00', '2026-09-19 09:30:00', 'cancelled', NULL, 'internal', '2026-06-21 05:09:16', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 05:08:57', '2026-06-21 05:09:16', NULL);
INSERT INTO `bookings` VALUES (150, 5, 16, 'ASDASD', 'For Testing', 'Anita Wijaya', 1, '2026-06-22 07:00:00', '2026-06-22 09:00:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 11:35:40', '2026-06-21 11:35:40', NULL);
INSERT INTO `bookings` VALUES (151, 1, 16, 'ABC', 'asdasdas', NULL, NULL, '2026-06-22 09:00:00', '2026-06-22 12:00:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-21 11:49:01', '2026-06-21 11:49:01', NULL);
INSERT INTO `bookings` VALUES (152, 5, 19, 'Daily Meeting ASDM', 'VCM-3', 'Anita Wijaya', 1, '2026-06-24 07:00:00', '2026-06-24 10:00:00', 'cancelled', NULL, 'internal', '2026-06-24 11:02:13', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-23 12:46:20', '2026-06-24 11:02:13', NULL);
INSERT INTO `bookings` VALUES (153, 5, 16, 'Meeting with disnaker', 'asdasda asdasdas', NULL, NULL, '2026-06-24 09:00:00', '2026-06-24 12:00:00', 'cancelled', NULL, 'external', '2026-06-23 12:47:16', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-23 12:46:53', '2026-06-23 12:47:16', NULL);
INSERT INTO `bookings` VALUES (154, 5, 16, 'ABC123', '12312312', NULL, NULL, '2026-06-24 07:00:00', '2026-06-24 09:00:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-23 12:48:34', '2026-06-23 12:48:34', NULL);
INSERT INTO `bookings` VALUES (155, 5, 7, 'Meeting with PCA', '123', 'Anita Wijaya', 1, '2026-06-24 07:00:00', '2026-06-24 09:00:00', 'cancelled', NULL, 'external', '2026-06-24 11:02:15', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-23 13:03:12', '2026-06-24 11:02:15', NULL);
INSERT INTO `bookings` VALUES (156, 5, 7, 'HHHH', 'asdasdasda', NULL, NULL, '2026-06-24 09:00:00', '2026-06-24 12:30:00', 'tentative', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-23 13:11:48', '2026-06-23 13:11:48', NULL);
INSERT INTO `bookings` VALUES (157, 5, 16, 'Barasuara', 'asdasdasdas', 'Anita Wijaya', 1, '2026-06-24 09:00:00', '2026-06-24 12:00:00', 'cancelled', NULL, 'internal', '2026-06-24 11:02:11', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-23 13:36:26', '2026-06-24 11:02:11', NULL);
INSERT INTO `bookings` VALUES (158, 1, 16, 'Test123', '12312312312', NULL, NULL, '2026-06-24 10:00:00', '2026-06-24 13:00:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-24 12:42:14', '2026-06-24 12:42:14', NULL);
INSERT INTO `bookings` VALUES (159, 1, 15, 'GGGG', 'asdasdas', 'Suciati Farhanas', 5, '2026-06-24 10:00:00', '2026-06-24 13:00:00', 'tentative', NULL, 'external', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-24 12:42:36', '2026-06-24 13:05:26', NULL);
INSERT INTO `bookings` VALUES (160, 1, 19, 'HJHHH', 'sdfsdfs', 'Anita Wijaya', 1, '2026-06-25 07:00:00', '2026-06-25 12:00:00', 'confirmed', NULL, 'external', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-24 12:43:11', '2026-06-24 12:43:11', NULL);
INSERT INTO `bookings` VALUES (161, 1, 7, 'Revara', 'ASDASDASDAS', NULL, NULL, '2026-06-25 12:00:00', '2026-06-25 14:30:00', 'tentative', NULL, 'external', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-24 13:06:23', '2026-06-24 13:06:32', NULL);
INSERT INTO `bookings` VALUES (162, 5, 7, 'KKKK', 'asdasdasda', 'Anita Wijaya', 1, '2026-06-25 07:00:00', '2026-06-25 11:00:00', 'confirmed', NULL, 'external', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-24 13:45:47', '2026-06-24 13:45:47', NULL);
INSERT INTO `bookings` VALUES (163, 5, 7, 'KKKKK', 'asdasldkasas asdasas', NULL, NULL, '2026-06-25 14:30:00', '2026-06-25 17:00:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-24 22:49:40', '2026-06-24 22:49:40', NULL);
INSERT INTO `bookings` VALUES (166, 5, 19, 'Daily Meeting Progress', 'ASDM 2026', 'Anita Wijaya', 1, '2026-06-26 07:00:00', '2026-06-26 14:30:00', 'confirmed', NULL, 'external', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '489ef2b2-bc0c-48a0-8377-aabafe9b6f48', NULL, '2026-06-25 13:07:30', '2026-06-25 13:07:30', NULL);
INSERT INTO `bookings` VALUES (167, 5, 19, 'Daily Meeting Progress', 'ASDM 2026', 'Anita Wijaya', 1, '2026-06-27 07:00:00', '2026-06-27 11:00:00', 'cancelled', NULL, 'external', '2026-06-27 08:10:18', NULL, NULL, NULL, NULL, NULL, NULL, '489ef2b2-bc0c-48a0-8377-aabafe9b6f48', NULL, '2026-06-25 13:07:31', '2026-06-27 08:10:18', NULL);
INSERT INTO `bookings` VALUES (168, 5, 19, 'Daily Meeting Progress', 'ASDM 2026', 'Anita Wijaya', 1, '2026-06-28 07:00:00', '2026-06-28 14:30:00', 'cancelled', NULL, 'external', '2026-06-28 07:42:51', NULL, NULL, NULL, NULL, NULL, NULL, '489ef2b2-bc0c-48a0-8377-aabafe9b6f48', NULL, '2026-06-25 13:07:32', '2026-06-28 00:42:51', NULL);
INSERT INTO `bookings` VALUES (169, 1, 7, 'Daily Meeting Progress', '123', NULL, NULL, '2026-06-26 10:00:00', '2026-06-26 12:00:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-26 02:19:50', '2026-06-26 02:19:50', NULL);
INSERT INTO `bookings` VALUES (170, 2, 7, 'Daily Progress Meeting', 'asdad asdas', NULL, NULL, '2026-06-28 12:00:00', '2026-06-28 15:00:00', 'cancelled', NULL, 'internal', '2026-06-28 00:36:07', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-26 02:44:21', '2026-06-28 00:36:07', NULL);
INSERT INTO `bookings` VALUES (171, 2, 7, 'ASDASDAS', 'asdasdas', NULL, NULL, '2026-06-29 12:00:00', '2026-06-29 13:30:00', 'confirmed', NULL, 'external', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-26 02:45:26', '2026-06-26 03:11:56', NULL);
INSERT INTO `bookings` VALUES (172, 2, 7, 'Daily Progress', 'ASDM 2026', NULL, NULL, '2026-06-26 12:00:00', '2026-06-26 16:30:00', 'cancelled', NULL, 'internal', '2026-06-26 03:11:43', NULL, NULL, NULL, NULL, NULL, NULL, 'cbb5a45c-3d5b-47d7-9676-3176ec32bc59', NULL, '2026-06-26 02:50:08', '2026-06-26 03:11:43', NULL);
INSERT INTO `bookings` VALUES (173, 2, 7, 'Daily Progress', 'ASDM 2026', NULL, NULL, '2026-06-27 12:00:00', '2026-06-27 16:30:00', 'cancelled', NULL, 'internal', '2026-06-26 03:11:43', NULL, NULL, NULL, NULL, NULL, NULL, 'cbb5a45c-3d5b-47d7-9676-3176ec32bc59', NULL, '2026-06-26 02:50:09', '2026-06-26 03:11:43', NULL);
INSERT INTO `bookings` VALUES (174, 2, 7, 'Daily Progress', 'ASDM 2026', NULL, NULL, '2026-06-30 12:00:00', '2026-06-30 16:30:00', 'cancelled', NULL, 'internal', '2026-06-26 03:11:43', NULL, NULL, NULL, NULL, NULL, NULL, 'cbb5a45c-3d5b-47d7-9676-3176ec32bc59', NULL, '2026-06-26 02:50:13', '2026-06-26 03:11:43', NULL);
INSERT INTO `bookings` VALUES (175, 2, 7, 'Daily Progress', 'ASDM 2026', NULL, NULL, '2026-07-01 12:00:00', '2026-07-01 16:30:00', 'cancelled', NULL, 'internal', '2026-06-26 03:11:43', NULL, NULL, NULL, NULL, NULL, NULL, 'cbb5a45c-3d5b-47d7-9676-3176ec32bc59', NULL, '2026-06-26 02:50:13', '2026-06-26 03:11:43', NULL);
INSERT INTO `bookings` VALUES (176, 2, 7, 'Daily Progress', 'ASDM 2026', NULL, NULL, '2026-07-02 12:00:00', '2026-07-02 16:30:00', 'cancelled', NULL, 'internal', '2026-06-26 03:11:43', NULL, NULL, NULL, NULL, NULL, NULL, 'cbb5a45c-3d5b-47d7-9676-3176ec32bc59', NULL, '2026-06-26 02:50:15', '2026-06-26 03:11:43', NULL);
INSERT INTO `bookings` VALUES (177, 2, 7, 'Daily Progress', 'ASDM 2026', NULL, NULL, '2026-07-03 12:00:00', '2026-07-03 16:30:00', 'cancelled', NULL, 'internal', '2026-06-26 03:11:43', NULL, NULL, NULL, NULL, NULL, NULL, 'cbb5a45c-3d5b-47d7-9676-3176ec32bc59', NULL, '2026-06-26 02:50:15', '2026-06-26 03:11:43', NULL);
INSERT INTO `bookings` VALUES (178, 2, 7, 'Daily Progress', 'ASDM 2026', NULL, NULL, '2026-07-04 12:00:00', '2026-07-04 16:30:00', 'cancelled', NULL, 'internal', '2026-06-26 03:11:43', NULL, NULL, NULL, NULL, NULL, NULL, 'cbb5a45c-3d5b-47d7-9676-3176ec32bc59', NULL, '2026-06-26 02:50:17', '2026-06-26 03:11:43', NULL);
INSERT INTO `bookings` VALUES (179, 2, 7, 'TESTING SERIES', 'ASDASDA ASdasdasdas', NULL, NULL, '2026-06-26 12:00:00', '2026-06-26 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:14:43', NULL, NULL, NULL, NULL, NULL, NULL, '2266a785-d97c-4015-9fbe-34e8e0bf706c', NULL, '2026-06-26 03:12:29', '2026-06-26 03:14:43', NULL);
INSERT INTO `bookings` VALUES (180, 2, 7, 'TESTING SERIES', 'ASDASDA ASdasdasdas', NULL, NULL, '2026-06-27 12:00:00', '2026-06-27 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:14:43', NULL, NULL, NULL, NULL, NULL, NULL, '2266a785-d97c-4015-9fbe-34e8e0bf706c', NULL, '2026-06-26 03:12:30', '2026-06-26 03:14:43', NULL);
INSERT INTO `bookings` VALUES (181, 2, 7, 'TESTING SERIES', 'ASDASDA ASdasdasdas', NULL, NULL, '2026-06-30 12:00:00', '2026-06-30 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:14:43', NULL, NULL, NULL, NULL, NULL, NULL, '2266a785-d97c-4015-9fbe-34e8e0bf706c', NULL, '2026-06-26 03:12:33', '2026-06-26 03:14:43', NULL);
INSERT INTO `bookings` VALUES (182, 2, 7, 'TESTING SERIES', 'ASDASDA ASdasdasdas', NULL, NULL, '2026-07-01 12:00:00', '2026-07-01 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:14:43', NULL, NULL, NULL, NULL, NULL, NULL, '2266a785-d97c-4015-9fbe-34e8e0bf706c', NULL, '2026-06-26 03:12:35', '2026-06-26 03:14:43', NULL);
INSERT INTO `bookings` VALUES (183, 2, 7, 'TESTING SERIES', 'ASDASDA ASdasdasdas', NULL, NULL, '2026-07-02 12:00:00', '2026-07-02 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:14:43', NULL, NULL, NULL, NULL, NULL, NULL, '2266a785-d97c-4015-9fbe-34e8e0bf706c', NULL, '2026-06-26 03:12:35', '2026-06-26 03:14:43', NULL);
INSERT INTO `bookings` VALUES (184, 2, 7, 'TESTING SERIES', 'ASDASDA ASdasdasdas', NULL, NULL, '2026-07-03 12:00:00', '2026-07-03 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:14:43', NULL, NULL, NULL, NULL, NULL, NULL, '2266a785-d97c-4015-9fbe-34e8e0bf706c', NULL, '2026-06-26 03:12:36', '2026-06-26 03:14:43', NULL);
INSERT INTO `bookings` VALUES (185, 2, 7, 'TESTING SERIES', 'ASDASDA ASdasdasdas', NULL, NULL, '2026-07-04 12:00:00', '2026-07-04 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:14:43', NULL, NULL, NULL, NULL, NULL, NULL, '2266a785-d97c-4015-9fbe-34e8e0bf706c', NULL, '2026-06-26 03:12:37', '2026-06-26 03:14:43', NULL);
INSERT INTO `bookings` VALUES (186, 2, 7, 'TESTING SERIES', 'ASDASDA ASdasdasdas', NULL, NULL, '2026-07-05 12:00:00', '2026-07-05 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:14:43', NULL, NULL, NULL, NULL, NULL, NULL, '2266a785-d97c-4015-9fbe-34e8e0bf706c', NULL, '2026-06-26 03:12:38', '2026-06-26 03:14:43', NULL);
INSERT INTO `bookings` VALUES (187, 2, 7, 'TEST 123', 'asdasdas', NULL, NULL, '2026-06-26 12:00:00', '2026-06-26 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:21:41', NULL, NULL, NULL, NULL, NULL, NULL, '2d97b84b-2028-42a2-9c44-8d0f187006b2', NULL, '2026-06-26 03:14:57', '2026-06-26 03:21:41', NULL);
INSERT INTO `bookings` VALUES (188, 2, 7, 'TEST 123', 'asdasdas', NULL, NULL, '2026-06-27 12:00:00', '2026-06-27 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:21:41', NULL, NULL, NULL, NULL, NULL, NULL, '2d97b84b-2028-42a2-9c44-8d0f187006b2', NULL, '2026-06-26 03:14:58', '2026-06-26 03:21:41', NULL);
INSERT INTO `bookings` VALUES (189, 2, 7, 'TEST 123', 'asdasdas', NULL, NULL, '2026-06-30 12:00:00', '2026-06-30 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:21:41', NULL, NULL, NULL, NULL, NULL, NULL, '2d97b84b-2028-42a2-9c44-8d0f187006b2', NULL, '2026-06-26 03:15:01', '2026-06-26 03:21:41', NULL);
INSERT INTO `bookings` VALUES (190, 2, 7, 'TEST 123', 'asdasdas', NULL, NULL, '2026-07-01 12:00:00', '2026-07-01 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:21:41', NULL, NULL, NULL, NULL, NULL, NULL, '2d97b84b-2028-42a2-9c44-8d0f187006b2', NULL, '2026-06-26 03:15:01', '2026-06-26 03:21:41', NULL);
INSERT INTO `bookings` VALUES (191, 2, 7, 'TEST 123', 'asdasdas', NULL, NULL, '2026-07-02 12:00:00', '2026-07-02 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:21:41', NULL, NULL, NULL, NULL, NULL, NULL, '2d97b84b-2028-42a2-9c44-8d0f187006b2', NULL, '2026-06-26 03:15:03', '2026-06-26 03:21:41', NULL);
INSERT INTO `bookings` VALUES (192, 2, 7, 'TEST 123', 'asdasdas', NULL, NULL, '2026-07-03 12:00:00', '2026-07-03 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:21:41', NULL, NULL, NULL, NULL, NULL, NULL, '2d97b84b-2028-42a2-9c44-8d0f187006b2', NULL, '2026-06-26 03:15:03', '2026-06-26 03:21:41', NULL);
INSERT INTO `bookings` VALUES (193, 2, 7, 'TEST 123', 'asdasdas', NULL, NULL, '2026-07-04 12:00:00', '2026-07-04 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:21:41', NULL, NULL, NULL, NULL, NULL, NULL, '2d97b84b-2028-42a2-9c44-8d0f187006b2', NULL, '2026-06-26 03:15:05', '2026-06-26 03:21:41', NULL);
INSERT INTO `bookings` VALUES (194, 2, 7, 'TEST 123', 'asdasdas', NULL, NULL, '2026-07-05 12:00:00', '2026-07-05 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:21:41', NULL, NULL, NULL, NULL, NULL, NULL, '2d97b84b-2028-42a2-9c44-8d0f187006b2', NULL, '2026-06-26 03:15:05', '2026-06-26 03:21:41', NULL);
INSERT INTO `bookings` VALUES (195, 2, 7, 'Daily Progress', 'ASDM 2026', NULL, NULL, '2026-06-26 12:00:00', '2026-06-26 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:35:31', NULL, NULL, NULL, NULL, NULL, NULL, 'c2e92220-904a-4ed0-a178-62694544dc18', NULL, '2026-06-26 03:22:03', '2026-06-26 03:35:31', NULL);
INSERT INTO `bookings` VALUES (196, 2, 7, 'Daily Progress', 'ASDM 2026', NULL, NULL, '2026-06-27 12:00:00', '2026-06-27 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:35:31', NULL, NULL, NULL, NULL, NULL, NULL, 'c2e92220-904a-4ed0-a178-62694544dc18', NULL, '2026-06-26 03:22:04', '2026-06-26 03:35:31', NULL);
INSERT INTO `bookings` VALUES (197, 2, 7, 'Daily Progress', 'ASDM 2026', NULL, NULL, '2026-06-30 12:00:00', '2026-06-30 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:35:31', NULL, NULL, NULL, NULL, NULL, NULL, 'c2e92220-904a-4ed0-a178-62694544dc18', NULL, '2026-06-26 03:22:06', '2026-06-26 03:35:31', NULL);
INSERT INTO `bookings` VALUES (198, 2, 7, 'Daily Progress', 'ASDM 2026', NULL, NULL, '2026-07-01 12:00:00', '2026-07-01 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:35:31', NULL, NULL, NULL, NULL, NULL, NULL, 'c2e92220-904a-4ed0-a178-62694544dc18', NULL, '2026-06-26 03:22:07', '2026-06-26 03:35:31', NULL);
INSERT INTO `bookings` VALUES (199, 2, 7, 'Daily Progress', 'ASDM 2026', NULL, NULL, '2026-07-02 12:00:00', '2026-07-02 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:35:31', NULL, NULL, NULL, NULL, NULL, NULL, 'c2e92220-904a-4ed0-a178-62694544dc18', NULL, '2026-06-26 03:22:09', '2026-06-26 03:35:31', NULL);
INSERT INTO `bookings` VALUES (200, 2, 7, 'Daily Progress', 'ASDM 2026', NULL, NULL, '2026-07-03 12:00:00', '2026-07-03 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:35:31', NULL, NULL, NULL, NULL, NULL, NULL, 'c2e92220-904a-4ed0-a178-62694544dc18', NULL, '2026-06-26 03:22:10', '2026-06-26 03:35:31', NULL);
INSERT INTO `bookings` VALUES (201, 2, 7, 'Daily Progress', 'ASDM 2026', NULL, NULL, '2026-07-04 12:00:00', '2026-07-04 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:35:31', NULL, NULL, NULL, NULL, NULL, NULL, 'c2e92220-904a-4ed0-a178-62694544dc18', NULL, '2026-06-26 03:22:10', '2026-06-26 03:35:31', NULL);
INSERT INTO `bookings` VALUES (202, 2, 7, 'Daily Progress', 'ASDM 2026', NULL, NULL, '2026-07-05 12:00:00', '2026-07-05 19:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:35:31', NULL, NULL, NULL, NULL, NULL, NULL, 'c2e92220-904a-4ed0-a178-62694544dc18', NULL, '2026-06-26 03:22:11', '2026-06-26 03:35:31', NULL);
INSERT INTO `bookings` VALUES (203, 2, 7, 'Barasuara', 'asdasdasdas asdasasd', NULL, NULL, '2026-06-26 12:00:00', '2026-06-26 19:00:00', 'confirmed', NULL, 'external', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '3a7aae80-ceb0-4482-a9d0-77b3eb77c7df', '[\"2026-06-28\",\"2026-06-29\"]', '2026-06-26 03:35:53', '2026-06-26 03:35:53', NULL);
INSERT INTO `bookings` VALUES (204, 2, 7, 'Barasuara', 'asdasdasdas asdasasd', NULL, NULL, '2026-06-27 12:00:00', '2026-06-27 19:00:00', 'confirmed', NULL, 'external', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '3a7aae80-ceb0-4482-a9d0-77b3eb77c7df', '[\"2026-06-28\",\"2026-06-29\"]', '2026-06-26 03:35:54', '2026-06-26 03:35:54', NULL);
INSERT INTO `bookings` VALUES (205, 2, 7, 'Barasuara', 'asdasdasdas asdasasd', NULL, NULL, '2026-06-30 12:00:00', '2026-06-30 19:00:00', 'confirmed', NULL, 'external', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '3a7aae80-ceb0-4482-a9d0-77b3eb77c7df', '[\"2026-06-28\",\"2026-06-29\"]', '2026-06-26 03:35:54', '2026-06-26 03:35:54', NULL);
INSERT INTO `bookings` VALUES (206, 2, 7, 'Barasuara', 'asdasdasdas asdasasd', NULL, NULL, '2026-07-01 12:00:00', '2026-07-01 19:00:00', 'confirmed', NULL, 'external', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '3a7aae80-ceb0-4482-a9d0-77b3eb77c7df', '[\"2026-06-28\",\"2026-06-29\"]', '2026-06-26 03:35:56', '2026-06-26 03:35:56', NULL);
INSERT INTO `bookings` VALUES (207, 2, 7, 'Barasuara', 'asdasdasdas asdasasd', NULL, NULL, '2026-07-02 12:00:00', '2026-07-02 19:00:00', 'confirmed', NULL, 'external', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '3a7aae80-ceb0-4482-a9d0-77b3eb77c7df', '[\"2026-06-28\",\"2026-06-29\"]', '2026-06-26 03:35:56', '2026-06-26 03:35:56', NULL);
INSERT INTO `bookings` VALUES (208, 2, 7, 'Barasuara', 'asdasdasdas asdasasd', NULL, NULL, '2026-07-03 12:00:00', '2026-07-03 19:00:00', 'confirmed', NULL, 'external', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '3a7aae80-ceb0-4482-a9d0-77b3eb77c7df', '[\"2026-06-28\",\"2026-06-29\"]', '2026-06-26 03:35:57', '2026-06-26 03:35:57', NULL);
INSERT INTO `bookings` VALUES (209, 2, 7, 'Barasuara', 'asdasdasdas asdasasd', NULL, NULL, '2026-07-04 12:00:00', '2026-07-04 19:00:00', 'confirmed', NULL, 'external', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '3a7aae80-ceb0-4482-a9d0-77b3eb77c7df', '[\"2026-06-28\",\"2026-06-29\"]', '2026-06-26 03:35:58', '2026-06-26 03:35:58', NULL);
INSERT INTO `bookings` VALUES (210, 2, 7, 'Barasuara', 'asdasdasdas asdasasd', NULL, NULL, '2026-07-05 12:00:00', '2026-07-05 19:00:00', 'confirmed', NULL, 'external', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '3a7aae80-ceb0-4482-a9d0-77b3eb77c7df', '[\"2026-06-28\",\"2026-06-29\"]', '2026-06-26 03:35:59', '2026-06-26 03:35:59', NULL);
INSERT INTO `bookings` VALUES (211, 2, 16, 'ASDADAS', NULL, NULL, NULL, '2026-06-26 10:00:00', '2026-06-26 13:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:50:20', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-26 03:50:01', '2026-06-26 03:50:20', NULL);
INSERT INTO `bookings` VALUES (212, 2, 16, 'asdasdas', 'asdasdasdas', NULL, NULL, '2026-06-26 08:00:00', '2026-06-26 11:00:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-26 03:51:03', '2026-06-26 03:51:03', NULL);
INSERT INTO `bookings` VALUES (213, 2, 16, 'AAA', 'dasdasdas', NULL, NULL, '2026-06-26 11:00:00', '2026-06-26 16:30:00', 'cancelled', NULL, 'external', '2026-06-26 03:52:08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-26 03:51:31', '2026-06-26 03:52:08', NULL);
INSERT INTO `bookings` VALUES (214, 2, 16, 'ZZZZZZZZZ', NULL, NULL, NULL, '2026-06-26 11:00:00', '2026-06-26 16:00:00', 'cancelled', NULL, 'external', '2026-06-26 03:52:46', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-26 03:52:20', '2026-06-26 03:52:46', NULL);
INSERT INTO `bookings` VALUES (215, 2, 16, 'ASDASD', NULL, NULL, NULL, '2026-06-26 11:00:00', '2026-06-26 16:30:00', 'cancelled', NULL, 'internal', '2026-06-26 04:05:29', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-26 03:53:45', '2026-06-26 04:05:29', NULL);
INSERT INTO `bookings` VALUES (216, 2, 16, 'REVARA', 'asdadasas', NULL, NULL, '2026-06-27 07:00:00', '2026-06-27 11:00:00', 'confirmed', NULL, 'external', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-26 04:29:04', '2026-06-26 04:29:04', NULL);
INSERT INTO `bookings` VALUES (217, 5, 7, 'HAHAHA', 'dasdasdas', NULL, NULL, '2026-06-27 07:00:00', '2026-06-27 12:00:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-26 04:41:03', '2026-06-26 04:41:03', NULL);
INSERT INTO `bookings` VALUES (218, 5, 14, 'Test 123', 'asdfgh', 'Jessica Miller', NULL, '2026-06-26 15:30:00', '2026-06-26 18:00:00', 'cancelled', NULL, 'external', '2026-06-26 08:43:04', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-26 08:41:13', '2026-06-26 08:43:04', NULL);
INSERT INTO `bookings` VALUES (219, 5, 7, 'KKKKK', 'asdasdasdasdasdas', NULL, NULL, '2026-06-28 07:00:00', '2026-06-28 10:30:00', 'cancelled', NULL, 'external', '2026-06-28 07:42:51', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-27 06:27:56', '2026-06-28 00:42:51', NULL);
INSERT INTO `bookings` VALUES (221, 1, 19, 'ABC', 'asdassa', NULL, NULL, '2026-06-27 15:00:00', '2026-06-27 17:00:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-27 08:30:42', '2026-06-27 08:30:42', NULL);
INSERT INTO `bookings` VALUES (222, 1, 19, 'A', 'a', NULL, NULL, '2026-06-27 17:00:00', '2026-06-27 18:00:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-27 08:30:54', '2026-06-27 08:30:54', NULL);
INSERT INTO `bookings` VALUES (231, 1, 16, 'AAAA', 'asdasdas', NULL, NULL, '2026-06-29 09:00:00', '2026-06-29 13:00:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '814a9099-5392-46ea-8a8d-a199cc2abe39', NULL, '2026-06-28 02:01:50', '2026-06-28 02:01:50', NULL);
INSERT INTO `bookings` VALUES (232, 1, 16, 'AAAA', 'asdasdas', NULL, NULL, '2026-06-30 09:00:00', '2026-06-30 13:00:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '814a9099-5392-46ea-8a8d-a199cc2abe39', NULL, '2026-06-28 02:01:55', '2026-06-28 02:01:55', NULL);
INSERT INTO `bookings` VALUES (233, 1, 19, 'TEST AUTO RELEASED1', 'booking sendiri', NULL, NULL, '2026-06-28 09:30:00', '2026-06-28 11:00:00', 'cancelled', NULL, 'external', '2026-06-28 09:35:01', 'ghost_release', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-28 02:26:17', '2026-06-28 02:35:01', NULL);
INSERT INTO `bookings` VALUES (234, 1, 7, 'KATY PERY', 'hahaha', NULL, NULL, '2026-06-28 09:30:00', '2026-06-28 12:00:00', 'cancelled', NULL, 'internal', '2026-06-28 09:35:01', 'ghost_release', NULL, NULL, NULL, NULL, NULL, 'e12f2ad8-8b04-41d4-a27b-e631ca42a592', NULL, '2026-06-28 02:26:41', '2026-06-28 02:35:01', NULL);
INSERT INTO `bookings` VALUES (235, 1, 7, 'KATY PERY', 'hahaha', NULL, NULL, '2026-06-29 09:30:00', '2026-06-29 12:00:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'e12f2ad8-8b04-41d4-a27b-e631ca42a592', NULL, '2026-06-28 02:26:45', '2026-06-28 02:26:45', NULL);
INSERT INTO `bookings` VALUES (236, 1, 7, 'KATY PERY', 'hahaha', NULL, NULL, '2026-06-30 09:30:00', '2026-06-30 12:00:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'e12f2ad8-8b04-41d4-a27b-e631ca42a592', NULL, '2026-06-28 02:26:51', '2026-06-28 02:26:51', NULL);
INSERT INTO `bookings` VALUES (237, 4, 16, 'LOL', 'asdasdasda', 'Anita Wijaya', 1, '2026-06-28 09:30:00', '2026-06-28 11:00:00', 'cancelled', NULL, 'external', '2026-06-28 09:35:01', 'ghost_release', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-28 02:27:21', '2026-06-28 02:35:01', NULL);
INSERT INTO `bookings` VALUES (238, 1, 19, 'TEST AUTO-', 'asdasdasdasd', NULL, NULL, '2026-06-28 16:00:00', '2026-06-28 17:30:00', 'cancelled', NULL, 'external', '2026-06-28 16:05:03', 'ghost_release', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-28 08:57:31', '2026-06-28 09:05:03', NULL);
INSERT INTO `bookings` VALUES (239, 1, 7, 'EEEEE', 'asdasdadas', NULL, NULL, '2026-06-28 16:00:00', '2026-06-28 19:00:00', 'cancelled', NULL, 'internal', '2026-06-28 16:05:03', 'ghost_release', NULL, NULL, NULL, NULL, NULL, '6ab217c4-04fe-4b69-b673-b587d2baba8e', '[\"2026-06-30\"]', '2026-06-28 08:57:49', '2026-06-28 09:05:03', NULL);
INSERT INTO `bookings` VALUES (240, 1, 7, 'EEEEE', 'asdasdadas', NULL, NULL, '2026-06-29 16:00:00', '2026-06-29 19:00:00', 'confirmed', NULL, 'internal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '6ab217c4-04fe-4b69-b673-b587d2baba8e', '[\"2026-06-30\"]', '2026-06-28 08:57:49', '2026-06-28 08:57:49', NULL);

-- ----------------------------
-- Table structure for buildings
-- ----------------------------
DROP TABLE IF EXISTS `buildings`;
CREATE TABLE `buildings`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `location_id` bigint UNSIGNED NULL DEFAULT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `floors` int NOT NULL DEFAULT 1,
  `photo` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `buildings_location_id_foreign`(`location_id` ASC) USING BTREE,
  CONSTRAINT `buildings_location_id_foreign` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of buildings
-- ----------------------------
INSERT INTO `buildings` VALUES (1, 1, 'Head Office', 'HO', 'Jakarta', 1, NULL, 'Main corporate headquarters.', 1, '2026-06-14 06:40:53', '2026-06-16 06:50:49');
INSERT INTO `buildings` VALUES (2, 2, 'One Team Center', 'OTC', 'Anyer', 3, NULL, 'One Team Center Building', 1, '2026-06-14 06:40:53', '2026-06-16 06:51:30');
INSERT INTO `buildings` VALUES (3, 2, 'Technical Building 1', 'TB1', 'Anyer', 2, NULL, 'Technical Building 1 - Anyer', 1, '2026-06-14 06:40:53', '2026-06-16 10:27:44');

-- ----------------------------
-- Table structure for cache
-- ----------------------------
DROP TABLE IF EXISTS `cache`;
CREATE TABLE `cache`  (
  `key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` int NOT NULL,
  PRIMARY KEY (`key`) USING BTREE,
  INDEX `cache_expiration_index`(`expiration` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of cache
-- ----------------------------

-- ----------------------------
-- Table structure for cache_locks
-- ----------------------------
DROP TABLE IF EXISTS `cache_locks`;
CREATE TABLE `cache_locks`  (
  `key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` int NOT NULL,
  PRIMARY KEY (`key`) USING BTREE,
  INDEX `cache_locks_expiration_index`(`expiration` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of cache_locks
-- ----------------------------

-- ----------------------------
-- Table structure for departments
-- ----------------------------
DROP TABLE IF EXISTS `departments`;
CREATE TABLE `departments`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `location_id` bigint UNSIGNED NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `departments_location_id_foreign`(`location_id` ASC) USING BTREE,
  CONSTRAINT `departments_location_id_foreign` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 7 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of departments
-- ----------------------------
INSERT INTO `departments` VALUES (1, 'GAA', NULL, 2, '2026-06-16 04:22:45', '2026-06-28 07:29:43');
INSERT INTO `departments` VALUES (2, 'PMD', 'PMD', 2, '2026-06-16 04:22:45', '2026-06-28 07:29:28');
INSERT INTO `departments` VALUES (3, 'MTC', NULL, 2, '2026-06-16 04:22:45', '2026-06-28 07:29:39');
INSERT INTO `departments` VALUES (4, 'GAJ', NULL, 1, '2026-06-16 04:22:45', '2026-06-28 07:29:35');

-- ----------------------------
-- Table structure for failed_jobs
-- ----------------------------
DROP TABLE IF EXISTS `failed_jobs`;
CREATE TABLE `failed_jobs`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `exception` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `failed_jobs_uuid_unique`(`uuid` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of failed_jobs
-- ----------------------------

-- ----------------------------
-- Table structure for job_batches
-- ----------------------------
DROP TABLE IF EXISTS `job_batches`;
CREATE TABLE `job_batches`  (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_jobs` int NOT NULL,
  `pending_jobs` int NOT NULL,
  `failed_jobs` int NOT NULL,
  `failed_job_ids` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `options` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `cancelled_at` int NULL DEFAULT NULL,
  `created_at` int NOT NULL,
  `finished_at` int NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of job_batches
-- ----------------------------

-- ----------------------------
-- Table structure for jobs
-- ----------------------------
DROP TABLE IF EXISTS `jobs`;
CREATE TABLE `jobs`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` tinyint UNSIGNED NOT NULL,
  `reserved_at` int UNSIGNED NULL DEFAULT NULL,
  `available_at` int UNSIGNED NOT NULL,
  `created_at` int UNSIGNED NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `jobs_queue_index`(`queue` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of jobs
-- ----------------------------

-- ----------------------------
-- Table structure for kiosk_configs
-- ----------------------------
DROP TABLE IF EXISTS `kiosk_configs`;
CREATE TABLE `kiosk_configs`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `room_id` bigint UNSIGNED NULL DEFAULT NULL,
  `pin` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `theme` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `layout` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `resolution` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `kiosk_configs_slug_unique`(`slug` ASC) USING BTREE,
  INDEX `kiosk_configs_room_id_foreign`(`room_id` ASC) USING BTREE,
  CONSTRAINT `kiosk_configs_room_id_foreign` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of kiosk_configs
-- ----------------------------
INSERT INTO `kiosk_configs` VALUES (5, 'Room 101', 'room101', 19, '1234', '{\"mode\":\"dark\",\"accent\":\"#adee2b\",\"bg\":\"#0a0e1a\",\"surface\":\"#141826\",\"text\":\"#ffffff\"}', '{\"show_clock\":true,\"show_bookings\":true,\"show_book_btn\":false,\"show_confirm_btn\":true,\"orientation\":\"portrait\",\"book_btn_url\":null,\"upcoming_count\":2}', '{\"preset\":\"custom\",\"width\":500,\"height\":1024}', 1, '2026-06-27 02:43:34', '2026-06-28 00:38:20');

-- ----------------------------
-- Table structure for locations
-- ----------------------------
DROP TABLE IF EXISTS `locations`;
CREATE TABLE `locations`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of locations
-- ----------------------------
INSERT INTO `locations` VALUES (1, 'Jakarta', NULL, '2026-06-14 12:02:13', '2026-06-14 12:02:13');
INSERT INTO `locations` VALUES (2, 'Anyer', NULL, '2026-06-14 12:02:13', '2026-06-14 12:02:13');

-- ----------------------------
-- Table structure for migrations
-- ----------------------------
DROP TABLE IF EXISTS `migrations`;
CREATE TABLE `migrations`  (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 43 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of migrations
-- ----------------------------
INSERT INTO `migrations` VALUES (1, '0001_01_01_000000_create_users_table', 1);
INSERT INTO `migrations` VALUES (2, '0001_01_01_000001_create_cache_table', 1);
INSERT INTO `migrations` VALUES (3, '0001_01_01_000002_create_jobs_table', 1);
INSERT INTO `migrations` VALUES (4, '2026_06_07_000001_create_rooms_table', 1);
INSERT INTO `migrations` VALUES (5, '2026_06_07_000002_add_fields_to_users_table', 1);
INSERT INTO `migrations` VALUES (6, '2026_06_07_000003_create_bookings_table', 1);
INSERT INTO `migrations` VALUES (7, '2026_06_07_000004_create_pantry_orders_table', 1);
INSERT INTO `migrations` VALUES (8, '2026_06_07_094038_create_personal_access_tokens_table', 1);
INSERT INTO `migrations` VALUES (9, '2026_06_10_000001_add_cancelled_at_to_bookings_table', 1);
INSERT INTO `migrations` VALUES (10, '2026_06_11_000001_add_status_and_requires_contact_to_rooms', 1);
INSERT INTO `migrations` VALUES (11, '2026_06_11_000001_create_room_views_table', 1);
INSERT INTO `migrations` VALUES (12, '2026_06_11_000002_add_maintenance_types_to_bookings', 1);
INSERT INTO `migrations` VALUES (13, '2026_06_11_000003_add_password_change_support', 1);
INSERT INTO `migrations` VALUES (14, '2026_06_14_000001_add_series_id_to_bookings', 1);
INSERT INTO `migrations` VALUES (15, '2026_06_14_000002_create_buildings_table', 1);
INSERT INTO `migrations` VALUES (16, '2026_06_14_000003_add_building_id_to_rooms', 1);
INSERT INTO `migrations` VALUES (17, '2026_06_14_000004_make_room_type_nullable', 2);
INSERT INTO `migrations` VALUES (18, '2026_06_14_000005_add_sort_order_to_rooms', 3);
INSERT INTO `migrations` VALUES (21, '2026_06_14_000008_add_building_admin_role', 6);
INSERT INTO `migrations` VALUES (22, '2026_06_14_000009_create_locations_table', 7);
INSERT INTO `migrations` VALUES (23, '2026_06_16_000001_create_departments_table', 8);
INSERT INTO `migrations` VALUES (24, '2026_06_16_000002_migrate_department_to_fk', 8);
INSERT INTO `migrations` VALUES (25, '2026_06_16_000003_create_settings_table', 9);
INSERT INTO `migrations` VALUES (26, '2026_06_17_000001_add_on_duty_to_users_table', 10);
INSERT INTO `migrations` VALUES (27, '2026_06_20_035007_add_booked_for_to_bookings_table', 11);
INSERT INTO `migrations` VALUES (28, '2026_06_20_051503_add_booked_for_user_id_to_bookings_table', 12);
INSERT INTO `migrations` VALUES (29, '2026_06_20_051504_create_notifications_table', 12);
INSERT INTO `migrations` VALUES (30, '2026_06_21_035300_add_can_book_special_to_users_table', 13);
INSERT INTO `migrations` VALUES (31, '2026_06_21_060205_add_archived_at_to_bookings_table', 14);
INSERT INTO `migrations` VALUES (32, '2026_06_25_130416_create_kiosk_configs_table', 15);
INSERT INTO `migrations` VALUES (33, '2026_06_25_132603_add_presence_to_bookings_table', 16);
INSERT INTO `migrations` VALUES (34, '2026_06_26_000001_add_series_skipped_dates_to_bookings', 17);
INSERT INTO `migrations` VALUES (35, '2026_06_27_022646_add_preferences_to_users_table', 18);
INSERT INTO `migrations` VALUES (36, '2026_06_27_064715_drop_type_from_rooms_table', 19);
INSERT INTO `migrations` VALUES (37, '2026_06_27_092212_create_activity_logs_table', 20);
INSERT INTO `migrations` VALUES (38, '2026_06_27_111417_add_slug_to_kiosk_configs_table', 21);
INSERT INTO `migrations` VALUES (39, '2026_06_28_011631_add_cancel_reason_to_bookings_table', 22);
INSERT INTO `migrations` VALUES (40, '2026_06_28_012350_add_dispute_fields_to_bookings_table', 23);
INSERT INTO `migrations` VALUES (41, '2026_06_28_add_sensor_code_to_rooms', 24);
INSERT INTO `migrations` VALUES (42, '2026_06_28_071915_add_location_id_to_departments_table', 25);

-- ----------------------------
-- Table structure for notifications
-- ----------------------------
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `booking_id` bigint UNSIGNED NOT NULL,
  `type` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'booked_for',
  `message` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `notifications_user_id_foreign`(`user_id` ASC) USING BTREE,
  INDEX `notifications_booking_id_foreign`(`booking_id` ASC) USING BTREE,
  CONSTRAINT `notifications_booking_id_foreign` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `notifications_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 46 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of notifications
-- ----------------------------

-- ----------------------------
-- Table structure for password_reset_tokens
-- ----------------------------
DROP TABLE IF EXISTS `password_reset_tokens`;
CREATE TABLE `password_reset_tokens`  (
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of password_reset_tokens
-- ----------------------------

-- ----------------------------
-- Table structure for personal_access_tokens
-- ----------------------------
DROP TABLE IF EXISTS `personal_access_tokens`;
CREATE TABLE `personal_access_tokens`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenable_id` bigint UNSIGNED NOT NULL,
  `name` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `abilities` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `personal_access_tokens_token_unique`(`token` ASC) USING BTREE,
  INDEX `personal_access_tokens_tokenable_type_tokenable_id_index`(`tokenable_type` ASC, `tokenable_id` ASC) USING BTREE,
  INDEX `personal_access_tokens_expires_at_index`(`expires_at` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 457 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of personal_access_tokens
-- ----------------------------
INSERT INTO `personal_access_tokens` VALUES (4, 'App\\Models\\User', 2, 'auth-token', 'ee08db3e690b9ad32ee8fdaa030ebef02bbffddde34d0a8eea43d4f28cda090e', '[\"*\"]', '2026-06-14 09:01:02', NULL, '2026-06-14 07:29:35', '2026-06-14 09:01:02');
INSERT INTO `personal_access_tokens` VALUES (5, 'App\\Models\\User', 2, 'auth-token', 'c526fb8612f09678efac32265f54974b31cd881590bca44c4dd77d9ebc7455c7', '[\"*\"]', '2026-06-14 09:01:42', NULL, '2026-06-14 09:01:07', '2026-06-14 09:01:42');
INSERT INTO `personal_access_tokens` VALUES (6, 'App\\Models\\User', 2, 'auth-token', '65712002a1a6fa293ab93b0b6e1e82c6876b569ea8815f099fca4551d804ba7e', '[\"*\"]', '2026-06-14 09:02:47', NULL, '2026-06-14 09:02:07', '2026-06-14 09:02:47');
INSERT INTO `personal_access_tokens` VALUES (7, 'App\\Models\\User', 2, 'auth-token', 'fa08337dd7b293e37b5bb546268ee580f7c922feaf8651cdb4eca20371742446', '[\"*\"]', '2026-06-14 09:06:17', NULL, '2026-06-14 09:02:16', '2026-06-14 09:06:17');
INSERT INTO `personal_access_tokens` VALUES (9, 'App\\Models\\User', 1, 'auth-token', 'b391a7fa3a6757752b86cf8fda7a2ce2444210e838dc43fb2216c129c2c72224', '[\"*\"]', NULL, NULL, '2026-06-14 09:06:30', '2026-06-14 09:06:30');
INSERT INTO `personal_access_tokens` VALUES (10, 'App\\Models\\User', 1, 'auth-token', 'd519a384d13a2ae0b35d01739f11b20d137375f4a3a4b24cf9722c9fc3689572', '[\"*\"]', '2026-06-14 09:09:29', NULL, '2026-06-14 09:07:32', '2026-06-14 09:09:29');
INSERT INTO `personal_access_tokens` VALUES (27, 'App\\Models\\User', 1, 'auth-token', '77e98b44a1692fcd64100c304f493c5b683903385c2ccd2efac7785ce99aebb3', '[\"*\"]', '2026-06-16 07:09:31', NULL, '2026-06-16 07:03:48', '2026-06-16 07:09:31');
INSERT INTO `personal_access_tokens` VALUES (36, 'App\\Models\\User', 5, 'auth-token', '1db39a68ada751d9fc9599d19c9a84f850215729697e09cf78f465c944df5dd0', '[\"*\"]', '2026-06-16 23:20:42', NULL, '2026-06-16 23:20:14', '2026-06-16 23:20:42');
INSERT INTO `personal_access_tokens` VALUES (37, 'App\\Models\\User', 2, 'auth-token', '8aba2c01abca6dd678a8f3cfb26d1227088375c917fe7fd0802d5275fe0ab780', '[\"*\"]', NULL, NULL, '2026-06-17 12:28:29', '2026-06-17 12:28:29');
INSERT INTO `personal_access_tokens` VALUES (40, 'App\\Models\\User', 1, 'auth-token', 'c901bec40ce4fd9995bcdfd688e39306db11eba71913c116c86134ba1ec64508', '[\"*\"]', '2026-06-18 13:35:32', NULL, '2026-06-18 11:59:16', '2026-06-18 13:35:32');
INSERT INTO `personal_access_tokens` VALUES (53, 'App\\Models\\User', 8, 'auth-token', '32ef7e91993b79cc57cb2009ed0058d2c5aab1e75d2dc9bfd5ee0cc1dede0245', '[\"*\"]', '2026-06-20 06:16:30', NULL, '2026-06-20 06:12:45', '2026-06-20 06:16:30');
INSERT INTO `personal_access_tokens` VALUES (55, 'App\\Models\\User', 2, 'auth-token', '494b1ea48cac9eb8d1ed17279fe8f917c582a77628522346d6d8aa9ac75616cd', '[\"*\"]', '2026-06-20 06:26:31', NULL, '2026-06-20 06:21:40', '2026-06-20 06:26:31');
INSERT INTO `personal_access_tokens` VALUES (56, 'App\\Models\\User', 2, 'auth-token', 'b913490b41a0c5f9929db3ed91dc31861d0eb601ddfa1522010b69b6af9be8db', '[\"*\"]', '2026-06-20 06:27:09', NULL, '2026-06-20 06:26:32', '2026-06-20 06:27:09');
INSERT INTO `personal_access_tokens` VALUES (57, 'App\\Models\\User', 2, 'auth-token', '5b8034afab61fa92821831816dd5ace087b9b9d898d650514bf1e631d9767515', '[\"*\"]', '2026-06-20 06:30:04', NULL, '2026-06-20 06:27:20', '2026-06-20 06:30:04');
INSERT INTO `personal_access_tokens` VALUES (59, 'App\\Models\\User', 2, 'auth-token', 'e3e196daacc3ad15ae938dfe76b43f91285c2a90316688580288f038fb2734a9', '[\"*\"]', '2026-06-20 06:38:39', NULL, '2026-06-20 06:32:15', '2026-06-20 06:38:39');
INSERT INTO `personal_access_tokens` VALUES (60, 'App\\Models\\User', 2, 'auth-token', '17e1548d792acbaf0bfe9293ce770b314df1b692e173e0da79b7255c1af4ef88', '[\"*\"]', '2026-06-20 06:43:18', NULL, '2026-06-20 06:39:44', '2026-06-20 06:43:18');
INSERT INTO `personal_access_tokens` VALUES (61, 'App\\Models\\User', 2, 'auth-token', '17e6015ff7226dacae974d082421a6db289408ef57bfa4f612671673c66fcb15', '[\"*\"]', '2026-06-20 06:45:03', NULL, '2026-06-20 06:43:35', '2026-06-20 06:45:03');
INSERT INTO `personal_access_tokens` VALUES (62, 'App\\Models\\User', 2, 'auth-token', 'b260de0426a8b9d907e518ad6cc7740e9fde02f49724d934796c40c86a7fd8d5', '[\"*\"]', '2026-06-20 06:45:28', NULL, '2026-06-20 06:45:13', '2026-06-20 06:45:28');
INSERT INTO `personal_access_tokens` VALUES (63, 'App\\Models\\User', 2, 'auth-token', 'f5c8bd535307ee1775c0029093b2e0af582aeddcdcb3dfb1f1ba092474cde6a3', '[\"*\"]', '2026-06-20 08:10:14', NULL, '2026-06-20 06:45:27', '2026-06-20 08:10:14');
INSERT INTO `personal_access_tokens` VALUES (65, 'App\\Models\\User', 2, 'auth-token', 'f0908c604ee1dbcdf59a3711d80ebf245085ec48eff47f8fb4e39283fe6b1a8c', '[\"*\"]', '2026-06-20 08:39:07', NULL, '2026-06-20 08:27:39', '2026-06-20 08:39:07');
INSERT INTO `personal_access_tokens` VALUES (66, 'App\\Models\\User', 2, 'auth-token', '05a0c5173f288383f593a2edd3f9e57580046fc343ceac1511525efa9bb41c9c', '[\"*\"]', '2026-06-20 08:48:22', NULL, '2026-06-20 08:39:07', '2026-06-20 08:48:22');
INSERT INTO `personal_access_tokens` VALUES (67, 'App\\Models\\User', 2, 'auth-token', '629532875cdcc180dc4201340b4d6571f0db1eaf632b403f1120dadbc6202fa1', '[\"*\"]', '2026-06-20 08:55:13', NULL, '2026-06-20 08:48:23', '2026-06-20 08:55:13');
INSERT INTO `personal_access_tokens` VALUES (68, 'App\\Models\\User', 2, 'auth-token', '3f93aca0519e9fcaccf402a646b20c2af564ae22826a74906f4582be670b1153', '[\"*\"]', '2026-06-20 10:18:46', NULL, '2026-06-20 08:55:12', '2026-06-20 10:18:46');
INSERT INTO `personal_access_tokens` VALUES (69, 'App\\Models\\User', 2, 'auth-token', '0102cd6eef3aafffb01f498386424b9468badbb92c354e3469b34dd361263460', '[\"*\"]', '2026-06-20 10:21:52', NULL, '2026-06-20 10:19:54', '2026-06-20 10:21:52');
INSERT INTO `personal_access_tokens` VALUES (70, 'App\\Models\\User', 2, 'auth-token', 'bdbad30fadf1acbabce3f5dfba517921b32a1b065b4619810c61ec4325e211af', '[\"*\"]', '2026-06-20 10:25:43', NULL, '2026-06-20 10:23:32', '2026-06-20 10:25:43');
INSERT INTO `personal_access_tokens` VALUES (71, 'App\\Models\\User', 2, 'auth-token', '96edb295ef5bf28c004a7ed0743712bfd511c15f36407f9d584264e4685b923e', '[\"*\"]', '2026-06-20 10:30:24', NULL, '2026-06-20 10:27:05', '2026-06-20 10:30:24');
INSERT INTO `personal_access_tokens` VALUES (72, 'App\\Models\\User', 2, 'auth-token', '7a230504dba570c71f11aec203db14f416ecf4172321200c8641cf120a1f2da8', '[\"*\"]', NULL, NULL, '2026-06-20 10:30:24', '2026-06-20 10:30:24');
INSERT INTO `personal_access_tokens` VALUES (73, 'App\\Models\\User', 2, 'auth-token', '4c37c377130d0e2b01bb9b6c04ad41c3f55122ae28f93fbe7193d43491098964', '[\"*\"]', '2026-06-20 10:30:42', NULL, '2026-06-20 10:30:27', '2026-06-20 10:30:42');
INSERT INTO `personal_access_tokens` VALUES (74, 'App\\Models\\User', 2, 'auth-token', '7b1b5b63e5bcf6f387ce248a46bbf11ecc5742312080c7061ff60f3f25162a1f', '[\"*\"]', '2026-06-20 10:31:01', NULL, '2026-06-20 10:30:46', '2026-06-20 10:31:01');
INSERT INTO `personal_access_tokens` VALUES (75, 'App\\Models\\User', 2, 'auth-token', 'd26b82e2c355cc0b43eebfe463a969648f60fb735c0fdea40ef5910c99d4cf26', '[\"*\"]', '2026-06-20 10:33:29', NULL, '2026-06-20 10:31:10', '2026-06-20 10:33:29');
INSERT INTO `personal_access_tokens` VALUES (76, 'App\\Models\\User', 2, 'auth-token', 'dd03ca6657b7d10ba6e31d8a472dcba6e67e88734c8cd7cc4179b5516165c922', '[\"*\"]', '2026-06-20 10:37:00', NULL, '2026-06-20 10:33:39', '2026-06-20 10:37:00');
INSERT INTO `personal_access_tokens` VALUES (77, 'App\\Models\\User', 2, 'auth-token', 'e2fc352491309e3297bd02fe6d3328c7937255682694a10b4cfa445602a954e6', '[\"*\"]', '2026-06-20 10:37:14', NULL, '2026-06-20 10:37:01', '2026-06-20 10:37:14');
INSERT INTO `personal_access_tokens` VALUES (78, 'App\\Models\\User', 2, 'auth-token', '30b50bf3ff64324da612cd1f4068ae2452068c47abffaeddbbe2412d9daab941', '[\"*\"]', '2026-06-20 10:37:36', NULL, '2026-06-20 10:37:15', '2026-06-20 10:37:36');
INSERT INTO `personal_access_tokens` VALUES (79, 'App\\Models\\User', 2, 'auth-token', 'be149eb6d4c8e17c90885aae3ec4a9e65752297147f8566903f5009c696ddcc1', '[\"*\"]', '2026-06-20 10:45:22', NULL, '2026-06-20 10:37:35', '2026-06-20 10:45:22');
INSERT INTO `personal_access_tokens` VALUES (80, 'App\\Models\\User', 2, 'auth-token', '260214dbaf040a90718b8af916863d9df4287216e6bc04d743fc1a3308769388', '[\"*\"]', '2026-06-20 10:48:15', NULL, '2026-06-20 10:45:32', '2026-06-20 10:48:15');
INSERT INTO `personal_access_tokens` VALUES (82, 'App\\Models\\User', 5, 'auth-token', 'b67534aba6e05b4edf22ea026ede06136cf3adb2a06845954a643d187a0b49a5', '[\"*\"]', '2026-06-20 10:58:17', NULL, '2026-06-20 10:55:22', '2026-06-20 10:58:17');
INSERT INTO `personal_access_tokens` VALUES (83, 'App\\Models\\User', 5, 'auth-token', 'bfbd29cdee84d2d8605b5d8c4eb90e0ff08c7c13bfbea6b5d05468f92966db8e', '[\"*\"]', '2026-06-20 10:59:23', NULL, '2026-06-20 10:59:03', '2026-06-20 10:59:23');
INSERT INTO `personal_access_tokens` VALUES (84, 'App\\Models\\User', 5, 'auth-token', '6088ad1e67bb88d229fb5aa97f4da93b183cac3d2d34e092077d799e937168e7', '[\"*\"]', NULL, NULL, '2026-06-20 10:59:26', '2026-06-20 10:59:26');
INSERT INTO `personal_access_tokens` VALUES (85, 'App\\Models\\User', 5, 'auth-token', '7b35a7d2ba0e2a8f4db5e823c1e3bb6a3e6ba1d1c0cf31bfee771480bec491ed', '[\"*\"]', '2026-06-20 10:59:41', NULL, '2026-06-20 10:59:27', '2026-06-20 10:59:41');
INSERT INTO `personal_access_tokens` VALUES (86, 'App\\Models\\User', 5, 'auth-token', 'da9334025926b3cb255d429ca3b2b4d00659c8e13ade419898a18bc38c3c3eee', '[\"*\"]', '2026-06-20 11:02:38', NULL, '2026-06-20 11:00:40', '2026-06-20 11:02:38');
INSERT INTO `personal_access_tokens` VALUES (87, 'App\\Models\\User', 5, 'auth-token', '8bb30735da0e71f377d44dfd0a5bbca1b5541cff4d8ce9513b9cf678b74eaed2', '[\"*\"]', '2026-06-20 11:05:55', NULL, '2026-06-20 11:02:40', '2026-06-20 11:05:55');
INSERT INTO `personal_access_tokens` VALUES (88, 'App\\Models\\User', 5, 'auth-token', '0d4204d636fb3a18310be89769865bb45e7ea53c8bc8c3b73cbad021b21940f0', '[\"*\"]', '2026-06-20 11:06:08', NULL, '2026-06-20 11:05:57', '2026-06-20 11:06:08');
INSERT INTO `personal_access_tokens` VALUES (89, 'App\\Models\\User', 5, 'auth-token', 'ea35d181f041d734ccdc4977c7f1eb78855127c4e74d2dd094b92a2075becd27', '[\"*\"]', '2026-06-20 11:06:59', NULL, '2026-06-20 11:06:29', '2026-06-20 11:06:59');
INSERT INTO `personal_access_tokens` VALUES (90, 'App\\Models\\User', 5, 'auth-token', '54afa907175442cde05bf402d0ded3f78bb3e3758d264e6fca59f4484d0ef7c6', '[\"*\"]', '2026-06-20 11:21:47', NULL, '2026-06-20 11:10:00', '2026-06-20 11:21:47');
INSERT INTO `personal_access_tokens` VALUES (91, 'App\\Models\\User', 5, 'auth-token', 'e5f6a396e3de0e997ab47a8bd75f05ccc473ce3f9b5b30911b4b65b0ff7a1f66', '[\"*\"]', '2026-06-20 11:28:49', NULL, '2026-06-20 11:21:58', '2026-06-20 11:28:49');
INSERT INTO `personal_access_tokens` VALUES (92, 'App\\Models\\User', 5, 'auth-token', '69579072aa6e0cf8382e73f419c82c24d67b4f9177b4e3a993c60e2aed4e0728', '[\"*\"]', '2026-06-20 11:34:41', NULL, '2026-06-20 11:29:17', '2026-06-20 11:34:41');
INSERT INTO `personal_access_tokens` VALUES (93, 'App\\Models\\User', 5, 'auth-token', '96159cf902de1947a5aa431d9f4419b8283de9289c5780df2161ac92a79d01cf', '[\"*\"]', '2026-06-20 11:43:02', NULL, '2026-06-20 11:34:44', '2026-06-20 11:43:02');
INSERT INTO `personal_access_tokens` VALUES (94, 'App\\Models\\User', 5, 'auth-token', '5f8af490456bcf77856634a6ff13fcde01d998ca5f33e54e85d9df1e1ee55842', '[\"*\"]', '2026-06-20 11:48:28', NULL, '2026-06-20 11:44:07', '2026-06-20 11:48:28');
INSERT INTO `personal_access_tokens` VALUES (95, 'App\\Models\\User', 5, 'auth-token', 'b70a6c91b38a28c747a5eb446e7d1fb40e1f01cbfaa2abdaaa57e1e7a3fea56c', '[\"*\"]', '2026-06-20 11:52:11', NULL, '2026-06-20 11:48:31', '2026-06-20 11:52:11');
INSERT INTO `personal_access_tokens` VALUES (96, 'App\\Models\\User', 5, 'auth-token', '732a9fdc9a88e1c1ea45f208b08e58570bcc0d2dac13b6722b159cf633487647', '[\"*\"]', '2026-06-20 11:57:16', NULL, '2026-06-20 11:52:26', '2026-06-20 11:57:16');
INSERT INTO `personal_access_tokens` VALUES (97, 'App\\Models\\User', 5, 'auth-token', 'ee3cdea8847235bc4df2c96ff625cebc2e6d842924357297b69fb6557dca2108', '[\"*\"]', '2026-06-20 12:18:39', NULL, '2026-06-20 11:57:21', '2026-06-20 12:18:39');
INSERT INTO `personal_access_tokens` VALUES (98, 'App\\Models\\User', 5, 'auth-token', '21a21bf1cf4c0a43a6c1a0eec5d25d17d430abac68a31ab97aac4a10ac35afa3', '[\"*\"]', '2026-06-20 12:30:22', NULL, '2026-06-20 12:19:46', '2026-06-20 12:30:22');
INSERT INTO `personal_access_tokens` VALUES (99, 'App\\Models\\User', 5, 'auth-token', '3162356adbfda7c07b39a84a3c21bd77c89fe192b2c2c6cf548feacad2177013', '[\"*\"]', '2026-06-20 12:39:32', NULL, '2026-06-20 12:30:28', '2026-06-20 12:39:32');
INSERT INTO `personal_access_tokens` VALUES (100, 'App\\Models\\User', 5, 'auth-token', 'fe49b8fb3e7cdaadd59a2810b949d5ae2ec2b8a837c3774f2623c46b4e5b3e39', '[\"*\"]', '2026-06-20 12:47:39', NULL, '2026-06-20 12:39:37', '2026-06-20 12:47:39');
INSERT INTO `personal_access_tokens` VALUES (101, 'App\\Models\\User', 5, 'auth-token', '293a444e0732cb5f5f699ac773d75cf85acb8f8bd64e1448c776ada591202ee5', '[\"*\"]', '2026-06-20 12:49:58', NULL, '2026-06-20 12:47:55', '2026-06-20 12:49:58');
INSERT INTO `personal_access_tokens` VALUES (102, 'App\\Models\\User', 5, 'auth-token', 'd2a686e7200ae1aa1a49eff427accb427016d03d1645b6c50e17340784de3e6b', '[\"*\"]', '2026-06-20 12:58:59', NULL, '2026-06-20 12:50:00', '2026-06-20 12:58:59');
INSERT INTO `personal_access_tokens` VALUES (103, 'App\\Models\\User', 5, 'auth-token', '7f3260aadc67619bc5b7bf2f4c41c2303f1dd45802addb4cd6c8c64b50218dd5', '[\"*\"]', '2026-06-20 13:09:50', NULL, '2026-06-20 12:59:04', '2026-06-20 13:09:50');
INSERT INTO `personal_access_tokens` VALUES (104, 'App\\Models\\User', 5, 'auth-token', '25f47de36990ab0a1f282086c91e9377612f3417081786b22322b682590e6fc2', '[\"*\"]', '2026-06-20 13:14:05', NULL, '2026-06-20 13:11:03', '2026-06-20 13:14:05');
INSERT INTO `personal_access_tokens` VALUES (105, 'App\\Models\\User', 5, 'auth-token', 'bbc065d9b77329452408f92287f8c4bf0e2c1f0e1c7c03a8b9c108487a975101', '[\"*\"]', '2026-06-21 00:47:50', NULL, '2026-06-20 13:14:28', '2026-06-21 00:47:50');
INSERT INTO `personal_access_tokens` VALUES (106, 'App\\Models\\User', 5, 'auth-token', '13410f2a65d5cc183215798209e7be983e7dedad6ada36c24732631212523e31', '[\"*\"]', '2026-06-21 01:09:58', NULL, '2026-06-21 00:47:56', '2026-06-21 01:09:58');
INSERT INTO `personal_access_tokens` VALUES (107, 'App\\Models\\User', 5, 'auth-token', '3cbd0199c5156363357af059fd8e90fe70b188ee78703f719234537b9ef05e41', '[\"*\"]', '2026-06-21 01:27:55', NULL, '2026-06-21 01:14:08', '2026-06-21 01:27:55');
INSERT INTO `personal_access_tokens` VALUES (108, 'App\\Models\\User', 5, 'auth-token', '7370257e41c19c2721bd10ae95b68621346ca2047c024de1a59b264be293e087', '[\"*\"]', '2026-06-21 01:34:30', NULL, '2026-06-21 01:28:05', '2026-06-21 01:34:30');
INSERT INTO `personal_access_tokens` VALUES (112, 'App\\Models\\User', 5, 'auth-token', '746cd80ad5acb5b75c892e447f9cd0b5bd2b3d9c07f549611d3ebc8d90d4c6b2', '[\"*\"]', NULL, NULL, '2026-06-21 01:37:48', '2026-06-21 01:37:48');
INSERT INTO `personal_access_tokens` VALUES (115, 'App\\Models\\User', 1, 'auth-token', 'a74de4bdba8d82848cdf5b85566df9e934118a202114924b1a060059bc97db43', '[\"*\"]', '2026-06-21 02:02:50', NULL, '2026-06-21 01:40:08', '2026-06-21 02:02:50');
INSERT INTO `personal_access_tokens` VALUES (116, 'App\\Models\\User', 5, 'auth-token', '9df2ca71d076341d346837a4337385eef8ed342d2b9b8d350836e271ade86a7e', '[\"*\"]', '2026-06-21 02:02:51', NULL, '2026-06-21 01:40:25', '2026-06-21 02:02:51');
INSERT INTO `personal_access_tokens` VALUES (117, 'App\\Models\\User', 5, 'auth-token', 'bd3f914d6dabb6bc742c9d8c7bf2b3dedf0b0c480a423bfc09e73ac0917296e7', '[\"*\"]', '2026-06-21 02:17:34', NULL, '2026-06-21 02:02:58', '2026-06-21 02:17:34');
INSERT INTO `personal_access_tokens` VALUES (118, 'App\\Models\\User', 1, 'auth-token', 'e27f6a4f5037ac5437cd30b9c9456adeafeac5eed96e6fd6ace7e9b31bb14e3d', '[\"*\"]', '2026-06-21 02:17:35', NULL, '2026-06-21 02:03:20', '2026-06-21 02:17:35');
INSERT INTO `personal_access_tokens` VALUES (119, 'App\\Models\\User', 5, 'auth-token', '420ef354edd867bea969af5b331e5db2313008ed1a3ab026b195717272c81ab5', '[\"*\"]', '2026-06-21 02:30:40', NULL, '2026-06-21 02:19:19', '2026-06-21 02:30:40');
INSERT INTO `personal_access_tokens` VALUES (120, 'App\\Models\\User', 1, 'auth-token', '0c3e78a608e355b3307afe7a1c10a1958009da70b52e83443c5f5023894a171d', '[\"*\"]', '2026-06-21 02:29:26', NULL, '2026-06-21 02:19:24', '2026-06-21 02:29:26');
INSERT INTO `personal_access_tokens` VALUES (121, 'App\\Models\\User', 1, 'auth-token', '071c5d9b17fe58d897cfcca818d72556feac9af03f4eed9e1cf9d57dba294431', '[\"*\"]', '2026-06-21 02:36:44', NULL, '2026-06-21 02:31:20', '2026-06-21 02:36:44');
INSERT INTO `personal_access_tokens` VALUES (122, 'App\\Models\\User', 5, 'auth-token', 'd5452a3354de800fef1a5e841d469bd281acbcef7be612ff5b8aaf2929471590', '[\"*\"]', '2026-06-21 02:36:46', NULL, '2026-06-21 02:31:24', '2026-06-21 02:36:46');
INSERT INTO `personal_access_tokens` VALUES (123, 'App\\Models\\User', 5, 'auth-token', 'c364a711e67154f70fb97ad46bedffa2a1a5535c0d13c2436ea949aa91324c69', '[\"*\"]', '2026-06-21 02:40:34', NULL, '2026-06-21 02:37:37', '2026-06-21 02:40:34');
INSERT INTO `personal_access_tokens` VALUES (124, 'App\\Models\\User', 1, 'auth-token', 'ef80a3a963874389172164c80efbd5b47745d2c6c4c74bafc21c1853e4d95986', '[\"*\"]', '2026-06-21 02:40:29', NULL, '2026-06-21 02:37:42', '2026-06-21 02:40:29');
INSERT INTO `personal_access_tokens` VALUES (125, 'App\\Models\\User', 5, 'auth-token', 'c22507b6aec8305a673245e2ea3c1b2e917f226aba19bb4ea695732400d876bb', '[\"*\"]', '2026-06-21 02:43:47', NULL, '2026-06-21 02:40:34', '2026-06-21 02:43:47');
INSERT INTO `personal_access_tokens` VALUES (126, 'App\\Models\\User', 1, 'auth-token', 'c894ee0cdaee041a25d4a5d6b902531266dfb331b6687a7281047528a82c9151', '[\"*\"]', '2026-06-21 02:43:43', NULL, '2026-06-21 02:40:40', '2026-06-21 02:43:43');
INSERT INTO `personal_access_tokens` VALUES (127, 'App\\Models\\User', 1, 'auth-token', '1d714ea50e27cca6723c57a3683083863ee22364d3d71d9f7a8fbd1588f6e90f', '[\"*\"]', '2026-06-21 02:46:07', NULL, '2026-06-21 02:43:52', '2026-06-21 02:46:07');
INSERT INTO `personal_access_tokens` VALUES (128, 'App\\Models\\User', 5, 'auth-token', 'db055b049ba554b18e181fc4945f08bcc955280808c6725312b54c1b070d27b3', '[\"*\"]', '2026-06-21 02:46:13', NULL, '2026-06-21 02:43:55', '2026-06-21 02:46:13');
INSERT INTO `personal_access_tokens` VALUES (129, 'App\\Models\\User', 1, 'auth-token', '02f097aa8adaf4e821769994285587592e29aca9847a5d62b9b4821128d85bbd', '[\"*\"]', '2026-06-21 02:48:01', NULL, '2026-06-21 02:46:34', '2026-06-21 02:48:01');
INSERT INTO `personal_access_tokens` VALUES (130, 'App\\Models\\User', 5, 'auth-token', '8f566440dd70efeeedd3237a8a69ff07dbe1d11277e4a22e15256bcbd719b50b', '[\"*\"]', '2026-06-21 02:48:00', NULL, '2026-06-21 02:46:38', '2026-06-21 02:48:00');
INSERT INTO `personal_access_tokens` VALUES (131, 'App\\Models\\User', 1, 'auth-token', 'd0806d6fa9ca352226489f77ebc59c7bcf0a7d071b4a25fa251072479f6f2c88', '[\"*\"]', '2026-06-21 02:53:06', NULL, '2026-06-21 02:48:32', '2026-06-21 02:53:06');
INSERT INTO `personal_access_tokens` VALUES (132, 'App\\Models\\User', 5, 'auth-token', '5f38cda05eb1fd0b84cc3ff682e8b47d6b0f5559c3b60bbeed0e66461138bd39', '[\"*\"]', '2026-06-21 02:53:10', NULL, '2026-06-21 02:48:36', '2026-06-21 02:53:10');
INSERT INTO `personal_access_tokens` VALUES (133, 'App\\Models\\User', 1, 'auth-token', '21a96148424dfe3867a0a62c041d5a953b5fba202328c426ed05583d77d164ad', '[\"*\"]', '2026-06-21 02:57:52', NULL, '2026-06-21 02:53:37', '2026-06-21 02:57:52');
INSERT INTO `personal_access_tokens` VALUES (134, 'App\\Models\\User', 5, 'auth-token', '2132950f9f91c1236ff68cd452cc63f8ddf75cdbb833432cd5e7f84fb1efc0f8', '[\"*\"]', '2026-06-21 02:57:53', NULL, '2026-06-21 02:53:40', '2026-06-21 02:57:53');
INSERT INTO `personal_access_tokens` VALUES (135, 'App\\Models\\User', 5, 'auth-token', '08e0c1d4ed7e7e680c5d3e3c228e01b5747695c1ffef9ab2c3054b4af8e895f0', '[\"*\"]', NULL, NULL, '2026-06-21 02:57:54', '2026-06-21 02:57:54');
INSERT INTO `personal_access_tokens` VALUES (136, 'App\\Models\\User', 5, 'auth-token', '440422c5e6584da5dc42074b97b9cd122d230c3b2b01b94331cb223046a3d933', '[\"*\"]', '2026-06-21 03:01:02', NULL, '2026-06-21 02:59:04', '2026-06-21 03:01:02');
INSERT INTO `personal_access_tokens` VALUES (137, 'App\\Models\\User', 1, 'auth-token', 'b454b2d178fe3a25c191c4eb8bb3be96384e8cd87a38cf91d9b6bdf32b395f6a', '[\"*\"]', '2026-06-21 03:01:00', NULL, '2026-06-21 02:59:09', '2026-06-21 03:01:00');
INSERT INTO `personal_access_tokens` VALUES (138, 'App\\Models\\User', 5, 'auth-token', '4f8870d54e76c9ef84690cfea76376f4d7046e54d5562ec79aa5db25ac2fb7f9', '[\"*\"]', '2026-06-21 03:04:30', NULL, '2026-06-21 03:02:01', '2026-06-21 03:04:30');
INSERT INTO `personal_access_tokens` VALUES (139, 'App\\Models\\User', 1, 'auth-token', '5b9fa85031c2ad3a2ecd80e0e9bdf841307ef478b5c3e6db8aac2c03c57b112b', '[\"*\"]', '2026-06-21 03:04:31', NULL, '2026-06-21 03:02:06', '2026-06-21 03:04:31');
INSERT INTO `personal_access_tokens` VALUES (140, 'App\\Models\\User', 1, 'auth-token', 'b1f8f98c302a49c43d9012051d470ec91d95db697cfca2af07f421f2ab4eb623', '[\"*\"]', '2026-06-21 03:13:17', NULL, '2026-06-21 03:04:39', '2026-06-21 03:13:17');
INSERT INTO `personal_access_tokens` VALUES (141, 'App\\Models\\User', 5, 'auth-token', '66ee8e55ea00d10c03b67b7dac80f9cddc1623a6cb840d771018e76759b7353c', '[\"*\"]', '2026-06-21 03:13:10', NULL, '2026-06-21 03:04:42', '2026-06-21 03:13:10');
INSERT INTO `personal_access_tokens` VALUES (142, 'App\\Models\\User', 1, 'auth-token', 'c4a28c342cbc2581ec3cbcc2efa4be56fdf93c051d66a1be2249b10d9881199f', '[\"*\"]', '2026-06-21 03:16:40', NULL, '2026-06-21 03:13:24', '2026-06-21 03:16:40');
INSERT INTO `personal_access_tokens` VALUES (143, 'App\\Models\\User', 5, 'auth-token', 'd4de52bc67cca1a479e98bafc05211bd2d061fa92cf1a60e87b9137f19bf7c18', '[\"*\"]', '2026-06-21 03:16:41', NULL, '2026-06-21 03:13:27', '2026-06-21 03:16:41');
INSERT INTO `personal_access_tokens` VALUES (144, 'App\\Models\\User', 1, 'auth-token', '8bce29af5dc2f74645cfc19a43c6473efccdb16c4bcea2218aed10cce75518ef', '[\"*\"]', '2026-06-21 03:25:21', NULL, '2026-06-21 03:16:44', '2026-06-21 03:25:21');
INSERT INTO `personal_access_tokens` VALUES (145, 'App\\Models\\User', 5, 'auth-token', '57ad859ae864bfcd4385a13c0b56fbd954f3938b748aa52a1afd536b39691c18', '[\"*\"]', '2026-06-21 03:22:27', NULL, '2026-06-21 03:16:45', '2026-06-21 03:22:27');
INSERT INTO `personal_access_tokens` VALUES (146, 'App\\Models\\User', 5, 'auth-token', '7055e473db0dc024185ee68f93ec9a7dc8de748579d8ed8272198adf18ebf2a1', '[\"*\"]', '2026-06-21 03:25:21', NULL, '2026-06-21 03:22:39', '2026-06-21 03:25:21');
INSERT INTO `personal_access_tokens` VALUES (147, 'App\\Models\\User', 5, 'auth-token', 'dbae0b587be5e3189d23ee47945fd80e5443b7a06160dd33bf0a29bb287bd388', '[\"*\"]', '2026-06-21 03:29:23', NULL, '2026-06-21 03:25:29', '2026-06-21 03:29:23');
INSERT INTO `personal_access_tokens` VALUES (148, 'App\\Models\\User', 1, 'auth-token', 'd1a2c6200d5f9b886028eb6ab5ed5740eceac3876302d7fe3e2361103fb7cc1f', '[\"*\"]', '2026-06-21 03:29:24', NULL, '2026-06-21 03:26:01', '2026-06-21 03:29:24');
INSERT INTO `personal_access_tokens` VALUES (149, 'App\\Models\\User', 5, 'auth-token', '5f9535c5d1f2218968b1df42f5b04fd80371f3089e5d7ff3f7395ac7174841fe', '[\"*\"]', '2026-06-21 04:11:08', NULL, '2026-06-21 03:32:43', '2026-06-21 04:11:08');
INSERT INTO `personal_access_tokens` VALUES (150, 'App\\Models\\User', 1, 'auth-token', 'c0911fe989114a4cbcd7b61eeff453262fb0658bcf96f517baa5537cd96f93dd', '[\"*\"]', '2026-06-21 04:11:06', NULL, '2026-06-21 03:32:49', '2026-06-21 04:11:06');
INSERT INTO `personal_access_tokens` VALUES (151, 'App\\Models\\User', 1, 'auth-token', 'd2c2378d38b520ed880b16701dc204ed006731eb97218348d15d2a5a86849731', '[\"*\"]', '2026-06-21 04:15:56', NULL, '2026-06-21 04:14:43', '2026-06-21 04:15:56');
INSERT INTO `personal_access_tokens` VALUES (152, 'App\\Models\\User', 1, 'auth-token', '336475d6732497e591bf006df694698e1ea9e31cc707d5253ae675bab19e8a50', '[\"*\"]', '2026-06-21 04:26:25', NULL, '2026-06-21 04:22:57', '2026-06-21 04:26:25');
INSERT INTO `personal_access_tokens` VALUES (153, 'App\\Models\\User', 5, 'auth-token', '7d418d4cc9cf079303e9e7a3aca481e1a3e340b1f35b262128fcc5558305498f', '[\"*\"]', '2026-06-21 04:26:26', NULL, '2026-06-21 04:23:04', '2026-06-21 04:26:26');
INSERT INTO `personal_access_tokens` VALUES (154, 'App\\Models\\User', 5, 'auth-token', 'c16b54e5c0ba1a6347f24add16d8a143fff98bb86af303b6449a3ffa60a8810b', '[\"*\"]', '2026-06-21 04:36:59', NULL, '2026-06-21 04:28:17', '2026-06-21 04:36:59');
INSERT INTO `personal_access_tokens` VALUES (155, 'App\\Models\\User', 1, 'auth-token', 'd46816bc089e6e8cdc8111ab6e998fb17df4592d52cc4892d91c79e81d88924e', '[\"*\"]', '2026-06-21 04:37:00', NULL, '2026-06-21 04:28:23', '2026-06-21 04:37:00');
INSERT INTO `personal_access_tokens` VALUES (156, 'App\\Models\\User', 1, 'auth-token', '75a2cfa025db74b6a1d65b7176d3b4100c2d57aa7682277cbe9def5d0f82ee2b', '[\"*\"]', '2026-06-21 04:41:13', NULL, '2026-06-21 04:37:07', '2026-06-21 04:41:13');
INSERT INTO `personal_access_tokens` VALUES (157, 'App\\Models\\User', 5, 'auth-token', '5813fb46bef35e1bde8411a9aaf50e64c093cae386445a4d848993f667fb66bb', '[\"*\"]', '2026-06-21 04:39:04', NULL, '2026-06-21 04:38:29', '2026-06-21 04:39:04');
INSERT INTO `personal_access_tokens` VALUES (158, 'App\\Models\\User', 1, 'auth-token', 'cb101b8d86c9fc3d49fcd29e6806700e7e49ecd276c0c15d0addadc993b857c6', '[\"*\"]', '2026-06-21 04:44:45', NULL, '2026-06-21 04:41:38', '2026-06-21 04:44:45');
INSERT INTO `personal_access_tokens` VALUES (159, 'App\\Models\\User', 1, 'auth-token', 'b71c1f0b5a4bd468415e343d67ed435fc9762ab027e85c0ed95c268c115e2bbc', '[\"*\"]', '2026-06-21 04:50:48', NULL, '2026-06-21 04:47:50', '2026-06-21 04:50:48');
INSERT INTO `personal_access_tokens` VALUES (160, 'App\\Models\\User', 1, 'auth-token', '92e7bbb982c93a396bfd40c57cbe544a686c8a22a1f121740ffd1172a0c20962', '[\"*\"]', '2026-06-21 04:56:02', NULL, '2026-06-21 04:52:00', '2026-06-21 04:56:02');
INSERT INTO `personal_access_tokens` VALUES (161, 'App\\Models\\User', 1, 'auth-token', 'c405587b8eae4bb153537839cdbe34a8d013910a2ad43f7b4be7ed7d4e06c988', '[\"*\"]', '2026-06-21 05:02:22', NULL, '2026-06-21 04:56:04', '2026-06-21 05:02:22');
INSERT INTO `personal_access_tokens` VALUES (162, 'App\\Models\\User', 5, 'auth-token', 'c63a8302556d9bd345b2c6fbee91feb2a2bb9b027ad12a190f1cde5fdfc2a43c', '[\"*\"]', '2026-06-21 05:02:21', NULL, '2026-06-21 04:59:20', '2026-06-21 05:02:21');
INSERT INTO `personal_access_tokens` VALUES (163, 'App\\Models\\User', 1, 'auth-token', '10939fde3417e5371393fcde3bcfa9d08a73694eb1b92bcfcc610128adda4e95', '[\"*\"]', '2026-06-21 06:04:45', NULL, '2026-06-21 05:03:33', '2026-06-21 06:04:45');
INSERT INTO `personal_access_tokens` VALUES (164, 'App\\Models\\User', 5, 'auth-token', 'e4c3c03913191a47881484d718806d75183c4922218c378525e035d89918d348', '[\"*\"]', '2026-06-21 05:50:56', NULL, '2026-06-21 05:07:24', '2026-06-21 05:50:56');
INSERT INTO `personal_access_tokens` VALUES (165, 'App\\Models\\User', 5, 'auth-token', '4acdc36cfbe4ad18fc554d4d2043ab2ae7f91ce4173f336b10d3a1c9bdda5027', '[\"*\"]', '2026-06-21 05:51:48', NULL, '2026-06-21 05:51:02', '2026-06-21 05:51:48');
INSERT INTO `personal_access_tokens` VALUES (166, 'App\\Models\\User', 5, 'auth-token', '1b9187fc128254e2c079d5d4c1dcd9586c177908679ad48195b885938ef47ea1', '[\"*\"]', '2026-06-21 06:04:45', NULL, '2026-06-21 05:51:53', '2026-06-21 06:04:45');
INSERT INTO `personal_access_tokens` VALUES (167, 'App\\Models\\User', 1, 'auth-token', 'bf3e2291c4df3877e59141020a9717c34e3e0fb373ff2fee9ac9bd2686b4f5f6', '[\"*\"]', '2026-06-21 06:18:20', NULL, '2026-06-21 06:07:46', '2026-06-21 06:18:20');
INSERT INTO `personal_access_tokens` VALUES (168, 'App\\Models\\User', 1, 'auth-token', 'a1b5331ff3a6d9ce39429dff01f470c7059365d89e35eba867b5dbe4a3ef7e3a', '[\"*\"]', '2026-06-21 06:31:38', NULL, '2026-06-21 06:19:36', '2026-06-21 06:31:38');
INSERT INTO `personal_access_tokens` VALUES (169, 'App\\Models\\User', 1, 'auth-token', '3d957c2552f3ee667f1f481d76f2cb17d77a07b322ca5bdba8a0a95a02f74981', '[\"*\"]', '2026-06-21 06:47:07', NULL, '2026-06-21 06:43:24', '2026-06-21 06:47:07');
INSERT INTO `personal_access_tokens` VALUES (170, 'App\\Models\\User', 1, 'auth-token', '6d691b8e7a5f5f112c18c504391303af3f7acac88278c034458e157f4655ffc9', '[\"*\"]', '2026-06-21 06:49:56', NULL, '2026-06-21 06:48:20', '2026-06-21 06:49:56');
INSERT INTO `personal_access_tokens` VALUES (171, 'App\\Models\\User', 1, 'auth-token', 'b9a15d7d12370a6691fd2a366d1f57d25745e10687130d8a9f2fb8359353815d', '[\"*\"]', '2026-06-21 11:01:31', NULL, '2026-06-21 06:50:00', '2026-06-21 11:01:31');
INSERT INTO `personal_access_tokens` VALUES (172, 'App\\Models\\User', 1, 'auth-token', '151ff419963257f7adea45898e3031e3023276018fca884b8535113d5f0f21a0', '[\"*\"]', '2026-06-21 11:09:32', NULL, '2026-06-21 11:01:38', '2026-06-21 11:09:32');
INSERT INTO `personal_access_tokens` VALUES (173, 'App\\Models\\User', 1, 'auth-token', '41b7c860f151d8509a181b7e831b39e58511d634f0440f79b106d5dc93d252f0', '[\"*\"]', '2026-06-21 11:13:10', NULL, '2026-06-21 11:11:40', '2026-06-21 11:13:10');
INSERT INTO `personal_access_tokens` VALUES (174, 'App\\Models\\User', 1, 'auth-token', 'cd4beac3c2d5baaf441a39b4e96480858224e5b1e8972616575ceb94e89476ff', '[\"*\"]', '2026-06-21 11:15:36', NULL, '2026-06-21 11:13:12', '2026-06-21 11:15:36');
INSERT INTO `personal_access_tokens` VALUES (175, 'App\\Models\\User', 1, 'auth-token', '8be407d2c673927ffd8c5c57bb8479d7c8307d1c0853580d4be2e7bef9f2bee0', '[\"*\"]', '2026-06-21 11:17:12', NULL, '2026-06-21 11:15:37', '2026-06-21 11:17:12');
INSERT INTO `personal_access_tokens` VALUES (176, 'App\\Models\\User', 1, 'auth-token', 'b187859a4370d968b9adfa750c1426eb59bb579798ff6b6009fe14f186d9334d', '[\"*\"]', '2026-06-21 11:19:57', NULL, '2026-06-21 11:18:12', '2026-06-21 11:19:57');
INSERT INTO `personal_access_tokens` VALUES (177, 'App\\Models\\User', 1, 'auth-token', '510b4571abaa09ef000e904b06e9e4f5223437840baf973670e1fc2611a7bc54', '[\"*\"]', '2026-06-21 11:22:01', NULL, '2026-06-21 11:20:18', '2026-06-21 11:22:01');
INSERT INTO `personal_access_tokens` VALUES (178, 'App\\Models\\User', 1, 'auth-token', 'd6f229db4e982874910899f2f419e670936e8135c912860b6e0d0a493fb64373', '[\"*\"]', '2026-06-21 11:28:15', NULL, '2026-06-21 11:24:00', '2026-06-21 11:28:15');
INSERT INTO `personal_access_tokens` VALUES (179, 'App\\Models\\User', 1, 'auth-token', 'ea0f17325a90db0725276cf7cbe01373bfadf97cb916aaeade940c302ce1a850', '[\"*\"]', '2026-06-21 11:33:01', NULL, '2026-06-21 11:29:38', '2026-06-21 11:33:01');
INSERT INTO `personal_access_tokens` VALUES (180, 'App\\Models\\User', 1, 'auth-token', 'f70972e1f66e8a5fdb1675283d01ac11b961571be38dbedc23ce764b58638349', '[\"*\"]', '2026-06-21 11:36:58', NULL, '2026-06-21 11:33:24', '2026-06-21 11:36:58');
INSERT INTO `personal_access_tokens` VALUES (181, 'App\\Models\\User', 5, 'auth-token', 'b34c10e7e808ea51f8fd6eecc7981180fb0943c8cf7fa60108f71d592bdffe36', '[\"*\"]', '2026-06-21 11:37:03', NULL, '2026-06-21 11:34:12', '2026-06-21 11:37:03');
INSERT INTO `personal_access_tokens` VALUES (182, 'App\\Models\\User', 1, 'auth-token', '579c674c1b08583899f6641ac944faf8cf535acd3dae89ac2ddfd828d94765ff', '[\"*\"]', '2026-06-21 11:42:19', NULL, '2026-06-21 11:38:20', '2026-06-21 11:42:19');
INSERT INTO `personal_access_tokens` VALUES (183, 'App\\Models\\User', 5, 'auth-token', 'e990b1863ea0dc961e8f44d1f2d3a7f25fb7db47de03b7232b973525f482733e', '[\"*\"]', '2026-06-21 11:42:22', NULL, '2026-06-21 11:39:36', '2026-06-21 11:42:22');
INSERT INTO `personal_access_tokens` VALUES (184, 'App\\Models\\User', 1, 'auth-token', '1bee0042a29e0001d4f1942e1d6fae014e45a95427f9c9234bf830b34a16d18a', '[\"*\"]', '2026-06-21 11:42:56', NULL, '2026-06-21 11:42:25', '2026-06-21 11:42:56');
INSERT INTO `personal_access_tokens` VALUES (185, 'App\\Models\\User', 1, 'auth-token', 'a54cc4f2cedd4a904360aabee9e0da0a4c893d912880fec5b4774f44c1b1a74a', '[\"*\"]', '2026-06-21 11:51:45', NULL, '2026-06-21 11:46:05', '2026-06-21 11:51:45');
INSERT INTO `personal_access_tokens` VALUES (188, 'App\\Models\\User', 1, 'auth-token', '142716195f631ccddf9f68f8d0435252383dbd2187651a2f7020315a1f8f1743', '[\"*\"]', '2026-06-23 12:49:00', NULL, '2026-06-23 12:39:34', '2026-06-23 12:49:00');
INSERT INTO `personal_access_tokens` VALUES (189, 'App\\Models\\User', 5, 'auth-token', '95a607e942bd44379c181ab9c8a21a85960b5e283eeb23db74b1f60a9db0d632', '[\"*\"]', '2026-06-23 12:49:06', NULL, '2026-06-23 12:39:53', '2026-06-23 12:49:06');
INSERT INTO `personal_access_tokens` VALUES (190, 'App\\Models\\User', 5, 'auth-token', '8a69bc89b57f5e6187c11e001a8f6490bd1ce837c7672a82a93ce23303a92cac', '[\"*\"]', '2026-06-23 12:49:30', NULL, '2026-06-23 12:49:11', '2026-06-23 12:49:30');
INSERT INTO `personal_access_tokens` VALUES (191, 'App\\Models\\User', 1, 'auth-token', 'd940a5f7e5515ca7c3233b0f1e9075a6ebf6f4c9f8daecb4f4d38e986a4ab1f5', '[\"*\"]', '2026-06-23 12:52:55', NULL, '2026-06-23 12:50:28', '2026-06-23 12:52:55');
INSERT INTO `personal_access_tokens` VALUES (192, 'App\\Models\\User', 5, 'auth-token', '189a308e47e2cb99323be0859499c53d139a373d33bc2daa11c16551b5686006', '[\"*\"]', '2026-06-23 12:52:59', NULL, '2026-06-23 12:50:35', '2026-06-23 12:52:59');
INSERT INTO `personal_access_tokens` VALUES (193, 'App\\Models\\User', 1, 'auth-token', '672f226963d78828870599a2a4f55ed685f4a1454c03bf132021a12dddefbb1d', '[\"*\"]', '2026-06-23 12:56:52', NULL, '2026-06-23 12:53:51', '2026-06-23 12:56:52');
INSERT INTO `personal_access_tokens` VALUES (194, 'App\\Models\\User', 5, 'auth-token', '5621b9c9490bd983222d3d7c7329686ffd218bfb96eaba6f7c9314f602680839', '[\"*\"]', '2026-06-23 12:56:52', NULL, '2026-06-23 12:54:02', '2026-06-23 12:56:52');
INSERT INTO `personal_access_tokens` VALUES (195, 'App\\Models\\User', 5, 'auth-token', 'f25b1eeb78f3b752fc1589a076d6964822463e83a61687d5b875b601cc47c4fd', '[\"*\"]', '2026-06-23 13:04:06', NULL, '2026-06-23 12:57:17', '2026-06-23 13:04:06');
INSERT INTO `personal_access_tokens` VALUES (196, 'App\\Models\\User', 1, 'auth-token', '13311c6bc0dcdef048d451d282e9e13e9d27eaa93bcbf129320bd7e9abea63d4', '[\"*\"]', '2026-06-23 13:04:05', NULL, '2026-06-23 12:57:27', '2026-06-23 13:04:05');
INSERT INTO `personal_access_tokens` VALUES (197, 'App\\Models\\User', 5, 'auth-token', 'ea84fcc95ba8693152775431782546efc5932f3e14749510ee25ce254cfa14af', '[\"*\"]', '2026-06-23 13:14:02', NULL, '2026-06-23 13:05:14', '2026-06-23 13:14:02');
INSERT INTO `personal_access_tokens` VALUES (198, 'App\\Models\\User', 1, 'auth-token', '91ae7a0bb0d763bd8ff3a5409d2d437aa2b44873092ec8d31b35e37e94f0cc35', '[\"*\"]', '2026-06-23 13:14:07', NULL, '2026-06-23 13:06:26', '2026-06-23 13:14:07');
INSERT INTO `personal_access_tokens` VALUES (199, 'App\\Models\\User', 5, 'auth-token', 'f07481d5fbdce26113cdac76af23d247ec7478020efa48a411e39760bc5edadd', '[\"*\"]', '2026-06-23 13:19:18', NULL, '2026-06-23 13:15:20', '2026-06-23 13:19:18');
INSERT INTO `personal_access_tokens` VALUES (200, 'App\\Models\\User', 5, 'auth-token', 'af8a00f4ef53cad695e56b9ace97bf4221cada9aaafe3f2f5b4d8bce4270a531', '[\"*\"]', '2026-06-23 13:20:45', NULL, '2026-06-23 13:19:19', '2026-06-23 13:20:45');
INSERT INTO `personal_access_tokens` VALUES (201, 'App\\Models\\User', 5, 'auth-token', '2633ac9a706ecd54097fd9a373bad72c9e82896cb299ef95b047630a7bebb533', '[\"*\"]', '2026-06-23 13:24:29', NULL, '2026-06-23 13:21:36', '2026-06-23 13:24:29');
INSERT INTO `personal_access_tokens` VALUES (202, 'App\\Models\\User', 5, 'auth-token', '4a1841db968852699a1aa047806c0d511d89004d852f286485d7cca5a10d2681', '[\"*\"]', '2026-06-23 13:42:03', NULL, '2026-06-23 13:24:40', '2026-06-23 13:42:03');
INSERT INTO `personal_access_tokens` VALUES (203, 'App\\Models\\User', 1, 'auth-token', '855f57bf552dfd737e5a3ad088c46c6462ab0994d6b5dde3df8519643e306854', '[\"*\"]', '2026-06-23 13:42:06', NULL, '2026-06-23 13:35:41', '2026-06-23 13:42:06');
INSERT INTO `personal_access_tokens` VALUES (204, 'App\\Models\\User', 5, 'auth-token', 'bf05f75842ff69c7ce4d935e0eea74a59097f1548a594be58301ff60c8d14ce3', '[\"*\"]', '2026-06-23 13:45:14', NULL, '2026-06-23 13:44:58', '2026-06-23 13:45:14');
INSERT INTO `personal_access_tokens` VALUES (205, 'App\\Models\\User', 5, 'auth-token', '629193b8ef3b618add20f90b236552485dd5fe30f7b9c49afcfc6112b1d0b1fd', '[\"*\"]', '2026-06-23 13:53:37', NULL, '2026-06-23 13:53:25', '2026-06-23 13:53:37');
INSERT INTO `personal_access_tokens` VALUES (206, 'App\\Models\\User', 5, 'auth-token', '601d3a122a034729132864b8d0d46f6bb3d342f7a21ae4a63ea951e284e1d15e', '[\"*\"]', '2026-06-23 14:05:57', NULL, '2026-06-23 14:05:42', '2026-06-23 14:05:57');
INSERT INTO `personal_access_tokens` VALUES (207, 'App\\Models\\User', 5, 'auth-token', '0a82892ffe60c9866078f9b377ee434479722bf3d6e5dcfd4b6801a4015fc579', '[\"*\"]', '2026-06-26 04:50:05', NULL, '2026-06-23 14:13:41', '2026-06-26 04:50:05');
INSERT INTO `personal_access_tokens` VALUES (208, 'App\\Models\\User', 1, 'auth-token', '6b8b98eeb20b5b93ea2b54dac064fa166ca4e8f258ad5225a07b35a5af5e0ed3', '[\"*\"]', '2026-06-24 11:04:04', NULL, '2026-06-23 14:26:09', '2026-06-24 11:04:04');
INSERT INTO `personal_access_tokens` VALUES (209, 'App\\Models\\User', 1, 'auth-token', 'eeb6bc0671f1c4e2c4ab27f99362d4034d9888226a61f8d7f69abf5428f07fc9', '[\"*\"]', '2026-06-24 11:17:22', NULL, '2026-06-24 11:05:29', '2026-06-24 11:17:22');
INSERT INTO `personal_access_tokens` VALUES (210, 'App\\Models\\User', 1, 'auth-token', '0051f4684f9679e21d2f3e006c2b1451417f5f94011b05a2207c84b2e1772357', '[\"*\"]', '2026-06-24 11:25:48', NULL, '2026-06-24 11:19:10', '2026-06-24 11:25:48');
INSERT INTO `personal_access_tokens` VALUES (211, 'App\\Models\\User', 1, 'auth-token', '0684191df39dd9ae6ecaeeba1a19dca424e136d418f262a81f0dd536c09402d3', '[\"*\"]', '2026-06-24 11:30:35', NULL, '2026-06-24 11:26:44', '2026-06-24 11:30:35');
INSERT INTO `personal_access_tokens` VALUES (212, 'App\\Models\\User', 1, 'auth-token', '5c93e3c7099ab2272dddc290db433af300ebdb3211c1f61fb2134201d6735c37', '[\"*\"]', '2026-06-24 11:33:35', NULL, '2026-06-24 11:31:24', '2026-06-24 11:33:35');
INSERT INTO `personal_access_tokens` VALUES (213, 'App\\Models\\User', 1, 'auth-token', '37fee417de39b6a10b0b65a84a4a096fd0c59de21d0279546a3da26a2f39c648', '[\"*\"]', '2026-06-24 11:42:57', NULL, '2026-06-24 11:34:37', '2026-06-24 11:42:57');
INSERT INTO `personal_access_tokens` VALUES (214, 'App\\Models\\User', 1, 'auth-token', 'd04e8c52ee5699488afb282e63867232ddeb6aef02969e3b70dcc5e62e17c099', '[\"*\"]', '2026-06-24 11:58:27', NULL, '2026-06-24 11:51:56', '2026-06-24 11:58:27');
INSERT INTO `personal_access_tokens` VALUES (215, 'App\\Models\\User', 1, 'auth-token', 'b797ff18cd3b47bb02fb36770b211baa7cb6d4c5e2af48115e45693b375f1c38', '[\"*\"]', '2026-06-24 12:11:57', NULL, '2026-06-24 12:03:42', '2026-06-24 12:11:57');
INSERT INTO `personal_access_tokens` VALUES (216, 'App\\Models\\User', 1, 'auth-token', 'c961054f3fd05d5aa1643e85ef0a6f1a3ede1236f942d1bd467f462608a42f76', '[\"*\"]', '2026-06-24 12:13:50', NULL, '2026-06-24 12:13:36', '2026-06-24 12:13:50');
INSERT INTO `personal_access_tokens` VALUES (217, 'App\\Models\\User', 1, 'auth-token', 'b2e3983f89ddbf5a81505b7256f288fe909e74780e0ae6751754f5c15332eaf2', '[\"*\"]', '2026-06-24 12:22:19', NULL, '2026-06-24 12:15:43', '2026-06-24 12:22:19');
INSERT INTO `personal_access_tokens` VALUES (218, 'App\\Models\\User', 1, 'auth-token', '3af288123f4eac26df438b743a9b0d3eb5ef238652f43907eff70e08cdbcec15', '[\"*\"]', '2026-06-24 12:30:34', NULL, '2026-06-24 12:27:15', '2026-06-24 12:30:34');
INSERT INTO `personal_access_tokens` VALUES (219, 'App\\Models\\User', 1, 'auth-token', '527efa48bdcc911a88c5554c0bda1c1fcd61edfded07f19fbdeb16492db60fe6', '[\"*\"]', '2026-06-24 12:34:25', NULL, '2026-06-24 12:30:44', '2026-06-24 12:34:25');
INSERT INTO `personal_access_tokens` VALUES (220, 'App\\Models\\User', 1, 'auth-token', 'cac41a51e82dd4b93cb59e438762d552ba0ce76fcc2a7d8bdc136aa3b3d6e971', '[\"*\"]', '2026-06-24 12:50:53', NULL, '2026-06-24 12:38:34', '2026-06-24 12:50:53');
INSERT INTO `personal_access_tokens` VALUES (221, 'App\\Models\\User', 1, 'auth-token', '42a67f94ac2ec8e878a7d0c77b7657fd26d98e9f184611ce05a3cd313de1f785', '[\"*\"]', '2026-06-24 12:54:23', NULL, '2026-06-24 12:54:07', '2026-06-24 12:54:23');
INSERT INTO `personal_access_tokens` VALUES (222, 'App\\Models\\User', 1, 'auth-token', '58e709b55938eb157dfff802c81b1dd30daf71658e775ed017c1527393148b53', '[\"*\"]', '2026-06-24 12:56:41', NULL, '2026-06-24 12:56:22', '2026-06-24 12:56:41');
INSERT INTO `personal_access_tokens` VALUES (223, 'App\\Models\\User', 1, 'auth-token', '9c66511f8330fdfd410fa2688bd6a112c2a8eef185327fd6b1daec21c0a4a08b', '[\"*\"]', '2026-06-24 12:57:03', NULL, '2026-06-24 12:56:59', '2026-06-24 12:57:03');
INSERT INTO `personal_access_tokens` VALUES (224, 'App\\Models\\User', 1, 'auth-token', '59498dfe3a4d8dee2cdfa9859a13fd1ae74306a6f4f67cdcf8cc9928501c1772', '[\"*\"]', '2026-06-24 12:57:57', NULL, '2026-06-24 12:57:43', '2026-06-24 12:57:57');
INSERT INTO `personal_access_tokens` VALUES (225, 'App\\Models\\User', 1, 'auth-token', '4a00179e9e0bb1cb04b3fbcdc6894e450613bd177dfadf6e1bbdbb878f040502', '[\"*\"]', '2026-06-24 13:09:35', NULL, '2026-06-24 13:04:23', '2026-06-24 13:09:35');
INSERT INTO `personal_access_tokens` VALUES (226, 'App\\Models\\User', 1, 'auth-token', '2038f5b9c9211e836e3a8f05c1a006c8392b517f9f487769056a107c068a9146', '[\"*\"]', '2026-06-24 13:22:10', NULL, '2026-06-24 13:11:35', '2026-06-24 13:22:10');
INSERT INTO `personal_access_tokens` VALUES (227, 'App\\Models\\User', 1, 'auth-token', 'f50849a1a5b37c554d152523f43d9ae96c33741703d398dcddf6262ea378fbb4', '[\"*\"]', '2026-06-24 13:30:07', NULL, '2026-06-24 13:23:40', '2026-06-24 13:30:07');
INSERT INTO `personal_access_tokens` VALUES (230, 'App\\Models\\User', 1, 'auth-token', '58171113b68acd314b9d005607e6c39b781d95c7b4310d9e95e0a0efdf83941c', '[\"*\"]', '2026-06-24 13:42:20', NULL, '2026-06-24 13:35:11', '2026-06-24 13:42:20');
INSERT INTO `personal_access_tokens` VALUES (232, 'App\\Models\\User', 5, 'auth-token', '4469d89ab71abf3c56ecd37e702fe81765c41a1b367691bf9226fa9e87443f36', '[\"*\"]', '2026-06-24 14:17:17', NULL, '2026-06-24 13:45:22', '2026-06-24 14:17:17');
INSERT INTO `personal_access_tokens` VALUES (234, 'App\\Models\\User', 1, 'auth-token', '2f965629dba6cadc97ea3da9ef7018d519c489deb5bf5105daf7b18e7e8022a5', '[\"*\"]', '2026-06-25 11:21:31', NULL, '2026-06-25 11:11:16', '2026-06-25 11:21:31');
INSERT INTO `personal_access_tokens` VALUES (235, 'App\\Models\\User', 1, 'auth-token', '7be6717cc76067a4049e2335fc2765ef1ec0bbcb323d763273379d7f7e390dd6', '[\"*\"]', '2026-06-25 11:34:34', NULL, '2026-06-25 11:22:42', '2026-06-25 11:34:34');
INSERT INTO `personal_access_tokens` VALUES (236, 'App\\Models\\User', 1, 'auth-token', '80c85082ba92963db2e4b05f57af7c6d468f43c22e3e4c9ee1522d3d174019b0', '[\"*\"]', '2026-06-25 11:39:58', NULL, '2026-06-25 11:35:53', '2026-06-25 11:39:58');
INSERT INTO `personal_access_tokens` VALUES (237, 'App\\Models\\User', 1, 'auth-token', '2b301f4c34a9a5956ea07b66c41202b52f0a001376e8dd6ea4aa83abfb49f697', '[\"*\"]', '2026-06-25 11:45:09', NULL, '2026-06-25 11:40:07', '2026-06-25 11:45:09');
INSERT INTO `personal_access_tokens` VALUES (238, 'App\\Models\\User', 1, 'auth-token', '5178e424b0e0a8f2a3d9adfac9d7506f509a48294d215d8b56464be51c4a8a50', '[\"*\"]', '2026-06-25 11:52:40', NULL, '2026-06-25 11:50:24', '2026-06-25 11:52:40');
INSERT INTO `personal_access_tokens` VALUES (239, 'App\\Models\\User', 1, 'auth-token', 'f302abdad5f3439786faa880f1ed2d3b16a0a5e21445340f53cf0f09a76c3d65', '[\"*\"]', '2026-06-25 11:53:44', NULL, '2026-06-25 11:52:41', '2026-06-25 11:53:44');
INSERT INTO `personal_access_tokens` VALUES (240, 'App\\Models\\User', 1, 'auth-token', 'b960411092ceb738ea64fa8d919fbbbeeaf827b861b3af2c27de5cf959d2d97d', '[\"*\"]', '2026-06-25 11:54:58', NULL, '2026-06-25 11:53:51', '2026-06-25 11:54:58');
INSERT INTO `personal_access_tokens` VALUES (241, 'App\\Models\\User', 1, 'auth-token', '6a9708fbdb8ce1497c4413dce4c5ec9fbcbd2239b52ee850181e9f8e8127c0ce', '[\"*\"]', '2026-06-25 11:55:59', NULL, '2026-06-25 11:55:16', '2026-06-25 11:55:59');
INSERT INTO `personal_access_tokens` VALUES (242, 'App\\Models\\User', 1, 'auth-token', 'ced70f026b0447092308464fb7a3751a42cef41b71346aa372fe0a01a59c81e2', '[\"*\"]', '2026-06-25 12:03:37', NULL, '2026-06-25 11:56:20', '2026-06-25 12:03:37');
INSERT INTO `personal_access_tokens` VALUES (243, 'App\\Models\\User', 1, 'auth-token', '12314a8f63f35b8abff59bb6da4e9b28da36e78637b0a318f2d86aaab0a4fe8d', '[\"*\"]', '2026-06-25 12:06:53', NULL, '2026-06-25 12:05:07', '2026-06-25 12:06:53');
INSERT INTO `personal_access_tokens` VALUES (244, 'App\\Models\\User', 1, 'auth-token', 'add16b425e85bbf098a140d7a64577cbb2b822391be19d127b53c04dafead307', '[\"*\"]', '2026-06-25 12:08:40', NULL, '2026-06-25 12:07:49', '2026-06-25 12:08:40');
INSERT INTO `personal_access_tokens` VALUES (245, 'App\\Models\\User', 1, 'auth-token', 'a8de33a76862b715dca806daae6b05c89a21cb550a4218ede2d0793bc419cd63', '[\"*\"]', '2026-06-25 12:16:42', NULL, '2026-06-25 12:08:55', '2026-06-25 12:16:42');
INSERT INTO `personal_access_tokens` VALUES (246, 'App\\Models\\User', 1, 'auth-token', 'f227ca3a7d50d4128f1f1bc2f6ff4b2c9ef5e6abe7fa2b00e42359aee58515e3', '[\"*\"]', '2026-06-25 12:34:37', NULL, '2026-06-25 12:22:50', '2026-06-25 12:34:37');
INSERT INTO `personal_access_tokens` VALUES (247, 'App\\Models\\User', 1, 'auth-token', '970a7aea5c4bf623f34643af3420e46cd583136980eb5bbe381c454b9c2f3e4b', '[\"*\"]', '2026-06-25 12:35:45', NULL, '2026-06-25 12:35:08', '2026-06-25 12:35:45');
INSERT INTO `personal_access_tokens` VALUES (248, 'App\\Models\\User', 1, 'auth-token', '7b763cacfc754e06fd6b8f997adeb44f96b0589839c549426a48b05cb4756518', '[\"*\"]', '2026-06-25 12:43:23', NULL, '2026-06-25 12:37:28', '2026-06-25 12:43:23');
INSERT INTO `personal_access_tokens` VALUES (250, 'App\\Models\\User', 2, 'auth-token', '9568c5e568e27bd5d5008119209bbe1ff8c3ed4c1b2c1ad5a5d643bc44be3db8', '[\"*\"]', '2026-06-25 12:48:14', NULL, '2026-06-25 12:45:45', '2026-06-25 12:48:14');
INSERT INTO `personal_access_tokens` VALUES (251, 'App\\Models\\User', 2, 'auth-token', '35c250b1b025fee19b7bb14e89d3cd354f150114b021a9989d2ed60257543f90', '[\"*\"]', '2026-06-25 12:51:12', NULL, '2026-06-25 12:48:41', '2026-06-25 12:51:12');
INSERT INTO `personal_access_tokens` VALUES (253, 'App\\Models\\User', 5, 'auth-token', '46807f962b035f2d4c62f69a0ca462fe49a101f2d6e9083286b2b9d23fd26db9', '[\"*\"]', '2026-06-25 12:55:23', NULL, '2026-06-25 12:53:30', '2026-06-25 12:55:23');
INSERT INTO `personal_access_tokens` VALUES (254, 'App\\Models\\User', 5, 'auth-token', '1b19ad5ccd2a97421e5c87678d86ad7f3165ec94e206f794339aa0d14873c513', '[\"*\"]', '2026-06-25 12:55:39', NULL, '2026-06-25 12:55:24', '2026-06-25 12:55:39');
INSERT INTO `personal_access_tokens` VALUES (255, 'App\\Models\\User', 5, 'auth-token', '4829e3a3d2b97612c32e119a0fd7d2508ee7e27e855bc6647815214a639f8017', '[\"*\"]', '2026-06-25 13:09:56', NULL, '2026-06-25 12:55:55', '2026-06-25 13:09:56');
INSERT INTO `personal_access_tokens` VALUES (257, 'App\\Models\\User', 1, 'auth-token', 'db2f60f6884305bf2817ad2234cca62ec1d57ad9fa2da9ef51e7204ecea049a6', '[\"*\"]', '2026-06-26 02:27:06', NULL, '2026-06-25 13:12:23', '2026-06-26 02:27:06');
INSERT INTO `personal_access_tokens` VALUES (258, 'App\\Models\\User', 1, 'auth-token', 'b3296f5ffd8b6883f57af40079a4b548a2276bf1accde282f07f7c1c664443a0', '[\"*\"]', '2026-06-26 02:35:47', NULL, '2026-06-26 02:31:16', '2026-06-26 02:35:47');
INSERT INTO `personal_access_tokens` VALUES (259, 'App\\Models\\User', 2, 'auth-token', 'e30cf991b140509ac32cd35ea69b4de0519943303e9403c53d967b63f8a2e6b4', '[\"*\"]', '2026-06-26 02:41:00', NULL, '2026-06-26 02:37:18', '2026-06-26 02:41:00');
INSERT INTO `personal_access_tokens` VALUES (260, 'App\\Models\\User', 2, 'auth-token', 'aaf5db77feb0f5dc9c3f11c32ce2cf76e5f4cc8f3bf2323af8cdaf98026877ca', '[\"*\"]', '2026-06-26 02:50:27', NULL, '2026-06-26 02:42:04', '2026-06-26 02:50:27');
INSERT INTO `personal_access_tokens` VALUES (263, 'App\\Models\\User', 5, 'auth-token', '95b687a1f86f2424b3d16dcdb3ee3044e07691fcccc075f3efa1a7ed8a70ed52', '[\"*\"]', '2026-06-26 03:05:40', NULL, '2026-06-26 03:03:32', '2026-06-26 03:05:40');
INSERT INTO `personal_access_tokens` VALUES (265, 'App\\Models\\User', 2, 'auth-token', '883b14c61023a5db5a563c0a0b59d58ac905412c954b136aa40c937a0f542e10', '[\"*\"]', '2026-06-26 03:16:51', NULL, '2026-06-26 03:08:57', '2026-06-26 03:16:51');
INSERT INTO `personal_access_tokens` VALUES (266, 'App\\Models\\User', 2, 'auth-token', 'fd11f1e1d1c71554a7e61aa68deffdf3cb57e1761cc11f6531e01f25647bc022', '[\"*\"]', '2026-06-26 03:31:14', NULL, '2026-06-26 03:16:54', '2026-06-26 03:31:14');
INSERT INTO `personal_access_tokens` VALUES (267, 'App\\Models\\User', 2, 'auth-token', 'c16a029e6afe5b8bc9e82b9173c68354f2fd12f020445542c59fe0054df4b203', '[\"*\"]', '2026-06-26 03:45:39', NULL, '2026-06-26 03:35:00', '2026-06-26 03:45:39');
INSERT INTO `personal_access_tokens` VALUES (268, 'App\\Models\\User', 2, 'auth-token', '56f863f936e9678ed6311830c04f3d908980b055d8d683f297234e8b2b16244a', '[\"*\"]', '2026-06-26 04:17:10', NULL, '2026-06-26 03:46:59', '2026-06-26 04:17:10');
INSERT INTO `personal_access_tokens` VALUES (269, 'App\\Models\\User', 2, 'auth-token', '5ca9b854278bc7c415bfcfe68d2eeb9ae316eaba5f5cea074dd6a78faa3f84b7', '[\"*\"]', '2026-06-26 04:26:23', NULL, '2026-06-26 04:18:51', '2026-06-26 04:26:23');
INSERT INTO `personal_access_tokens` VALUES (270, 'App\\Models\\User', 2, 'auth-token', '0ced79a7aa7bb78ebb67dbcfe2e048c90f69010b3dcd2d08361cac1fe81ad76e', '[\"*\"]', '2026-06-26 04:35:58', NULL, '2026-06-26 04:26:46', '2026-06-26 04:35:58');
INSERT INTO `personal_access_tokens` VALUES (272, 'App\\Models\\User', 5, 'auth-token', 'fad7b44e1cc1fab812505e2fb61a688870581f9edae10d26fa3a88af6c19a4fb', '[\"*\"]', '2026-06-26 04:45:05', NULL, '2026-06-26 04:40:40', '2026-06-26 04:45:05');
INSERT INTO `personal_access_tokens` VALUES (273, 'App\\Models\\User', 2, 'auth-token', '8de362eae67c09b7d1c64985ef630fa9c2ce95d016e94dda19403b1ec9d04103', '[\"*\"]', '2026-06-26 04:57:06', NULL, '2026-06-26 04:45:59', '2026-06-26 04:57:06');
INSERT INTO `personal_access_tokens` VALUES (274, 'App\\Models\\User', 2, 'auth-token', '621a1377e20701b2549b4572049442403f24a92350e1360d0ba9f2b049787ec3', '[\"*\"]', '2026-06-26 05:02:28', NULL, '2026-06-26 04:57:31', '2026-06-26 05:02:28');
INSERT INTO `personal_access_tokens` VALUES (275, 'App\\Models\\User', 2, 'auth-token', '18a5eb1320c6b7b8d1d608e7d36d4d8945f3e79fb49ea3057353d758b7965da2', '[\"*\"]', '2026-06-26 05:08:24', NULL, '2026-06-26 05:02:49', '2026-06-26 05:08:24');
INSERT INTO `personal_access_tokens` VALUES (276, 'App\\Models\\User', 2, 'auth-token', '7564d0bdf7ea3eea0f6196dff82086a5e0e59ece9aa16d75e7854a66e2cf1b72', '[\"*\"]', '2026-06-26 05:14:48', NULL, '2026-06-26 05:11:00', '2026-06-26 05:14:48');
INSERT INTO `personal_access_tokens` VALUES (277, 'App\\Models\\User', 2, 'auth-token', '1d94b1f1fcc6562f388bfbf063378c7c816d101182b51e1146592db5c1f54992', '[\"*\"]', '2026-06-26 05:16:38', NULL, '2026-06-26 05:14:53', '2026-06-26 05:16:38');
INSERT INTO `personal_access_tokens` VALUES (283, 'App\\Models\\User', 2, 'auth-token', '17162a42c021fa73ce8ea47fe4ab423c4763c248809c3a3dbba76ff3cd40376f', '[\"*\"]', '2026-06-26 05:29:58', NULL, '2026-06-26 05:29:33', '2026-06-26 05:29:58');
INSERT INTO `personal_access_tokens` VALUES (284, 'App\\Models\\User', 2, 'auth-token', '92c5e36ae5ec44ff30a32402b55d3a31f151ee1b6c0e72e4e96bb4a9131a4208', '[\"*\"]', '2026-06-26 05:30:04', NULL, '2026-06-26 05:29:49', '2026-06-26 05:30:04');
INSERT INTO `personal_access_tokens` VALUES (288, 'App\\Models\\User', 2, 'auth-token', 'c2b14b21208eb70f2d3501f5bb34d6673b4b06f8c944673fc33194f8a6a42305', '[\"*\"]', '2026-06-26 07:41:43', NULL, '2026-06-26 07:35:18', '2026-06-26 07:41:43');
INSERT INTO `personal_access_tokens` VALUES (289, 'App\\Models\\User', 2, 'auth-token', 'abfc15270fe05e9d1435a8f3018fd98e2af15748ee80f6785fce9472a7cce478', '[\"*\"]', '2026-06-26 07:49:02', NULL, '2026-06-26 07:42:06', '2026-06-26 07:49:02');
INSERT INTO `personal_access_tokens` VALUES (290, 'App\\Models\\User', 2, 'auth-token', '172fe9a097f2c468900d707b96b91919d63ea5c69912e422806c19223d0d0955', '[\"*\"]', '2026-06-26 07:52:41', NULL, '2026-06-26 07:49:08', '2026-06-26 07:52:41');
INSERT INTO `personal_access_tokens` VALUES (293, 'App\\Models\\User', 2, 'auth-token', 'ca9940847c60d5527e5df578677241816bec755cddc8c4320d46f0cc596d9cf3', '[\"*\"]', '2026-06-26 07:58:25', NULL, '2026-06-26 07:57:36', '2026-06-26 07:58:25');
INSERT INTO `personal_access_tokens` VALUES (294, 'App\\Models\\User', 5, 'auth-token', '2f00e5bc284f3b57026705f5fbd2953418d0c8a4b8caa272191fffa3dab71aa2', '[\"*\"]', '2026-06-26 08:07:45', NULL, '2026-06-26 07:59:53', '2026-06-26 08:07:45');
INSERT INTO `personal_access_tokens` VALUES (298, 'App\\Models\\User', 5, 'auth-token', 'ab6dd8940a01c12eedac8a6e4a8acecc7e705b4d3d2f79a3360e63a92152e0dd', '[\"*\"]', '2026-06-26 08:49:21', NULL, '2026-06-26 08:14:46', '2026-06-26 08:49:21');
INSERT INTO `personal_access_tokens` VALUES (299, 'App\\Models\\User', 2, 'auth-token', 'f464614f83a2c7be5422329f65c44294f9e63ccb6843c4faf54ce76cf76d94f0', '[\"*\"]', '2026-06-26 08:49:20', NULL, '2026-06-26 08:18:00', '2026-06-26 08:49:20');
INSERT INTO `personal_access_tokens` VALUES (300, 'App\\Models\\User', 2, 'auth-token', '1f67fe9258d7e1c490d5c52390e91d3cb43b147cf0ef84bbb0c1a09a4e5a518c', '[\"*\"]', '2026-06-26 08:54:21', NULL, '2026-06-26 08:53:03', '2026-06-26 08:54:21');
INSERT INTO `personal_access_tokens` VALUES (301, 'App\\Models\\User', 5, 'auth-token', '421994ae3ac8b27a48dd8736da33794ffe1f7126172a41789865c5b70ee363d5', '[\"*\"]', '2026-06-26 08:54:20', NULL, '2026-06-26 08:53:47', '2026-06-26 08:54:20');
INSERT INTO `personal_access_tokens` VALUES (302, 'App\\Models\\User', 5, 'auth-token', 'd061fd0eeb484b4f515581519f33d4164d6fa60e8686c45383054e772ef29cd1', '[\"*\"]', '2026-06-26 10:16:44', NULL, '2026-06-26 08:54:59', '2026-06-26 10:16:44');
INSERT INTO `personal_access_tokens` VALUES (305, 'App\\Models\\User', 1, 'auth-token', '918c2b5d13e909909819a88b01808446fc848c2cb5cb94cc784a09484e228be1', '[\"*\"]', '2026-06-26 10:16:44', NULL, '2026-06-26 09:04:35', '2026-06-26 10:16:44');
INSERT INTO `personal_access_tokens` VALUES (306, 'App\\Models\\User', 1, 'auth-token', '4d9acca002960f6755071dabeb59d5d5929c301907ff4be91ae60a581500c3c3', '[\"*\"]', '2026-06-26 10:24:46', NULL, '2026-06-26 10:19:07', '2026-06-26 10:24:46');
INSERT INTO `personal_access_tokens` VALUES (307, 'App\\Models\\User', 1, 'auth-token', '5a580ff6c1fc392b8628de579f88f90942f9b2476c42ca9107ca906c8144f8ce', '[\"*\"]', '2026-06-26 11:55:54', NULL, '2026-06-26 10:30:23', '2026-06-26 11:55:54');
INSERT INTO `personal_access_tokens` VALUES (308, 'App\\Models\\User', 1, 'auth-token', '9d0cdb6febd439cd6de11f39b5d4fb1310e800c1f700b239e20d6c072f5759bd', '[\"*\"]', '2026-06-27 03:09:03', NULL, '2026-06-26 12:05:57', '2026-06-27 03:09:03');
INSERT INTO `personal_access_tokens` VALUES (311, 'App\\Models\\User', 1, 'auth-token', '8db51043f74908eecf99594b4d90a70e1b7e0e635887797eda9baea076bb3e61', '[\"*\"]', '2026-06-26 13:09:30', NULL, '2026-06-26 13:05:24', '2026-06-26 13:09:30');
INSERT INTO `personal_access_tokens` VALUES (313, 'App\\Models\\User', 1, 'auth-token', '17cd201963fbacb3562c39e8e3e58b2277ac0d6ae9c826e4b208b805b7b76497', '[\"*\"]', '2026-06-26 13:13:24', NULL, '2026-06-26 13:11:41', '2026-06-26 13:13:24');
INSERT INTO `personal_access_tokens` VALUES (314, 'App\\Models\\User', 1, 'auth-token', '043e1f8c5f479d061d0eafbd02ba6c994bd577649608c0c04836668b561f793b', '[\"*\"]', '2026-06-26 13:17:51', NULL, '2026-06-26 13:13:38', '2026-06-26 13:17:51');
INSERT INTO `personal_access_tokens` VALUES (315, 'App\\Models\\User', 1, 'auth-token', '0e0455c06102d3ed8acc45ba909bcfb516b22fe9978aea077b14a41dce99acbd', '[\"*\"]', '2026-06-26 13:28:24', NULL, '2026-06-26 13:19:48', '2026-06-26 13:28:24');
INSERT INTO `personal_access_tokens` VALUES (319, 'App\\Models\\User', 1, 'auth-token', 'cd49baeeb87edbb2ba39b185d22b0b3ff02a019d325130d96775eac99880970b', '[\"*\"]', '2026-06-26 13:50:48', NULL, '2026-06-26 13:34:55', '2026-06-26 13:50:48');
INSERT INTO `personal_access_tokens` VALUES (320, 'App\\Models\\User', 1, 'auth-token', 'b9ccdeaa71d5038979f2a2a7234078ca1bb1f7e8b4d167512dfe739b611190aa', '[\"*\"]', '2026-06-26 14:02:03', NULL, '2026-06-26 13:51:48', '2026-06-26 14:02:03');
INSERT INTO `personal_access_tokens` VALUES (321, 'App\\Models\\User', 1, 'auth-token', '4ac71f723343b71cddf70aeff8a79e692fa9d6eb5a356939aecc15e9de234f61', '[\"*\"]', '2026-06-26 14:07:38', NULL, '2026-06-26 14:03:54', '2026-06-26 14:07:38');
INSERT INTO `personal_access_tokens` VALUES (322, 'App\\Models\\User', 1, 'auth-token', 'c2069827d967bb9cdeea836d8ce19c7440868a788b396f0bc97df39b7b175bbc', '[\"*\"]', '2026-06-27 00:55:53', NULL, '2026-06-27 00:43:24', '2026-06-27 00:55:53');
INSERT INTO `personal_access_tokens` VALUES (323, 'App\\Models\\User', 1, 'auth-token', '20e03484782666fd1389bbf26f7c319bfa91d731f7380b425387184e48184d96', '[\"*\"]', '2026-06-27 01:20:52', NULL, '2026-06-27 00:56:05', '2026-06-27 01:20:52');
INSERT INTO `personal_access_tokens` VALUES (324, 'App\\Models\\User', 1, 'auth-token', '1b7faf0f71e47fe50f724ff6054ecb14c35e23f149117f876b9ac6e4f8b45338', '[\"*\"]', '2026-06-27 01:28:49', NULL, '2026-06-27 01:26:40', '2026-06-27 01:28:49');
INSERT INTO `personal_access_tokens` VALUES (325, 'App\\Models\\User', 1, 'auth-token', '73f0df4e7486775f02213e913275729c3ac116b190e621173e6d4124a7aecfed', '[\"*\"]', '2026-06-27 01:31:11', NULL, '2026-06-27 01:28:52', '2026-06-27 01:31:11');
INSERT INTO `personal_access_tokens` VALUES (326, 'App\\Models\\User', 1, 'auth-token', '87ce5356498ed0e53a2036acf5cdf6fd1a2928dead9481e52684e340a5523965', '[\"*\"]', '2026-06-27 01:35:27', NULL, '2026-06-27 01:32:03', '2026-06-27 01:35:27');
INSERT INTO `personal_access_tokens` VALUES (327, 'App\\Models\\User', 1, 'auth-token', '50850e87c02816899df64c738049d7fa5a861e75c970013f47a70511a6dcfc50', '[\"*\"]', '2026-06-27 01:40:39', NULL, '2026-06-27 01:35:30', '2026-06-27 01:40:39');
INSERT INTO `personal_access_tokens` VALUES (328, 'App\\Models\\User', 1, 'auth-token', 'a5363f8436a98ab4b0b62f02c4a0ef9766e2386a2a8c6b8ea07eeb51276e9b52', '[\"*\"]', '2026-06-27 01:49:15', NULL, '2026-06-27 01:42:34', '2026-06-27 01:49:15');
INSERT INTO `personal_access_tokens` VALUES (329, 'App\\Models\\User', 1, 'auth-token', 'f9b185579c9dcadad4b473065398c213c9d33a3e18666544dc10ce419041464d', '[\"*\"]', '2026-06-27 01:55:21', NULL, '2026-06-27 01:49:44', '2026-06-27 01:55:21');
INSERT INTO `personal_access_tokens` VALUES (330, 'App\\Models\\User', 1, 'auth-token', 'be4baecc6b310a8fc9087a0b87ec1e8e827df11a3f733b1aeb5fbddec3b0d865', '[\"*\"]', '2026-06-27 01:56:54', NULL, '2026-06-27 01:55:43', '2026-06-27 01:56:54');
INSERT INTO `personal_access_tokens` VALUES (331, 'App\\Models\\User', 1, 'auth-token', '91abc162041a2ea37077e1eee40e13f5d4ba3112def022ae67760af3c7917b38', '[\"*\"]', '2026-06-27 01:59:20', NULL, '2026-06-27 01:56:54', '2026-06-27 01:59:20');
INSERT INTO `personal_access_tokens` VALUES (332, 'App\\Models\\User', 1, 'auth-token', 'cfc66cd543ee6f7c3405a3615fb5fe593e24d37dd709e890e4ae2c70086791ba', '[\"*\"]', '2026-06-27 02:01:02', NULL, '2026-06-27 01:59:29', '2026-06-27 02:01:02');
INSERT INTO `personal_access_tokens` VALUES (333, 'App\\Models\\User', 1, 'auth-token', 'cf9d51a276a6941dbb716ec1ca85427953d011c26bf88780d15686b37e32871c', '[\"*\"]', '2026-06-27 02:06:52', NULL, '2026-06-27 02:01:14', '2026-06-27 02:06:52');
INSERT INTO `personal_access_tokens` VALUES (335, 'App\\Models\\User', 1, 'auth-token', '826b52afd9bb026d92649e0b9a083d6f4e967e08ff6d6bc2c9cb2d735cc529a7', '[\"*\"]', '2026-06-27 02:10:25', NULL, '2026-06-27 02:08:37', '2026-06-27 02:10:25');
INSERT INTO `personal_access_tokens` VALUES (336, 'App\\Models\\User', 1, 'auth-token', '23e68fc8041cb771e6a4d4cffd4f60955cc589ed9c1c97c1d5b0f8d6475bda78', '[\"*\"]', '2026-06-27 02:11:03', NULL, '2026-06-27 02:10:46', '2026-06-27 02:11:03');
INSERT INTO `personal_access_tokens` VALUES (339, 'App\\Models\\User', 1, 'auth-token', 'a152564030f4fbd360dd98f7b84278b60aa9a71663446aae2e375265362921a1', '[\"*\"]', '2026-06-27 02:19:25', NULL, '2026-06-27 02:18:48', '2026-06-27 02:19:25');
INSERT INTO `personal_access_tokens` VALUES (340, 'App\\Models\\User', 1, 'auth-token', 'b8c0276e70f80946da21808a1ab60a7960026c0156d7d095c5f52734d480ceeb', '[\"*\"]', '2026-06-27 02:31:05', NULL, '2026-06-27 02:20:31', '2026-06-27 02:31:05');
INSERT INTO `personal_access_tokens` VALUES (341, 'App\\Models\\User', 1, 'auth-token', 'dd808ccdec12a3ec929191fd2e963e0fc002b4cfcd4d1376c49fda5c07f5a9d7', '[\"*\"]', '2026-06-27 02:39:31', NULL, '2026-06-27 02:33:34', '2026-06-27 02:39:31');
INSERT INTO `personal_access_tokens` VALUES (342, 'App\\Models\\User', 1, 'auth-token', '706911058bcc1559807af6eb7063fb8c160fbda427ebb057664abafb17f98f4f', '[\"*\"]', '2026-06-27 02:51:42', NULL, '2026-06-27 02:40:18', '2026-06-27 02:51:42');
INSERT INTO `personal_access_tokens` VALUES (343, 'App\\Models\\User', 1, 'auth-token', '3d8aefbc1e2f8721f58320c62969e13b6c6e57eb8e332d12f785c57b04ff164b', '[\"*\"]', '2026-06-27 03:09:10', NULL, '2026-06-27 02:52:03', '2026-06-27 03:09:10');
INSERT INTO `personal_access_tokens` VALUES (344, 'App\\Models\\User', 1, 'auth-token', 'df0334900fc9deb115967df0305ee31c1a0a940d3c5fdab762b245c41e714367', '[\"*\"]', '2026-06-27 03:15:30', NULL, '2026-06-27 03:09:39', '2026-06-27 03:15:30');
INSERT INTO `personal_access_tokens` VALUES (346, 'App\\Models\\User', 1, 'auth-token', '860918ae75dbd807bb9fc80285318c3d4dd01917ef5fbe69fcfc0c42831e284b', '[\"*\"]', '2026-06-27 06:31:52', NULL, '2026-06-27 06:01:42', '2026-06-27 06:31:52');
INSERT INTO `personal_access_tokens` VALUES (347, 'App\\Models\\User', 5, 'auth-token', 'c826b24624b3490492abdf7f130a5eb36223ee329da9b78fcda1f971d3cb0eef', '[\"*\"]', '2026-06-27 06:31:42', NULL, '2026-06-27 06:27:24', '2026-06-27 06:31:42');
INSERT INTO `personal_access_tokens` VALUES (348, 'App\\Models\\User', 1, 'auth-token', '4c3e341e751c6400071ce5b17de858ef8f983487cbab576d6bfb34cfde13fdd6', '[\"*\"]', '2026-06-27 06:43:59', NULL, '2026-06-27 06:33:40', '2026-06-27 06:43:59');
INSERT INTO `personal_access_tokens` VALUES (349, 'App\\Models\\User', 5, 'auth-token', 'f0af37e3bfbbaa0dc1cc804d6590ff4a5ab825847f3cd918fb498f4bda733648', '[\"*\"]', '2026-06-27 06:35:15', NULL, '2026-06-27 06:33:45', '2026-06-27 06:35:15');
INSERT INTO `personal_access_tokens` VALUES (350, 'App\\Models\\User', 5, 'auth-token', 'd996b7b9102f9e7fc75709a75721641a2cd405c971a89dfb7d448165156d5e53', '[\"*\"]', '2026-06-27 06:44:01', NULL, '2026-06-27 06:35:24', '2026-06-27 06:44:01');
INSERT INTO `personal_access_tokens` VALUES (351, 'App\\Models\\User', 1, 'auth-token', '9d353afdb1bf664546dcdae3962987fe6c488a3d6d1993c449084ea77bd955de', '[\"*\"]', '2026-06-27 06:44:41', NULL, '2026-06-27 06:44:02', '2026-06-27 06:44:41');
INSERT INTO `personal_access_tokens` VALUES (352, 'App\\Models\\User', 1, 'auth-token', 'e4da494d67abfbc8d7752624b9cb5621da0362d2536d76e8d9be27d7aa3a99fd', '[\"*\"]', '2026-06-27 07:07:42', NULL, '2026-06-27 06:50:58', '2026-06-27 07:07:42');
INSERT INTO `personal_access_tokens` VALUES (353, 'App\\Models\\User', 5, 'auth-token', '15b474672ac0e61c51976a975f83fec6a23b1dfa23b74817bb20aa9508b3f575', '[\"*\"]', '2026-06-27 09:12:13', NULL, '2026-06-27 07:03:04', '2026-06-27 09:12:13');
INSERT INTO `personal_access_tokens` VALUES (354, 'App\\Models\\User', 1, 'auth-token', 'd2b2383efd6a77495fbc16f28468ca79f4fd5c51c4545f7dbaf2ca9a2122f515', '[\"*\"]', '2026-06-27 07:25:53', NULL, '2026-06-27 07:09:56', '2026-06-27 07:25:53');
INSERT INTO `personal_access_tokens` VALUES (355, 'App\\Models\\User', 1, 'auth-token', '0ec9b71cbe940719ee2f2518a105eef3da51f53164fa1e3020b2221a9be4c065', '[\"*\"]', '2026-06-27 09:12:10', NULL, '2026-06-27 07:52:51', '2026-06-27 09:12:10');
INSERT INTO `personal_access_tokens` VALUES (356, 'App\\Models\\User', 1, 'auth-token', 'bfdc360f1e40bcf00d7b010d4ba051fd308a8957b67c22751dde032a039a0e5a', '[\"*\"]', '2026-06-27 09:42:52', NULL, '2026-06-27 09:13:54', '2026-06-27 09:42:52');
INSERT INTO `personal_access_tokens` VALUES (357, 'App\\Models\\User', 2, 'auth-token', 'a233da224898f169824b58e16dd5cc62ec6305d3c26b278cdb135ecc92b26482', '[\"*\"]', '2026-06-27 09:42:48', NULL, '2026-06-27 09:18:21', '2026-06-27 09:42:48');
INSERT INTO `personal_access_tokens` VALUES (358, 'App\\Models\\User', 1, 'auth-token', 'b2bd379084f1e8c6a806c522252a6cd172834282c47f1ecd3ed7d357ec7c4545', '[\"*\"]', '2026-06-27 09:44:15', NULL, '2026-06-27 09:43:49', '2026-06-27 09:44:15');
INSERT INTO `personal_access_tokens` VALUES (359, 'App\\Models\\User', 1, 'auth-token', '79748f96e6d14290486c61c39ef94f83fe77670d98fd4ea7cac056e7731c51e3', '[\"*\"]', '2026-06-27 09:52:39', NULL, '2026-06-27 09:44:39', '2026-06-27 09:52:39');
INSERT INTO `personal_access_tokens` VALUES (360, 'App\\Models\\User', 1, 'auth-token', 'bcddce1ea4a9d41a92236029241f9037798d20c6523bf63d2839ad00bf549120', '[\"*\"]', '2026-06-27 11:46:24', NULL, '2026-06-27 11:01:23', '2026-06-27 11:46:24');
INSERT INTO `personal_access_tokens` VALUES (361, 'App\\Models\\User', 1, 'auth-token', '09a4f26bdf80d8a144bb1f7d09f7601476be1dabef12c3a8ff521d38c2bb7806', '[\"*\"]', '2026-06-27 11:46:58', NULL, '2026-06-27 11:46:25', '2026-06-27 11:46:58');
INSERT INTO `personal_access_tokens` VALUES (362, 'App\\Models\\User', 2, 'auth-token', '7a00e9986da141bc1790edb434dd38c517986d82e22ac91eab53b85de3ab5d4c', '[\"*\"]', '2026-06-27 11:47:19', NULL, '2026-06-27 11:46:58', '2026-06-27 11:47:19');
INSERT INTO `personal_access_tokens` VALUES (363, 'App\\Models\\User', 1, 'auth-token', '90c27a218614e19b53eaffd5789fd4a552a7d798a4563bc24cadfb99b4c42765', '[\"*\"]', '2026-06-27 12:06:01', NULL, '2026-06-27 11:54:00', '2026-06-27 12:06:01');
INSERT INTO `personal_access_tokens` VALUES (364, 'App\\Models\\User', 1, 'auth-token', '5c00be2082e584e5b199c4700c98ed5e0518b3f21596f5fc938d9bc35485bb96', '[\"*\"]', '2026-06-27 12:25:35', NULL, '2026-06-27 12:19:27', '2026-06-27 12:25:35');
INSERT INTO `personal_access_tokens` VALUES (365, 'App\\Models\\User', 1, 'auth-token', '49a2cbfe2cf60d4a21d0367d41c57b1fbb43673db3ef00072b7d472d0051138b', '[\"*\"]', '2026-06-27 12:31:40', NULL, '2026-06-27 12:27:17', '2026-06-27 12:31:40');
INSERT INTO `personal_access_tokens` VALUES (369, 'App\\Models\\User', 1, 'auth-token', 'ce9e911da036e7381f6ca10a5189f98266455816c1fe4250396a98866f6e9560', '[\"*\"]', '2026-06-28 01:18:31', NULL, '2026-06-28 00:36:14', '2026-06-28 01:18:31');
INSERT INTO `personal_access_tokens` VALUES (370, 'App\\Models\\User', 1, 'auth-token', '7f000d27aa9985318c35dbf89d830a57109e22193a79a143cee28bbad2a96baf', '[\"*\"]', '2026-06-28 01:25:42', NULL, '2026-06-28 01:19:31', '2026-06-28 01:25:42');
INSERT INTO `personal_access_tokens` VALUES (371, 'App\\Models\\User', 1, 'auth-token', 'dc0bcedf67140ad60e3baf5963b5cde8e2c98bf9a94c2e9815efcd83c76c836c', '[\"*\"]', '2026-06-28 01:34:53', NULL, '2026-06-28 01:30:10', '2026-06-28 01:34:53');
INSERT INTO `personal_access_tokens` VALUES (372, 'App\\Models\\User', 1, 'auth-token', '6ffc896b65dde8ab2032f0875b9c3bfbb5e791d6cbc63ff3ef027bb658e1a537', '[\"*\"]', '2026-06-28 01:52:14', NULL, '2026-06-28 01:35:57', '2026-06-28 01:52:14');
INSERT INTO `personal_access_tokens` VALUES (373, 'App\\Models\\User', 4, 'auth-token', '3b59d72ff34b43155bd727cc4e8cacd658e8aa6a56287f141be027eb564add7e', '[\"*\"]', '2026-06-28 02:18:08', NULL, '2026-06-28 01:36:55', '2026-06-28 02:18:08');
INSERT INTO `personal_access_tokens` VALUES (374, 'App\\Models\\User', 1, 'auth-token', 'b9cf0b7e59cfbdfa402b932c95b3b6b43c00e84986bbe6f0221346b8cf84410c', '[\"*\"]', '2026-06-28 02:18:11', NULL, '2026-06-28 01:56:44', '2026-06-28 02:18:11');
INSERT INTO `personal_access_tokens` VALUES (375, 'App\\Models\\User', 1, 'auth-token', '7337f8295b4957612269523a4c5eb73de89ffd5004dbeeedd5d7def69c53f1d5', '[\"*\"]', '2026-06-28 02:33:52', NULL, '2026-06-28 02:20:24', '2026-06-28 02:33:52');
INSERT INTO `personal_access_tokens` VALUES (376, 'App\\Models\\User', 4, 'auth-token', '66b5353b669f6adc208f48d5693da46276ec77fbb0128685804990a94626b2eb', '[\"*\"]', '2026-06-28 02:33:51', NULL, '2026-06-28 02:20:36', '2026-06-28 02:33:51');
INSERT INTO `personal_access_tokens` VALUES (377, 'App\\Models\\User', 1, 'auth-token', '4684abbf43f839dd7419a4a4bfc19a46b00d055ed5f843d8806bcbed8c5a58e2', '[\"*\"]', '2026-06-28 02:46:06', NULL, '2026-06-28 02:35:14', '2026-06-28 02:46:06');
INSERT INTO `personal_access_tokens` VALUES (378, 'App\\Models\\User', 4, 'auth-token', 'a7bf29112dfbcc62c5aec065f5ec9d085f63d586227ca879651cfe188fbd952d', '[\"*\"]', '2026-06-28 02:45:57', NULL, '2026-06-28 02:35:19', '2026-06-28 02:45:57');
INSERT INTO `personal_access_tokens` VALUES (379, 'App\\Models\\User', 1, 'auth-token', 'cb88d2d5461ecd2947fa99b39172fec5508854fa8008c5d511a743a74e651cd4', '[\"*\"]', '2026-06-28 02:56:45', NULL, '2026-06-28 02:47:58', '2026-06-28 02:56:45');
INSERT INTO `personal_access_tokens` VALUES (380, 'App\\Models\\User', 4, 'auth-token', 'a995f64481f28bcb8b5627429ed6ea8fe3f65faff301fe5ca8361eeb571b41d8', '[\"*\"]', '2026-06-28 02:56:45', NULL, '2026-06-28 02:48:03', '2026-06-28 02:56:45');
INSERT INTO `personal_access_tokens` VALUES (381, 'App\\Models\\User', 1, 'auth-token', '8fb75202b0c8080104f87b1c9b8cc0591739ef0af1a426a1a2a07071bcc3eb77', '[\"*\"]', '2026-06-28 03:08:18', NULL, '2026-06-28 03:00:01', '2026-06-28 03:08:18');
INSERT INTO `personal_access_tokens` VALUES (382, 'App\\Models\\User', 4, 'auth-token', '6e46b1b4a440e836a0975d752d8b09a47c0e56d2d225ea68ea2d4c0359b0fd84', '[\"*\"]', '2026-06-28 03:08:17', NULL, '2026-06-28 03:03:32', '2026-06-28 03:08:17');
INSERT INTO `personal_access_tokens` VALUES (383, 'App\\Models\\User', 1, 'auth-token', 'dde35e56c078f2b5a9456f9923e367c4d6c3bcf068ac23d7d7bf80a892a38bab', '[\"*\"]', '2026-06-28 03:25:17', NULL, '2026-06-28 03:08:25', '2026-06-28 03:25:17');
INSERT INTO `personal_access_tokens` VALUES (384, 'App\\Models\\User', 2, 'auth-token', 'd4b0df73b76e4ea702f4f3c5a91089db742e88dae40214274ed3d62792f4fb0c', '[\"*\"]', '2026-06-28 03:25:14', NULL, '2026-06-28 03:12:09', '2026-06-28 03:25:14');
INSERT INTO `personal_access_tokens` VALUES (385, 'App\\Models\\User', 1, 'auth-token', 'e52fda6b9db2c79e78863e64fbd332b3ff13475f5cd107f37643672cc55ff681', '[\"*\"]', '2026-06-28 03:46:48', NULL, '2026-06-28 03:35:03', '2026-06-28 03:46:48');
INSERT INTO `personal_access_tokens` VALUES (386, 'App\\Models\\User', 1, 'auth-token', '0d4e593685f78f39ef607ae4a22207b65368aee2499ec21563a7aff3204ba214', '[\"*\"]', '2026-06-28 03:56:31', NULL, '2026-06-28 03:47:31', '2026-06-28 03:56:31');
INSERT INTO `personal_access_tokens` VALUES (387, 'App\\Models\\User', 1, 'auth-token', '8749ea54b098894ec2de0fecd3b7a239749422dadd6ebc3f92076455c324c60d', '[\"*\"]', '2026-06-28 04:04:58', NULL, '2026-06-28 03:59:12', '2026-06-28 04:04:58');
INSERT INTO `personal_access_tokens` VALUES (388, 'App\\Models\\User', 1, 'auth-token', '8540b6db81f07d0c9011cefb42e64fab7b769221ac615f8add7cb22fd330cb89', '[\"*\"]', '2026-06-28 04:08:45', NULL, '2026-06-28 04:04:58', '2026-06-28 04:08:45');
INSERT INTO `personal_access_tokens` VALUES (393, 'App\\Models\\User', 1, 'auth-token', '1302ac433cf730515f2cb15a91c82dce7bb49d41051c05b81f969087e4bfdebf', '[\"*\"]', '2026-06-28 06:12:59', NULL, '2026-06-28 06:06:04', '2026-06-28 06:12:59');
INSERT INTO `personal_access_tokens` VALUES (395, 'App\\Models\\User', 2, 'auth-token', '32404645943109a9889defb793b741bb093738df9ffd9bef254b0034d7bdb90b', '[\"*\"]', '2026-06-28 06:15:13', NULL, '2026-06-28 06:13:33', '2026-06-28 06:15:13');
INSERT INTO `personal_access_tokens` VALUES (399, 'App\\Models\\User', 2, 'auth-token', 'd60eca7eff8c1bfd9a0449b0c28981b8c51730cd56420e80e33f736336d673c9', '[\"*\"]', '2026-06-28 06:21:22', NULL, '2026-06-28 06:20:00', '2026-06-28 06:21:22');
INSERT INTO `personal_access_tokens` VALUES (402, 'App\\Models\\User', 1, 'auth-token', 'd592b18474159a9e9d267c6605021c81ae56964a960450e5828d7c605adf0058', '[\"*\"]', '2026-06-28 06:25:48', NULL, '2026-06-28 06:25:01', '2026-06-28 06:25:48');
INSERT INTO `personal_access_tokens` VALUES (406, 'App\\Models\\User', 1, 'auth-token', '9f0863ce8b021813f965f3b8670f6d6ec8adcd444ac660f8dbf4a44d1b8a86c0', '[\"*\"]', '2026-06-28 06:37:17', NULL, '2026-06-28 06:28:07', '2026-06-28 06:37:17');
INSERT INTO `personal_access_tokens` VALUES (407, 'App\\Models\\User', 2, 'auth-token', '2d6240a6617f67b58777fb45a9c3fe9ff0cc5e3850cbf9f1d8dfd6070448ebb6', '[\"*\"]', '2026-06-28 06:37:17', NULL, '2026-06-28 06:28:58', '2026-06-28 06:37:17');
INSERT INTO `personal_access_tokens` VALUES (409, 'App\\Models\\User', 2, 'auth-token', 'addc187535b597e55d5d4484c437677103d304730cfeb690665593ae531afa8b', '[\"*\"]', '2026-06-28 06:43:03', NULL, '2026-06-28 06:42:08', '2026-06-28 06:43:03');
INSERT INTO `personal_access_tokens` VALUES (410, 'App\\Models\\User', 1, 'auth-token', 'f7485896961c626a2b62dfe013d3bc0659cb5e31493af5f6e93479e4c2ff1014', '[\"*\"]', '2026-06-28 06:46:43', NULL, '2026-06-28 06:43:18', '2026-06-28 06:46:43');
INSERT INTO `personal_access_tokens` VALUES (411, 'App\\Models\\User', 2, 'auth-token', '673d849eab34e33b21ab6ede99ddf21637c9c54a772501ef30dc7ab205e23b96', '[\"*\"]', '2026-06-28 06:46:36', NULL, '2026-06-28 06:43:21', '2026-06-28 06:46:36');
INSERT INTO `personal_access_tokens` VALUES (412, 'App\\Models\\User', 1, 'auth-token', '3af6d08f841ce08519ff6d27661263bce73dbdd764b07218572507db9157bb15', '[\"*\"]', '2026-06-28 07:02:12', NULL, '2026-06-28 06:46:46', '2026-06-28 07:02:12');
INSERT INTO `personal_access_tokens` VALUES (419, 'App\\Models\\User', 2, 'auth-token', 'e63db80340e3e3cf9339c6b9e0295134b655f705695b7ccebef602d5fd75f7ec', '[\"*\"]', '2026-06-28 07:02:13', NULL, '2026-06-28 06:56:01', '2026-06-28 07:02:13');
INSERT INTO `personal_access_tokens` VALUES (420, 'App\\Models\\User', 1, 'auth-token', '7647e323344b7f2d6c8f6bc117bec6fd4a4eaa59fba3e9425d1e2429567ca83d', '[\"*\"]', '2026-06-28 07:24:41', NULL, '2026-06-28 07:05:22', '2026-06-28 07:24:41');
INSERT INTO `personal_access_tokens` VALUES (421, 'App\\Models\\User', 1, 'auth-token', 'd740d9d80e257ba367c769a806054f1ef11dfc1ba27a60411e7c73b40f20a99f', '[\"*\"]', '2026-06-28 07:32:37', NULL, '2026-06-28 07:28:18', '2026-06-28 07:32:37');
INSERT INTO `personal_access_tokens` VALUES (426, 'App\\Models\\User', 1, 'auth-token', 'f994f289935f1e2071e5796dcf6e6b82b53c5007dc232188ca3cae887844613d', '[\"*\"]', '2026-06-28 08:02:51', NULL, '2026-06-28 07:44:01', '2026-06-28 08:02:51');
INSERT INTO `personal_access_tokens` VALUES (427, 'App\\Models\\User', 5, 'auth-token', '45f5414788843f1d2aa50522be5f2e662e8f1d43f908c5feb7a37ffdbfc6b226', '[\"*\"]', '2026-06-28 08:02:52', NULL, '2026-06-28 07:44:44', '2026-06-28 08:02:52');
INSERT INTO `personal_access_tokens` VALUES (428, 'App\\Models\\User', 1, 'auth-token', '01851d022ffee92f5b0184d0c33e460d5a0430c40598ec8343fc85a4fa5c8bcb', '[\"*\"]', '2026-06-28 08:31:32', NULL, '2026-06-28 08:25:33', '2026-06-28 08:31:32');
INSERT INTO `personal_access_tokens` VALUES (429, 'App\\Models\\User', 1, 'auth-token', '0fe84542762a26e074bf0b42806f535637b39226803f78d5f9bf44e53305d43d', '[\"*\"]', '2026-06-28 08:35:50', NULL, '2026-06-28 08:31:50', '2026-06-28 08:35:50');
INSERT INTO `personal_access_tokens` VALUES (430, 'App\\Models\\User', 1, 'auth-token', 'ad67c1908f3c9311a570cf5586eafa4184a7c7008b425cf61f7e39ce119c0f5f', '[\"*\"]', '2026-06-28 08:42:40', NULL, '2026-06-28 08:36:17', '2026-06-28 08:42:40');
INSERT INTO `personal_access_tokens` VALUES (431, 'App\\Models\\User', 1, 'auth-token', 'fc33447c3a449c36c4bbb76faccd2f1056cac69fb8b8b26670974cf033bc52ad', '[\"*\"]', '2026-06-28 08:54:54', NULL, '2026-06-28 08:46:01', '2026-06-28 08:54:54');
INSERT INTO `personal_access_tokens` VALUES (432, 'App\\Models\\User', 1, 'auth-token', '0a669cfb95fe227fa268383467aa8a1724b895842e77049e40f31cd95495251c', '[\"*\"]', '2026-06-28 09:09:03', NULL, '2026-06-28 08:55:29', '2026-06-28 09:09:03');
INSERT INTO `personal_access_tokens` VALUES (433, 'App\\Models\\User', 1, 'auth-token', 'a107705f698e8728442f6459c988a84181109dd06f09deebb8a027bbff93bf4b', '[\"*\"]', '2026-06-28 09:40:44', NULL, '2026-06-28 09:09:53', '2026-06-28 09:40:44');
INSERT INTO `personal_access_tokens` VALUES (434, 'App\\Models\\User', 1, 'auth-token', 'ac7d7fe6fd7596457692c6d5704ea39304170a3a6b083a5fa1359e649a07e3e7', '[\"*\"]', '2026-06-28 09:50:41', NULL, '2026-06-28 09:43:37', '2026-06-28 09:50:41');
INSERT INTO `personal_access_tokens` VALUES (435, 'App\\Models\\User', 1, 'auth-token', '96f552ea591a8c5b14283fd602a1ae4ac1ee64fc9c3888d09e185e13247a17d8', '[\"*\"]', '2026-06-28 09:55:58', NULL, '2026-06-28 09:50:51', '2026-06-28 09:55:58');
INSERT INTO `personal_access_tokens` VALUES (436, 'App\\Models\\User', 1, 'auth-token', 'dc2c5704120df14c3fbf21737a36bb79eaa2df0b9b732afebc92488b3675b097', '[\"*\"]', '2026-06-28 10:14:34', NULL, '2026-06-28 09:56:02', '2026-06-28 10:14:34');
INSERT INTO `personal_access_tokens` VALUES (437, 'App\\Models\\User', 1, 'auth-token', '8b9fb266d74ca250dccb71294ea64431ba070bf1ab6773a592bb43b3a0c5364b', '[\"*\"]', '2026-06-28 10:15:52', NULL, '2026-06-28 10:15:32', '2026-06-28 10:15:52');
INSERT INTO `personal_access_tokens` VALUES (438, 'App\\Models\\User', 1, 'auth-token', 'b0947aed59a2ae4d38153910a89d58634e51b358fbd844774e503e5f03d052c2', '[\"*\"]', '2026-06-28 10:43:07', NULL, '2026-06-28 10:29:19', '2026-06-28 10:43:07');
INSERT INTO `personal_access_tokens` VALUES (439, 'App\\Models\\User', 1, 'auth-token', '3759508fa6a3cddca441fdbb6c34a7177c52539da5c4c96c941772248798f3a8', '[\"*\"]', '2026-06-28 12:02:05', NULL, '2026-06-28 12:01:29', '2026-06-28 12:02:05');
INSERT INTO `personal_access_tokens` VALUES (440, 'App\\Models\\User', 1, 'auth-token', 'a6d2591084fad7bef4e858cdf17e1bd3c9040e4bd71421477767ed7a0c313f67', '[\"*\"]', '2026-06-28 12:03:11', NULL, '2026-06-28 12:02:24', '2026-06-28 12:03:11');
INSERT INTO `personal_access_tokens` VALUES (441, 'App\\Models\\User', 1, 'auth-token', '8dc42b7338937d90ad40471d843d452205601f9c3cbea0d6134cf35773d0dc2f', '[\"*\"]', '2026-06-28 12:03:54', NULL, '2026-06-28 12:03:12', '2026-06-28 12:03:54');
INSERT INTO `personal_access_tokens` VALUES (442, 'App\\Models\\User', 1, 'auth-token', '2ce4f265ad9e827be1a34aaa1df79d26caa16999359d79877a181a7d3211144b', '[\"*\"]', '2026-06-28 12:29:32', NULL, '2026-06-28 12:19:54', '2026-06-28 12:29:32');
INSERT INTO `personal_access_tokens` VALUES (443, 'App\\Models\\User', 1, 'auth-token', 'bc477bd8cdd317ee2d04a748b5e6fa8a51c2ca4fe14cfa38c0d78256f548cbe0', '[\"*\"]', '2026-06-28 12:44:14', NULL, '2026-06-28 12:42:20', '2026-06-28 12:44:14');
INSERT INTO `personal_access_tokens` VALUES (444, 'App\\Models\\User', 1, 'auth-token', '29b4b130a0d46543af5818da47431b54721db65fa3fe126ef2c71df1d2da4923', '[\"*\"]', '2026-06-28 12:47:00', NULL, '2026-06-28 12:44:30', '2026-06-28 12:47:00');
INSERT INTO `personal_access_tokens` VALUES (445, 'App\\Models\\User', 1, 'auth-token', 'ebb9e106be47e8ed52b085a73f9c8ca2cb4ab67f6791d977fd6813a1feebd106', '[\"*\"]', '2026-06-28 12:50:07', NULL, '2026-06-28 12:47:42', '2026-06-28 12:50:07');
INSERT INTO `personal_access_tokens` VALUES (446, 'App\\Models\\User', 1, 'auth-token', 'bb15c359710474c8b9371f8e420b5e8255a6a5d97866914b5ee4945ff8a7c874', '[\"*\"]', '2026-06-28 12:52:29', NULL, '2026-06-28 12:51:02', '2026-06-28 12:52:29');
INSERT INTO `personal_access_tokens` VALUES (447, 'App\\Models\\User', 1, 'auth-token', '71c9eef18c61f3f0c7b6f12b7f553d6ee3bf6a86abc3090e4e151cd54476c388', '[\"*\"]', '2026-06-28 12:53:46', NULL, '2026-06-28 12:52:30', '2026-06-28 12:53:46');
INSERT INTO `personal_access_tokens` VALUES (448, 'App\\Models\\User', 1, 'auth-token', 'd9a4335435d0e37ea739f2b6ef2dca45bca68f97dc11927a2f4ee9dde42d3fd3', '[\"*\"]', '2026-06-28 12:58:28', NULL, '2026-06-28 12:55:04', '2026-06-28 12:58:28');
INSERT INTO `personal_access_tokens` VALUES (449, 'App\\Models\\User', 1, 'auth-token', '6e9afdecd4e65c391656980ee389d7758578d734fa6e8f5c3ebcacd29e647fee', '[\"*\"]', '2026-06-28 13:04:05', NULL, '2026-06-28 13:00:20', '2026-06-28 13:04:05');
INSERT INTO `personal_access_tokens` VALUES (450, 'App\\Models\\User', 2, 'auth-token', 'a7c44db1f4cd90bed103714be85fe16cc15e0dcb1ce934aa809b5d9395a803f4', '[\"*\"]', '2026-06-28 13:04:00', NULL, '2026-06-28 13:01:26', '2026-06-28 13:04:00');
INSERT INTO `personal_access_tokens` VALUES (451, 'App\\Models\\User', 2, 'auth-token', '01e67aafa067d0684d8c520d4d8fba0e7569522c9328664c85207c45467449c7', '[\"*\"]', '2026-06-28 13:07:38', NULL, '2026-06-28 13:04:05', '2026-06-28 13:07:38');
INSERT INTO `personal_access_tokens` VALUES (452, 'App\\Models\\User', 1, 'auth-token', '462b00db2291dff7273f3d29080b34c525bf34b0d9100858f0f1a13005f9a1f5', '[\"*\"]', '2026-06-28 13:15:00', NULL, '2026-06-28 13:09:12', '2026-06-28 13:15:00');
INSERT INTO `personal_access_tokens` VALUES (453, 'App\\Models\\User', 2, 'auth-token', '92329077e69c107c5632e190679d1160652db58b182978dfef08bd3334d8497a', '[\"*\"]', '2026-06-28 13:15:04', NULL, '2026-06-28 13:10:20', '2026-06-28 13:15:04');
INSERT INTO `personal_access_tokens` VALUES (454, 'App\\Models\\User', 2, 'auth-token', 'a155c84478db6a9b177cc28b0eaf907999583f659928e342a9c4012710ca5bb1', '[\"*\"]', '2026-06-28 13:17:52', NULL, '2026-06-28 13:15:05', '2026-06-28 13:17:52');
INSERT INTO `personal_access_tokens` VALUES (455, 'App\\Models\\User', 2, 'auth-token', '909f21aa010d3a62501c25e3ed2eebb053c00b01e502d1a635d7a4d2aa23c43b', '[\"*\"]', '2026-06-28 13:20:34', NULL, '2026-06-28 13:17:55', '2026-06-28 13:20:34');
INSERT INTO `personal_access_tokens` VALUES (456, 'App\\Models\\User', 1, 'auth-token', 'beaaffd67509a15d33028a671bd72085745d3a60a5c71bd67fc0cca96a51544c', '[\"*\"]', '2026-06-28 22:56:18', NULL, '2026-06-28 22:37:32', '2026-06-28 22:56:18');

-- ----------------------------
-- Table structure for room_views
-- ----------------------------
DROP TABLE IF EXISTS `room_views`;
CREATE TABLE `room_views`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `room_id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `start_at` datetime NOT NULL,
  `end_at` datetime NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `room_views_room_id_user_id_unique`(`room_id` ASC, `user_id` ASC) USING BTREE,
  INDEX `room_views_user_id_foreign`(`user_id` ASC) USING BTREE,
  CONSTRAINT `room_views_room_id_foreign` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `room_views_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 979 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of room_views
-- ----------------------------
INSERT INTO `room_views` VALUES (105, 7, 4, '2026-06-16 08:00:00', '2026-06-16 10:00:00', '2026-06-16 02:49:11');
INSERT INTO `room_views` VALUES (145, 3, 1, '2026-06-16 13:30:00', '2026-06-16 18:30:00', '2026-06-16 05:27:17');
INSERT INTO `room_views` VALUES (147, 5, 1, '2026-06-16 13:30:00', '2026-06-16 18:30:00', '2026-06-16 05:27:25');
INSERT INTO `room_views` VALUES (148, 6, 1, '2026-06-16 13:30:00', '2026-06-16 18:30:00', '2026-06-16 05:27:25');
INSERT INTO `room_views` VALUES (199, 10, 1, '2026-06-16 11:30:00', '2026-06-16 19:00:00', '2026-06-16 05:59:01');
INSERT INTO `room_views` VALUES (968, 7, 1, '2026-06-28 11:00:00', '2026-06-28 12:00:00', '2026-06-28 12:44:45');

-- ----------------------------
-- Table structure for rooms
-- ----------------------------
DROP TABLE IF EXISTS `rooms`;
CREATE TABLE `rooms`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `capacity` int NOT NULL,
  `floor` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `facilities` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `photos` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `status` enum('active','maintenance') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `requires_contact` tinyint(1) NOT NULL DEFAULT 0,
  `sensor_code` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `building_id` bigint UNSIGNED NULL DEFAULT NULL,
  `sort_order` int UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `rooms_sensor_code_unique`(`sensor_code` ASC) USING BTREE,
  INDEX `rooms_building_id_foreign`(`building_id` ASC) USING BTREE,
  CONSTRAINT `rooms_building_id_foreign` FOREIGN KEY (`building_id`) REFERENCES `buildings` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 20 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of rooms
-- ----------------------------
INSERT INTO `rooms` VALUES (1, 'Ballroom 101', 100, 'B1', '[]', '[\"https:\\/\\/images.unsplash.com\\/photo-1517457373958-b7bdd4587205?q=80&w=800\",\"https:\\/\\/images.unsplash.com\\/photo-1598488035139-bdbb2231ce04?q=80&w=800\"]', 'Suitable for large-scale events. Coordinate with GA team 48hrs before for stage/AV setup.', 1, 'active', 0, '6vMT01b04H1KEOgn', '2026-06-14 06:40:53', '2026-06-14 11:34:41', 1, 1);
INSERT INTO `rooms` VALUES (2, 'Ballroom 102', 100, 'B1', '[]', '[\"https:\\/\\/images.unsplash.com\\/photo-1492684223066-81342ee5ff30?q=80&w=800\"]', 'Suitable for large-scale events.', 1, 'active', 0, 'fWA6gEJmNF7iNPqb', '2026-06-14 06:40:53', '2026-06-26 08:19:20', 1, 2);
INSERT INTO `rooms` VALUES (3, 'Executive 101', 12, '5F', '[]', '[\"https:\\/\\/images.unsplash.com\\/photo-1497366811353-6870744d04b2?q=80&w=800\",\"https:\\/\\/images.unsplash.com\\/photo-1462826303086-329426d1aef5?q=80&w=800\"]', 'For senior leadership and external meetings. Video conferencing pre-configured.', 1, 'active', 0, 'L0uIlfoYZJmbOAUL', '2026-06-14 06:40:53', '2026-06-14 11:35:24', 1, 3);
INSERT INTO `rooms` VALUES (4, 'Executive 102', 12, '5F', '[]', '[\"https:\\/\\/images.unsplash.com\\/photo-1560472354-b33ff0c44a43?q=80&w=800\"]', 'Executive suite with full AV setup.', 1, 'active', 0, 'IErLRqX8GcdYPr1R', '2026-06-14 06:40:53', '2026-06-14 11:35:31', 1, 4);
INSERT INTO `rooms` VALUES (5, 'Focus 101', 4, '3F', '[]', '[\"https:\\/\\/images.unsplash.com\\/photo-1505409859467-3a799be57c8f?q=80&w=800\",\"https:\\/\\/images.unsplash.com\\/photo-1521737711867-e3b97375f902?q=80&w=800\"]', 'Quiet zone - no phone calls. Max 4 pax strictly enforced.', 1, 'active', 0, 'JymVFcuLW26mzC76', '2026-06-14 06:40:53', '2026-06-14 11:35:33', 1, 5);
INSERT INTO `rooms` VALUES (6, 'Focus 102', 4, '3F', '[]', '[\"https:\\/\\/images.unsplash.com\\/photo-1497366216548-37526070297c?q=80&w=800\"]', 'Quiet zone for focused work.', 1, 'active', 1, '0PSccLPbWa9JEzQh', '2026-06-14 06:40:53', '2026-06-26 08:19:43', 1, 6);
INSERT INTO `rooms` VALUES (7, 'Room 203', 8, '2nd Floor', '[]', '[\"https:\\/\\/plus.unsplash.com\\/premium_photo-1681487144031-d502ea9abefc?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D\"]', 'Medium ballroom for events up to 8 pax.', 1, 'active', 0, 'UWmTzZg8Pbd5EFVm', '2026-06-14 06:40:53', '2026-06-24 11:12:28', 2, 2);
INSERT INTO `rooms` VALUES (8, 'Executive 201', 8, '2nd Floor', '[]', '[\"https:\\/\\/images.unsplash.com\\/photo-1497366811353-6870744d04b2?q=80&w=800\"]', 'Smaller executive room for focused discussions.', 0, 'active', 0, 'mWj2Qcs3T4J6dVEX', '2026-06-14 06:40:53', '2026-06-16 03:25:09', 2, 2);
INSERT INTO `rooms` VALUES (9, 'Focus 201', 6, '2F', '[]', '[\"https:\\/\\/images.unsplash.com\\/photo-1505409859467-3a799be57c8f?q=80&w=800\"]', 'Small meeting room for quick discussions.', 0, 'active', 0, '2XXwnHcVW7CQBYW4', '2026-06-14 06:40:53', '2026-06-16 03:37:18', 2, 3);
INSERT INTO `rooms` VALUES (10, 'Focus 202', 4, '2F', '[]', '[\"https:\\/\\/images.unsplash.com\\/photo-1497366216548-37526070297c?q=80&w=800\"]', 'Creative quiet pod.', 0, 'active', 1, 'NVqvhWZQNrsTLG9R', '2026-06-14 06:40:53', '2026-06-16 06:04:30', 2, 4);
INSERT INTO `rooms` VALUES (11, 'Ballroom 301', 60, 'B1', '[]', '[\"https:\\/\\/images.unsplash.com\\/photo-1492684223066-81342ee5ff30?q=80&w=800\"]', 'Regional event space.', 1, 'active', 0, 'TfE0plImNVrCn6uw', '2026-06-14 06:40:53', '2026-06-14 11:35:52', 3, 1);
INSERT INTO `rooms` VALUES (12, 'Executive 301', 10, '3F', '[]', '[\"https:\\/\\/images.unsplash.com\\/photo-1560472354-b33ff0c44a43?q=80&w=800\"]', 'Surabaya leadership room.', 1, 'active', 0, 'L9eFeD951I8e7024', '2026-06-14 06:40:53', '2026-06-14 11:35:56', 3, 2);
INSERT INTO `rooms` VALUES (13, 'Focus 301', 4, '2F', '[]', '[\"https:\\/\\/images.unsplash.com\\/photo-1521737711867-e3b97375f902?q=80&w=800\"]', 'Quiet pod for remote work.', 1, 'active', 0, 'N38cD5rMTbic2Ofn', '2026-06-14 06:40:53', '2026-06-14 11:35:59', 3, 3);
INSERT INTO `rooms` VALUES (14, 'Relax Room', 6, '1st Floor', NULL, NULL, 'Suitable for rest or who want take relax time.', 1, 'active', 1, 'VEtli8nkzbVEZS3T', '2026-06-14 11:43:13', '2026-06-21 04:44:10', 2, 5);
INSERT INTO `rooms` VALUES (15, 'VIP Room', 10, '1st Floor', '[{\"name\":\"TV \\/ Monitor\",\"icon\":\"tv\"},{\"name\":\"Projector\",\"icon\":\"present_to_all\"},{\"name\":\"Video Conference\",\"icon\":\"video_call\"},{\"name\":\"Whiteboard\",\"icon\":\"edit_square\"},{\"name\":\"Microphone\",\"icon\":\"mic\"},{\"name\":\"Speaker\",\"icon\":\"speaker\"},{\"name\":\"HDMI Cable\",\"icon\":\"cable\"},{\"name\":\"WiFi\",\"icon\":\"wifi\"},{\"name\":\"Webcam\",\"icon\":\"camera\"}]', '[\"https:\\/\\/images.unsplash.com\\/photo-1497366811353-6870744d04b2?q=80&w=1469&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D\"]', 'From Lobby OTC', 1, 'active', 1, 'jRSQX07O0TBdGJur', '2026-06-14 11:43:42', '2026-06-25 13:00:50', 2, 4);
INSERT INTO `rooms` VALUES (16, 'Room 204', 40, '2nd Floor', NULL, '[\"https:\\/\\/images.unsplash.com\\/photo-1517502884422-41eaead166d4?q=80&w=1025&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D\"]', 'Suitable for a lot of person, up to 40 seats', 1, 'active', 0, '0cRPxSsl0NpidWCL', '2026-06-16 03:25:53', '2026-06-25 13:00:55', 2, 3);
INSERT INTO `rooms` VALUES (17, 'Test 123', 12, '2nd Floor', NULL, NULL, 'ABC', 0, 'active', 0, 'cqDCra3p5WU5OgTt', '2026-06-16 03:29:32', '2026-06-16 04:07:57', 2, 7);
INSERT INTO `rooms` VALUES (18, 'Ghost Room 1', 10, '2nd Floor', NULL, NULL, 'Testing delete room', 0, 'active', 0, '7bREGA5NyuO8EKk7', '2026-06-16 06:08:07', '2026-06-16 06:08:26', 2, 8);
INSERT INTO `rooms` VALUES (19, 'Room 101', 6, '1st Floor', NULL, '[\"https:\\/\\/images.unsplash.com\\/photo-1431540015161-0bf868a2d407?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D\"]', NULL, 1, 'active', 0, 'ymJrJ1hDE2LB1hM6', '2026-06-16 09:43:50', '2026-06-26 03:01:16', 2, 1);

-- ----------------------------
-- Table structure for sessions
-- ----------------------------
DROP TABLE IF EXISTS `sessions`;
CREATE TABLE `sessions`  (
  `id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint UNSIGNED NULL DEFAULT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `user_agent` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_activity` int NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `sessions_user_id_index`(`user_id` ASC) USING BTREE,
  INDEX `sessions_last_activity_index`(`last_activity` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sessions
-- ----------------------------
INSERT INTO `sessions` VALUES ('RC0CIFv6HXG9gh8TRcCgGt6f0gy41G2LgpYpJvvH', NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', 'YTozOntzOjY6Il90b2tlbiI7czo0MDoiU3B1UHlyZTk3eHVRcHZ3T3VUZDFjSlI3emJ1VndHeVRkREQxcE9HZyI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly9sb2NhbGhvc3Q6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==', 1781428046);

-- ----------------------------
-- Table structure for settings
-- ----------------------------
DROP TABLE IF EXISTS `settings`;
CREATE TABLE `settings`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `settings_key_unique`(`key` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 31 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of settings
-- ----------------------------
INSERT INTO `settings` VALUES (1, 'booking_start_time', '07:00', '2026-06-16 06:12:31', '2026-06-20 08:07:51');
INSERT INTO `settings` VALUES (2, 'booking_end_time', '19:00', '2026-06-16 06:12:31', '2026-06-20 08:07:51');
INSERT INTO `settings` VALUES (3, 'weekend_saturday', 'true', '2026-06-20 08:07:51', '2026-06-20 08:07:51');
INSERT INTO `settings` VALUES (4, 'weekend_sunday', 'true', '2026-06-20 08:07:51', '2026-06-21 04:42:36');
INSERT INTO `settings` VALUES (5, 'max_advance_days', '91', '2026-06-21 04:23:41', '2026-06-26 02:32:45');
INSERT INTO `settings` VALUES (6, 'allow_book_for_others', 'true', '2026-06-21 04:23:41', '2026-06-28 00:37:15');
INSERT INTO `settings` VALUES (7, 'restrict_after_hours', 'true', '2026-06-21 04:23:41', '2026-06-26 05:18:36');
INSERT INTO `settings` VALUES (8, 'working_hours_end', '16:30', '2026-06-21 04:23:41', '2026-06-26 05:18:45');
INSERT INTO `settings` VALUES (9, 'feature_ai_chat', 'true', '2026-06-21 04:23:41', '2026-06-27 11:44:42');
INSERT INTO `settings` VALUES (10, 'rooms_grid_cols', '4', '2026-06-21 04:48:10', '2026-06-21 04:57:59');
INSERT INTO `settings` VALUES (11, 'archive_after_days', '30', '2026-06-21 06:09:03', '2026-06-21 11:14:00');
INSERT INTO `settings` VALUES (12, 'archive_delete_after_days', '30', '2026-06-21 06:10:32', '2026-06-21 06:10:36');
INSERT INTO `settings` VALUES (13, 'export_enabled', 'false', '2026-06-21 06:44:52', '2026-06-21 06:46:15');
INSERT INTO `settings` VALUES (14, 'export_frequency', 'weekly', '2026-06-21 06:46:03', '2026-06-21 06:46:09');
INSERT INTO `settings` VALUES (15, 'export_day_of_week', '4', '2026-06-21 06:46:12', '2026-06-21 06:46:12');
INSERT INTO `settings` VALUES (16, 'allow_password_change', 'false', '2026-06-24 13:24:53', '2026-06-26 13:13:57');
INSERT INTO `settings` VALUES (17, 'after_hours_contacts', '[4,5,6,7]', '2026-06-26 05:33:39', '2026-06-26 08:59:11');
INSERT INTO `settings` VALUES (18, 'special_room_contacts', '[4,6,5]', '2026-06-26 08:13:29', '2026-06-26 08:16:12');
INSERT INTO `settings` VALUES (19, 'allow_avatar_upload', 'false', '2026-06-26 13:11:32', '2026-06-27 08:13:27');
INSERT INTO `settings` VALUES (20, 'chart_peak_hour_from', '6', '2026-06-27 01:27:19', '2026-06-27 01:27:19');
INSERT INTO `settings` VALUES (21, 'chart_peak_hour_to', '19', '2026-06-27 01:27:19', '2026-06-27 01:27:21');
INSERT INTO `settings` VALUES (22, 'anti_ghost_enabled', 'true', '2026-06-27 11:54:32', '2026-06-28 08:56:31');
INSERT INTO `settings` VALUES (23, 'anti_ghost_mode', 'kiosk', '2026-06-27 11:54:42', '2026-06-28 07:38:24');
INSERT INTO `settings` VALUES (24, 'web_confirm_enabled', 'true', '2026-06-27 12:20:01', '2026-06-28 08:56:31');
INSERT INTO `settings` VALUES (25, 'anti_ghost_window_before', '15', '2026-06-27 12:27:45', '2026-06-27 12:32:52');
INSERT INTO `settings` VALUES (26, 'anti_ghost_window_after', '5', '2026-06-27 12:28:58', '2026-06-28 02:03:18');
INSERT INTO `settings` VALUES (27, 'sensor_api_token', '37bd99b4aeb6db80d705d40f8d11d67d', '2026-06-28 03:25:07', '2026-06-28 04:05:13');
INSERT INTO `settings` VALUES (28, 'log_auto_export_enabled', 'true', '2026-06-28 08:50:02', '2026-06-28 09:22:33');
INSERT INTO `settings` VALUES (29, 'log_auto_export_time', '16:50', '2026-06-28 08:50:15', '2026-06-28 09:47:33');
INSERT INTO `settings` VALUES (30, 'log_auto_export_interval', 'daily', '2026-06-28 08:59:34', '2026-06-28 08:59:35');

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `department_id` bigint UNSIGNED NULL DEFAULT NULL,
  `role` enum('user','admin','receptionist','building_admin') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  `ext` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `avatar` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `on_duty` tinyint(1) NOT NULL DEFAULT 1,
  `can_book_special` tinyint(1) NOT NULL DEFAULT 0,
  `preferences` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `default_building_id` bigint UNSIGNED NULL DEFAULT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `remember_token` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `users_email_unique`(`email` ASC) USING BTREE,
  INDEX `users_department_id_foreign`(`department_id` ASC) USING BTREE,
  INDEX `users_default_building_id_foreign`(`default_building_id` ASC) USING BTREE,
  CONSTRAINT `users_default_building_id_foreign` FOREIGN KEY (`default_building_id`) REFERENCES `buildings` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `users_department_id_foreign` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 9 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of users
-- ----------------------------
INSERT INTO `users` VALUES (1, 'Anita Wijaya', 'anita@corp.com', 1, 'admin', '102', 'Anita', 1, 0, '{\"defaultBuilding\":2,\"darkMode\":false,\"language\":\"en\",\"defaultView\":\"day\",\"defaultType\":\"internal\",\"showBarTitle\":true}', NULL, NULL, '$2y$12$uBcbDmGMfrOQGPUsI79wLOsDs5cEKKS0/UOCvllNubVP5D.XzNZhK', NULL, '2026-06-14 06:40:52', '2026-06-28 12:52:04');
INSERT INTO `users` VALUES (2, 'Jessica Miller', 'jessica@corp.com', 2, 'user', '801', 'Aria', 1, 0, '{\"language\":\"en\",\"darkMode\":false,\"defaultBuilding\":3,\"defaultView\":\"day\"}', 2, NULL, '$2y$12$TngFMvaJ4Iyl2m5z8VFZHeGQkQCk4ZO1.YF4C8k621PWVgOuV1v7a', NULL, '2026-06-14 06:40:52', '2026-06-28 13:17:19');
INSERT INTO `users` VALUES (3, 'Fixer Team', 'mtc@corp.com', 3, 'user', '000', 'Felix', 1, 0, NULL, NULL, NULL, '$2y$12$Q1ey0F8EET.h.PhDGhKJm.Uz0zJNs/srBI260WsXx7BuLpCuv2rb.', NULL, '2026-06-14 06:40:53', '2026-06-21 04:35:30');
INSERT INTO `users` VALUES (4, 'Ayu Restiana', 'ayu.restiana@agc.com', 1, 'receptionist', '9', NULL, 1, 0, NULL, NULL, NULL, '$2y$12$iNmXKmBfkOIUo8EoeGeyMeYTl3rrQ4lo86DR3CsVJel3Q0.uCVn62', NULL, '2026-06-15 23:43:32', '2026-06-16 04:11:08');
INSERT INTO `users` VALUES (5, 'Suciati Farhanas', 'suciati.farhanas@agc.com', 1, 'receptionist', '9', NULL, 1, 0, '{\"defaultBuilding\":1}', 2, NULL, '$2y$12$6uYDc6WUjAxXfggvhv8QBu33xMvevMyOFMPGvpUFurItFygxHeKMi', NULL, '2026-06-16 03:46:06', '2026-06-28 07:46:15');
INSERT INTO `users` VALUES (6, 'Carolina', 'carolina@agc.com', 4, 'receptionist', '1', NULL, 1, 0, NULL, NULL, NULL, '$2y$12$.s59l/DxzkIzx8dX/4FR5.aJ6Dl3glpbqL.3XjVWBQsnOZNA//ugG', NULL, '2026-06-16 03:58:07', '2026-06-16 03:58:07');
INSERT INTO `users` VALUES (7, 'em.arius', 'em.arius@agc.com', 1, 'building_admin', '1234', NULL, 1, 0, NULL, NULL, NULL, '$2y$12$mxFQOUCKtOf6.WP9908p9uNphYAP3MHXM2EdnLiNSpadecAN7GEru', NULL, '2026-06-16 04:36:25', '2026-06-16 04:36:25');

SET FOREIGN_KEY_CHECKS = 1;

/**
 * jsonStore.js — Database Compatibility Layer
 * Giữ nguyên API cho toàn bộ các controller và test suite,
 * chuyển tiếp xử lý sang SQLite WAL Mode (sqliteStore.js) chuẩn Production.
 */

export * from './sqliteStore.js';

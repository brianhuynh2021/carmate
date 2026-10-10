/**
 * jsonStore.js — Database Compatibility Layer
 * Keeps the API unchanged for all controllers and the test suite,
 * delegating processing to SQLite WAL Mode (sqliteStore.js), production-grade.
 */

export * from './sqliteStore.js';

#!/usr/bin/env node
/**
 * CarMate — Safe SQLite backup while the server is still running.
 *
 * Uses the SQLite Online Backup API (db.backup) instead of `cp`:
 * a plain file copy made while a transaction is writing produces a
 * corrupt copy, or one missing data that is still in the WAL.
 *
 * Usage:
 *   node scripts/backup-db.js                 # back up to apps/api/data/backups
 *   node scripts/backup-db.js --out /mnt/bak  # use a different directory
 *   node scripts/backup-db.js --keep 30       # keep the 30 most recent backups
 *
 * Equivalent environment variables: CARMATE_BACKUP_DIR, CARMATE_BACKUP_KEEP
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../apps/api/data');
const DB_PATH = path.join(DATA_DIR, 'carmate.sqlite');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--out') args.out = argv[++i];
    else if (key === '--keep') args.keep = Number(argv[++i]);
    else if (key === '--help' || key === '-h') args.help = true;
  }
  return args;
}

const args = parseArgs(process.argv);

if (args.help) {
  console.log('Cách dùng: node scripts/backup-db.js [--out <thư-mục>] [--keep <số-bản>]');
  process.exit(0);
}

const BACKUP_DIR = path.resolve(args.out || process.env.CARMATE_BACKUP_DIR || path.join(DATA_DIR, 'backups'));
const KEEP = Number.isFinite(args.keep) ? args.keep : Number(process.env.CARMATE_BACKUP_KEEP || 14);

function fail(message) {
  console.error(`[backup] ✗ ${message}`);
  process.exit(1);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    fail(`Không tìm thấy database tại ${DB_PATH}`);
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  // Timestamp like 2026-09-06T12-30-00 so file names sort in the right order
  const stamp = new Date()
    .toISOString()
    .replace(/\.\d{3}Z$/, '')
    .replace(/:/g, '-');
  const rawPath = path.join(BACKUP_DIR, `carmate-${stamp}.sqlite`);
  const gzPath = `${rawPath}.gz`;

  // Open read-only: never write anything to the DB that is serving traffic.
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });

  try {
    // backup() merges the data still in the WAL and preserves
    // transactional consistency, even while the server keeps writing.
    await db.backup(rawPath);

    const integrity = new Database(rawPath, { readonly: true });
    const result = integrity.pragma('integrity_check', { simple: true });
    const tripCount = integrity.prepare('SELECT COUNT(*) AS c FROM trips').get().c;
    const userCount = integrity.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    integrity.close();

    // Opening the file for verification creates -wal/-shm files next to it;
    // clean them up right away so the backup directory only contains .gz files.
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = `${rawPath}${suffix}`;
      if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
    }

    if (result !== 'ok') {
      fs.unlinkSync(rawPath);
      fail(`Bản sao lưu không toàn vẹn (integrity_check = ${result}). Đã xoá bản lỗi.`);
    }

    await pipeline(fs.createReadStream(rawPath), zlib.createGzip({ level: 9 }), fs.createWriteStream(gzPath));
    fs.unlinkSync(rawPath);

    const size = fs.statSync(gzPath).size;
    console.log(
      `[backup] ✓ ${path.basename(gzPath)} (${formatBytes(size)}) — ${tripCount} chuyến, ${userCount} thành viên`
    );
  } finally {
    db.close();
  }

  // Prune old backups, keeping only the most recent KEEP
  if (KEEP > 0) {
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('carmate-') && f.endsWith('.sqlite.gz'))
      .sort()
      .reverse();

    for (const stale of files.slice(KEEP)) {
      fs.unlinkSync(path.join(BACKUP_DIR, stale));
      console.log(`[backup] · đã xoá bản cũ ${stale}`);
    }

    // Clean up orphaned sidecar files (from older script versions or interrupted runs)
    for (const orphan of fs.readdirSync(BACKUP_DIR)) {
      if (orphan.endsWith('-wal') || orphan.endsWith('-shm')) {
        fs.unlinkSync(path.join(BACKUP_DIR, orphan));
      }
    }
  }
}

main().catch((err) => fail(err.message));

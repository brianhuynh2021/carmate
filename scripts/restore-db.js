#!/usr/bin/env node
/**
 * CarMate — Restore the database from a backup.
 *
 * STOP THE SERVER BEFORE RUNNING. Overwriting the DB while the server has
 * connections open will corrupt the data.
 *
 * Usage:
 *   node scripts/restore-db.js --list              # list the backups
 *   node scripts/restore-db.js --latest            # restore the most recent backup
 *   node scripts/restore-db.js <path.gz>           # restore the specified backup
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../apps/api/data');
const DB_PATH = path.join(DATA_DIR, 'carmate.sqlite');
const BACKUP_DIR = path.resolve(process.env.CARMATE_BACKUP_DIR || path.join(DATA_DIR, 'backups'));

function fail(message) {
  console.error(`[restore] ✗ ${message}`);
  process.exit(1);
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('carmate-') && f.endsWith('.sqlite.gz'))
    .sort()
    .reverse()
    .map((f) => path.join(BACKUP_DIR, f));
}

function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const backups = listBackups();

  if (argv.includes('--list') || argv.length === 0) {
    if (backups.length === 0) {
      console.log(`[restore] Chưa có bản sao lưu nào trong ${BACKUP_DIR}`);
      return;
    }
    console.log(`[restore] Các bản sao lưu trong ${BACKUP_DIR}:\n`);
    backups.forEach((b, i) => {
      const size = (fs.statSync(b).size / 1024).toFixed(1);
      console.log(`  ${String(i + 1).padStart(2)}. ${path.basename(b)}  (${size} KB)`);
    });
    console.log('\nKhôi phục:  node scripts/restore-db.js --latest');
    return;
  }

  const source = argv.includes('--latest') ? backups[0] : path.resolve(argv[0]);

  if (!source) fail('Không có bản sao lưu nào để khôi phục.');
  if (!fs.existsSync(source)) fail(`Không tìm thấy file ${source}`);

  // Decompress to a temp file and verify it before touching the real DB
  const tmpPath = path.join(DATA_DIR, `.restore-${Date.now()}.sqlite`);
  await pipeline(fs.createReadStream(source), zlib.createGunzip(), fs.createWriteStream(tmpPath));

  let tripCount = 0;
  let userCount = 0;
  try {
    const check = new Database(tmpPath, { readonly: true });
    const integrity = check.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') {
      check.close();
      fs.unlinkSync(tmpPath);
      fail(`Bản sao lưu hỏng (integrity_check = ${integrity}). Không khôi phục.`);
    }
    tripCount = check.prepare('SELECT COUNT(*) AS c FROM trips').get().c;
    userCount = check.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    check.close();
  } catch (err) {
    fs.existsSync(tmpPath) && fs.unlinkSync(tmpPath);
    fail(`Không đọc được bản sao lưu: ${err.message}`);
  }

  console.log(`[restore] Nguồn : ${path.basename(source)}`);
  console.log(`[restore] Nội dung: ${tripCount} chuyến, ${userCount} thành viên`);
  console.log(`[restore] Đích  : ${DB_PATH}`);

  if (!argv.includes('--yes')) {
    const answer = await confirm('\nGhi đè database hiện tại? Hãy chắc chắn server ĐÃ DỪNG. [y/N] ');
    if (answer !== 'y' && answer !== 'yes') {
      fs.unlinkSync(tmpPath);
      console.log('[restore] Đã huỷ.');
      return;
    }
  }

  // Keep the current DB in case we need to roll back
  if (fs.existsSync(DB_PATH)) {
    const safety = `${DB_PATH}.before-restore-${Date.now()}`;
    fs.copyFileSync(DB_PATH, safety);
    console.log(`[restore] · DB cũ được giữ tại ${path.basename(safety)}`);
  }

  // Remove the old WAL/SHM, otherwise SQLite would apply the old DB's WAL onto the new DB
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = `${DB_PATH}${suffix}`;
    if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
  }

  fs.renameSync(tmpPath, DB_PATH);
  console.log('[restore] ✓ Khôi phục thành công. Khởi động lại server để áp dụng.');
}

main().catch((err) => fail(err.message));

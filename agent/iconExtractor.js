import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.join(__dirname, 'scripts', 'extract-icon.ps1');
const CACHE_DIR = path.join(__dirname, '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'icons.json');
const EXTRACTION_TIMEOUT_MS = 5000;

/** @type {Map<string, string|null>} caminho do exe -> data URL (ou null se falhou) */
const memoryCache = new Map();

function loadDiskCache() {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    for (const [key, value] of Object.entries(parsed)) {
      memoryCache.set(key, value);
    }
  } catch (err) {
    // Cache ainda não existe ou está corrompido — começa vazio, sem problema.
  }
}

function persistDiskCache() {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const obj = Object.fromEntries(memoryCache);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.warn('[IconExtractor] Não foi possível salvar o cache de ícones:', err.message);
  }
}

function runExtractScript(exePath) {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT_PATH, '-Path', exePath],
      { timeout: EXTRACTION_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => {
        if (err || !stdout) {
          resolve(null);
          return;
        }
        const base64 = stdout.trim();
        resolve(base64 ? `data:image/png;base64,${base64}` : null);
      }
    );
  });
}

/**
 * Retorna o ícone (data URL) do executável, usando cache quando possível.
 * @param {string} exePath caminho completo do .exe
 * @returns {Promise<string|null>}
 */
export async function getIconDataUrl(exePath) {
  if (!exePath) return null;

  if (memoryCache.has(exePath)) {
    return memoryCache.get(exePath);
  }

  const dataUrl = await runExtractScript(exePath);
  memoryCache.set(exePath, dataUrl);
  persistDiskCache();

  if (!dataUrl) {
    console.warn(`[IconExtractor] Não foi possível extrair ícone de: ${exePath}`);
  }

  return dataUrl;
}

loadDiskCache();

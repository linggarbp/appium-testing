/**
 * Helpers for naming and writing failure artifacts — kept free of device imports so they stay
 * unit-testable without Appium.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Turn a scenario name into a bounded, filesystem-safe stem:
 * `Adding the first product!` → `adding-the-first-product`.
 */
export function slugify(text: string, maxLength = 60): string {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (slug || 'artifact')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/** Create the directory (idempotently) and return it — callers chain straight into a write. */
export function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** `<dir>/<timestamp>-<slug>.<ext>` — the naming every failure artifact follows. */
export function artifactFile(baseDir: string, stem: string, extension: string, timestamp = Date.now()): string {
  const ext = extension.replace(/^\./, '');
  return path.join(baseDir, `${timestamp}-${slugify(stem)}.${ext}`);
}

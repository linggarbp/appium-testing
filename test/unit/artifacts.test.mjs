/**
 * Unit tests for the artifact helpers — `npm run test:unit` (node:test, no device needed).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });

const { slugify, ensureDir, artifactFile } = require('../../src/support/artifacts.ts');

test('slugify makes a filesystem-safe stem out of a scenario name', () => {
  assert.equal(
    slugify('  Adding the first product updates the cart badge  '),
    'adding-the-first-product-updates-the-cart-badge',
  );
  assert.equal(
    slugify('SMK-002 / A wrong password: "do not match"!'),
    'smk-002-a-wrong-password-do-not-match',
  );
});

test('slugify is bounded, never ends in a separator, and never comes back empty', () => {
  const long = slugify('a '.repeat(100), 20);
  assert.ok(long.length <= 20, `expected <= 20 chars, got ${long.length}`);
  assert.ok(!long.endsWith('-'), 'a truncated slug must not end in a dash');
  assert.equal(slugify('***', 20), 'artifact');
});

test('artifactFile names the file from the stem, timestamp and extension', () => {
  const file = artifactFile('/tmp/artifacts', 'SMK-001 Sign in', 'png', 1700000000000);
  assert.equal(file, path.join('/tmp/artifacts', '1700000000000-smk-001-sign-in.png'));
  assert.equal(path.extname(artifactFile('/tmp/artifacts', 'x', '.xml')), '.xml');
});

test('ensureDir creates the directory idempotently and returns it', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'appium-testing-'));
  const dir = path.join(root, 'nested', 'artifacts');
  try {
    assert.equal(ensureDir(dir), dir);
    assert.ok(fs.existsSync(dir));
    assert.equal(ensureDir(dir), dir);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['src/ofgem/cli.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  write: false,
});

const cacheDir = resolve('node_modules/.cache/price-cap');
mkdirSync(cacheDir, { recursive: true });
const tempFile = join(cacheDir, `ofgem-cli-${process.pid}.mjs`);
writeFileSync(tempFile, result.outputFiles[0].text, 'utf8');

try {
  await import(pathToFileURL(tempFile).href);
} finally {
  unlinkSync(tempFile);
}

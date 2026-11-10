import { readdir, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

/**
 * Writes `buffer` as `${stem}.${first10HexOfSha256}.${ext}` inside `baseDir`,
 * removing any other previously-hashed sibling for the same stem+ext first.
 * This gives these public/-served, non-Vite-processed assets the same
 * "content-hashed, cache-forever" property Vite already gives files under
 * src/assets — required for the long `Cache-Control: immutable` documented
 * in nginx.conf.example, without hand-rolling a bigger asset pipeline.
 */
export async function writeHashed(baseDir, stem, ext, buffer) {
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 10);
  const filename = `${stem}.${hash}.${ext}`;
  const siblingPattern = new RegExp(`^${stem}\\.[0-9a-f]{10}\\.${ext}$`);
  for (const entry of await readdir(baseDir).catch(() => [])) {
    if (siblingPattern.test(entry) && entry !== filename) await unlink(new URL(entry, baseDir));
  }
  await writeFile(new URL(filename, baseDir), buffer);
  return filename;
}

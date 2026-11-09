/**
 * La key va en Ajustes, nunca en `.env`: Expo mete en el JavaScript las
 * variables que el código lee con `process.env.…`. Este test lo vigila.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', '..');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    if (d.isDirectory()) return d.name === '__tests__' || d.name === 'test' ? [] : sources(p);
    return /\.(ts|tsx|js|jsx)$/.test(d.name) ? [p] : [];
  });
}

it('ningún archivo de la app lee process.env', () => {
  const offenders = sources(SRC).filter((f) => /process\s*\.\s*env/.test(readFileSync(f, 'utf8')));
  expect(offenders).toEqual([]);
});

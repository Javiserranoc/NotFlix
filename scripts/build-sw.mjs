// Tras `expo export`: adapta los archivos estáticos a la subruta de publicación
// y mete en dist/sw.js la lista a precachear y una versión que cambia con su
// contenido, para que cada despliegue actualice.
import { createHash } from 'node:crypto';
import { copyFileSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = 'dist';
const BASE = (process.env.BASE_PATH ?? '').replace(/\/$/, '');
// Las imágenes de arranque de iOS solo las pide el sistema al instalar.
const SKIP = /^(sw\.js$|index\.html$|404\.html$|.*\.map$|icons\/splash-)/;

const indexPath = join(DIST, 'index.html');
writeFileSync(
  indexPath,
  readFileSync(indexPath, 'utf8').replace(/href="\/(manifest\.webmanifest|icons\/)/g, `href="${BASE}/$1`),
);
// GitHub Pages sirve 404.html en las rutas que no existen como archivo:
// así funciona abrir o recargar una ruta interna.
copyFileSync(indexPath, join(DIST, '404.html'));

const manifestPath = join(DIST, 'manifest.webmanifest');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.start_url = `${BASE}/`;
manifest.scope = `${BASE}/`;
manifest.icons = manifest.icons.map((icon) => ({ ...icon, src: `${BASE}${icon.src}` }));
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const hash = createHash('sha256');
const urls = [`${BASE}/`];
for (const file of walk(DIST).sort()) {
  const rel = relative(DIST, file).split(sep).join('/');
  if (rel === 'sw.js') continue;
  hash.update(rel).update(readFileSync(file));
  if (!SKIP.test(rel)) urls.push(encodeURI(`${BASE}/${rel}`));
}

const sw = join(DIST, 'sw.js');
writeFileSync(
  sw,
  readFileSync(sw, 'utf8')
    .replace("'__VERSION__'", JSON.stringify(hash.digest('hex').slice(0, 12)))
    .replace('[/*__PRECACHE__*/]', JSON.stringify(urls)),
);
console.log(`sw.js: ${urls.length} archivos para usar sin conexión (base: "${BASE}")`);

import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const assetsDir = path.join(distDir, 'assets');
const loaderPath = path.join(distDir, 'px-loader.js');

const bootstrap = fs
  .readdirSync(assetsDir)
  .find((name) => name.startsWith('bootstrap-spa-') && name.endsWith('.js'));

if (!bootstrap) {
  console.error('[write-px-loader] Chunk bootstrap-spa introuvable dans dist/assets');
  process.exit(1);
}

const src = `/assets/${bootstrap}`;
let loader = fs.readFileSync(loaderPath, 'utf8');
loader = loader.replace('__PRIMEXPERT_BOOTSTRAP_SRC__', src);
fs.writeFileSync(loaderPath, loader);

const indexPath = path.join(distDir, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');
indexHtml = indexHtml.replace(
  /<script type="module" crossorigin src="\/assets\/index-[^"]+\.js"><\/script>\s*/g,
  ''
);
fs.writeFileSync(indexPath, indexHtml);

console.log(`[write-px-loader] bootstrap → ${src}`);

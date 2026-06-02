import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const assetsDir = path.join(distDir, 'assets');
const loaderPath = path.join(distDir, 'px-loader.js');

function findChunk(prefix) {
  return fs
    .readdirSync(assetsDir)
    .find((name) => name.startsWith(`${prefix}-`) && name.endsWith('.js'));
}

const bootstrap = findChunk('bootstrap-spa');
const gate = findChunk('gate');

if (!bootstrap) {
  console.error('[write-px-loader] Chunk bootstrap-spa introuvable dans dist/assets');
  process.exit(1);
}
if (!gate) {
  console.error('[write-px-loader] Chunk gate introuvable dans dist/assets');
  process.exit(1);
}

const bootstrapSrc = `/assets/${bootstrap}`;
const gateSrc = `/assets/${gate}`;

let loader = fs.readFileSync(loaderPath, 'utf8');
loader = loader.replace('__PRIMEXPERT_BOOTSTRAP_SRC__', bootstrapSrc);
loader = loader.replace('__PRIMEXPERT_GATE_SRC__', gateSrc);
fs.writeFileSync(loaderPath, loader);

const indexPath = path.join(distDir, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');
indexHtml = indexHtml.replace(
  /<script type="module" crossorigin src="\/assets\/index-[^"]+\.js"><\/script>\s*/g,
  ''
);
fs.writeFileSync(indexPath, indexHtml);

console.log(`[write-px-loader] bootstrap → ${bootstrapSrc}`);
console.log(`[write-px-loader] gate → ${gateSrc}`);

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const copyPairs = [
  ['node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', 'public/pdfjs/pdf.worker.min.js'],
  ['node_modules/tesseract.js/dist/worker.min.js', 'public/tesseract/worker/worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core.wasm.js', 'public/tesseract/core/tesseract-core.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd.wasm.js', 'public/tesseract/core/tesseract-core-simd.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'public/tesseract/core/tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'public/tesseract/core/tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core.wasm', 'public/tesseract/core/tesseract-core.wasm'],
  ['node_modules/tesseract.js-core/tesseract-core-simd.wasm', 'public/tesseract/core/tesseract-core-simd.wasm'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm', 'public/tesseract/core/tesseract-core-lstm.wasm'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm', 'public/tesseract/core/tesseract-core-simd-lstm.wasm'],
];

copyPairs.forEach(([sourceRelative, targetRelative]) => {
  const sourcePath = path.resolve(projectRoot, sourceRelative);
  const targetPath = path.resolve(projectRoot, targetRelative);

  if (!existsSync(sourcePath)) {
    throw new Error(`OCR asset source not found: ${sourceRelative}`);
  }

  mkdirSync(path.dirname(targetPath), { recursive: true });
  cpSync(sourcePath, targetPath, { force: true });
});

const localLanguageFiles = [
  'public/tesseract/lang-data/eng.traineddata.gz',
];

const missingLanguageFiles = localLanguageFiles.filter((fileRelative) => !existsSync(path.resolve(projectRoot, fileRelative)));
if (missingLanguageFiles.length > 0) {
  console.warn(
    `Missing local OCR language data: ${missingLanguageFiles.join(', ')}. ` +
    'OCR will fall back to network only if your runtime code still points to a CDN.'
  );
}

console.log('PDF and OCR assets synced to public/.');

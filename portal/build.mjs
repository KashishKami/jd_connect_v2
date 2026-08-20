import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWatch = process.argv.includes('--watch');

const distDir = path.resolve(__dirname, 'dist');
const srcDir = path.resolve(__dirname, 'src');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy styles.css to dist/
const cssSrc = path.resolve(srcDir, 'styles.css');
const cssDist = path.resolve(distDir, 'styles.css');
if (fs.existsSync(cssSrc)) {
  fs.copyFileSync(cssSrc, cssDist);
}

// Copy index.html to dist/
const htmlSrc = path.resolve(__dirname, 'index.html');
const htmlDist = path.resolve(distDir, 'index.html');
if (fs.existsSync(htmlSrc)) {
  fs.copyFileSync(htmlSrc, htmlDist);
}

const buildOptions = {
  entryPoints: [path.resolve(srcDir, 'index.ts')],
  bundle: true,
  outfile: path.resolve(distDir, 'bundle.js'),
  format: 'esm',
  target: ['es2022'],
  sourcemap: true,
  minify: !isWatch,
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.info('Watching portal for changes...');
} else {
  await esbuild.build(buildOptions);
  console.info('Portal built successfully.');
}

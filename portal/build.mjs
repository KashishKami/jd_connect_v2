import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read root .env file manually
const envPath = path.resolve(__dirname, '../.env');
const envVars = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      envVars[key] = val;
    }
  });
}

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

// BACKEND_URL resolution order:
// 1. Docker build arg (process.env.BACKEND_URL) — set by compose build.args
// 2. Root .env file — used in local dev (pnpm build / pnpm dev)
// 3. Hardcoded fallback for local dev without .env
const backendUrl = process.env.BACKEND_URL || envVars.BACKEND_URL || 'http://127.0.0.1:4000';

const buildOptions = {
  entryPoints: [path.resolve(srcDir, 'index.ts')],
  bundle: true,
  outfile: path.resolve(distDir, 'bundle.js'),
  format: 'esm',
  target: ['es2022'],
  sourcemap: true,
  minify: !isWatch,
  define: {
    'process.env.BACKEND_URL': JSON.stringify(backendUrl),
  },
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.info(`Watching portal for changes... (BACKEND_URL=${backendUrl})`);
} else {
  await esbuild.build(buildOptions);
  console.info(`Portal built successfully. (BACKEND_URL=${backendUrl})`);
}

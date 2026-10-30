import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const distAssets = path.join(distDir, 'assets');
const rootAssets = path.join(rootDir, 'assets');

console.log('Copying production distribution to repository root for GitHub Pages...');

// Ensure root assets directory exists
if (!fs.existsSync(rootAssets)) {
  fs.mkdirSync(rootAssets, { recursive: true });
}

// Copy assets from dist/assets to root/assets
if (fs.existsSync(distAssets)) {
  const files = fs.readdirSync(distAssets);
  for (const file of files) {
    fs.copyFileSync(path.join(distAssets, file), path.join(rootAssets, file));
    console.log(`Copied assets/${file}`);
  }
}

// Copy dist/index.html to root index.html
const distIndex = path.join(distDir, 'index.html');
const rootIndex = path.join(rootDir, 'index.html');
if (fs.existsSync(distIndex)) {
  // First save index.source.html if not already saved
  const sourceIndex = path.join(rootDir, 'index.source.html');
  if (!fs.existsSync(sourceIndex)) {
    fs.copyFileSync(rootIndex, sourceIndex);
    console.log('Saved index.source.html template');
  }
  fs.copyFileSync(distIndex, rootIndex);
  console.log('Updated root index.html with production bundle');
}

console.log('GitHub Pages root distribution sync complete!');

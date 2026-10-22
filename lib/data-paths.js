const fs = require('fs');
const path = require('path');

const BUNDLED_DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_DIR = process.env.VERCEL === '1' ? path.join('/tmp', 'stashov-data') : BUNDLED_DATA_DIR;
const IMAGE_DIR = path.join(DATA_DIR, 'images');
const BUNDLED_IMAGE_DIR = path.join(BUNDLED_DATA_DIR, 'images');
const VAULT_PATH = path.join(DATA_DIR, 'vault.json');
const SECTIONS_PATH = path.join(DATA_DIR, 'sections.json');

if (DATA_DIR !== BUNDLED_DATA_DIR) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const name of ['vault.json', 'sections.json']) {
    const source = path.join(BUNDLED_DATA_DIR, name);
    const destination = path.join(DATA_DIR, name);
    if (!fs.existsSync(destination) && fs.existsSync(source)) fs.copyFileSync(source, destination);
  }
}

module.exports = { BUNDLED_DATA_DIR, BUNDLED_IMAGE_DIR, DATA_DIR, IMAGE_DIR, SECTIONS_PATH, VAULT_PATH };

const fs = require('fs');
const path = require('path');
const { resolveImage } = require('../lib/image-cache');

const vaultPath = path.join(__dirname, '..', 'data', 'vault.json');

async function main() {
  const vault = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
  const wishlist = vault.wishlist || [];
  let cursor = 0;
  let changed = 0;

  async function worker() {
    while (cursor < wishlist.length) {
      const item = wishlist[cursor++];
      if (item.image) continue;
      try {
        const image = await resolveImage(item.url, { pageUrl: item.url });
        if (image) {
          item.image = image;
          item.image_source = item.url;
          changed += 1;
          console.log(`Saved image for ${item.title}`);
        }
      } catch (err) {
        console.log(`No image for ${item.title}: ${err.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: 3 }, worker));
  fs.writeFileSync(vaultPath, JSON.stringify(vault, null, 2), 'utf8');
  console.log(`Updated ${changed} wishlist images.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

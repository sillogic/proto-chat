const sharp = require('../node_modules/sharp/lib/index.js');

async function generate() {
  const src = './public/logo.png';

  const regular = [
    { out: './public/icons/icon-192x192.png', size: 192 },
    { out: './public/icons/icon-512x512.png', size: 512 },
    { out: './public/apple-touch-icon.png', size: 180 },
    { out: './public/avatars/lobe-ai.png', size: 512 },
  ];

  for (const { out, size } of regular) {
    await sharp(src).resize(size, size).png().toFile(out);
    console.log('Generated', out);
  }

  const maskable = [
    { out: './public/icons/icon-192x192.maskable.png', size: 192 },
    { out: './public/icons/icon-512x512.maskable.png', size: 512 },
  ];

  for (const { out, size } of maskable) {
    const inner = Math.round(size * 0.76);
    const offset = Math.round((size - inner) / 2);
    const resized = await sharp(src).resize(inner, inner).png().toBuffer();
    await sharp({
      create: {
        background: { alpha: 0, b: 0, g: 0, r: 0 },
        channels: 4,
        height: size,
        width: size,
      },
    })
      .composite([{ input: resized, left: offset, top: offset }])
      .png()
      .toFile(out);
    console.log('Generated maskable', out);
  }

  console.log('All done!');
}

generate().catch(console.error);

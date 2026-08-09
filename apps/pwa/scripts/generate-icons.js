const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const publicDir = path.join(__dirname, '../public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

function getSvgIcon(width, height) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#065f46" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a7f3d0" />
      <stop offset="100%" stop-color="#34d399" />
    </linearGradient>
  </defs>
  <!-- Background with maskable safe padding -->
  <rect width="${width}" height="${height}" rx="${width * 0.22}" fill="url(#bgGrad)" />
  
  <!-- Subtle decorative ring -->
  <circle cx="${width / 2}" cy="${height / 2}" r="${width * 0.38}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="${width * 0.02}" />
  
  <!-- Inner Chef Badge -->
  <rect x="${width * 0.2}" y="${height * 0.2}" width="${width * 0.6}" height="${height * 0.6}" rx="${width * 0.15}" fill="rgba(255,255,255,0.08)" />

  <!-- Emoji Icon / Chef Symbol -->
  <text x="50%" y="54%" font-size="${width * 0.4}px" text-anchor="middle" dominant-baseline="middle" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">🍳</text>
</svg>`;
}

async function buildIcons() {
  console.log('Generating PWA icons...');

  const icon192Svg = Buffer.from(getSvgIcon(192, 192));
  await sharp(icon192Svg).png().toFile(path.join(publicDir, 'icon-192.png'));
  console.log('✔ Generated icon-192.png');

  const icon512Svg = Buffer.from(getSvgIcon(512, 512));
  await sharp(icon512Svg).png().toFile(path.join(publicDir, 'icon-512.png'));
  console.log('✔ Generated icon-512.png');

  const appleIconSvg = Buffer.from(getSvgIcon(180, 180));
  await sharp(appleIconSvg).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✔ Generated apple-touch-icon.png');

  const faviconSvg = Buffer.from(getSvgIcon(64, 64));
  await sharp(faviconSvg).png().toFile(path.join(publicDir, 'favicon.ico'));
  console.log('✔ Generated favicon.ico');

  console.log('All PWA icons generated successfully!');
}

buildIcons().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});

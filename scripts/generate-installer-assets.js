const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

// NSIS header (150x57 BMP) - 使用 sharp 的 raw 输出然后手动转 BMP
const HEADER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="150" height="57" viewBox="0 0 150 57">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4c6ef5"/>
      <stop offset="100%" style="stop-color:#3b5bdb"/>
    </linearGradient>
  </defs>
  <rect width="150" height="57" fill="url(#bg)"/>
  <text x="75" y="35" font-family="Segoe UI, Arial" font-size="18" font-weight="bold" fill="white" text-anchor="middle">ClipMaster</text>
</svg>
`

// Welcome sidebar (164x314 BMP)
const WELCOME_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="164" height="314" viewBox="0 0 164 314">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#4c6ef5"/>
      <stop offset="50%" style="stop-color:#3b5bdb"/>
      <stop offset="100%" style="stop-color:#364fc7"/>
    </linearGradient>
  </defs>
  <rect width="164" height="314" fill="url(#bg)"/>
  <circle cx="130" cy="50" r="30" fill="rgba(255,255,255,0.06)"/>
  <circle cx="40" cy="280" r="25" fill="rgba(255,255,255,0.04)"/>
  <g transform="translate(82, 100)">
    <rect x="-25" y="-30" width="50" height="60" rx="6" fill="white" opacity="0.95"/>
    <rect x="-15" y="-38" width="30" height="16" rx="4" fill="white" opacity="0.9"/>
    <rect x="-10" y="-35" width="20" height="10" rx="3" fill="url(#bg)" opacity="0.2"/>
    <rect x="-18" y="-15" width="36" height="3" rx="1.5" fill="url(#bg)" opacity="0.15"/>
    <rect x="-18" y="-8" width="28" height="3" rx="1.5" fill="url(#bg)" opacity="0.12"/>
    <rect x="-18" y="-1" width="32" height="3" rx="1.5" fill="url(#bg)" opacity="0.15"/>
    <rect x="-18" y="6" width="24" height="3" rx="1.5" fill="url(#bg)" opacity="0.12"/>
    <circle cx="18" cy="18" r="12" fill="#20c997"/>
    <path d="M13 18 L16 21 L23 14" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <text x="82" y="200" font-family="Segoe UI, Arial" font-size="16" font-weight="bold" fill="white" text-anchor="middle">ClipMaster</text>
  <text x="82" y="218" font-family="Segoe UI, Arial" font-size="9" fill="rgba(255,255,255,0.7)" text-anchor="middle">剪贴板管理器</text>
</svg>
`

// Simple BMP file creator (24-bit uncompressed)
function createBMP(width, height, rgbData) {
  const rowSize = Math.ceil((width * 3) / 4) * 4 // Rows must be aligned to 4 bytes
  const pixelDataSize = rowSize * height
  const fileSize = 54 + pixelDataSize

  const buffer = Buffer.alloc(fileSize)

  // BMP Header
  buffer.write('BM', 0) // Signature
  buffer.writeUInt32LE(fileSize, 2) // File size
  buffer.writeUInt32LE(0, 6) // Reserved
  buffer.writeUInt32LE(54, 10) // Pixel data offset

  // DIB Header (BITMAPINFOHEADER)
  buffer.writeUInt32LE(40, 14) // Header size
  buffer.writeInt32LE(width, 18) // Width
  buffer.writeInt32LE(height, 22) // Height (positive = bottom-up)
  buffer.writeUInt16LE(1, 26) // Color planes
  buffer.writeUInt16LE(24, 28) // Bits per pixel
  buffer.writeUInt32LE(0, 30) // Compression (none)
  buffer.writeUInt32LE(pixelDataSize, 34) // Image size
  buffer.writeInt32LE(2835, 38) // X pixels per meter
  buffer.writeInt32LE(2835, 42) // Y pixels per meter
  buffer.writeUInt32LE(0, 46) // Colors in palette
  buffer.writeUInt32LE(0, 50) // Important colors

  // Write pixel data (BMP stores bottom-to-top, BGR order)
  for (let y = 0; y < height; y++) {
    const srcRow = (height - 1 - y) * width * 3
    const dstRow = 54 + y * rowSize
    for (let x = 0; x < width; x++) {
      const srcIdx = srcRow + x * 3
      const dstIdx = dstRow + x * 3
      buffer[dstIdx] = rgbData[srcIdx + 2]     // B
      buffer[dstIdx + 1] = rgbData[srcIdx + 1] // G
      buffer[dstIdx + 2] = rgbData[srcIdx]     // R
    }
  }

  return buffer
}

async function generate() {
  const installerDir = path.join(__dirname, '..', 'installer')

  // Generate header BMP
  const headerPng = await sharp(Buffer.from(HEADER_SVG))
    .resize(150, 57)
    .raw()
    .toBuffer({ resolveWithObject: true })
  const headerBmp = createBMP(150, 57, headerPng.data)
  fs.writeFileSync(path.join(installerDir, 'header.bmp'), headerBmp)
  console.log('✓ Generated header.bmp')

  // Generate welcome sidebar BMP
  const welcomePng = await sharp(Buffer.from(WELCOME_SVG))
    .resize(164, 314)
    .raw()
    .toBuffer({ resolveWithObject: true })
  const welcomeBmp = createBMP(164, 314, welcomePng.data)
  fs.writeFileSync(path.join(installerDir, 'welcome.bmp'), welcomeBmp)
  console.log('✓ Generated welcome.bmp')

  console.log('\n✅ Installer assets generated!')
}

generate().catch(err => {
  console.error('Failed:', err)
  process.exit(1)
})

const sharp = require('sharp')
const toIco = require('to-ico')
const fs = require('fs')
const path = require('path')

const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="120" y1="80" x2="904" y2="944" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#22304B"/>
      <stop offset="0.52" stop-color="#0E766E"/>
      <stop offset="1" stop-color="#F59E0B"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(280 196) rotate(48) scale(620)">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.34"/>
      <stop offset="0.44" stop-color="#FFFFFF" stop-opacity="0.08"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="paper" x1="346" y1="232" x2="680" y2="786" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#EAF3F0"/>
    </linearGradient>
    <linearGradient id="clip" x1="410" y1="160" x2="612" y2="326" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#F8FAFC"/>
      <stop offset="1" stop-color="#BFEDE7"/>
    </linearGradient>
    <linearGradient id="accent" x1="374" y1="394" x2="708" y2="610" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#14B8A6"/>
      <stop offset="0.55" stop-color="#6366F1"/>
      <stop offset="1" stop-color="#F97316"/>
    </linearGradient>
    <filter id="tileShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="24" stdDeviation="32" flood-color="#0B1220" flood-opacity="0.28"/>
    </filter>
    <filter id="paperShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="26" flood-color="#0B1220" flood-opacity="0.36"/>
    </filter>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#0B1220" flood-opacity="0.24"/>
    </filter>
  </defs>

  <rect x="40" y="40" width="944" height="944" rx="214" fill="url(#bg)" filter="url(#tileShadow)"/>
  <rect x="40" y="40" width="944" height="944" rx="214" fill="url(#glow)"/>
  <path d="M760 88C847 116 922 195 947 288C882 256 801 250 732 279C690 296 656 322 628 353C592 276 635 149 760 88Z" fill="#FFFFFF" opacity="0.08"/>
  <path d="M116 720C198 656 299 650 372 696C440 739 478 818 474 924H228C170 881 131 810 116 720Z" fill="#FFFFFF" opacity="0.07"/>

  <g filter="url(#paperShadow)">
    <rect x="252" y="306" width="412" height="520" rx="72" fill="#B7F2E8" opacity="0.35"/>
    <rect x="316" y="244" width="424" height="556" rx="76" fill="url(#paper)"/>
    <rect x="356" y="286" width="344" height="472" rx="48" fill="#FFFFFF" opacity="0.62"/>
  </g>

  <g filter="url(#softShadow)">
    <path d="M418 266C418 212 460 170 512 170C564 170 606 212 606 266H648C673 266 694 287 694 312V346H330V312C330 287 351 266 376 266H418Z" fill="url(#clip)"/>
    <path d="M468 262C468 238 488 218 512 218C536 218 556 238 556 262H468Z" fill="#22304B" opacity="0.88"/>
    <rect x="374" y="336" width="276" height="30" rx="15" fill="#0F766E" opacity="0.18"/>
  </g>

  <g>
    <rect x="388" y="430" width="266" height="34" rx="17" fill="#0F766E" opacity="0.20"/>
    <rect x="388" y="498" width="226" height="34" rx="17" fill="#22304B" opacity="0.18"/>
    <rect x="388" y="566" width="284" height="34" rx="17" fill="#F97316" opacity="0.20"/>
    <rect x="388" y="634" width="186" height="34" rx="17" fill="#6366F1" opacity="0.20"/>
  </g>

  <g filter="url(#softShadow)">
    <rect x="594" y="594" width="182" height="182" rx="50" fill="url(#accent)"/>
    <path d="M664 642H718C734 642 746 655 746 670V724" fill="none" stroke="#FFFFFF" stroke-width="28" stroke-linecap="round"/>
    <path d="M706 746H652C636 746 624 733 624 718V664" fill="none" stroke="#FFFFFF" stroke-width="28" stroke-linecap="round"/>
  </g>

  <path d="M216 191L240 247L300 256L256 297L267 356L216 328L164 356L176 297L132 256L192 247Z" fill="#FFFFFF" opacity="0.16"/>
  <path d="M814 706L830 744L870 750L841 778L848 818L814 799L778 818L786 778L756 750L797 744Z" fill="#FFFFFF" opacity="0.16"/>
</svg>
`

async function generate() {
  const publicDir = path.join(__dirname, '..', 'public')
  const svgBuffer = Buffer.from(SVG.trim())
  const icoSizes = [16, 24, 32, 48, 64, 128, 256]
  const pngBuffers = []

  fs.mkdirSync(publicDir, { recursive: true })

  for (const size of icoSizes) {
    const png = await sharp(svgBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    pngBuffers.push(png)
    console.log(`Generated ${size}x${size} PNG`)
  }

  const largePng = await sharp(svgBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  fs.writeFileSync(path.join(publicDir, 'icon.png'), largePng)
  console.log('Generated icon.png')

  const icoBuffer = await toIco(pngBuffers)
  fs.writeFileSync(path.join(publicDir, 'icon.ico'), icoBuffer)
  console.log('Generated icon.ico')

  fs.writeFileSync(path.join(publicDir, 'icon.svg'), SVG.trim())
  console.log('Generated icon.svg')
}

generate().catch(err => {
  console.error('Failed to generate icons:', err)
  process.exit(1)
})

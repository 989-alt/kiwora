// Generates the PWA icons from public/pots/happy.png (run: node scripts/make-icons.mjs).
import sharp from 'sharp'

const src = 'public/pots/happy.png'
const bg = '#F0FDF4'
for (const size of [192, 512]) {
  const inner = Math.round(size * 0.78)
  const art = await sharp(src).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: art, gravity: 'center' }])
    .png()
    .toFile(`public/icon-${size}.png`)
}
console.log('icons written')

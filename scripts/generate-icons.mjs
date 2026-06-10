import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const assetsDir = path.join(__dirname, '..', 'assets')

const logoPath = path.join(assetsDir, 'logo-sismei.webp')

// 1. adaptive-icon-foreground.png — logo com padding em fundo transparente 1024x1024
await sharp(logoPath)
  .resize(700, 700, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 162, bottom: 162, left: 162, right: 162, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(path.join(assetsDir, 'adaptive-icon-foreground.png'))

console.log('✅ adaptive-icon-foreground.png gerado (1024x1024, fundo transparente)')

// 2. icon.png — logo em fundo roxo 1024x1024
const svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" rx="180" fill="#7C3AED"/>
</svg>`

const logoResized = await sharp(logoPath)
  .resize(680, 680, { fit: 'contain', background: { r: 124, g: 58, b: 237, alpha: 1 } })
  .png()
  .toBuffer()

await sharp(Buffer.from(svg))
  .composite([{ input: logoResized, gravity: 'center' }])
  .resize(1024, 1024)
  .png()
  .toFile(path.join(assetsDir, 'icon.png'))

console.log('✅ icon.png gerado (1024x1024, fundo roxo)')

import { describe, expect, it } from 'vitest'
import { checkUpload, publishIssues } from './validation'
import { createStarterConfig } from './starters'

const file = (bytes: number[] | string, name: string, pad = 0) => {
  const head = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : new Uint8Array(bytes)
  return new File([head, new Uint8Array(pad)], name)
}

describe('checkUpload', () => {
  it('identifies images by their bytes, not their name', async () => {
    expect(await checkUpload(file([0xff, 0xd8, 0xff, 0xe0], 'photo.jpg'), 'image')).toMatchObject({ ok: true, mime: 'image/jpeg' })
    expect(await checkUpload(file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'x.png'), 'image')).toMatchObject({ ok: true, mime: 'image/png' })
    expect(await checkUpload(file('RIFF\0\0\0\0WEBPVP8 ', 'x.webp'), 'image')).toMatchObject({ ok: true, mime: 'image/webp' })
    expect(await checkUpload(file('<svg onload="alert(1)">', 'evil.png'), 'image')).toMatchObject({ ok: false })
    expect(await checkUpload(file('<html><script>', 'page.jpg'), 'image')).toMatchObject({ ok: false })
  })

  it('enforces size limits', async () => {
    const big = file([0xff, 0xd8, 0xff], 'huge.jpg', 16 * 1024 * 1024)
    const r = await checkUpload(big, 'image')
    expect(r.ok).toBe(false)
  })

  it('accepts GLB and self-contained glTF only', async () => {
    expect(await checkUpload(file('glTF\x02\0\0\0', 'chair.glb'), 'model')).toMatchObject({ ok: true, mime: 'model/gltf-binary' })
    const embedded = JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'data:application/octet-stream;base64,AAAA' }] })
    expect(await checkUpload(file(embedded, 'chair.gltf'), 'model')).toMatchObject({ ok: true })
    const external = JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'https://tracker.example/b.bin' }] })
    expect(await checkUpload(file(external, 'chair.gltf'), 'model')).toMatchObject({ ok: false })
    expect(await checkUpload(file('not json', 'chair.gltf'), 'model')).toMatchObject({ ok: false })
    expect(await checkUpload(file([0xff, 0xd8, 0xff], 'chair.glb'), 'model')).toMatchObject({ ok: false })
  })
})

describe('publishIssues', () => {
  it('requires a name, matching media, alt text and a safe link', () => {
    const base = createStarterConfig('editorial', 'photo', '', 'x')
    expect(publishIssues(base).map((i) => i.field).sort()).toEqual(['images', 'productName'])
    const ok = { ...base, productName: 'Cuff', images: [{ src: 'asset:1', alt: 'Cuff' }], purchaseUrl: 'https://shop.example.com/cuff' }
    expect(publishIssues(ok)).toEqual([])
    expect(publishIssues({ ...ok, images: [{ src: 'asset:1', alt: ' ' }] })).toHaveLength(1)
    expect(publishIssues({ ...ok, mode: 'true3d' })[0]?.field).toBe('model')
  })
})

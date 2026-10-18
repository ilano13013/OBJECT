import type { Plugin } from 'vite'

/** Preloads the two fonts the hero needs on first paint (Archivo display, Inter Tight text, latin subsets). */
export function fontPreload(): Plugin {
  const wanted = [/archivo-latin-wdth-normal-.*\.woff2$/, /inter-tight-latin-wght-normal-.*\.woff2$/]
  return {
    name: 'object-font-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return []
        return Object.keys(ctx.bundle)
          .filter((f) => wanted.some((r) => r.test(f)))
          .map((f) => ({ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `/${f}`, crossorigin: '' }, injectTo: 'head' as const }))
      },
    },
  }
}

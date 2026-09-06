// Runs after `vite build`: SSR-renders the Landing page (src/entry-server.jsx)
// and bakes the resulting HTML into dist/index.html's <div id="root">, so the
// static file served for "/" already contains real, crawlable content.
import { build } from 'vite'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ssrOutDir = 'dist-ssr'

async function main() {
  await build({
    root,
    configFile: path.join(root, 'vite.config.js'),
    build: {
      ssr: 'src/entry-server.jsx',
      outDir: ssrOutDir,
      emptyOutDir: true,
      rollupOptions: { output: {} },
    },
  })

  const { renderLanding } = await import(
    path.join(root, ssrOutDir, 'entry-server.js')
  )
  const appHtml = renderLanding()

  const indexPath = path.join(root, 'dist', 'index.html')
  const template = readFileSync(indexPath, 'utf-8')
  if (!template.includes('<div id="root"></div>')) {
    throw new Error('prerender: <div id="root"></div> not found in dist/index.html')
  }
  const output = template.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
  writeFileSync(indexPath, output)

  rmSync(path.join(root, ssrOutDir), { recursive: true, force: true })

  console.log(`Prerendered Landing page into dist/index.html (${appHtml.length} chars)`)
}

main().catch(err => {
  console.error('Prerender failed:', err)
  process.exit(1)
})

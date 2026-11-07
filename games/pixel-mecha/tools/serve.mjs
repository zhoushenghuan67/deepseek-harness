/**
 * 静态服务器：给 Demo 提供本地托管（ES Module 需要 http 协议，file:// 无法加载）。
 *
 * 用法：node games/pixel-mecha/tools/serve.mjs [端口]
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const port = Number.parseInt(process.argv[2] ?? '8080', 10)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8',
}

createServer((request, response) => {
  const requested = new URL(request.url ?? '/', 'http://localhost').pathname
  const relative = normalize(decodeURIComponent(requested)).replace(/^(\.\.[/\\])+/, '')
  let filePath = join(root, relative)

  if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = join(filePath, 'index.html')
  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('404 Not Found')
    return
  }

  response.writeHead(200, {
    'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  })
  createReadStream(filePath).pipe(response)
}).listen(port, () => {
  console.log(`PIXEL MECHA DUEL: http://localhost:${port}/`)
})

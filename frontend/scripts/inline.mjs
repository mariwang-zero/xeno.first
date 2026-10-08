// dist-demo/index.html 의 JS·CSS 를 한 파일에 넣어 Artifact 로 올릴 수 있게 만든다.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
const dir = new URL('../dist-demo/', import.meta.url)
let html = readFileSync(new URL('index.html', dir), 'utf8')
const assets = readdirSync(new URL('assets/', dir))
const js = assets.filter(f => f.endsWith('.js')).map(f => readFileSync(new URL('assets/' + f, dir), 'utf8')).join('\n')
const css = assets.filter(f => f.endsWith('.css')).map(f => readFileSync(new URL('assets/' + f, dir), 'utf8')).join('\n')
html = html
  .replace(/<script type="module" crossorigin src="[^"]+"><\/script>/, '')
  .replace(/<link rel="stylesheet" crossorigin href="\.\/assets\/[^"]+">/, '')
const head = html.match(/<title>[\s\S]*?<\/title>/)[0] + '\n' + (html.match(/<link rel="(preconnect|stylesheet)" href="https:[^>]+>/g) || []).join('\n')
const out = `${head}\n<style>\n${css}\n</style>\n<div id="app"></div>\n<script type="module">\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>\n`
writeFileSync(new URL('demo.html', dir), out)
console.log('demo.html', out.length, 'bytes')

// GitHub Pages 용: 저장소 맨 위 index.html (완전한 HTML 문서)
if (process.argv.includes('--pages')) {
  const page = `<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />\n<meta name="description" content="제품 매뉴얼의 초안, 수정 요청, 개정을 관리하는 사내 도구 데모 (예시 데이터)" />\n${out.replace('<div id="app"></div>', '</head>\n<body>\n<div id="app"></div>')}</body>\n</html>\n`
  writeFileSync(new URL('../../index.html', import.meta.url), page)
  console.log('../index.html written')
}

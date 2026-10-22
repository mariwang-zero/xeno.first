// 뷰어용 원본 모양(PDF) 만들기. 올린 워드(.docx/.doc)는 그대로 두고, 같은 모양의 PDF 를 앱 데이터 폴더에 따로 만든다.
// 윈도우에 워드가 있으면 워드로(워드에서 보는 것과 같은 모양), 없으면 LibreOffice 로 바꾼다.
// 같은 파일은 한 번만 바꾸고, 한 번에 하나씩 차례로 바꾼다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'

const WORD_PS = `
$ErrorActionPreference = 'Stop'
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {
  $d = $w.Documents.Open($env:PREVIEW_SRC, $false, $true, $false)
  $d.ExportAsFixedFormat($env:PREVIEW_OUT, 17)
  $d.Close(0)
} finally {
  $w.Quit()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($w)
}`

function run(cmd, args, opts = {}) {
  return new Promise((ok, no) => execFile(cmd, args, { timeout: 180000, windowsHide: true, ...opts }, (e, _out, err) => (e ? no(new Error((err || e.message).toString().trim().slice(0, 300))) : ok())))
}
function findSoffice(given) {
  const list = [given, 'C:\\Program Files\\LibreOffice\\program\\soffice.exe', 'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe', '/usr/bin/soffice', '/usr/local/bin/soffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice']
  return list.find(p => p && fs.existsSync(p)) || null
}

export function createPreviews({ dataDir, filesDir, mode = 'auto', sofficePath = '' }) {
  const dir = path.join(dataDir, 'previews')
  fs.mkdirSync(dir, { recursive: true })
  const soffice = findSoffice(sofficePath)
  const useWord = process.platform === 'win32' && (mode === 'auto' || mode === 'word')
  const useOffice = !!soffice && (mode === 'auto' || mode === 'libreoffice')
  const failed = new Map() // key → 실패 이유
  const queued = new Set()
  let chain = Promise.resolve()

  const keyOf = rel => crypto.createHash('sha1').update(rel).digest('hex').slice(0, 16)
  const fileOf = key => path.join(dir, key + '.pdf')
  const isWord = rel => /\.docx?$/i.test(rel || '')

  async function convert(rel, key) {
    const src = path.join(filesDir, rel)
    // NAS 경로·한글 이름·열려 있는 파일 문제를 피하려고 임시 폴더에 복사본을 만들어 바꾼다
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-preview-'))
    const copy = path.join(tmp, 'src' + path.extname(rel).toLowerCase())
    const out = path.join(tmp, 'src.pdf')
    try {
      fs.copyFileSync(src, copy)
      let done = false, why = ''
      if (useWord) {
        try {
          await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', WORD_PS], { env: { ...process.env, PREVIEW_SRC: copy, PREVIEW_OUT: out } })
          done = fs.existsSync(out)
        } catch (e) { why = '워드 변환 실패: ' + e.message }
      }
      if (!done && useOffice) {
        try {
          await run(soffice, ['--headless', '--norestore', '--convert-to', 'pdf', '--outdir', tmp, copy])
          done = fs.existsSync(out)
        } catch (e) { why = 'LibreOffice 변환 실패: ' + e.message }
      }
      if (!done) throw new Error(why || '워드나 LibreOffice 가 없어 PDF 를 만들 수 없습니다.')
      fs.copyFileSync(out, fileOf(key))
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  }

  // rel(매뉴얼 폴더 안 경로)의 PDF 를 만들도록 줄 세운다
  function request(rel) {
    if (mode === 'off' || !isWord(rel)) return
    const key = keyOf(rel)
    if (queued.has(key) || failed.has(key) || fs.existsSync(fileOf(key))) return
    queued.add(key)
    chain = chain.then(async () => {
      try {
        await convert(rel, key)
        console.log('[미리보기 PDF]', rel)
      } catch (e) {
        failed.set(key, e.message)
        console.error('[미리보기 PDF 실패]', rel, e.message)
      } finally {
        queued.delete(key)
      }
    })
  }
  // 뷰어에 줄 상태: { pdf: 주소 } 또는 { previewPending: true } 또는 { previewError }
  function status(rel) {
    if (!isWord(rel)) return {}
    const key = keyOf(rel)
    if (fs.existsSync(fileOf(key))) return { pdf: `/api/previews/${key}` }
    if (queued.has(key)) return { previewPending: true }
    if (failed.has(key)) return { previewError: '원본 모양(PDF)을 만들지 못해 글자만 보여 줍니다.' }
    if (mode === 'off' || (!useWord && !useOffice)) return {}
    request(rel)
    return { previewPending: true }
  }
  function file(key) {
    return /^[0-9a-f]{16}$/.test(key) && fs.existsSync(fileOf(key)) ? fileOf(key) : null
  }
  return { request, status, file, how: useWord ? '워드' + (useOffice ? ' (안 되면 LibreOffice)' : '') : useOffice ? 'LibreOffice' : '없음' }
}

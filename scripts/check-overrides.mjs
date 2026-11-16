#!/usr/bin/env node
// 校验 package.json 的 overrides 与实际安装版本是否一致（CI 门禁，在 lint 之后调用）。
//
// 检查规则：
//   1) overrides 中每一项必须是精确版本号（X.Y.Z，可带 v/= 前缀），范围写法无法校验会直接判失败；
//   2) package-lock.json 根级解析出的版本必须与 overrides 完全一致；
//   3) node_modules 里实际安装的根级副本版本必须一致（存在 node_modules 时）；
//   4) 依赖树里若存在同包不同版本的嵌套副本，仅提示不失败（npm overrides 不作用于传递依赖的独立副本）。
//
// 任何不一致 → 输出 FAIL 明细并以退出码 1 结束。
//
// 用法：node scripts/check-overrides.mjs
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const overrides = pkg.overrides || {}
const EXACT = /^(?:=|v)?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/

function readLockfileVersions(name) {
  const lockPath = resolve(root, 'package-lock.json')
  if (!existsSync(lockPath)) return null
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
  const entries = lock.packages || {}
  const rootKey = `node_modules/${name}`
  const result = { root: entries[rootKey] ? entries[rootKey].version : null, nested: [] }
  for (const [key, meta] of Object.entries(entries)) {
    if (key !== rootKey && key.endsWith(`/node_modules/${name}`)) {
      result.nested.push({ key, version: meta.version })
    }
  }
  return result
}

function readInstalledVersion(name) {
  const pj = resolve(root, 'node_modules', name, 'package.json')
  if (!existsSync(pj)) return null
  try {
    return JSON.parse(readFileSync(pj, 'utf8')).version
  } catch {
    return null
  }
}

const names = Object.keys(overrides)
if (names.length === 0) {
  console.log('check-overrides: package.json 未声明 overrides，无需检查。')
  process.exit(0)
}

let failures = 0
for (const name of names) {
  const spec = String(overrides[name]).trim()
  const match = EXACT.exec(spec)
  if (!match) {
    console.error(`FAIL ${name}: override "${spec}" 不是精确版本号，本检查仅支持精确钉版`)
    failures++
    continue
  }
  const expected = match[1]
  const lock = readLockfileVersions(name)
  if (!lock) {
    console.error(`FAIL ${name}: package-lock.json 缺失或无法解析`)
    failures++
    continue
  }
  if (!lock.root) {
    console.error(`FAIL ${name}: package-lock.json 缺少根级 node_modules/${name}（overrides 未生效？）`)
    failures++
    continue
  }
  if (lock.root !== expected) {
    console.error(`FAIL ${name}: package.json overrides=${expected}，lockfile 解析=${lock.root}（请重新 npm install 刷新 lockfile）`)
    failures++
    continue
  }
  const installed = readInstalledVersion(name)
  if (installed != null && installed !== expected) {
    console.error(`FAIL ${name}: node_modules 实际安装=${installed}，overrides=${expected}（请重新 npm install）`)
    failures++
    continue
  }
  const nested = lock.nested.filter(n => n.version !== expected)
  let line = `OK   ${name}@${expected}`
  if (installed != null) line += `（installed ${installed}）`
  if (nested.length > 0) {
    line += ` — 另有 ${nested.length} 处嵌套副本版本不同：${nested.map(n => `${n.key}@${n.version}`).join(', ')}（传递依赖独立副本，overrides 不作用）`
  }
  console.log(line)
}

if (failures > 0) {
  console.error(`\ncheck-overrides: ${failures} 处不一致`)
  process.exit(1)
}
console.log('\ncheck-overrides: 全部一致')

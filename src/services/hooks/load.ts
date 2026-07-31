/**
 * 从工作区加载 hooks 配置（`.agents/hooks.json`）
 *
 * `HOOKS=0` 或文件缺失 → null（跳过 hooks）。
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { HookCommandEntry, HooksConfig } from './types.js'

const CONFIG_REL = join('.agents', 'hooks.json')

export function isHooksDisabled(): boolean {
  return process.env.HOOKS === '0'
}

function isEntry(value: unknown): value is HookCommandEntry {
  if (!value || typeof value !== 'object') return false
  const o = value as Record<string, unknown>
  return typeof o.matcher === 'string' && typeof o.command === 'string'
}

function parseEntries(raw: unknown): HookCommandEntry[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isEntry).map(e => ({
    matcher: e.matcher,
    command: e.command,
    ...(typeof e.timeoutMs === 'number' ? { timeoutMs: e.timeoutMs } : {}),
    ...(typeof e.denyOnFailure === 'boolean'
      ? { denyOnFailure: e.denyOnFailure }
      : {}),
  }))
}

/**
 * 解析 hooks JSON 对象；非法结构返回空配置（不抛）。
 */
export function parseHooksConfig(raw: unknown): HooksConfig {
  if (!raw || typeof raw !== 'object') return {}
  const root = raw as Record<string, unknown>
  // 兼容 `{ "hooks": { PreToolUse: [...] } }` 与顶层 PreToolUse
  const body =
    root.hooks && typeof root.hooks === 'object'
      ? (root.hooks as Record<string, unknown>)
      : root
  return {
    PreToolUse: parseEntries(body.PreToolUse),
    PostToolUse: parseEntries(body.PostToolUse),
  }
}

/**
 * 从 cwd 加载 `.agents/hooks.json`。
 * 缺失 / 禁用 / 读失败 → null。
 */
export function loadHooksConfig(cwd: string = process.cwd()): HooksConfig | null {
  if (isHooksDisabled()) return null
  const path = join(cwd, CONFIG_REL)
  try {
    const text = readFileSync(path, 'utf8')
    const json = JSON.parse(text) as unknown
    return parseHooksConfig(json)
  } catch (err) {
    // 缺失文件：ENOENT → null；其它解析错误也 fail-soft
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'ENOENT'
    ) {
      return null
    }
    // 非法 JSON：当作无 hooks，避免拖垮会话
    return null
  }
}

export const HOOKS_CONFIG_RELATIVE_PATH = CONFIG_REL

/**
 * Edit 匹配辅助 — 对齐 claude-code findActualString 精简子集
 */

export type EditMatch = {
  start: number
  end: number
}

/** 在文件内容中查找唯一可替换的 old_string（CRLF 规范化 + 行尾空白回退） */
export function findUniqueEditMatch(
  fileContent: string,
  oldString: string,
): EditMatch | null {
  if (oldString.length === 0) {
    return null
  }

  const exactCount = countOccurrences(fileContent, oldString)
  if (exactCount > 1) {
    return null
  }
  if (exactCount === 1) {
    const start = fileContent.indexOf(oldString)
    return { start, end: start + oldString.length }
  }

  const normalizedFile = normalizeNewlines(fileContent)
  const normalizedNeedle = normalizeNewlines(oldString)
  const normalizedExact = findUniqueIndex(normalizedFile, normalizedNeedle)
  if (normalizedExact !== null) {
    return mapNormalizedRangeToOriginal(
      fileContent,
      normalizedFile,
      normalizedExact,
      normalizedNeedle.length,
    )
  }

  const trimmed = findUniqueTrimmedLineMatch(normalizedFile, normalizedNeedle)
  if (trimmed !== null) {
    return mapNormalizedRangeToOriginal(
      fileContent,
      normalizedFile,
      trimmed.start,
      trimmed.end - trimmed.start,
    )
  }

  return null
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0
  let from = 0
  while (true) {
    const idx = haystack.indexOf(needle, from)
    if (idx === -1) break
    count++
    from = idx + needle.length
  }
  return count
}

function findUniqueIndex(haystack: string, needle: string): number | null {
  const first = haystack.indexOf(needle)
  if (first === -1) return null
  if (haystack.indexOf(needle, first + needle.length) !== -1) return null
  return first
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n')
}

function findUniqueTrimmedLineMatch(
  haystack: string,
  needle: string,
): { start: number; end: number } | null {
  const trimmedNeedle = trimTrailingWhitespacePerLine(needle)
  if (trimmedNeedle.length === 0) return null

  const matches: { start: number; end: number }[] = []
  let searchFrom = 0
  while (searchFrom < haystack.length) {
    const idx = haystack.indexOf(trimmedNeedle, searchFrom)
    if (idx === -1) break
    const actual = expandToOriginalSlice(haystack, idx, trimmedNeedle)
    if (actual) {
      matches.push(actual)
    }
    searchFrom = idx + 1
  }

  if (matches.length !== 1) return null
  return matches[0]!
}

function trimTrailingWhitespacePerLine(text: string): string {
  return text
    .split('\n')
    .map(line => line.replace(/[ \t]+$/, ''))
    .join('\n')
}

function expandToOriginalSlice(
  haystack: string,
  start: number,
  trimmedNeedle: string,
): { start: number; end: number } | null {
  const needleLines = trimmedNeedle.split('\n')
  const fileSlice = haystack.slice(start)
  const fileLines = fileSlice.split('\n')
  if (fileLines.length < needleLines.length) return null

  for (let i = 0; i < needleLines.length; i++) {
    if (fileLines[i]!.replace(/[ \t]+$/, '') !== needleLines[i]) {
      return null
    }
  }

  const matchedLines = fileLines.slice(0, needleLines.length)
  const matched = matchedLines.join('\n')
  return { start, end: start + matched.length }
}

function mapNormalizedRangeToOriginal(
  original: string,
  normalized: string,
  normalizedStart: number,
  normalizedLength: number,
): EditMatch | null {
  const normalizedEnd = normalizedStart + normalizedLength
  const originalStart = mapNormalizedOffsetToOriginal(
    original,
    normalized,
    normalizedStart,
  )
  const originalEnd = mapNormalizedOffsetToOriginal(
    original,
    normalized,
    normalizedEnd,
  )
  if (originalStart === null || originalEnd === null) return null
  return { start: originalStart, end: originalEnd }
}

function mapNormalizedOffsetToOriginal(
  original: string,
  normalized: string,
  normalizedOffset: number,
): number | null {
  let oi = 0
  let ni = 0
  while (ni < normalizedOffset && oi < original.length) {
    if (original.startsWith('\r\n', oi)) {
      oi += 2
      ni += 1
      continue
    }
    oi += 1
    ni += 1
  }
  if (ni !== normalizedOffset) return null
  return oi
}

export function restoreLineEndings(
  original: string,
  editedLf: string,
): string {
  if (!original.includes('\r\n')) {
    return editedLf
  }
  return editedLf.replace(/(?<!\r)\n/g, '\r\n')
}

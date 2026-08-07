/**
 * Lightweight GFM → ANSI formatter (CC-aligned: marked lexer + chalk).
 * Full CC `utils/markdown.ts` can replace this via upstream sync.
 */

import chalk from 'chalk'
import { marked, type Token, type Tokens } from 'marked'

const EOL = '\n'
let configured = false

// Ink <Ansi> always wants escape sequences; force color even when stdout is not a TTY
chalk.level = 3

export function configureMarked(): void {
  if (configured) return
  configured = true
  marked.use({
    tokenizer: {
      // Model often uses ~ for approximate; skip strikethrough
      del() {
        return undefined
      },
    },
  })
}

function formatInline(tokens: Token[] | undefined): string {
  if (!tokens?.length) return ''
  return tokens.map(t => formatToken(t)).join('')
}

export function formatToken(token: Token, listDepth = 0): string {
  switch (token.type) {
    case 'space':
      return EOL
    case 'heading': {
      const t = token as Tokens.Heading
      const body = formatInline(t.tokens) || t.text
      const styled =
        t.depth <= 1
          ? chalk.bold.underline(body)
          : t.depth === 2
            ? chalk.bold(body)
            : chalk.bold.dim(body)
      return styled + EOL + EOL
    }
    case 'paragraph': {
      const t = token as Tokens.Paragraph
      return formatInline(t.tokens) + EOL + EOL
    }
    case 'text': {
      const t = token as Tokens.Text
      if (t.tokens) return formatInline(t.tokens)
      return t.text
    }
    case 'strong': {
      const t = token as Tokens.Strong
      return chalk.bold(formatInline(t.tokens) || t.text)
    }
    case 'em': {
      const t = token as Tokens.Em
      return chalk.italic(formatInline(t.tokens) || t.text)
    }
    case 'codespan': {
      const t = token as Tokens.Codespan
      return chalk.cyan(t.text)
    }
    case 'code': {
      const t = token as Tokens.Code
      const fence = chalk.dim('```' + (t.lang ?? ''))
      return fence + EOL + t.text + EOL + chalk.dim('```') + EOL + EOL
    }
    case 'blockquote': {
      const t = token as Tokens.Blockquote
      const inner = formatInline(t.tokens) || formatTokenList(t.tokens ?? [])
      return inner
        .split(EOL)
        .map(line => (line.trim() ? chalk.dim('│ ') + chalk.italic(line) : line))
        .join(EOL) + EOL
    }
    case 'list': {
      const t = token as Tokens.List
      return (
        t.items
          .map((item, i) => {
            const start =
              typeof t.start === 'number' ? t.start : Number(t.start) || 1
            const bullet = t.ordered ? `${start + i}. ` : '• '
            const body = formatInline(item.tokens) || item.text
            const pad = '  '.repeat(listDepth)
            return pad + chalk.dim(bullet) + body
          })
          .join(EOL) +
        EOL +
        EOL
      )
    }
    case 'link': {
      const t = token as Tokens.Link
      const label = formatInline(t.tokens) || t.text
      return chalk.blue.underline(label) + chalk.dim(` (${t.href})`)
    }
    case 'image': {
      const t = token as Tokens.Image
      return chalk.dim(`[image: ${t.text || t.href}]`)
    }
    case 'hr':
      return chalk.dim('─'.repeat(24)) + EOL + EOL
    case 'html':
    case 'escape':
      return (token as Tokens.HTML | Tokens.Escape).text
    default:
      if ('text' in token && typeof (token as { text?: string }).text === 'string') {
        return (token as { text: string }).text
      }
      return ''
  }
}

function formatTokenList(tokens: Token[]): string {
  return tokens.map(t => formatToken(t)).join('')
}

/** Convert markdown source to ANSI-styled string for terminal. */
export function formatMarkdown(content: string): string {
  configureMarked()
  const tokens = marked.lexer(content)
  return tokens.map(t => formatToken(t)).join('').trimEnd() + EOL
}

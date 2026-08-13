// BOOTH-9a's terminology, held in place.
//
// The rename was mechanical — nine terms, applied across every UI string — and the
// two things a mechanical rename gets wrong are the ones checked here: an occurrence
// it missed, and a 한자 병기 that ended up on more than one string.
//
// It reads the sources rather than rendering, because the rule is about the strings
// themselves. Comments are stripped first: they are English (CLAUDE.md §11) and the
// two that quote a Korean term do so to explain the rename, which is not a UI string.

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(here, '../src')

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sources(path)
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : []
  })
}

/**
 * The file with its comments removed.
 *
 * Block comments first, then line comments — the other order leaves the `*` rows of a
 * doc comment behind. Neither pattern can be fooled by a string in this codebase: no
 * Korean string here contains `//` or `/*`, which is exactly what the test below
 * would fail loudly on if it ever changed.
 */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
}

// Keys are posix-style: this runs on Windows, where `relative` returns backslashes,
// and the expected paths below are written the way the repo talks about its files.
const FILES = sources(SRC)
const CODE = new Map(FILES.map((path) => [relative(SRC, path).replaceAll('\\', '/'), code(path)]))

describe('BOOTH-9a terminology', () => {
  // The nine replacements. If one of these turns up in a string again, either the
  // rename missed a spot or new copy was written in the old vocabulary.
  const RETIRED: readonly (readonly [string, string])[] = [
    ['라운드', '주기'],
    ['덱', '공허'],
    ['정산', '융합'],
    ['보드', '성단'],
    ['배치', 'γένεσις'],
    ['스타더스트', 'St4RDu3t'],
    ['특수 조각', 'MЦLГЦS 조각'],
    ['별자리 패턴', '황도 12궁'],
  ]

  it('has no retired term left in any UI string', () => {
    const found: string[] = []
    for (const [from, to] of RETIRED) {
      for (const [file, text] of CODE) {
        if (text.includes(from)) found.push(`${file}: "${from}" should be "${to}"`)
      }
    }
    expect(found, `\n${found.join('\n')}\n`).toEqual([])
  })

  // ★ 한자 병기 is first-appearance only. Written once per term, so a reader meets the
  // 한자 the first time and 한글 every time after. Each of these four lives at a
  // different surface, chosen for room: BOOTH-6a caps a coach caption at 30 characters
  // and 병기 costs four, so none of them could go on the tutorial captions that would
  // otherwise be the natural home (see `Coach.tsx`).
  const 병기: Readonly<Record<string, string>> = {
    '주기(週期)': 'ui/Title.tsx',
    '공허(空虛)': 'ui/Report.tsx',
    '융합(融合)': 'ui/Settlement.tsx',
    '성단(星團)': 'ui/dialogue.ts',
  }

  it('writes each 한자 exactly once, at the surface that introduces the term', () => {
    for (const [form, where] of Object.entries(병기)) {
      const hits = [...CODE].flatMap(([file, text]) =>
        Array.from({ length: text.split(form).length - 1 }, () => file),
      )
      expect(hits, `${form} should appear once, in ${where}`).toEqual([where])
    }
  })

  // GDD 2 uses the Korean 星團, not the Japanese 星団. They are the same word and
  // different characters, and a proofread would not catch it.
  it('writes 성단 with the Korean 星團 and never the Japanese 星団', () => {
    for (const [file, text] of CODE) {
      expect(text.includes('星団'), `${file} uses the Japanese 星団`).toBe(false)
    }
  })

  // The comment-stripping above is load-bearing: if a Korean string ever contained a
  // comment opener, the checks would silently stop seeing part of the file.
  it('strips comments without eating a string', () => {
    for (const [file, text] of CODE) {
      expect(text.includes('/*'), `${file}: unbalanced block comment after stripping`).toBe(false)
    }
  })
})

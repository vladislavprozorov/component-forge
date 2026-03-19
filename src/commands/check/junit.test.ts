import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

import { writeJunitReport } from './index'

describe('writeJunitReport', () => {
  it('writes a functional XML when there are no violations', () => {
    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-junit-'))
    const reportPath = path.join(tmpDir, 'report.xml')

    writeJunitReport({ violations: [], checkedFiles: 10 }, reportPath, 'fsd')

    const content = fs.readFileSync(reportPath, 'utf8')
    expect(content).toContain('<?xml')
    expect(content).toContain('failures="0"')
    expect(content).toContain('tests="10"')
    expect(content).toContain('Architecture Check (fsd)')
    expect(content).toContain('All architecture boundaries are valid')

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes XML containing failures properly escaped', () => {
    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-junit-'))
    const reportPath = path.join(tmpDir, 'fail-report.xml')

    writeJunitReport(
      {
        violations: [
          {
            file: 'src/features/a.ts',
            importPath: '@/features/b',
            message: 'Message with < > & "',
            hint: 'Hint with < > & "',
          },
        ],
        checkedFiles: 5,
      },
      reportPath,
      'fsd',
    )

    const content = fs.readFileSync(reportPath, 'utf8')
    expect(content).toContain('failures="1"')
    expect(content).toContain('tests="5"')
    expect(content).toContain('src/features/a.ts: import @/features/b')
    expect(content).toContain('classname="src/features/a.ts"')
    expect(content).toContain('Message with &lt; &gt; &amp; &quot;')
    expect(content).toContain('Hint with &lt; &gt; &amp; &quot;')

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})

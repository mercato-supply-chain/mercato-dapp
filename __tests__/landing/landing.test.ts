import { expect, test } from 'bun:test'
import { join } from 'node:path'

// Module mocks are process-isolated so they cannot affect other Bun test files.
for (const scenario of ['aggregate', 'query-error', 'stream']) {
  test(`landing stats: ${scenario}`, async () => {
    const child = Bun.spawn([process.execPath, join(import.meta.dir, 'landing.fixture.tsx'), scenario], {
      cwd: process.cwd(), stdout: 'pipe', stderr: 'pipe',
    })
    const [exit, stdout, stderr] = await Promise.all([
      child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
    ])
    expect({ exit, stdout, stderr }).toEqual({ exit: 0, stdout: 'ok\n', stderr: '' })
  }, 15000)
}

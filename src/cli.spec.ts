import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runTypeAnnotationify } from './cli.ts';
import { DEFAULT_OPTIONS } from './transform.ts';
describe(runTypeAnnotationify.name, async () => {
  await it('should display a smart help message when called with `--help` or `-h`', async () => {
    const originalConsoleLog = console.log;
    try {
      const logMessages: string[] = [];
      console.log = (message: string) => {
        logMessages.push(message);
      };

      await runTypeAnnotationify(['--help']);
      await runTypeAnnotationify(['-h']);
      originalConsoleLog(logMessages[0]);
      assert.equal(logMessages.length, 2);
      assert.equal(logMessages[0], logMessages[1]);
      assert.match(logMessages[0]!, / --help/);
      assert.match(logMessages[0]!, / -h/);
      Object.keys(DEFAULT_OPTIONS).forEach((option) => {
        assert.match(logMessages[0]!, new RegExp(toKebabCase(option)));
      });
    } finally {
      console.log = originalConsoleLog;
    }
  });
});

function toKebabCase(input: string): string {
  return input.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

import ts from 'typescript';
import { parse, transform, type TransformOptions } from './transform.ts';
import assert from 'node:assert/strict';
import * as prettier from 'prettier';
import { describe, it } from 'node:test';

const IMAGINARY_FILE_NAME = 'ts.ts';
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

describe('transform', async () => {
  await describe('type assertions', async () => {
    await it('should transform a type assertion', async () => {
      await scenario(`const foo = <a>'foo';`, `const foo = 'foo' as a;`);
    });
  });

  await it('should provide an accurate report of changes', async () => {
    const source = parse(
      IMAGINARY_FILE_NAME,
      `
      const foo = <a>'foo';
      class Bar {
        constructor(public baz: string) {}
      }
      enum Baz { A }
      namespace Qux {}
      import('./foo.js');
      `,
    );
    const { report } = transform(source, { relativeImportExtensions: true });
    assert.strictEqual(report.changed, true);
    assert.strictEqual(report.classConstructors, 1);
    assert.strictEqual(report.typeAssertions, 1);
    assert.strictEqual(report.enumDeclarations, 1);
    assert.strictEqual(report.namespaceDeclarations, 1);
    assert.strictEqual(report.relativeImportExtensions, 1);
  });
});

export async function scenario(
  input: string,
  expectedOutput = input,
  options?: Partial<TransformOptions>,
) {
  const expectedChanged = input !== expectedOutput;
  const source = parse(IMAGINARY_FILE_NAME, input);
  const expected = parse(IMAGINARY_FILE_NAME, expectedOutput);
  const actualTransformResult = transform(source, options);
  const actualCodeUnformatted = printer.printFile(actualTransformResult.node);
  const actualCode = await prettier.format(actualCodeUnformatted, {
    filepath: IMAGINARY_FILE_NAME,
  });
  const expectedCode = await prettier.format(printer.printFile(expected), {
    filepath: IMAGINARY_FILE_NAME,
  });
  assert.equal(
    actualTransformResult.report.changed,
    expectedChanged,
    expectedChanged
      ? `Expected input to be changed, but wasn't: \`${input}\``
      : `Expected input to not be changed, but was: Expected:\`${input}\`\nActual:${actualCode}`,
  );
  assert.deepEqual(actualCode, expectedCode);
}

import ts from 'typescript';
import { transform } from './transform.ts';
import assert from 'node:assert/strict';
import * as prettier from 'prettier';
import { describe, it } from 'node:test';

describe('transform', async () => {
  it('should not change unrelated TS code', async () => {
    await scenario(
      `class Iban {
            constructor(bankCode: string) {}
            }`,
      `
      class Iban {
            constructor(bankCode: string) {}
            }
            `,
            false,
    );
  });
  it('should transform a parameter property', async () => {
    await scenario(
      `class Iban {
            constructor(public bankCode: string) {}
            }`,
      `class Iban {
            public bankCode;
            constructor(bankCode: string) {
              this.bankCode = bankCode;
            }
    }`,
    );
  });
  async function scenario(
    input: string,
    expectedOutput = input,
    expectedChanged = input === expectedOutput,
  ) {
    const source = parse(input);
    const expected = parse(expectedOutput);
    const actualTransformResult = transform(source);
    const actualCode = await prettier.format(
      printer.printFile(actualTransformResult.source),
      {
        filepath: IMAGINARY_FILE_NAME,
      },
    );
    const expectedCode = await prettier.format(printer.printFile(expected), {
      filepath: IMAGINARY_FILE_NAME,
    });
    assert.equal(actualTransformResult.changed, expectedChanged);
    assert.deepEqual(actualCode, expectedCode);
  }
});
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
const IMAGINARY_FILE_NAME = 'ts.ts';
function parse(input: string) {
  return ts.createSourceFile(
    IMAGINARY_FILE_NAME,
    input,
    ts.ScriptTarget.ESNext,
    /*setParentNodes */ true,
  );
}

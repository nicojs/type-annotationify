import ts from 'typescript';
import {
  DEFAULT_OPTIONS,
  parse,
  transform,
  type TransformOptions,
} from './transform.ts';
import assert from 'node:assert/strict';
import * as prettier from 'prettier';
import { describe, it } from 'node:test';

const IMAGINARY_FILE_NAME = 'ts.ts';
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

describe('transform', async () => {
  await it('should not change unrelated TS code', async () => {
    await scenario(
      `class Iban {
          constructor(bankCode: string) {}
          }`,
    );
  });
  await describe('parameter properties', async () => {
    await it('should transform a parameter property', async () => {
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

    await it('should transform a parameter property deeper in the AST', async () => {
      await scenario(
        `
      function foo() {
          class Bar {
            doSomething() {
              class Iban {
                  constructor(public bankCode: string) {}
                  }
            }
          }
      }`,
        `
      function foo() {
          class Bar {
            doSomething() {
              class Iban {
                public bankCode;
                constructor(bankCode: string) {
                  this.bankCode = bankCode;
                }
              }
            }
          }
      }`,
      );
    });

    await it('should move any initializer to the parameter', async () => {
      await scenario(
        `
        class Foo {
          constructor(
            public bar: string,
            readonly baz: boolean,
            protected qux = 42,
          ) {}
        }`,
        `
        class Foo {
          public bar;
          readonly baz;
          protected qux;
          constructor(
            bar: string,
            baz: boolean,
            qux = 42,
          ) {
            this.bar = bar;
            this.baz = baz;
            this.qux = qux;
          }
        }
      `,
      );
    });

    await it('should support a class inside a class', async () => {
      await scenario(
        `class Iban {
           constructor(public bankCode: string) {}

           doWork() {
             class Bic {
               constructor(public bic: string) {}

            }
          }
         }`,
        `class Iban {
           public bankCode;
           constructor(bankCode: string) {
             this.bankCode = bankCode;
           }

           doWork() {
             class Bic {
               public bic;
               constructor(bic: string) {
                  this.bic = bic;
               }
             }
           }
         }`,
      );
    });

    await it('should transform multiple parameter properties', async () => {
      await scenario(
        `class Iban {
              constructor(public bankCode: string, public bic: string) {}
              }`,
        `class Iban {
              public bankCode;
              public bic;
              constructor(bankCode: string, bic: string) {
                this.bankCode = bankCode;
                this.bic = bic;
              }
          }`,
      );
    });

    await it('should support a constructor with a super() call', async () => {
      await scenario(
        `class Iban extends Base {
              constructor(public bankCode: string) {
                super();
              }
         }`,
        `class Iban extends Base {
              public bankCode;
              constructor(bankCode: string) {
                super();
                this.bankCode = bankCode;
              }
          }`,
      );
    });
    await it('should support a constructor with a super() call with parameters', async () => {
      await scenario(
        `class Iban extends Base {
              constructor(public bankCode: string, bic: string) {
                super(bic);
              }
         }`,
        `class Iban extends Base {
              public bankCode;
              constructor(bankCode: string, bic: string) {
                super(bic);
                this.bankCode = bankCode;
              }
          }`,
      );
    });
    await it('should support a constructor with statements before the super() call', async () => {
      await scenario(
        `class Iban extends Base {
              constructor(public bankCode: string) {
                console.log('foo');
                console.log('bar');
                super();
                console.log('baz');
              }
         }`,
        `class Iban extends Base {
              public bankCode;
              constructor(bankCode: string) {
                console.log('foo');
                console.log('bar');
                super();
                this.bankCode = bankCode;
                console.log('baz');
              }
          }`,
      );
    });
  });

  await describe('type assertions', async () => {
    await it('should transform a type assertion', async () => {
      await scenario(`const foo = <a>'foo';`, `const foo = 'foo' as a;`);
    });
  });
});

export async function scenario(
  input: string,
  expectedOutput = input,
  options: TransformOptions = DEFAULT_OPTIONS,
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
    actualTransformResult.changed,
    expectedChanged,
    expectedChanged
      ? `Expected input to be changed, but wasn't: \`${input}\``
      : `Expected input to not be changed, but was: Expected:\`${input}\`\nActual:${actualCode}`,
  );
  assert.deepEqual(actualCode, expectedCode);
}

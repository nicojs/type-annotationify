import ts from 'typescript';
import { transform } from './transform.ts';
import assert from 'node:assert/strict';
import * as prettier from 'prettier';
import { describe, it } from 'node:test';

describe('transform', async () => {
  await it('should not change unrelated TS code', async () => {
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
  describe('parameter properties', async () => {
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

  describe('enums', async () => {
    await it('should transform a plain enum', async () => {
      await scenario(
        'enum MessageKind { Start, Work, Stop }',
        `type MessageKind = 0 | 1 | 2;
         type MessageKindKeys = 'Start' | 'Work' | 'Stop';
         const MessageKind = {
          0: 'Start',
          1: 'Work',
          2: 'Stop',
          Start: 0,
          Work: 1,
          Stop: 2
          } satisfies Record<MessageKind, MessageKindKeys> & Record<MessageKindKeys, MessageKind>;`,
      );
    });
    await it('should use unique name for the keys enum', async () => {
      await scenario(
        `enum MessageKind { Start }; 
         let MessageKindKeys = 0;
         `,
        `type MessageKind = 0;
         type MessageKindKeys_1 = 'Start';
         const MessageKind = {
          0: 'Start',
          Start: 0
          } satisfies Record<MessageKind, MessageKindKeys_1> & Record<MessageKindKeys_1, MessageKind>;
         let MessageKindKeys = 0;`,
      );
    });

    await it('should not transform an initialized number enum (yet)', async () => {
      await scenario('enum MessageKind { Start = 1, Work, Stop }');
    });
    await it('should not transform a string enum (yet)', async () => {
      await scenario(
        'enum MessageKind { Start = "start", Work = "work", Stop = "stop" }',
      );
    });
    await it('should not transform a computed property name enum (yet)', async () => {
      await scenario(
        'enum MessageKind { ["▶"]: "Start", ["👷‍♂️"]: "Work", ["🛑"]: "Stop" }',
      );
    });
  });

  async function scenario(
    input: string,
    expectedOutput = input,
    expectedChanged = input !== expectedOutput,
  ) {
    const source = parse(input);
    const expected = parse(expectedOutput);
    const actualTransformResult = transform(source);
    const actualCode = await prettier.format(
      printer.printFile(actualTransformResult.node),
      {
        filepath: IMAGINARY_FILE_NAME,
      },
    );
    const expectedCode = await prettier.format(printer.printFile(expected), {
      filepath: IMAGINARY_FILE_NAME,
    });
    assert.equal(
      actualTransformResult.changed,
      expectedChanged,
      `Expected input to be changed, but wasn't: \`${input}\``,
    );
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

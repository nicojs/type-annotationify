import ts from 'typescript';
import { transform } from './transform.ts';
import assert from 'node:assert/strict';
import * as prettier from 'prettier';
import { describe, it } from 'node:test';

const IMAGINARY_FILE_NAME = 'ts.ts';
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

await describe('transform', async () => {
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

  await describe('enums', async () => {
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
          } satisfies Record<MessageKind, MessageKindKeys> & Record<MessageKindKeys, MessageKind>;
          declare namespace MessageKind {
            type Start = typeof MessageKind.Start;
            type Work = typeof MessageKind.Work;
            type Stop = typeof MessageKind.Stop;
          }`,
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
          declare namespace MessageKind {
            type Start = typeof MessageKind.Start;
          }
         let MessageKindKeys = 0;`,
      );
    });
    await it('should transform an exported enum', async () => {
      await scenario(
        'export enum MessageKind { Start }',
        `export type MessageKind = 0;
         type MessageKindKeys = 'Start';
         export const MessageKind = {
          0: 'Start',
          Start: 0,
          } satisfies Record<MessageKind, MessageKindKeys> & Record<MessageKindKeys, MessageKind>;
          export declare namespace MessageKind {
            type Start = typeof MessageKind.Start;
          }`,
      );
    });

    await it('should transform an enum with number initializers', async () => {
      await scenario(
        'enum Rank { Two = 2, Three = 3 }',
        ` type Rank = 2 | 3;
          type RankKeys = 'Two' | 'Three';
          const Rank = {
            2: 'Two',
            3: 'Three',
            Two: 2,
            Three: 3,
          } satisfies Record<Rank, RankKeys> & Record<RankKeys, Rank>;
          declare namespace Rank {
            type Two = typeof Rank.Two;
            type Three = typeof Rank.Three;
          }
        `,
      );
    });
    await it('should transform an enum with and without number initializers', async () => {
      await scenario(
        'enum Numbers { One = 1, Two, FortyTwo = 42, FortyThree }',
        `
        type Numbers = 1 | 2 | 42 | 43;
        type NumbersKeys = 'One' | 'Two' | 'FortyTwo' | 'FortyThree';
        const Numbers = {
          1: 'One',
          2: 'Two',
          42: 'FortyTwo',
          43: 'FortyThree',
          One: 1,
          Two: 2,
          FortyTwo: 42,
          FortyThree: 43
          } satisfies Record<Numbers, NumbersKeys> & Record<NumbersKeys, Numbers>;
          declare namespace Numbers {
            type One = typeof Numbers.One;
            type Two = typeof Numbers.Two;
            type FortyTwo = typeof Numbers.FortyTwo;
            type FortyThree = typeof Numbers.FortyThree;
          }
        `,
      );
    });
    await it('should transform an enum duplicate number values', async () => {
      await scenario(
        'enum NumbersI18n { Two = 2, Three, Deux = 2, Trois }',
        `
        type NumbersI18n = 2 | 3;
        type NumbersI18nKeys = 'Two' | 'Three' | 'Deux' | 'Trois';
        const NumbersI18n = {
          2: 'Deux',
          3: 'Trois',
          Two: 2,
          Three: 3,
          Deux: 2,
          Trois: 3
          } satisfies Record<NumbersI18n, NumbersI18nKeys> & Record<NumbersI18nKeys, NumbersI18n>;
          declare namespace NumbersI18n {
            type Two = typeof NumbersI18n.Two;
            type Three = typeof NumbersI18n.Three;
            type Deux = typeof NumbersI18n.Deux;
            type Trois = typeof NumbersI18n.Trois;
          }
        `,
      );
    });

    await it('should transform a string enum', async () => {
      await scenario(
        'enum Foo { Bar = "bar", Baz = "baz" }',
        `type Foo = 'bar' | 'baz';
         type FooKeys = 'Bar' | 'Baz';
         const Foo = {
           Bar: 'bar',
           Baz: 'baz',
         } satisfies Record<FooKeys, Foo>;
         declare namespace Foo {
           type Bar = typeof Foo.Bar;
           type Baz = typeof Foo.Baz;
         }
           `,
      );
    });
    await it('should transform a mixed enum (strings and numbers)', async () => {
      await scenario(
        'enum Foo { A = "a", One = 1, Two, B = "b"}',
        `type Foo = 'a'| 1 | 2 | 'b';
         type FooKeys = 'A' | 'One' | 'Two' | 'B';
         const Foo = {
            1: 'One',
            2: 'Two',
            A: 'a',
            One: 1,
            Two: 2,
            B: 'b',
         } satisfies Record<Exclude<Foo, 'a' | 'b'>, FooKeys> & Record<FooKeys, Foo>;
          declare namespace Foo {
            type A = typeof Foo.A;
            type One = typeof Foo.One;
            type Two = typeof Foo.Two;
            type B = typeof Foo.B;
          }
         `,
      );
    });
    await it('should transform a computed property name enum', async () => {
      await scenario(
        'enum PathSeparator { ["/"], ["\\\\"] }',
        `
      type PathSeparator = 0 | 1;
      type PathSeparatorKeys = '/' | '\\\\';
      const PathSeparator = {
        0: '/',
        1: '\\\\',
        '/': 0,
        '\\\\': 1
        } satisfies Record<PathSeparator, PathSeparatorKeys> & Record<PathSeparatorKeys, PathSeparator>;
      `,
      );
    });
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
function parse(input: string) {
  return ts.createSourceFile(
    IMAGINARY_FILE_NAME,
    input,
    ts.ScriptTarget.ESNext,
    /*setParentNodes */ true,
  );
}

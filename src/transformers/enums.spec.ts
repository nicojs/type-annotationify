import { describe, it } from 'node:test';
import { scenario } from '../transform.spec.ts';
import { transformEnum } from './enums.ts';

describe(transformEnum.name, async () => {
  await it('should transform a plain enum', async () => {
    await scenario(
      'enum MessageKind { Start, Work, Stop }',
      `const MessageKind = {
          0: 'Start',
          1: 'Work',
          2: 'Stop',
          Start: 0,
          Work: 1,
          Stop: 2
       } as const;
       type MessageKind = typeof MessageKind[keyof typeof MessageKind & string];
       declare namespace MessageKind {
         type Start = typeof MessageKind.Start;
         type Work = typeof MessageKind.Work;
         type Stop = typeof MessageKind.Stop;
       }`,
    );
  });
  await it('should transform an exported enum', async () => {
    await scenario(
      'export enum MessageKind { Start }',
      `
      export const MessageKind = {
        0: 'Start',
        Start: 0,
      } as const;
      export type MessageKind = typeof MessageKind[keyof typeof MessageKind & string];
      export declare namespace MessageKind {
        type Start = typeof MessageKind.Start;
      }`,
    );
  });

  await it('should transform an enum with number initializers', async () => {
    await scenario(
      'enum Rank { Two = 2, Three = 3 }',
      `
      const Rank = {
        2: 'Two',
        3: 'Three',
        Two: 2,
        Three: 3,
      } as const;
      type Rank = typeof Rank[keyof typeof Rank & string];
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
        const Numbers = {
          1: 'One',
          2: 'Two',
          42: 'FortyTwo',
          43: 'FortyThree',
          One: 1,
          Two: 2,
          FortyTwo: 42,
          FortyThree: 43
        } as const;
        type Numbers = typeof Numbers[keyof typeof Numbers & string];
        declare namespace Numbers {
          type One = typeof Numbers.One;
          type Two = typeof Numbers.Two;
          type FortyTwo = typeof Numbers.FortyTwo;
          type FortyThree = typeof Numbers.FortyThree;
        }
        `,
    );
  });
  await it.only('should transform an enum duplicate number values', async () => {
    await scenario(
      'enum NumbersI18n { Two = 2, Three, Deux = 2, Trois }',
      `
        const NumbersI18n = {
          2: 'Deux',
          3: 'Trois',
          Two: 2,
          Three: 3,
          Deux: 2,
          Trois: 3
        } as const;
        type NumbersI18n = typeof NumbersI18n[keyof typeof NumbersI18n & string];
        declare namespace NumbersI18n {
          type Two = typeof NumbersI18n.Two;
          type Three = typeof NumbersI18n.Three;
          type Deux = typeof NumbersI18n.Deux;
          type Trois = typeof NumbersI18n.Trois;
        }
        `,
    );
  });

  await it.only('should transform a string enum', async () => {
    await scenario(
      'enum Foo { Bar = "bar", Baz = "baz" }',
      `
      const Foo = {
        Bar: 'bar',
        Baz: 'baz',
      } as const;
      type Foo = typeof Foo[keyof typeof Foo];
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

  await it('should support const enums', async () => {
    await scenario(
      'const enum Foo { Bar, Baz }',
      `type Foo = 0 | 1;
         type FooKeys = 'Bar' | 'Baz';
         const Foo = {
           0: 'Bar',
           1: 'Baz',
           Bar: 0,
           Baz: 1,
         } satisfies Record<Foo, FooKeys> & Record<FooKeys, Foo>;
         declare namespace Foo {
           type Bar = typeof Foo.Bar;
           type Baz = typeof Foo.Baz;
         }
         `,
    );
  });
});

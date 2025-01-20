import { describe, it } from 'node:test';
import { transformNamespace } from './namespaces.ts';
import { scenario } from '../transform.spec.ts';

describe(transformNamespace.name, async () => {
  await it('should remove empty namespaces', async () => {
    await scenario(`namespace Foo {}`, ``);
    await scenario(`module Foo {}`, ``);
  });

  await it('should not transform namespace declarations', async () => {
    await scenario(`
      declare namespace Foo {
        export const pi: 3.14;
      }`);
  });

  await it('should transform namespaces without exports', async () => {
    await scenario(
      `
      namespace Foo {
        console.log('Foo created');
      }`,
      `
      declare namespace Foo {}
      var Foo: Foo;
      {
        // @ts-ignore Migrated module with type-annotationify
        Foo ??= {};
        console.log('Foo created');
      }
      `,
    );
  });

  await it('should transform namespaces with a type exports', async () => {
    await scenario(
      `
      namespace Foo {
          export type Bar = number;
          export interface Baz {
              name: string;
          }
      }`,
      `
      declare namespace Foo {
        type Bar = number;
        interface Baz {
          name: string;
        }
      }
      var Foo: Foo;
      {
        // @ts-ignore Migrated module with type-annotationify
        Foo ??= {};
      }
      `,
    );
  });

  await it('should transform namespaces with value exports', async () => {
    await scenario(
      `
      namespace Foo {
        export const pi: 3.14 = 3.14;
      }`,
      `declare namespace Foo {
        const pi: 3.14;
       }
       var Foo: Foo;
       {
         // @ts-ignore Migrated module with type-annotationify
         Foo ??= {};
         Foo.pi = 3.14;
       }`,
    );
  });

  await it('should transform a namespace with a value without initializer', async () => {
    await scenario(
      `
      namespace Math2 {
        export let answer: number;
      }`,
      `declare namespace Math2 {
         let answer: number;
       }
       var Math2: Math2;
       {
         // @ts-ignore Migrated module with type-annotationify
         Math2 ??= {};
       }`,
    );
  });

  await it('should transform namespaces with a mix of exports', async () => {
    await scenario(
      `
      namespace Foo {
        export const pi: 3.14 = 3.14, e: 2.71 = 2.71, tau: 6.28 = 6.28;
        export type Bar = number;
        export interface Baz {
          name: string;
        }
      }`,
      `declare namespace Foo {
        const pi: 3.14, e: 2.71, tau: 6.28;
        type Bar = number;
        interface Baz {
          name: string;
        }
      }
      var Foo: Foo;
      {
        // @ts-ignore Migrated module with type-annotationify
        Foo ??= {};
        Foo.pi = 3.14, Foo.e = 2.71, Foo.tau = 6.28;
      }`,
    );
  });
});

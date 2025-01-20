import { describe, it } from 'node:test';
import { transformNamespace } from './namespaces.ts';
import { scenario } from '../transform.spec.ts';

describe.only(transformNamespace.name, async () => {
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

  await it.only('should transform namespaces with value exports', async () => {
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
});

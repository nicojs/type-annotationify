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
      interface Foo {}
      var Foo: Foo;
      {
        // @ts-ignore Migrated module with type-annotationify
        Foo ??= {};
        console.log('Foo created');
      }
      `,
    );
  });
  await it('should not transform namespaces with exports (yet)', async () => {
    await scenario(`
      namespace Foo {
        export const pi: 3.14;
      }`);
  });
});

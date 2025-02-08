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
      // @ts-ignore Migrated namespace with type-annotationify
      declare namespace Foo {}
      // @ts-ignore Migrated namespace with type-annotationify
      var Foo: Foo;
      {
        // @ts-ignore Migrated namespace with type-annotationify
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
      // @ts-ignore Migrated namespace with type-annotationify
      declare namespace Foo {
        type Bar = number;
        interface Baz {
          name: string;
        }
      }
       // @ts-ignore Migrated namespace with type-annotationify
      var Foo: Foo;
      {
        // @ts-ignore Migrated namespace with type-annotationify
        Foo ??= {};
      }
      `,
    );
  });

  await it('should transform namespaces with variable statement exports', async () => {
    await scenario(
      `
      namespace Foo {
        export const pi: 3.14 = 3.14;
      }`,
      `
      // @ts-ignore Migrated namespace with type-annotationify
      declare namespace Foo {
        const pi: 3.14;
       }
       // @ts-ignore Migrated namespace with type-annotationify
       var Foo: Foo;
       {
         // @ts-ignore Migrated namespace with type-annotationify
         Foo ??= {};
         Foo.pi = 3.14;
       }`,
    );
  });

  await it('should transform a namespace with a variable statement without initializer', async () => {
    await scenario(
      `
      namespace Math2 {
        export let answer: number;
      }`,
      `
      // @ts-ignore Migrated namespace with type-annotationify
      declare namespace Math2 {
         let answer: number;
       }
       // @ts-ignore Migrated namespace with type-annotationify
       var Math2: Math2;
       {
         // @ts-ignore Migrated namespace with type-annotationify
         Math2 ??= {};
       }`,
    );
  });

  await it('should transform namespaces with a function export', async () => {
    await scenario(
      `
      namespace Math2 {
        export function add (a: number, b: number): number {
            return a + b;
        }
      }`,
      `
      // @ts-ignore Migrated namespace with type-annotationify
      declare namespace Math2 {
        function add(a: number, b: number): number;
      }
      // @ts-ignore Migrated namespace with type-annotationify
      var Math2: Math2;
      {
        // @ts-ignore Migrated namespace with type-annotationify
        Math2 ??= {};
        function add(a: number, b: number): number {
          return a + b;
        }
        Math2.add = add;
      }`,
    );
  });

  await it('should transform namespaces with a class export', async () => {
    await scenario(
      ` namespace Zoo {
            export abstract class Animal {
                public legs;
                constructor(legs: number) {
                  this.legs = legs;
                }
                abstract makeSound(): string;
            }
            export class Dog extends Animal {
                protected breed;
                constructor(legs: number, breed: string) {
                    super(legs);
                    this.breed = breed;
                }
                makeSound() {
                  return 'Woof';
                };
            }
        }
        }`,
      ` // @ts-ignore Migrated namespace with type-annotationify
        declare namespace Zoo {
          abstract class Animal {
              legs: number;
              constructor(legs: number);
              abstract makeSound(): string;
          }
          class Dog extends Animal {
              protected breed: string;
              constructor(legs: number, breed: string);
              makeSound(): string;
          }
        }

         // @ts-ignore Migrated namespace with type-annotationify
         var Zoo: Zoo;
         {
            // @ts-ignore Migrated namespace with type-annotationify
            Zoo ??= {};
            abstract class Animal {
              public legs;
              constructor(legs: number) {
                this.legs = legs;
              }
              abstract makeSound(): string;
            }
            // @ts-ignore Migrated namespace with type-annotationify
            Zoo.Animal = Animal;
            class Dog extends Animal {
                protected breed;
                constructor(legs: number, breed: string) {
                    super(legs);
                    this.breed = breed;
                }
                makeSound() {
                    return 'Woof';
                }
            }
            // @ts-ignore Migrated namespace with type-annotationify
            Zoo.Dog = Dog;
         }
        `,
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
      `// @ts-ignore Migrated namespace with type-annotationify
      declare namespace Foo {
        const pi: 3.14, e: 2.71, tau: 6.28;
        type Bar = number;
        interface Baz {
          name: string;
        }
      }
      // @ts-ignore Migrated namespace with type-annotationify
      var Foo: Foo;
      {
        // @ts-ignore Migrated namespace with type-annotationify
        Foo ??= {};
        Foo.pi = 3.14, Foo.e = 2.71, Foo.tau = 6.28;
      }`,
    );
  });
});

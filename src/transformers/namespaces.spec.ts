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
         // @ts-ignore Migrated namespace with type-annotationify
         Foo.pi = 3.14;
       }`,
    );
  });

  await it('should transform namespace exports with "const" keyword using "@ts-ignore"', async () => {
    await scenario(
      `
      namespace Foo {
        export const pi: 3.14 = 3.14;
        export let e: 2.71 = 2.71;
        export var tau: 6.28 = 6.28;
      }
      `,
      `// @ts-ignore Migrated namespace with type-annotationify
      declare namespace Foo {
        const pi: 3.14;
        let e: 2.71;
        var tau: 6.28;
      }
      // @ts-ignore Migrated namespace with type-annotationify
      var Foo: Foo;
      {
        // @ts-ignore Migrated namespace with type-annotationify
        Foo ??= {};
        // @ts-ignore Migrated namespace with type-annotationify
        Foo.pi = 3.14;
        Foo.e = 2.71;
        Foo.tau = 6.28;
      }`,
    );
  });

  await it('should support exporting a namespace', async () => {
    await scenario(
      `
      export namespace Foo {
        export const pi: 3.14 = 3.14;
      }`,
      `
      // @ts-ignore Migrated namespace with type-annotationify
      export declare namespace Foo {
          const pi: 3.14;
      }

      // @ts-ignore Migrated namespace with type-annotationify
      export var Foo: Foo;
      {
        // @ts-ignore Migrated namespace with type-annotationify
        Foo ??= {};
        // @ts-ignore Migrated namespace with type-annotationify
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
            export const dog = new Dog(4, 'Poodle');
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
          const dog: Dog;
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
            // @ts-ignore Migrated namespace with type-annotationify
            Zoo.dog = new Dog(4, 'Poodle');
         }
        `,
    );
  });

  await it('should add a @ts-ignore comment to class instance exports', async () => {
    await scenario(
      `namespace Farm {
        export class Animal {}
        export let dog = new Animal();
      }`,
      `// @ts-ignore Migrated namespace with type-annotationify
      declare namespace Farm {
        class Animal {}
        let dog: Animal;
      }
      // @ts-ignore Migrated namespace with type-annotationify
      var Farm: Farm;
      {
        // @ts-ignore Migrated namespace with type-annotationify
        Farm ??= {};
        class Animal {}
        // @ts-ignore Migrated namespace with type-annotationify
        Farm.Animal = Animal;
        // @ts-ignore Migrated namespace with type-annotationify
        Farm.dog = new Animal();
      }`,
    );
  });

  describe('exported identifier transformations', async () => {
    await it('should transform exported variables to namespace properties', async () => {
      await scenario(
        `
      namespace Foo {
        export const bar = 42;
        console.log(bar);
        export function qux() {
          return bar;
        }
      }
      `,
        `
      // @ts-ignore Migrated namespace with type-annotationify
      declare namespace Foo {
          const bar = 42;
          function qux(): number;
      }

      // @ts-ignore Migrated namespace with type-annotationify
      var Foo: Foo;
      {
        // @ts-ignore Migrated namespace with type-annotationify
        Foo ??= {};
        // @ts-ignore Migrated namespace with type-annotationify
        Foo.bar = 42;
        console.log(Foo.bar);
        function qux() {
          return Foo.bar;
        }
        Foo.qux = qux;
      }
      `,
      );
    });

    await it('should not transform shadowed parameters', async () => {
      await scenario(
        `
      namespace Counter {
        export let count = 0;
        
        function doIncrement(count: number) {
          return count + 1;
        }
        export function increment() {
          count = doIncrement(count);
        }
      }
      `,
        `
      // @ts-ignore Migrated namespace with type-annotationify
      declare namespace Counter {
          let count: number;
          function increment(): void;
      }
      // @ts-ignore Migrated namespace with type-annotationify
      var Counter: Counter;
      {
        // @ts-ignore Migrated namespace with type-annotationify
        Counter ??= {};
        Counter.count = 0;
        function doIncrement(count: number) {
            return count + 1;
        }
        function increment() {
            Counter.count = doIncrement(Counter.count);
        }
        Counter.increment = increment;
      }
      `,
      );
    });

    await it('should not transform shadowed variables', async () => {
      await scenario(
        `
      namespace Counter {
        export let count = 0;

        function logZero() {
          let count = 0;
          console.log(count);  
        }
        
        export function increment10() {
          let result = count;
          for (let count = 0; count < 10; count++) {
            result++;
          }
          count = result
        }
      }
      `,
        `
      // @ts-ignore Migrated namespace with type-annotationify
      declare namespace Counter {
        let count: number;
        function increment10(): void;
      }
      // @ts-ignore Migrated namespace with type-annotationify
      var Counter: Counter;
      {
        // @ts-ignore Migrated namespace with type-annotationify
        Counter ??= {};
        Counter.count = 0;
        function logZero() {
          let count = 0;
          console.log(count);  
        }
        function increment10() {
            let result = Counter.count;
            for (let count = 0; count < 10; count++) {
                result++;
            }
            Counter.count = result;
        }
        Counter.increment10 = increment10;      }
      `,
      );
    });

    await it('should transform exported identifiers inside variable initializers', async () => {
      await scenario(
        `
      namespace Counter {
        export let count = 0;
        export let count2: typeof count = count;
      }
      `,
        `
      // @ts-ignore Migrated namespace with type-annotationify
      declare namespace Counter {
        let count: number;
        let count2: typeof count;
      }
      // @ts-ignore Migrated namespace with type-annotationify
      var Counter: Counter;
      {
        // @ts-ignore Migrated namespace with type-annotationify
        Counter ??= {};
        Counter.count = 0;
        Counter.count2 = Counter.count; 
      }
      `,
      );
    });

    await it('should not transform type annotations', async () => {
      await scenario(
        `
      namespace Counter {
        export let count: number = 0;
        function n(): count {
        }
      }
      `,
        `
      // @ts-ignore Migrated namespace with type-annotationify
      declare namespace Counter {
          let count: number;
      }
      // @ts-ignore Migrated namespace with type-annotationify
      var Counter: Counter;
      {
        // @ts-ignore Migrated namespace with type-annotationify
        Counter ??= {};
        Counter.count = 0;
        function n(): count {
        }
      }
      `,
      );
    });

    await it('should transform variable names inside type queries', async () => {
      await scenario(
        `
      namespace Counter {
        export let count: number = 0;
        function n(): typeof count {
        }
      }
      `,
        `
      // @ts-ignore Migrated namespace with type-annotationify
      declare namespace Counter {
          let count: number;
      }
      // @ts-ignore Migrated namespace with type-annotationify
      var Counter: Counter;
      {
        // @ts-ignore Migrated namespace with type-annotationify
        Counter ??= {};
        Counter.count = 0;
        function n(): typeof Counter.count {
        }
      }
      `,
      );
    });
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
        // @ts-ignore Migrated namespace with type-annotationify
        Foo.pi = 3.14, Foo.e = 2.71, Foo.tau = 6.28;
      }`,
    );
  });
});

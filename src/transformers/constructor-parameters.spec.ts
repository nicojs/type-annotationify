import { describe, it } from 'node:test';
import { scenario } from '../transform.spec.ts';
import { transformConstructorParameters } from './constructor-parameters.ts';

describe(transformConstructorParameters.name, async () => {
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

  await it('should add the property type when `explicitPropertyTypes` is set', async () => {
    await scenario(
      `class Iban {
            constructor(public bankCode: string) {}
            }`,
      `class Iban {
            public bankCode: string;
            constructor(bankCode: string) {
              this.bankCode = bankCode;
            }
    }`,
      { explicitPropertyTypes: true },
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

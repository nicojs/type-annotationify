[![Mutation testing badge](https://img.shields.io/endpoint?style=flat&url=https%3A%2F%2Fbadge-api.stryker-mutator.io%2Fgithub.com%2Fnicojs%2Ftype-annotationify%2Fmain)](https://dashboard.stryker-mutator.io/reports/github.com/nicojs/type-annotationify/main)

# Type Annotationify

This is a simple tool to migrate full-fledged TypeScript code to type-annotated TypeScript code that is compatible with the [type annotation proposal](https://github.com/tc39/proposal-type-annotations) as well as NodeJS's[--experimental-strip-types](https://nodejs.org/en/blog/release/v22.6.0#experimental-typescript-support-via-strip-types) mode.

![Example of class parameter properties transformation](https://github.com/nicojs/type-annotationify/blob/main/convert-parameter-properties.gif)

> [!NOTE]
> See [running typescript natively on the NodeJS docs page](https://nodejs.org/en/learn/typescript/run-natively) for more info on `--experimental-strip-types`.

## Status

👷‍♂️ Work in progress. This tool is still in development, and not all syntax transformations are supported yet.

| Syntax                                      | Status | Notes                                                             |
| ------------------------------------------- | ------ | ----------------------------------------------------------------- |
| Parameter Properties                        | ✅     | [See limitations](#parameter-property-transformation-limitations) |
| Parameter Properties with `super()` call    | ✅     | [See limitations](#parameter-property-transformation-limitations) |
| Plain Enum                                  | ✅     | [See limitations](#enum-transformation-limitations)               |
| Number Enum                                 | ❌     |                                                                   |
| String Enum                                 | ❌     |                                                                   |
| Const Enum                                  | ❌     |                                                                   |
| Type assertion expressions                  | ❌     | I.e. `<string>value` --> `value as string`                        |
| Namespaces                                  | ❌     | This might turn out to be impossible to do, to be investigated    |
| Rewrite file extensions in import specifier | ❌     | This might be included with an option in the future               |

## Installation

```bash
npm install -g type-annotationify@latest
# OR simply run directly with
npx type-annotationify@latest
```

## Usage

```bash
type-annotationify <pattern-to-typescript-files>
```

The default pattern is `**/!(*.d).?(m|c)ts?(x)`, excluding 'node_modules'.

This will convert all the TypeScript files that match the pattern to type-annotated TypeScript files _in place_. So be sure to commit your code before running this tool.

> [!TIP]
> Running `type-annotationify` will rewrite your TypeScript files without taking your formatting into account. It is recommended to run `prettier` or another formatter after running `type-annotationify`. If you use manual formatting, it might be faster to do the work yourself

## Transformations

### Parameter Properties

Input:

```ts
class Foo {
  constructor(
    public bar: string,
    readonly baz: boolean,
    protected qux = 42,
  ) {}
}
```

Type-annotationifies as:

```ts
class Foo {
  public bar;
  readonly baz;
  protected qux;
  constructor(bar: string, baz: boolean, qux = 42) {
    this.bar = bar;
    this.baz = baz;
    this.qux = qux;
  }
}
```

When a `super()` call is present, the assignments in the constructor are moved to below the `super()` call (like in normal TypeScript transpilation).

The property type annotations are left out, as the TypeScript compiler infers them form the constructor assignments. This is better for code maintainability (every type is listed once instead of twice), but does come with some limitations.

#### Parameter property transformation limitations

1.  It assumes `noImplicitAny` is enabled. Without out, this inference doesn't work.
2.  When you use the property in with an assertion function you will get an error. For example:
    ```ts
    interface Options {
      Foo: string;
    }
    type OptionsValidator = (o: unknown) => asserts o is Options;
    class ConfigReader {
      private readonly validator;
      constructor(validator: OptionsValidator) {
        this.validator = validator;
      }
      public doValidate(options: unknown): Options {
        this.validator(options);
        //   ^^^^^^^^^ 💥 Assertions require every name in the call target to be declared with an explicit type annotation.(2775)
        return options;
      }
    }
    ```
    The solution is to add back the type annotation to the property manually
    ```diff
    - private readonly validator;
    + private readonly validator: OptionsValidator;
    ```

### Enum transformations

An enum transforms to 4 components. The goal is to get as close to a drop-in replacement as possible, without transforming the consumer side of enums.

Input:

```ts
enum Message {
  Start,
  Stop,
}
```

Type-annotationifies as:

```ts
type Message = 0 | 1;
type MessageKeys = 'Start' | 'Stop';
const Message = {
  0: 'Start',
  1: 'Stop',
  Start: 0,
  Stop: 1,
} satisfies Record<Message, MessageKeys> & Record<MessageKeys, Message>;
declare namespace Message {
  type Start = typeof Message.Start;
  type Stop = typeof Message.Stop;
}
```

That's a mouthful. Let's break down each part.

- `type Message = 0 | 1` \
  This allows you to use `Message` as a type: `let message: Message`. The backing value of the enum was a number (`0` or `1`), so thats what it uses here.
- `type MessageKeys = 'Start' | 'Stop'` \
  This is a convenience type alias used in the object literal later.
- The object literal
  ```ts
  const Message = {
    0: 'Start',
    1: 'Stop',
    Start: 0,
    Stop: 1,
  } satisfies Record<Message, MessageKeys> & Record<MessageKeys, Message>;
  ```
  This allows you to use `Message` as a value: `let message = Message.Start`. This is the actual JS footprint of the enum. The `satisfies` operator isn't strictly necessary, but makes sure the `Message` type and `Message` value keep in sync if you decide to change the `Message` "enum" later.
- The namespace
  ```ts
  declare namespace Message {
    type Start = typeof Message.Start;
    type Stop = typeof Message.Stop;
  }
  ```
  This allows you to use `Message.Start` as a type: `let message: Message.Start`.

#### Enum transformation limitations

1. Type inference of enum values are now more narrow after the transformation.
   ```ts
   const bottle = {
     message: Message.Start,
   };
   bottle.message = Message.Stop;
   //     ^^^^^^^ 💥 Type '1' is not assignable to type '0'.(2322)
   ```
   [Playground link](https://www.typescriptlang.org/play/?#code/C4TwDgpgBAshDO8CGBzaBeKAGKAfKAjANwCwAUKJLAsmgNIQjxSYDkAysEgE7Ct5QOwAPZhWpMgGNhAO3jBqiVBigBvclGwAuQZx58ANBsI6ho1kbKa9vHVkvWRYHQUsBfKMmABLeADNvBCgAJQhpbgATAB44JTQDRVoIBiYAPigAMhCw4UiYmmUU+ATYpNSJCLCAGx5oGSQAWwQwJEloUuU1Y0poGwVMHuE-ROUAOj6JTR6oTlEWKEHhjrRxpwk3cmk5BQAjYWBgKpV1KygmuIgdZYhV-XI3CT2Do9HzpPnr1dEiIA) \
   In this example, the type of `bottle.message` is inferred as `0` instead of `Message`. This can be solved with a type annotation.
   ```diff
   - const bottle = {
   + const bottle: { message: Message } = {
   ```

## FAQ

### Why would I want to use this tool?

1. You want to be alined with the upcoming [type annotation proposal](https://github.com/tc39/proposal-type-annotations).
2. You want to use NodeJS's [--experimental-strip-types](https://nodejs.org/en/blog/release/v22.6.0#experimental-typescript-support-via-strip-types) mode.

### How does this tool work?

This tool uses the TypeScript compiler API to parse the TypeScript code and then rewrite it with type annotations.

### Why do I get `ExperimentalWarning` errors?

This tool uses plain NodeJS as much as possible. It doesn't rely on [`glob`](https://www.npmjs.com/package/glob) or other libraries to reduce the download size and maintenance (the only dependency is TypeScript itself). That's also why the minimal version of node is set to 22.

```

```

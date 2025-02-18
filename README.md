[![Mutation testing badge](https://img.shields.io/endpoint?style=flat&url=https%3A%2F%2Fbadge-api.stryker-mutator.io%2Fgithub.com%2Fnicojs%2Ftype-annotationify%2Fmain)](https://dashboard.stryker-mutator.io/reports/github.com/nicojs/type-annotationify/main)

# Type Annotationify

This is a simple tool to migrate full-fledged TypeScript code to type-annotated TypeScript code that is compatible with the [type annotation proposal](https://github.com/tc39/proposal-type-annotations) as well as NodeJS's[--experimental-strip-types](https://nodejs.org/en/blog/release/v22.6.0#experimental-typescript-support-via-strip-types) mode.

Live demo: [nicojs.github.io/type-annotationify/](https://nicojs.github.io/type-annotationify/)

![Example of class parameter properties transformation](https://github.com/nicojs/type-annotationify/blob/main/convert-parameter-properties.gif)

> [!NOTE]
> See [running typescript natively on the NodeJS docs page](https://nodejs.org/en/learn/typescript/run-natively) for more info on `--experimental-strip-types`.

## Status

👷‍♂️ Work in progress. This tool is still in development, and not all syntax transformations are supported yet.

| Syntax                                   | Status | Notes                                      |
| ---------------------------------------- | ------ | ------------------------------------------ |
| Parameter Properties                     | ✅     |                                            |
| Parameter Properties with `super()` call | ✅     |                                            |
| Plain Enum                               | ✅     |                                            |
| Number Enum                              | ✅     |                                            |
| String Enum                              | ✅     |                                            |
| Const Enum                               | ✅     |                                            |
| Type assertion expressions               | ✅     | I.e. `<string>value` --> `value as string` |
| Namespaces                               | ✅     | With some limitations                      |
| Rewrite relative import extensions       | ✅     | with `--relative-import-extensions`        |

## Installation

```bash
npm install -g type-annotationify@latest
# OR simply run directly with
npx type-annotationify@latest
```

## Usage

```bash
type-annotationify [options] <pattern-to-typescript-files>
```

The default pattern is `**/!(*.d).?(m|c)ts?(x)`, excluding 'node_modules'.
In other words, by default all TypeScript files are matched (also in subdirectories) except declaration files (d.ts).

This will convert all the TypeScript files that match the pattern to type-annotated TypeScript files _in place_. So be sure to commit your code before running this tool.

> [!TIP]
> Running `type-annotationify` will rewrite your TypeScript files without taking your formatting into account. It is recommended to run `prettier` or another formatter after running `type-annotationify`. If you use manual formatting, it might be faster to do the work yourself

## Options

### `--dry`

Don't write the changes to disk, but print changes that would have been made to the console.

### `--help`

Print the help message.

### `--explicit-property-types`

Add type annotations to properties. See [Parameter Properties](#parameter-properties) for more info.

### `--no-enum-namespace-declaration`

Disable the `declare namespace` output for enums. For example:

```ts
// ❌ Disable this output for enums
declare namespace Message {
  type Start = typeof Message.Start;
  type Stop = typeof Message.Stop;
}
```

This makes it so you can't use enum values (i.e. `Message.Start`) as a type, but means a far cleaner output in general. This might result in compile errors, which are pretty easy to fix yourself:

```diff
- let message: Message.Start;
+ let message: typeof Message.Start;
```

### `--relative-import-extensions`

Rewrite relative file extensions in import specifiers to `.ts`, `.cts` or `.mts`. See [Relative import extensions](#relative-import-extensions) for more info.

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

<table>
<thread>
<tr>
<th>Default</th>
<th><code>--explicit-property-types</code></th>
</tr>
</thead>
<tbody>
<tr>
<td>

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

</td><td>

```ts
class Foo {
  public bar: string;
  readonly baz: boolean;
  protected qux;
  constructor(bar: string, baz: boolean, qux = 42) {
    this.bar = bar;
    this.baz = baz;
    this.qux = qux;
  }
}
```

</td>
</tr>
</tbody>
</table>

When a `super()` call is present, the assignments in the constructor are moved to below the `super()` call (like in normal TypeScript transpilation).

The property type annotations are left out by default, as the TypeScript compiler infers them from the constructor assignments. This is better for code maintainability (every type is listed once instead of twice), but does come with some limitations. However, if you want to be explicit, you can enable the `--explicit-property-types` option.

#### Parameter property transformation limitations

1.  It assumes `noImplicitAny` is enabled. Without it, the inference from the assignments in the constructor doesn't work. You can opt-out of this by enabling the `--explicit-property-types` option.
2.  When you use the property as an assertion function you will get an error. For example:
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
    The solution is to add the type annotation to the property manually.
    ```diff
    - private readonly validator;
    + private readonly validator: OptionsValidator;
    ```
    Or enable the `--explicit-property-types` option.

### Enum transformations

An enum transforms to 3 components. The goal is to get as close to a drop-in replacement as possible, _without transforming the consuming side of enums_.

Input:

```ts
enum Message {
  Start,
  Stop,
}
```

> [!NOTE]
> String enums are also supported.

Type-annotationifies as:

```ts
const Message = {
  0: 'Start',
  1: 'Stop',
  Start: 0,
  Stop: 1,
} as const;
type Message = (typeof Message)[keyof typeof Message & string];
declare namespace Message {
  type Start = typeof Message.Start;
  type Stop = typeof Message.Stop;
}
```

That's a mouthful. Let's break down each part.

- The object literal
  ```ts
  const Message = {
    0: 'Start',
    1: 'Stop',
    Start: 0,
    Stop: 1,
  } as const;
  ```
  This allows you to use `Message` as a value: `let message = Message.Start`. This is the actual JS footprint of the enum. The `as const` assertion, but makes sure we can use `typeof Message.Start`.
- `type Message = (typeof Message)[keyof typeof Message & string];` \
  This allows you to use `Message` as a type: `let message: Message`. Let's break it down further:
  - `typeof Message` means the object shape `{0: 'Start', 1: 'Stop', Start: 0, Stop: 1 }`
  - `keyof typeof Message` means the keys of that object: `0 | 1 | 'Start' | 'Stop'`
  - `& string` filters out the keys that are also strings: `'Start' | 'Stop'`
  - `(typeof Message)[keyof typeof Message & string]` means the type of the values of the object with the keys `'Start' | 'Stop'`, so only values `0 | 1`. This was the backing value of the original enum.
- The `declare namespace`
  ```ts
  declare namespace Message {
    type Start = typeof Message.Start;
    type Stop = typeof Message.Stop;
  }
  ```
  This allows you to use `Message.Start` as a type: `let message: Message.Start`. This can be disabled with the `--no-enum-namespace-declaration` option.

#### Enum transformation limitations

1. Type inference of enum values are more narrow after the transformation.
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
1. A const enum is transformed to a regular enum. This is because the caller-side of a `const enum` will assume that there is an actual value after type-stripping.

### Type assertion expressions

Input:

```ts
const value = <string>JSON.parse('"test"');
```

Type-annotationifies as:

```ts
const value = JSON.parse('"test"') as string;
```

### Namespaces

Namespace transformation is a bit more complex. The goal is to keep the namespace as close to the original as possible, while still using erasable types only. It unfortunately _needs_ a couple of `@ts-ignore` comments to make it work. For more info and reasoning, see [#26](https://github.com/nicojs/type-annotationify/issues/26).

Input:

```ts
namespace Geometry {
  console.log('Foo is defined');
  export const pi = 3.141527;
  export function areaOfCircle(radius: number) {
    return pi * radius ** 2;
  }
}
```

Type-annotationifies as:

```ts
// @ts-ignore Migrated namespace with type-annotationify
declare namespace Geometry {
  const pi = 3.141527;
  function areaOfCircle(radius: number): number;
}
// @ts-ignore Migrated namespace with type-annotationify
var Geometry: Geometry;
{
  // @ts-ignore Migrated namespace with type-annotationify
  Geometry ??= {};
  console.log('Foo is defined');
  // @ts-ignore Migrated namespace with type-annotationify
  Geometry.pi = 3.141527;
  function areaOfCircle(radius: number) {
    return Geometry.pi * radius ** 2;
  }
  Geometry.areaOfCircle = areaOfCircle;
}
```

#### Namespace transformation limitations

1. Nested namespaces are not supported yet. Please open an issue if you want support for this.
1. Referring to identifiers with their local name across namespaces declarations with the same name is not supported. For example:
   ```ts
   namespace Geometry {
     export const pi = 3.141527;
   }
   namespace Geometry {
     export function areaOfCircle(radius: number) {
       return pi * radius ** 2;
     }
   }
   ```
   This will result in an error because `pi` is not defined in the second namespace. The solution is to refer to `pi` as `Geometry.pi`:
   ```diff
   - return pi * radius ** 2;
   + return Geometry.pi * radius ** 2;
   ```
1. The `@ts-ignore` comments are necessary to make the namespace work. This is because there are a bunch of illegal TypeScript constructs needed, like declaring a namespace and a variable with the same name. This also means that _TypeScript_ is turned off entirely for these statements.

### Relative import extensions

You can let type-annotationify rewrite relative import extensions from `.js`, `.cjs` or `.mjs` to `.ts`, `.cts` or `.mts` respectively. Since this isn't strictly 'type-annotationification', you'll need to enable this using the `--relative-import-extensions` flag.

Input

```ts
import { foo } from './foo.js';
```

Type-annotationifies as:

```ts
import { foo } from './foo.ts';
```

This is useful when you want to use the `--experimental-strip-types` flag in NodeJS to run your TS code directly, where in the past you needed to transpile it first.

> [!TIP]
> After you've rewritten your imports, you should not forget to enable `allowImportingTsExtensions` in your tsconfig. If you still want to transpile your code to `.js` with `tsc`, you will also should enable `rewriteRelativeImportExtensions` in your tsconfig.

## FAQ

### Why would I want to use this tool?

1. You want to be aligned with the upcoming [type annotation proposal](https://github.com/tc39/proposal-type-annotations).
2. You want to use NodeJS's [--experimental-strip-types](https://nodejs.org/en/blog/release/v22.6.0#experimental-typescript-support-via-strip-types) mode.
3. You want to use TypeScript [`--erasableSyntaxOnly`](https://devblogs.microsoft.com/typescript/announcing-typescript-5-8-beta/#the---erasablesyntaxonly-option) option.

### How does this tool work?

This tool uses the TypeScript compiler API to parse the TypeScript code and then rewrite it with type annotations.

### Why do I get `ExperimentalWarning` errors?

This tool uses plain NodeJS as much as possible. It doesn't rely on [`glob`](https://www.npmjs.com/package/glob) or other libraries to reduce the download size and maintenance (the only dependency is TypeScript itself). That's also why the minimal version of node is set to 22.

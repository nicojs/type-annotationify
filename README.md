# Type Annotationify

This is a simple tool to migrate full-fledged TypeScript code to type-annotated TypeScript code that is compatible with the [type annotation proposal](https://github.com/tc39/proposal-type-annotations) as well as NodeJS's[--experimental-strip-types](https://nodejs.org/en/blog/release/v22.6.0#experimental-typescript-support-via-strip-types) mode.

![Example of class parameter properties transformation](https://github.com/nicojs/type-annotationify/blob/main/convert-parameter-properties.gif)

> [!NOTE]
> See [running typescript natively on the NodeJS docs page](https://nodejs.org/en/learn/typescript/run-natively) for more info on `--experimental-strip-types`.

## Status

👷‍♂️ Work in progress. This tool is still in development, and not all syntax transformations are supported yet.

| Syntax                                      | Status | Notes                                                              |
| ------------------------------------------- | ------ | ------------------------------------------------------------------ |
| Class Properties                            | ✅     |                                                                    |
| Class Properties with `super()` call        | ❌     |                                                                    |
| Plain Enum                                  | ❌     |                                                                    |
| Number Enum                                 | ❌     |                                                                    |
| String Enum                                 | ❌     |                                                                    |
| Namespaces                                  | ❌     | This might turn out to be impossible to do, to be investigated     |
| Rewrite file extensions in import specifier | ❌     | This might be included with an option in the future With an option |

## Installation

```bash
npm install -g type-annotationify
# OR simply run directly with
npx type-annotationify
```

## Usage

```bash
type-annotationify <pattern-to-typescript-files>
```

The default pattern is `**/!(*.d).?(m|c)ts?(x)`, excluding 'node_modules'.

This will convert all the TypeScript files that match the pattern to type-annotated TypeScript files _in place_. So be sure to commit your code before running this tool.

> [!TIP]
> Running `type-annotationify` will rewrite your TypeScript files without taking your formatting into account. It is recommended to run `prettier` or another formatter after running `type-annotationify`. If you use manual formatting, it might be faster to do the work yourself

## FAQ

### Why would I want to use this tool?

1. You want to be alined with the upcoming [type annotation proposal](https://github.com/tc39/proposal-type-annotations).
2. You want to use NodeJS's [--experimental-strip-types](https://nodejs.org/en/blog/release/v22.6.0#experimental-typescript-support-via-strip-types) mode.

### How does this tool work?

This tool uses the TypeScript compiler API to parse the TypeScript code and then rewrite it with type annotations.

### Why do I get `ExperimentalWarning` errors?

This tool uses plain NodeJS as much as possible. It doesn't rely on [`glob`](https://www.npmjs.com/package/glob) or other libraries to reduce the download size and maintenance (the only dependency is TypeScript itself). That's also why the minimal version of node is set to 22.

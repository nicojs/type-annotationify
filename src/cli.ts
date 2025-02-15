import { parseArgs } from 'util';
import fs from 'fs/promises';
import { type TransformOptions, parse, print, transform } from './transform.ts';
import type { GlobOptionsWithoutFileTypes } from 'fs';

/**
 * Runs the type annotationify CLI.
 * @param args The command line arguments to use.
 * @param context The context with dependencies, used for testing.
 * @returns
 */
export async function runTypeAnnotationifyCli(
  args: string[],
  context = {
    parse,
    print,
    transform,
    log: console.log,
    glob: fs.glob as (
      pattern: string[],
      opt: GlobOptionsWithoutFileTypes,
    ) => NodeJS.AsyncIterator<string>,
    readFile: fs.readFile as (
      fileName: string,
      encoding: 'utf-8',
    ) => Promise<string>,
    writeFile: fs.writeFile,
  },
): Promise<void> {
  const { parse, print, transform, log, glob, writeFile, readFile } = context;
  const { positionals, values: options } = parseArgs({
    args,
    options: {
      'enum-namespace-declaration': { type: 'boolean', default: true },
      'relative-import-extensions': { type: 'boolean', default: false },
      dry: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
    allowNegative: true,
  });

  if (options.help) {
    log(`
    Usage: type-annotationify [options] [patterns]

    Options:
      --dry                            Don't write the transformed files to disk, perform a test run only.
      --no-enum-namespace-declaration  Don't emit "declare namespace..." when converting enum declarations.
      --relative-import-extensions     Convert relative imports from .js to .ts
      -h, --help                       Display this help message

    Patterns:
      Glob patterns to match files to transform. Defaults to '**/!(*.d).?(m|c)ts?(x)' (excluding node_modules). 
      In other words, by default all TypeScript files are matched (also in subdirectories) except declaration files (d.ts). 
    `);
    return;
  }

  const patterns: string[] = [...positionals];
  if (patterns.length === 0) {
    patterns.push('**/!(*.d).?(m|c)ts?(x)');
  }
  const promises: Promise<void>[] = [];
  let untouched = 0;
  const transformOptions: TransformOptions = {
    enumNamespaceDeclaration: options['enum-namespace-declaration'],
    relativeImportExtensions: options['relative-import-extensions'],
  };
  for await (const file of glob(patterns, {
    exclude: (fileName) => fileName === 'node_modules',
  })) {
    promises.push(
      (async () => {
        const content = await readFile(file, 'utf-8');
        const sourceFile = parse(file, content);
        const { node, report } = transform(sourceFile, transformOptions);
        if (report.changed) {
          if (options.dry) {
            log(`🚀 ${file} [${report.text}]`);
          } else {
            const transformedContent = print(node);
            await writeFile(file, transformedContent);
            log(`✅ ${file} [${report.text}]`);
          }
        } else {
          untouched++;
        }
      })(),
    );
  }
  await Promise.allSettled(promises);
  const transformed = promises.length - untouched;
  log(
    `🎉 ${transformed} file${transformed === 1 ? '' : 's'}${options.dry ? ' would have been' : ''} transformed (${untouched} untouched)`,
  );
}

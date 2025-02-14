import { parseArgs } from 'util';
import fs from 'fs/promises';
import { type TransformOptions, parse, print, transform } from './transform.ts';

export async function runTypeAnnotationify(args: string[]) {
  const { positionals, values: options } = parseArgs({
    args,
    options: {
      'enum-namespace-declaration': { type: 'boolean', default: true },
      'relative-import-extensions': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
    allowNegative: true,
  });

  if (options.help) {
    console.log(`
    Usage: type-annotationify [options] [patterns]

    Options:
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
  for await (const file of fs.glob(patterns, {
    exclude: (fileName) => fileName === 'node_modules',
  })) {
    promises.push(
      (async () => {
        const content = await fs.readFile(file, 'utf-8');
        const sourceFile = parse(file, content);
        const { node, report } = transform(sourceFile, transformOptions);
        if (report.changed) {
          const transformedContent = print(node);
          await fs.writeFile(file, transformedContent);
          console.log(`✅ ${file} [${report.text}]`);
        } else {
          untouched++;
        }
      })(),
    );
  }
  await Promise.allSettled(promises);
  console.log(
    `🎉 ${promises.length - untouched} files transformed (${untouched} untouched)`,
  );
}

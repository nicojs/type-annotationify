import { parseArgs } from 'util';
import fs from 'fs/promises';
import { parse, print, transform } from './transform.ts';

export async function runTypeAnnotationify(args: string[]) {
  const { positionals, values: options } = parseArgs({
    args,
    options: {
      'enum-namespace-declaration': { type: 'boolean', default: true },
    },
    allowPositionals: true,
    allowNegative: true,
  });
  const patterns: string[] = [...positionals];
  if (patterns.length === 0) {
    patterns.push('**/!(*.d).?(m|c)ts?(x)');
  }
  const promises: Promise<void>[] = [];
  let untouched = 0;
  for await (const file of fs.glob(patterns, {
    exclude: (fileName) => fileName === 'node_modules',
  })) {
    promises.push(
      (async () => {
        const content = await fs.readFile(file, 'utf-8');
        const sourceFile = parse(file, content);
        const { node, changed } = transform(sourceFile, {
          enumNamespaceDeclaration: options['enum-namespace-declaration'],
        });
        if (changed) {
          const transformedContent = print(node);
          await fs.writeFile(file, transformedContent);
          console.log(`✅ (changed) ${file}`);
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

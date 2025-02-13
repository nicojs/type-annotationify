import { describe, it } from 'node:test';
import { transformRelativeImportExtensions } from './import-extensions.ts';
import { scenario } from '../transform.spec.ts';

describe(transformRelativeImportExtensions.name, async () => {
  await it('should not change a bare imports', async () => {
    const input = `
      import 'module/path.js';
      import 'module/path.cjs';
      import 'module/path.mjs';
      import('module/path.js');
      import('module/path.cjs');
      import('module/path.mjs');
      `;
    await scenario(input, input, { relativeImportExtensions: true });
  });
  await it('should not change a relative import when relativeImportExtensions is false', async () => {
    const input = `
      import './module/path.js';
      `;
    await scenario(input, input, { relativeImportExtensions: false });
  });
  await it('should not rewrite a relative import when it already has ".ts"', async () => {
    const input = `
      import './module/path.ts';
      `;
    await scenario(input, input, { relativeImportExtensions: false });
  });
  await it('should rewrite a relative import when relativeImportExtensions is true', async () => {
    await scenario("import './module/path.js';", "import './module/path.ts';", {
      relativeImportExtensions: true,
    });
  });
  await it('should also rewrite .cjs and .mjs extensions', async () => {
    await scenario(
      `import './module/path.cjs'; 
       import './module/path.mjs';`,
      `import './module/path.cts';
       import './module/path.mts';`,
      {
        relativeImportExtensions: true,
      },
    );
  });
  await it('should also rewrite type-only imports', async () => {
    await scenario(
      `import type { A } from './module/path.js'; 
       import type { B } from './module/path.cjs';
       import type { C } from './module/path.mjs';`,
      `import type { A } from './module/path.ts'; 
       import type { B } from './module/path.cts';
       import type { C } from './module/path.mts';`,
      {
        relativeImportExtensions: true,
      },
    );
  });
  await it('should rewrite conditional imports', async () => {
    await scenario(
      `import('./module/path.js');
        import('./module/path.cjs');
        import('./module/path.mjs');`,
      `import('./module/path.ts');
        import('./module/path.cts');
        import('./module/path.mts');`,
      {
        relativeImportExtensions: true,
      },
    );
  });
});

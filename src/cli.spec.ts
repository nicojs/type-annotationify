import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runTypeAnnotationifyCli } from './cli.ts';
import { DEFAULT_OPTIONS, parse, print, transform } from './transform.ts';
import sinon from 'sinon';
import type fs from 'fs/promises';
import type { GlobOptionsWithoutFileTypes } from 'node:fs';
import { TransformChangesReport } from './transform-changes-report.ts';

describe(runTypeAnnotationifyCli.name, async () => {
  class Context {
    parse = parse;
    print = print;
    transform = sinon.spy(transform);
    log = sinon.stub<
      Parameters<typeof console.log>,
      ReturnType<typeof console.log>
    >();
    glob = sinon.stub<
      [string[], GlobOptionsWithoutFileTypes],
      NodeJS.AsyncIterator<string>
    >();
    readFile = sinon.stub<[string, 'utf-8'], Promise<string>>();
    writeFile = sinon.stub<
      Parameters<typeof fs.writeFile>,
      ReturnType<typeof fs.writeFile>
    >();
  }

  let context: Context;
  beforeEach(() => {
    context = new Context();
  });
  afterEach(() => {
    sinon.restore();
  });

  await it('should display a smart help message when called with `--help` or `-h`', async () => {
    await act(['--help']);
    await act(['-h']);
    sinon.assert.calledTwice(context.log);
    const logMessages = context.log.args.map(([message]) => message);

    assert.equal(logMessages[0], logMessages[1]);
    sinon.assert.calledWithMatch(context.log, / --help/);
    sinon.assert.calledWithMatch(context.log, / -h/);
    Object.keys(DEFAULT_OPTIONS).forEach((option) => {
      sinon.assert.calledWithMatch(
        context.log,
        new RegExp(toKebabCase(option)),
      );
    });
  });

  await it('should exclude node_modules', async () => {
    context.glob.returns(new AsyncFileIterable([]));
    await act();
    sinon.assert.calledOnce(context.glob);
    sinon.assert.calledWith(context.glob, sinon.match.array, {
      exclude: sinon.match.func,
    });
    const exclude = context.glob.args[0]![1].exclude!;
    assert.equal(exclude('node_modules'), true);
    assert.equal(exclude('something_else'), false);
  });

  await it('should default use the default pattern', async () => {
    context.glob.returns(new AsyncFileIterable([]));
    await act();
    sinon.assert.calledOnceWithExactly(
      context.glob,
      ['**/!(*.d).?(m|c)ts?(x)'],
      {
        exclude: sinon.match.func,
      },
    );
  });

  await it('should use the provided patterns', async () => {
    context.glob.returns(new AsyncFileIterable([]));
    await act(['src/**/*.ts', 'test/**/*.ts']);
    sinon.assert.calledOnceWithExactly(
      context.glob,
      ['src/**/*.ts', 'test/**/*.ts'],
      {
        exclude: sinon.match.func,
      },
    );
  });

  await it('should transform a single file and write it back in-place', async () => {
    context.glob.returns(new AsyncFileIterable(['src/cli.ts']));
    context.readFile.resolves('const foo = <string>JSON.parse(`"hello"`);');
    await act();
    sinon.assert.calledOnceWithExactly(context.readFile, 'src/cli.ts', 'utf-8');
    sinon.assert.calledOnceWithExactly(
      context.writeFile,
      'src/cli.ts',
      'const foo = JSON.parse(`"hello"`) as string;\n',
    );
  });

  await it('should not write the file if it was not changed', async () => {
    context.glob.returns(new AsyncFileIterable(['src/cli.ts']));
    context.readFile.resolves('const foo = JSON.parse(`"hello"`) as string;');
    await act();
    sinon.assert.notCalled(context.writeFile);
  });

  await it('should report the number of changes', async () => {
    context.glob.returns(new AsyncFileIterable(['src/foo.ts', 'src/bar.ts']));
    context.readFile
      .withArgs('src/foo.ts')
      .resolves('const foo = <string>JSON.parse(`"hello"`);');
    context.readFile.withArgs('src/bar.ts').resolves('');
    await act();
    const report = new TransformChangesReport();
    report.typeAssertions++;
    sinon.assert.calledWith(context.log, `✅ src/foo.ts [${report.text}]`);
    sinon.assert.calledWith(context.log, `🎉 1 file transformed (1 untouched)`);
  });

  await it('should report the number of changes as plural if there are more than one changed', async () => {
    context.glob.returns(new AsyncFileIterable(['src/foo.ts', 'src/bar.ts']));
    context.readFile.resolves('const foo = <string>JSON.parse(`"hello"`);');
    await act();
    const report = new TransformChangesReport();
    report.typeAssertions++;
    sinon.assert.calledWith(
      context.log,
      `🎉 2 files transformed (0 untouched)`,
    );
  });

  await it('should use default options when no options are provided', async () => {
    context.glob.returns(new AsyncFileIterable(['src/foo.ts']));
    context.readFile.resolves('const foo = <string>JSON.parse(`"hello"`);');
    await act();
    sinon.assert.calledWithMatch(
      context.transform,
      sinon.match.any,
      DEFAULT_OPTIONS,
    );
  });
  await it('should set enumNamespaceDeclaration to false when `--no-enum-namespace-declaration` is set', async () => {
    context.glob.returns(new AsyncFileIterable(['src/foo.ts']));
    context.readFile.resolves('');
    await act(['--no-enum-namespace-declaration']);
    sinon.assert.calledWithMatch(context.transform, sinon.match.any, {
      ...DEFAULT_OPTIONS,
      enumNamespaceDeclaration: false,
    });
  });
  await it('should set relativeImportExtensions to true when `--relative-import-extensions` is set', async () => {
    context.glob.returns(new AsyncFileIterable(['src/foo.ts']));
    context.readFile.resolves('');
    await act(['--relative-import-extensions']);
    sinon.assert.calledWithMatch(context.transform, sinon.match.any, {
      ...DEFAULT_OPTIONS,
      relativeImportExtensions: true,
    });
  });

  await it.only('should only report files when `--dry` is set', async () => {
    context.glob.returns(new AsyncFileIterable(['src/foo.ts']));
    context.readFile.resolves('const foo = <string>JSON.parse(`"hello"`);');
    await act(['--dry']);
    sinon.assert.notCalled(context.writeFile);
    const report = new TransformChangesReport();
    report.typeAssertions++;
    sinon.assert.calledWith(context.log, `🚀 src/foo.ts [${report.text}]`);
    sinon.assert.calledWith(
      context.log,
      `🎉 1 file would have been transformed (0 untouched)`,
    );
  });

  async function act(args: string[] = []) {
    await runTypeAnnotationifyCli(args, context);
  }

  class AsyncFileIterable {
    private readonly values;
    constructor(values: string[]) {
      this.values = values;
    }
    [Symbol.asyncIterator]() {
      return this;
    }
    next() {
      const done = !this.values.length;
      return Promise.resolve({
        value: this.values.shift(),
        done: done,
      } as IteratorResult<string>);
    }
  }
});

function toKebabCase(input: string): string {
  return input.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

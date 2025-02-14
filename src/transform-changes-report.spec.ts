import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TransformChangesReport } from './transform-changes-report.ts';

describe(TransformChangesReport.name, () => {
  let sut: TransformChangesReport;
  beforeEach(() => {
    sut = new TransformChangesReport();
  });

  describe('changed', () => {
    it('should be false when no changes are reported', async () => {
      assert.strictEqual(sut.changed, false);
    });
    (
      [
        'classConstructors',
        'enumDeclarations',
        'typeAssertions',
        'namespaceDeclarations',
        'relativeImportExtensions',
      ] as const
    ).forEach((property) => {
      it(`should be true when ${property} changes are reported`, async () => {
        sut[property]++;
        assert.strictEqual(sut.changed, true);
      });
    });
  });

  describe('text', () => {
    it('should be empty when no changes are reported', async () => {
      assert.strictEqual(sut.text, '');
    });
    it('should be the singular form when one change is reported', async () => {
      sut.classConstructors++;
      assert.strictEqual(sut.text, '1 class constructor');
    });
    it('should be the plural form when multiple changes are reported', async () => {
      sut.classConstructors = 2;
      sut.enumDeclarations = 3;
      assert.strictEqual(sut.text, '2 class constructors, 3 enum declarations');
    });
    it('should be able to report all changes', async () => {
      sut.classConstructors = 1;
      sut.enumDeclarations = 2;
      sut.typeAssertions = 3;
      sut.namespaceDeclarations = 4;
      sut.relativeImportExtensions = 5;
      assert.strictEqual(
        sut.text,
        '1 class constructor, 2 enum declarations, 4 namespace declarations, 3 type assertions, 5 import extensions',
      );
    });
  });
});

const reportLabels = Object.freeze({
  classConstructors: 'class constructor',
  enumDeclarations: 'enum declaration',
  namespaceDeclarations: 'namespace declaration',
  typeAssertions: 'type assertion',
  relativeImportExtensions: 'import extension',
});

export class TransformChangesReport {
  classConstructors = 0;
  enumDeclarations = 0;
  namespaceDeclarations = 0;
  typeAssertions = 0;
  relativeImportExtensions = 0;

  #numberToText(name: keyof typeof reportLabels) {
    return this[name] > 0
      ? `${this[name]} ${reportLabels[name]}${this[name] > 1 ? 's' : ''}`
      : '';
  }

  get changed(): boolean {
    return (
      this.classConstructors > 0 ||
      this.enumDeclarations > 0 ||
      this.namespaceDeclarations > 0 ||
      this.typeAssertions > 0 ||
      this.relativeImportExtensions > 0
    );
  }

  get text(): string {
    return [
      this.#numberToText('classConstructors'),
      this.#numberToText('enumDeclarations'),
      this.#numberToText('namespaceDeclarations'),
      this.#numberToText('typeAssertions'),
      this.#numberToText('relativeImportExtensions'),
    ]
      .filter(Boolean)
      .join(', ');
  }
}

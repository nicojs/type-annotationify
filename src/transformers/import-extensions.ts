import ts from 'typescript';
import type { TransformOptions, TransformResult } from '../transform.ts';

export function transformRelativeImportExtensions(
  node: ts.ImportDeclaration | ts.CallExpression,
  options: Pick<TransformOptions, 'relativeImportExtensions'>,
): TransformResult<ts.ImportDeclaration | ts.CallExpression> {
  if (!options.relativeImportExtensions) {
    return { changed: false, node };
  }
  if (ts.isCallExpression(node)) {
    return transformRelativeImportCallExpression(node);
  }
  return transformRelativeImportDeclaration(node);
}

function transformRelativeImportCallExpression(
  node: ts.CallExpression,
): TransformResult<ts.ImportDeclaration | ts.CallExpression> {
  if (
    node.expression.kind !== ts.SyntaxKind.ImportKeyword ||
    !node.arguments[0] ||
    !ts.isStringLiteral(node.arguments[0])
  ) {
    return {
      changed: false,
      node: node,
    };
  }
  const moduleSpecifier = rewriteRelativeExtension(node.arguments[0].text);
  const changed = moduleSpecifier !== node.arguments[0].text;
  return {
    changed,
    node: changed
      ? ts.factory.createCallExpression(node.expression, node.typeArguments, [
          ts.factory.createStringLiteral(moduleSpecifier),
        ])
      : node,
  };
}

function transformRelativeImportDeclaration(
  node: ts.ImportDeclaration,
): TransformResult<ts.ImportDeclaration> {
  if (!ts.isStringLiteral(node.moduleSpecifier)) {
    return { changed: false, node: node };
  }

  const moduleSpecifier = rewriteRelativeExtension(node.moduleSpecifier.text);
  const changed = moduleSpecifier !== node.moduleSpecifier.text;
  return {
    changed,
    node: changed
      ? ts.factory.createImportDeclaration(
          node.modifiers,
          node.importClause,
          ts.factory.createStringLiteral(moduleSpecifier),
          node.attributes,
        )
      : node,
  };
}

function rewriteRelativeExtension(moduleSpecifier: string) {
  if (!moduleSpecifier.startsWith('.')) {
    return moduleSpecifier;
  }

  if (moduleSpecifier.endsWith('.js')) {
    return moduleSpecifier.replace(/\.js$/, '.ts');
  }
  if (moduleSpecifier.endsWith('.mjs')) {
    return moduleSpecifier.replace(/\.mjs$/, '.mts');
  }
  if (moduleSpecifier.endsWith('.cjs')) {
    return moduleSpecifier.replace(/\.cjs$/, '.cts');
  }
  return moduleSpecifier;
}

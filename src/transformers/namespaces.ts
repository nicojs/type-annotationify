import ts, { getCombinedModifierFlags, type Identifier } from 'typescript';
import type { TransformResult } from '../transform.ts';

export function transformNamespace(
  namespace: ts.ModuleDeclaration,
): TransformResult<ts.Node[] | ts.ModuleDeclaration> {
  // Don't transpile empty namespaces
  if (
    namespace.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword,
    ) ||
    namespace.body?.kind !== ts.SyntaxKind.ModuleBlock
  ) {
    return { changed: false, node: namespace };
  }

  if (!namespace.body || namespace.body.statements.length === 0) {
    return { changed: true, node: [] }; // Remove empty namespaces, this is compatible with typescript transpilation
  }

  const namespaceHasExports = hasExports(namespace.body);
  if (namespaceHasExports) {
    // Not supported yet
    return { changed: false, node: [] };
  }

  const nodes: ts.Node[] = [];
  const namespaceDeclaration = createNamespaceDeclaration(
    namespace,
    namespaceHasExports,
  );
  if (namespaceDeclaration) {
    nodes.push(namespaceDeclaration);
  }
  nodes.push(createInterface(namespace));
  nodes.push(...createBlock(namespace, namespace.body));
  return {
    changed: true,
    node: nodes,
  };
}
function hasExports(block: ts.ModuleBlock) {
  return block.statements.some(
    (statement) =>
      (ts.isVariableStatement(statement) ||
        ts.isFunctionDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isClassDeclaration(statement)) &&
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      ),
  );
}

function createNamespaceDeclaration(
  _namespace: ts.ModuleDeclaration,
  namespaceHasExports: boolean,
): ts.Node | undefined {
  if (!namespaceHasExports) {
    return undefined;
  }
  throw new Error('Namespaces with exports not supported yet');
}

function createInterface(namespace: ts.ModuleDeclaration): ts.Node {
  return ts.factory.createInterfaceDeclaration(
    namespace.modifiers,
    namespace.name as Identifier,
    undefined,
    undefined,
    [],
  );
}

function createBlock(
  namespace: ts.ModuleDeclaration,
  block: ts.ModuleBlock,
): ts.Node[] {
  const namespaceName = namespace.name as Identifier;
  const initialization = ts.addSyntheticLeadingComment(
    ts.factory.createExpressionStatement(
      ts.factory.createBinaryExpression(
        namespaceName,
        ts.SyntaxKind.QuestionQuestionEqualsToken,
        ts.factory.createObjectLiteralExpression(),
      ),
    ),
    ts.SyntaxKind.SingleLineCommentTrivia,
    ' @ts-ignore Migrated module with type-annotationify',
    false,
  );

  return [
    ts.factory.createVariableStatement(
      namespace.modifiers,
      ts.factory.createVariableDeclarationList([
        ts.factory.createVariableDeclaration(
          namespaceName,
          undefined,
          ts.factory.createTypeReferenceNode(namespace.name as Identifier),
        ),
      ]),
    ),
    ts.factory.createBlock([initialization, ...block.statements], true),
  ];
}

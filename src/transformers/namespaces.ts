import ts, { isTypeReferenceNode, type Identifier } from 'typescript';
import type { TransformerResult } from './transformer-result.ts';
const IGNORE_COMMENT = ' @ts-ignore Migrated namespace with type-annotationify';

export function transformNamespace(
  namespace: ts.ModuleDeclaration,
): TransformerResult<ts.Node[] | ts.ModuleDeclaration> {
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

  return {
    changed: true,
    node: [
      createNamespaceDeclaration(namespace),
      ...createBlock(namespace, namespace.body),
    ],
  };
}

function createNamespaceDeclaration(namespace: ts.ModuleDeclaration): ts.Node {
  const declarationText = ts.transpileDeclaration(namespace.getText(), {
    reportDiagnostics: false,
    compilerOptions: { strict: true },
  }).outputText;
  const foreignDeclaration = ts.createSourceFile(
    'ts2.ts',
    declarationText,
    ts.ScriptTarget.ESNext,
    /*setParentNodes:*/ false,
  ).statements[0]!;
  const declaration = ts.setTextRange(foreignDeclaration, namespace);

  // @ts-expect-error the parent is needed here
  declaration.parent = namespace.parent;

  return addIgnoreComment(declaration);
}

function addIgnoreComment<T extends ts.Node>(node: T): T {
  return ts.addSyntheticLeadingComment(
    node,
    ts.SyntaxKind.SingleLineCommentTrivia,
    IGNORE_COMMENT,
    /* hasTrailingNewLine: */ false,
  );
}

function createBlock(
  namespace: ts.ModuleDeclaration,
  block: ts.ModuleBlock,
): ts.Node[] {
  const namespaceName = namespace.name as Identifier;
  const initialization = addIgnoreComment(
    ts.factory.createExpressionStatement(
      ts.factory.createBinaryExpression(
        namespaceName,
        ts.SyntaxKind.QuestionQuestionEqualsToken,
        ts.factory.createObjectLiteralExpression(),
      ),
    ),
  );
  const exportedIdentifierNames: string[] = [];

  return [
    addIgnoreComment(
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
    ),
    ts.factory.createBlock(
      [
        initialization,
        ...block.statements
          .filter(isNotInterfaceOrTypeDeclaration)
          .flatMap((statement) => {
            if (isNamespaceExportableValue(statement) && isExported(statement))
              switch (statement.kind) {
                case ts.SyntaxKind.VariableStatement:
                  exportedIdentifierNames.push(
                    ...statement.declarationList.declarations
                      .map(({ name }) => name)
                      .filter(ts.isIdentifier)
                      .map(({ text }) => text),
                  );

                  return toSyntheticExportedVariableStatement(
                    statement,
                    namespaceName,
                    exportedIdentifierNames,
                  );
                case ts.SyntaxKind.FunctionDeclaration:
                  return toSyntheticExportedFunctionDeclaration(
                    transformExportedIdentifiersToNamespaceProperties(
                      statement,
                      namespaceName,
                      exportedIdentifierNames,
                    ),
                    namespaceName,
                  );
                case ts.SyntaxKind.ClassDeclaration:
                  return toSyntheticExportedClassDeclaration(
                    transformExportedIdentifiersToNamespaceProperties(
                      statement,
                      namespaceName,
                      exportedIdentifierNames,
                    ),
                    namespaceName,
                  );
                default:
                  throw new Error(
                    `Exported ${ts.SyntaxKind[(statement satisfies never as ts.Statement).kind]} not supported`,
                  );
              }
            return transformExportedIdentifiersToNamespaceProperties(
              statement,
              namespaceName,
              exportedIdentifierNames,
            );
          }),
      ],
      true,
    ),
  ];
}

/**
 * Transforms all exported identifiers to namespace properties
 * @example
 * // Before
 * export const foo = 'bar';
 * export function qux() {
 *  return foo;
 * }
 * // After
 * Foo.foo = 'bar';
 * function qux() {
 *  return Foo.foo;
 * }
 */
function transformExportedIdentifiersToNamespaceProperties<T extends ts.Node>(
  node: T,
  namespaceName: Identifier,
  exportedIdentifiers: readonly string[],
): T {
  /**
   * Rebinds identifiers that are shadowed by a variable declaration
   */
  function removeShadowedNames(
    nodes: readonly Pick<ts.VariableDeclaration, 'name'>[],
  ) {
    const reboundNames = nodes
      .map(({ name }) => name)
      .filter(ts.isIdentifier)
      .map(({ text }) => text);
    exportedIdentifiers = exportedIdentifiers.filter(
      (id) => !reboundNames.includes(id),
    );
  }

  if (ts.isFunctionDeclaration(node)) {
    // Remove shadowed parameters
    removeShadowedNames(node.parameters);
  }
  if (
    ts.isForStatement(node) &&
    node.initializer &&
    ts.isVariableDeclarationList(node.initializer)
  ) {
    // Remove shadowed variables in for initializer
    removeShadowedNames(node.initializer.declarations);
  }

  if (ts.isBlock(node)) {
    node.statements
      .filter(ts.isVariableStatement)
      .forEach((variableStatement) =>
        // Remove shadowed variables
        removeShadowedNames(variableStatement.declarationList.declarations),
      );
  }

  if (ts.isParameter(node)) {
    // Skip parameters
    return node;
  }
  if (ts.isVariableDeclaration(node)) {
    // Skip variable name declarations
    return ts.factory.updateVariableDeclaration(
      node,
      node.name,
      node.exclamationToken,
      node.type,
      node.initializer
        ? (transformExportedIdentifiersToNamespaceProperties(
            node.initializer,
            namespaceName,
            exportedIdentifiers,
          ) as ts.Expression)
        : undefined,
    ) as unknown as T;
  }

  if (isTypeReferenceNode(node)) {
    // Skip type references
    return node;
  }
  if (ts.isIdentifier(node) && exportedIdentifiers.includes(node.text)) {
    // Replace identifier with namespace property. I.e. `foo` -> `Foo.foo`
    return ts.factory.createPropertyAccessExpression(
      namespaceName,
      node,
    ) as unknown as T;
  }

  // Recursive, do the same for all children
  return ts.visitEachChild(
    node,
    (child) => {
      return transformExportedIdentifiersToNamespaceProperties(
        child,
        namespaceName,
        exportedIdentifiers,
      );
    },
    undefined,
  );
}

function toSyntheticExportedFunctionDeclaration(
  statement: ts.FunctionDeclaration,
  namespaceName: ts.Identifier,
): ts.Statement[] {
  return [
    ts.factory.updateFunctionDeclaration(
      statement,
      modifiersExceptExport(statement.modifiers),
      statement.asteriskToken,
      statement.name,
      statement.typeParameters,
      statement.parameters,
      statement.type,
      statement.body,
    ),
    ts.factory.createExpressionStatement(
      ts.factory.createBinaryExpression(
        ts.factory.createPropertyAccessExpression(
          namespaceName,
          statement.name!,
        ),
        ts.SyntaxKind.EqualsToken,
        statement.name!,
      ),
    ),
  ];
}

function toSyntheticExportedClassDeclaration(
  statement: ts.ClassDeclaration,
  namespaceName: ts.Identifier,
): ts.Statement[] {
  return [
    ts.factory.createClassDeclaration(
      modifiersExceptExport(statement.modifiers),
      statement.name,
      statement.typeParameters,
      statement.heritageClauses,
      statement.members,
    ),
    addIgnoreComment(
      ts.factory.createExpressionStatement(
        ts.factory.createBinaryExpression(
          ts.factory.createPropertyAccessExpression(
            namespaceName,
            statement.name!,
          ),
          ts.SyntaxKind.EqualsToken,
          statement.name!,
        ),
      ),
    ),
  ];
}

/**
 * Converts `export const foo = 'bar';` to `Namespace.foo = 'bar'`
 */
function toSyntheticExportedVariableStatement(
  variableExport: ts.VariableStatement,
  namespaceName: ts.Identifier,
  exportedIdentifierNames: string[],
) {
  const declarations = variableExport.declarationList.declarations.filter(
    (declaration) => declaration.initializer,
  );
  if (!declarations.length) {
    return ts.factory.createEmptyStatement();
  }

  let expression = exportValueOfVariableDeclaration(
    namespaceName,
    declarations[0]!,
    exportedIdentifierNames,
  );
  let hasClassDeclaration =
    declarations[0]!.initializer?.kind === ts.SyntaxKind.NewExpression;
  for (let i = 1; i < declarations.length; i++) {
    expression = ts.factory.createBinaryExpression(
      expression,
      ts.SyntaxKind.CommaToken,
      exportValueOfVariableDeclaration(
        namespaceName,
        declarations[i]!,
        exportedIdentifierNames,
      ),
    );
    hasClassDeclaration =
      declarations[i]!.initializer?.kind === ts.SyntaxKind.NewExpression;
  }
  const expressionStatement = ts.factory.createExpressionStatement(expression);

  if (
    variableExport.declarationList.flags & ts.NodeFlags.Const ||
    hasClassDeclaration
  ) {
    return addIgnoreComment(expressionStatement);
  }

  return expressionStatement;
}

function exportValueOfVariableDeclaration(
  namespaceName: ts.Identifier,
  declaration: ts.VariableDeclaration,
  exportedIdentifierNames: string[],
): ts.Expression {
  return ts.factory.createBinaryExpression(
    ts.factory.createPropertyAccessExpression(
      namespaceName,
      declaration.name as ts.Identifier,
    ),
    ts.SyntaxKind.EqualsToken,
    transformExportedIdentifiersToNamespaceProperties(
      declaration.initializer!,
      namespaceName,
      exportedIdentifierNames,
    ),
  );
}

function modifiersExceptExport(
  modifiers: ts.NodeArray<ts.ModifierLike> | undefined,
) {
  return modifiers?.filter((mod) => mod.kind !== ts.SyntaxKind.ExportKeyword);
}

function isNotInterfaceOrTypeDeclaration(statement: ts.Statement): boolean {
  return !isInterfaceOrTypeDeclaration(statement);
}

function isNamespaceExportableValue(
  statement: ts.Statement,
): statement is NamespaceExportableValue {
  return (
    ts.isVariableStatement(statement) ||
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement)
  );
}

function isInterfaceOrTypeDeclaration(
  statement: ts.Statement,
): statement is ts.InterfaceDeclaration | ts.TypeAliasDeclaration {
  return (
    ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)
  );
}

function isExported(statement: NamespaceExportableValue): boolean {
  return (
    statement.modifiers?.some(
      (mod) => mod.kind === ts.SyntaxKind.ExportKeyword,
    ) ?? false
  );
}

export type NamespaceExportableValue =
  | ts.VariableStatement
  | ts.FunctionDeclaration
  | ts.ClassDeclaration;

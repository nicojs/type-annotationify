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

  return {
    changed: true,
    node: [
      createNamespaceDeclaration(namespace, namespace.body),
      ...createBlock(namespace, namespace.body),
    ],
  };
}

function createNamespaceDeclaration(
  namespace: ts.ModuleDeclaration,
  body: ts.ModuleBlock,
): ts.Node {
  return ts.factory.createModuleDeclaration(
    createModifiers(
      namespace.modifiers,
      ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword),
    ),
    namespace.name,
    ts.factory.createModuleBlock(
      body.statements
        .filter(isVariableStatementOrInterfaceOrTypeDeclaration)
        .filter(isExported)
        .map((statement) => {
          if (ts.isVariableStatement(statement)) {
            return ts.factory.createVariableStatement(
              modifiersExceptExport(statement.modifiers),
              ts.factory.createVariableDeclarationList(
                statement.declarationList.declarations.map((declaration) =>
                  ts.factory.createVariableDeclaration(
                    declaration.name,
                    undefined,
                    declaration.type,
                    undefined,
                  ),
                ),
                statement.declarationList.flags,
              ),
            );
          }
          return ts.isTypeAliasDeclaration(statement)
            ? ts.factory.updateTypeAliasDeclaration(
                statement,
                modifiersExceptExport(statement.modifiers),
                statement.name,
                statement.typeParameters,
                statement.type,
              )
            : ts.factory.updateInterfaceDeclaration(
                statement,
                modifiersExceptExport(statement.modifiers),
                statement.name,
                statement.typeParameters,
                statement.heritageClauses,
                statement.members,
              );
        }),
    ),

    namespace.flags,
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
    ts.factory.createBlock(
      [
        initialization,
        ...block.statements
          .filter(isNotInterfaceOrTypeDeclaration)
          .flatMap((statement) => {
            if (
              ts.isVariableStatement(statement) &&
              statement.modifiers?.some(
                (mod) => mod.kind === ts.SyntaxKind.ExportKeyword,
              )
            ) {
              const declarations =
                statement.declarationList.declarations.filter(
                  (declaration) => declaration.initializer,
                );
              if (declarations.length === 1) {
                const declaration = declarations[0]!;
                return ts.factory.createExpressionStatement(
                  ts.factory.createBinaryExpression(
                    ts.factory.createPropertyAccessExpression(
                      namespaceName,
                      declaration.name as ts.Identifier,
                    ),
                    ts.SyntaxKind.EqualsToken,
                    declaration.initializer!,
                  ),
                );
              }
              return ts.factory.updateVariableStatement(
                statement,
                modifiersExceptExport(statement.modifiers),
                statement.declarationList,
              );
            }
            return statement;
          }),
      ],
      true,
    ),
  ];
}
function createModifiers(
  modifiers: ts.NodeArray<ts.ModifierLike> | undefined,
  ...additionalModifiers: ts.ModifierLike[]
): ts.ModifierLike[] {
  return [...(modifiers ?? []), ...additionalModifiers];
}
function modifiersExceptExport(
  modifiers: ts.NodeArray<ts.ModifierLike> | undefined,
) {
  return modifiers?.filter((mod) => mod.kind !== ts.SyntaxKind.ExportKeyword);
}

function isNotInterfaceOrTypeDeclaration(statement: ts.Statement): boolean {
  return !isInterfaceOrTypeDeclaration(statement);
}

function isVariableStatementOrInterfaceOrTypeDeclaration(
  statement: ts.Statement,
): statement is
  | ts.VariableStatement
  | ts.InterfaceDeclaration
  | ts.TypeAliasDeclaration {
  return (
    ts.isVariableStatement(statement) || isInterfaceOrTypeDeclaration(statement)
  );
}

function isInterfaceOrTypeDeclaration(
  statement: ts.Statement,
): statement is ts.InterfaceDeclaration | ts.TypeAliasDeclaration {
  return (
    ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)
  );
}

function isExported(
  statement:
    | ts.InterfaceDeclaration
    | ts.TypeAliasDeclaration
    | ts.VariableStatement,
): boolean {
  return (
    statement.modifiers?.some(
      (mod) => mod.kind === ts.SyntaxKind.ExportKeyword,
    ) ?? false
  );
}

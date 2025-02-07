import ts, { type Identifier } from 'typescript';
import { type TransformResult } from '../transform.ts';
const IGNORE_COMMENT = ' @ts-ignore Migrated namespace with type-annotationify';

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

  return ts.addSyntheticLeadingComment(
    declaration,
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
  const initialization = ts.addSyntheticLeadingComment(
    ts.factory.createExpressionStatement(
      ts.factory.createBinaryExpression(
        namespaceName,
        ts.SyntaxKind.QuestionQuestionEqualsToken,
        ts.factory.createObjectLiteralExpression(),
      ),
    ),
    ts.SyntaxKind.SingleLineCommentTrivia,
    IGNORE_COMMENT,
    /* hasTrailingNewLine: */ false,
  );

  return [
    ts.addSyntheticLeadingComment(
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
      ts.SyntaxKind.SingleLineCommentTrivia,
      IGNORE_COMMENT,
      /* hasTrailingNewLine: */ false,
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
                  return toSyntheticExportedVariableStatement(
                    statement,
                    namespaceName,
                  );
                case ts.SyntaxKind.FunctionDeclaration:
                  return toSyntheticExportedFunctionDeclaration(
                    statement,
                    namespaceName,
                  );
                case ts.SyntaxKind.ClassDeclaration:
                  return toSyntheticExportedClassDeclaration(
                    statement,
                    namespaceName,
                  );
                default:
                  throw new Error(
                    `Exported ${ts.SyntaxKind[(statement satisfies never as ts.Statement).kind]} not supported`,
                  );
              }
            return statement;
          }),
      ],
      true,
    ),
  ];
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

/**
 * Converts `export const foo = 'bar';` to `Namespace.foo = 'bar'`
 */
function toSyntheticExportedVariableStatement(
  statement: ts.VariableStatement,
  namespaceName: ts.Identifier,
) {
  const declarations = statement.declarationList.declarations.filter(
    (declaration) => declaration.initializer,
  );
  if (!declarations.length) {
    return ts.factory.createEmptyStatement();
  }

  let expression = exportValueOfVariableDeclaration(
    namespaceName,
    declarations[0]!,
  );
  for (let i = 1; i < declarations.length; i++) {
    expression = ts.factory.createBinaryExpression(
      expression,
      ts.SyntaxKind.CommaToken,
      exportValueOfVariableDeclaration(namespaceName, declarations[i]!),
    );
  }
  return ts.factory.createExpressionStatement(expression);
}

function exportValueOfVariableDeclaration(
  namespaceName: ts.Identifier,
  declaration: ts.VariableDeclaration,
): ts.Expression {
  return ts.factory.createBinaryExpression(
    ts.factory.createPropertyAccessExpression(
      namespaceName,
      declaration.name as ts.Identifier,
    ),
    ts.SyntaxKind.EqualsToken,
    declaration.initializer!,
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

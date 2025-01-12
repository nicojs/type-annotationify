import ts, { type Identifier } from 'typescript';
export function parse(fileName: string, content: string) {
  return ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.ESNext,
    /*setParentNodes */ true,
  );
}
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
export function print(source: ts.SourceFile): string {
  return printer.printFile(source);
}

export interface TransformResult {
  changed: boolean;
  source: ts.SourceFile;
}

export function transform(source: ts.SourceFile): TransformResult {
  let changed = false;
  return {
    source: ts.visitEachChild(source, transformNode, undefined),
    changed,
  };

  function transformNode(node: ts.Node): ts.Node {
    if (ts.isClassDeclaration(node)) {
      const constructor = node.members.find((member) =>
        ts.isConstructorDeclaration(member),
      );
      const constructorParameterProperties: ts.ParameterDeclaration[] = [];
      if (constructor) {
        const constructorParams = constructor.parameters;
        constructorParams.forEach((param) => {
          if (ts.isParameterPropertyDeclaration(param, param.parent)) {
            constructorParameterProperties.push(param);
          }
        });
      }
      if (constructorParameterProperties.length > 0) {
        changed = true;
        return ts.factory.updateClassDeclaration(
          node,
          node.modifiers,
          node.name,
          node.typeParameters,
          node.heritageClauses,
          [
            ...toClassProperties(constructorParameterProperties),
            ...node.members.map((member) => {
              if (!ts.isConstructorDeclaration(member)) {
                return member;
              }

              const statements: readonly ts.Statement[] =
                member.body?.statements || [];

              const indexOfSuperCall = statements.findIndex(
                (statement) =>
                  ts.isExpressionStatement(statement) &&
                  ts.isCallExpression(statement.expression) &&
                  statement.expression.expression.kind ===
                    ts.SyntaxKind.SuperKeyword,
              );

              return ts.factory.updateConstructorDeclaration(
                member,
                member.modifiers,
                removeModifiersFromProperties(member.parameters),
                ts.factory.createBlock([
                  ...statements.slice(0, indexOfSuperCall + 1),
                  ...toPropertyInitializers(constructorParameterProperties),
                  ...statements.slice(indexOfSuperCall + 1),
                ]),
              );
            }),
          ],
        );
      }
    }
    return ts.visitEachChild(node, transformNode, undefined);
  }
}
function toPropertyInitializers(
  constructorParameterProperties: ts.ParameterDeclaration[],
) {
  return constructorParameterProperties.map((param) => {
    return ts.factory.createExpressionStatement(
      ts.factory.createBinaryExpression(
        ts.factory.createPropertyAccessExpression(
          ts.factory.createThis(),
          (param.name as Identifier).text,
        ),
        ts.SyntaxKind.EqualsToken,
        ts.factory.createIdentifier((param.name as Identifier).text),
      ),
    );
  });
}
function toClassProperties(parameterProperties: ts.ParameterDeclaration[]) {
  return parameterProperties.map((param) => {
    return ts.factory.createPropertyDeclaration(
      param.modifiers,
      (param.name as Identifier).text,
      param.questionToken,
      /* type */ undefined,
      param.initializer,
    );
  });
}
function removeModifiersFromProperties(
  params: ts.NodeArray<ts.ParameterDeclaration>,
): readonly ts.ParameterDeclaration[] {
  return params.map((param) => {
    if (ts.isParameterPropertyDeclaration(param, param.parent)) {
      return ts.factory.updateParameterDeclaration(
        param,
        /* modifiers */ undefined,
        param.dotDotDotToken,
        param.name,
        param.questionToken,
        param.type,
        param.initializer,
      );
    }
    return param;
  });
}

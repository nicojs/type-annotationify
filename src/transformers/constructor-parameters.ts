import ts from 'typescript';
import type { TransformerResult } from './transformer-result.ts';

export function transformConstructorParameters(
  clazz: ts.ClassDeclaration,
): TransformerResult<ts.ClassDeclaration> {
  const constructor = clazz.members.find((member) =>
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
  if (constructorParameterProperties.length === 0) {
    return { changed: false, node: clazz };
  }
  return {
    changed: true,
    node: ts.factory.updateClassDeclaration(
      clazz,
      clazz.modifiers,
      clazz.name,
      clazz.typeParameters,
      clazz.heritageClauses,
      [
        ...toClassProperties(constructorParameterProperties),
        ...clazz.members.map((member) => {
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
    ),
  };
}

function toPropertyInitializers(
  constructorParameterProperties: ts.ParameterDeclaration[],
) {
  return constructorParameterProperties.map((param) => {
    return ts.factory.createExpressionStatement(
      ts.factory.createBinaryExpression(
        ts.factory.createPropertyAccessExpression(
          ts.factory.createThis(),
          (param.name as ts.Identifier).text,
        ),
        ts.SyntaxKind.EqualsToken,
        ts.factory.createIdentifier((param.name as ts.Identifier).text),
      ),
    );
  });
}
function toClassProperties(parameterProperties: ts.ParameterDeclaration[]) {
  return parameterProperties.map((param) => {
    return ts.factory.createPropertyDeclaration(
      param.modifiers,
      (param.name as ts.Identifier).text,
      param.questionToken,
      /* type */ undefined,
      /* initializer */ undefined,
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

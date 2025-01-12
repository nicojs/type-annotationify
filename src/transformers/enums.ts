import ts from 'typescript';
import type { TransformResult } from '../transform.ts';

export function transformEnum(
  enumDeclaration: ts.EnumDeclaration,
): TransformResult<ts.Node[]> {
  // TODO: Implement enums with initializers
  if (enumDeclaration.members.some((member) => member.initializer)) {
    return { changed: false, node: [enumDeclaration] as const };
  }

  // TODO: Implement enums with computed property names
  if (
    enumDeclaration.members.some((member) =>
      ts.isComputedPropertyName(member.name),
    )
  ) {
    return { changed: false, node: [enumDeclaration] as const };
  }

  const enumMap = new Map(
    enumDeclaration.members.map((member, index) => [member, index] as const),
  );
  const keysUnion = ts.factory.createUniqueName(
    `${enumDeclaration.name.text}Keys`,
    ts.GeneratedIdentifierFlags.Optimistic
  );
  return {
    changed: true,
    node: [
      ts.factory.createTypeAliasDeclaration(
        enumDeclaration.modifiers,
        enumDeclaration.name,
        undefined,
        ts.factory.createUnionTypeNode(
          enumDeclaration.members.map((member) =>
            ts.factory.createLiteralTypeNode(
              ts.factory.createNumericLiteral(enumMap.get(member)!),
            ),
          ),
        ),
      ),
      ts.factory.createTypeAliasDeclaration(
        undefined,
        keysUnion,
        undefined,
        ts.factory.createUnionTypeNode(
          enumDeclaration.members.map((member) => {
            if (ts.isComputedPropertyName(member.name)) {
              throw new Error('Computed property names are not supported yet');
            }
            return ts.factory.createLiteralTypeNode(
              ts.factory.createStringLiteral(member.name.text),
            );
          }),
        ),
      ),
      ts.factory.createVariableStatement(
        enumDeclaration.modifiers,
        ts.factory.createVariableDeclarationList(
          [
            ts.factory.createVariableDeclaration(
              enumDeclaration.name,
              undefined,
              undefined,
              ts.factory.createSatisfiesExpression(
                ts.factory.createObjectLiteralExpression(
                  [
                    ...enumDeclaration.members.map((member) => {
                      if (ts.isComputedPropertyName(member.name)) {
                        throw new Error(
                          'Computed property names are not supported yet',
                        );
                      }
                      return ts.factory.createPropertyAssignment(
                        ts.factory.createNumericLiteral(enumMap.get(member)!),
                        ts.factory.createStringLiteral(member.name.text),
                      );
                    }),
                    ...enumDeclaration.members.map((member) => {
                      if (ts.isComputedPropertyName(member.name)) {
                        throw new Error(
                          'Computed property names are not supported yet',
                        );
                      }
                      return ts.factory.createPropertyAssignment(
                        ts.factory.createStringLiteral(member.name.text),
                        ts.factory.createNumericLiteral(enumMap.get(member)!),
                      );
                    }),
                  ],
                  true,
                ),
                // satisfies...
                ts.factory.createIntersectionTypeNode([
                  ts.factory.createTypeReferenceNode('Record', [
                    ts.factory.createTypeReferenceNode(enumDeclaration.name),
                    ts.factory.createTypeReferenceNode(keysUnion),
                  ]),

                  ts.factory.createTypeReferenceNode('Record', [
                    ts.factory.createTypeReferenceNode(keysUnion),
                    ts.factory.createTypeReferenceNode(enumDeclaration.name),
                  ]),
                ]),
              ),
            ),
          ],
          ts.NodeFlags.Const,
        ),
      ),
    ],
  };
}

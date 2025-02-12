import ts from 'typescript';
import type { TransformResult } from '../transform.ts';

export function transformEnum(
  enumDeclaration: ts.EnumDeclaration,
): TransformResult<ts.Node[]> {
  let initValue: number | string = 0;
  const enumValueMap = new Map(
    enumDeclaration.members.map((member) => {
      if (member.initializer) {
        if (ts.isNumericLiteral(member.initializer)) {
          initValue = parseInt(member.initializer.text);
        } else if (ts.isStringLiteral(member.initializer)) {
          initValue = member.initializer.text;
        }
      }
      const keyValue = [member, initValue] as const;
      initValue = typeof initValue === 'number' ? initValue + 1 : initValue;
      return keyValue;
    }),
  );
  const enumNameMap = new Map(
    enumDeclaration.members.map(
      (member) =>
        [
          member,
          ts.factory.createStringLiteral(
            ts.isComputedPropertyName(member.name)
              ? (member.name.expression as ts.StringLiteral).text // Computed property names other than string literals are not allowed in enum declarations
              : member.name.text,
          ),
        ] as const,
    ),
  );

  const nodes = [
    // Object literal: const MessageKind = { 0: 'Start', 1: 'Work', 2: 'Stop', Start: 0, Work: 1, Stop: 2 } as const;
    createObjectLiteral(enumDeclaration, enumValueMap, enumNameMap),
    // Type alias for values: type MessageKind = typeof MessageKind[keyof typeof MessageKind & string];
    createTypeAlias(enumDeclaration),
  ];
  // Finish with the namespace declaration: declare namespace MessageKind { type Start = typeof MessageKind.Start; ... }
  const moduleDeclaration = createModuleDeclarationIfNeeded(enumDeclaration);
  if (moduleDeclaration) {
    nodes.push(moduleDeclaration);
  }

  return {
    changed: true,
    node: nodes,
  };
}

function createModuleDeclarationIfNeeded(
  enumDeclaration: ts.EnumDeclaration,
): ts.Node | undefined {
  // Only identifiers need to be types. I.e. computed enum values cannot be used as types
  // ex: `enum Foo { ['😀'] }; type A = Foo['😀']` is invalid
  const enumTypeAliasDeclarations = enumDeclaration.members
    .map(({ name }) => name)
    .filter((name) => ts.isIdentifier(name))
    .map((name) =>
      ts.factory.createTypeAliasDeclaration(
        undefined,
        name,
        undefined,
        ts.factory.createTypeQueryNode(
          ts.factory.createQualifiedName(
            ts.factory.createIdentifier(enumDeclaration.name.text),
            name,
          ),
        ),
      ),
    );

  if (enumTypeAliasDeclarations.length === 0) {
    return;
  }

  return ts.factory.createModuleDeclaration(
    [
      ...(createModifiers(enumDeclaration.modifiers) ?? []),
      ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword),
    ],
    enumDeclaration.name,
    ts.factory.createModuleBlock(enumTypeAliasDeclarations),
    ts.NodeFlags.Namespace,
  );
}

function createObjectLiteral(
  enumDeclaration: ts.EnumDeclaration,
  enumValueMap: Map<ts.EnumMember, number | string>,
  enumNameMap: Map<ts.EnumMember, ts.StringLiteral>,
): ts.Node {
  // An enum may have duplicate values, but an object literal doesn't allow duplicate keys
  // Ex. enum NumbersI18n { Two = 2, Three, Deux = 2, Trois }, should be transformed to: const NumbersI18n = { 2: 'Deux', 3: 'Trois', ... }
  const memberMap = new Map(
    enumDeclaration.members.map((member) => {
      const value = enumValueMap.get(member)!;
      return [value, member] as const;
    }),
  );

  return ts.factory.createVariableStatement(
    createModifiers(enumDeclaration.modifiers),
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          enumDeclaration.name,
          undefined,
          undefined,
          ts.factory.createAsExpression(
            ts.factory.createObjectLiteralExpression(
              [
                ...[...memberMap.entries()]
                  .filter(([key]) => typeof key === 'number')
                  .map(([key, member]) =>
                    ts.factory.createPropertyAssignment(
                      ts.factory.createNumericLiteral(key),
                      enumNameMap.get(member)!,
                    ),
                  ),
                ...enumDeclaration.members.map((member) =>
                  ts.factory.createPropertyAssignment(
                    enumNameMap.get(member)!,
                    createLiteral(enumValueMap.get(member)!),
                  ),
                ),
              ],
              true,
            ),
            ts.factory.createTypeReferenceNode('const'),
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );
}

function createModifiers(enumModifiers?: ts.NodeArray<ts.ModifierLike>) {
  if (!enumModifiers) {
    return;
  }
  return enumModifiers.filter((mod) => mod.kind !== ts.SyntaxKind.ConstKeyword);
}

function createTypeAlias(enumDeclaration: ts.EnumDeclaration): ts.Node {
  const isStringEnum = enumDeclaration.members.every(
    (member) => member.initializer && ts.isStringLiteral(member.initializer),
  );
  const keyOfTypeOperator = ts.factory.createTypeOperatorNode(
    ts.SyntaxKind.KeyOfKeyword,
    ts.factory.createTypeQueryNode(enumDeclaration.name),
  );
  return ts.factory.createTypeAliasDeclaration(
    createModifiers(enumDeclaration.modifiers),
    enumDeclaration.name,
    undefined,
    ts.factory.createIndexedAccessTypeNode(
      ts.factory.createTypeQueryNode(enumDeclaration.name),
      isStringEnum
        ? keyOfTypeOperator
        : ts.factory.createIntersectionTypeNode([
            keyOfTypeOperator,
            ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
          ]),
    ),
  );
}

function createLiteral(value: string | number) {
  return typeof value === 'number'
    ? ts.factory.createNumericLiteral(value)
    : ts.factory.createStringLiteral(value);
}

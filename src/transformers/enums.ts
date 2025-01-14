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
  const keysUnionName = ts.factory.createUniqueName(
    `${enumDeclaration.name.text}Keys`,
    ts.GeneratedIdentifierFlags.Optimistic,
  );

  const nodes = [
    // Type alias for values: type MessageKind = 0 | 1 | 2;
    createTypeAlias(enumDeclaration, enumValueMap),
    // Type alias for keys: type MessageKindKeys = 'Start' | 'Work' | 'Stop';
    createTypeAliasForNames(keysUnionName, enumDeclaration, enumNameMap),
    // Object literal: const MessageKind = { 0: 'Start', 1: 'Work', 2: 'Stop', Start: 0, Work: 1, Stop: 2 };
    createObjectLiteral(
      enumDeclaration,
      enumValueMap,
      enumNameMap,
      keysUnionName,
    ),
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
      ...(enumDeclaration.modifiers ? enumDeclaration.modifiers : []),
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
  keysUnionName: ts.Identifier,
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
            // Tag with satisfies: Record<MessageKind, MessageKindKeys> & Record<MessageKindKeys, MessageKind>;
            createSatisfiesTypeTarget(
              enumDeclaration,
              keysUnionName,
              enumValueMap,
              enumNameMap,
            ),
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );
}

function createSatisfiesTypeTarget(
  enumDeclaration: ts.EnumDeclaration,
  keysUnionName: ts.Identifier,
  enumValueMap: Map<ts.EnumMember, string | number>,
  enumNameMap: Map<ts.EnumMember, ts.StringLiteral>,
): ts.TypeNode {
  // If this is a string enum, we simply don't create a reverse mapping
  if (enumValueMap.values().every((value) => typeof value === 'string')) {
    return createRecord(keysUnionName, enumDeclaration.name);
  }
  // If this is a mixed enum, we exclude the strings from reverse mapping
  const excluded = [...enumValueMap.entries()]
    .filter(([_, value]) => typeof value === 'string')
    .map(([_, value]) =>
      ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(value)),
    );
  return ts.factory.createIntersectionTypeNode([
    excluded.length
      ? ts.factory.createTypeReferenceNode('Record', [
          ts.factory.createTypeReferenceNode('Exclude', [
            ts.factory.createTypeReferenceNode(enumDeclaration.name),
            ts.factory.createUnionTypeNode(excluded),
          ]),
          ts.factory.createTypeReferenceNode(keysUnionName),
        ])
      : createRecord(enumDeclaration.name, keysUnionName),
    createRecord(keysUnionName, enumDeclaration.name),
  ]);
}

function createRecord(from: ts.Identifier, to: ts.Identifier) {
  return ts.factory.createTypeReferenceNode('Record', [
    ts.factory.createTypeReferenceNode(from),
    ts.factory.createTypeReferenceNode(to),
  ]);
}

function createTypeAlias(
  enumDeclaration: ts.EnumDeclaration,
  enumValueMap: Map<ts.EnumMember, number | string>,
): ts.Node {
  const values = [...new Set(enumValueMap.values())];
  return ts.factory.createTypeAliasDeclaration(
    enumDeclaration.modifiers,
    enumDeclaration.name,
    undefined,
    ts.factory.createUnionTypeNode(
      values.map((val) => ts.factory.createLiteralTypeNode(createLiteral(val))),
    ),
  );
}

function createLiteral(value: string | number) {
  return typeof value === 'number'
    ? ts.factory.createNumericLiteral(value)
    : ts.factory.createStringLiteral(value);
}

function createTypeAliasForNames(
  keysUnionName: ts.Identifier,
  enumDeclaration: ts.EnumDeclaration,
  enumNameMap: Map<ts.EnumMember, ts.StringLiteral>,
): ts.Node {
  return ts.factory.createTypeAliasDeclaration(
    undefined,
    keysUnionName,
    undefined,
    ts.factory.createUnionTypeNode(
      enumDeclaration.members.map((member) =>
        ts.factory.createLiteralTypeNode(enumNameMap.get(member)!),
      ),
    ),
  );
}

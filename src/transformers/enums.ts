import ts from 'typescript';
import type { TransformResult } from '../transform.ts';

export function transformEnum(
  enumDeclaration: ts.EnumDeclaration,
): TransformResult<ts.Node[]> {
  // TODO: Implement enums with initializers
  if (enumDeclaration.members.some((member) => member.initializer)) {
    return { changed: false, node: [enumDeclaration] as const };
  }

  const enumValueMap = new Map(
    enumDeclaration.members.map((member, index) => [member, index] as const),
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
  enumValueMap: Map<ts.EnumMember, number>,
  enumNameMap: Map<ts.EnumMember, ts.StringLiteral>,
  keysUnionName: ts.Identifier,
): ts.Node {
  return ts.factory.createVariableStatement(
    enumDeclaration.modifiers,
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          enumDeclaration.name,
          undefined,
          undefined,
          // Tag with satisfies: Record<MessageKind, MessageKindKeys> & Record<MessageKindKeys, MessageKind>;
          ts.factory.createSatisfiesExpression(
            ts.factory.createObjectLiteralExpression(
              [
                ...enumDeclaration.members.map((member) =>
                  ts.factory.createPropertyAssignment(
                    ts.factory.createNumericLiteral(enumValueMap.get(member)!),
                    enumNameMap.get(member)!,
                  ),
                ),
                ...enumDeclaration.members.map((member) =>
                  ts.factory.createPropertyAssignment(
                    enumNameMap.get(member)!,
                    ts.factory.createNumericLiteral(enumValueMap.get(member)!),
                  ),
                ),
              ],
              true,
            ),
            ts.factory.createIntersectionTypeNode([
              createRecord(enumDeclaration.name, keysUnionName),
              createRecord(keysUnionName, enumDeclaration.name),
            ]),
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );
}

function createRecord(from: ts.Identifier, to: ts.Identifier) {
  return ts.factory.createTypeReferenceNode('Record', [
    ts.factory.createTypeReferenceNode(from),
    ts.factory.createTypeReferenceNode(to),
  ]);
}

function createTypeAlias(
  enumDeclaration: ts.EnumDeclaration,
  enumValueMap: Map<ts.EnumMember, number>,
): ts.Node {
  return ts.factory.createTypeAliasDeclaration(
    enumDeclaration.modifiers,
    enumDeclaration.name,
    undefined,
    ts.factory.createUnionTypeNode(
      enumDeclaration.members.map((member) =>
        ts.factory.createLiteralTypeNode(
          ts.factory.createNumericLiteral(enumValueMap.get(member)!),
        ),
      ),
    ),
  );
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

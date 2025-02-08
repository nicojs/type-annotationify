import ts from 'typescript';
import { transformConstructorParameters } from './transformers/constructor-parameters.ts';
import { transformEnum } from './transformers/enums.ts';
import { transformNamespace } from './transformers/namespaces.ts';
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

export interface TransformResult<TNode extends ts.Node | ts.Node[]> {
  changed: boolean;
  node: TNode;
}

export function transform(
  source: ts.SourceFile,
): TransformResult<ts.SourceFile> {
  let changed = false;
  return {
    node: ts.visitEachChild(source, transformNode, undefined),
    changed,
  };

  function transformNode(node: ts.Node): ts.Node | ts.Node[] {
    let resultingNode: ts.Node | ts.Node[] = node;
    if (ts.isClassDeclaration(node)) {
      const result = transformConstructorParameters(node);
      changed ||= result.changed;
      resultingNode = result.node;
    }
    if (ts.isEnumDeclaration(node)) {
      const result = transformEnum(node);
      changed ||= result.changed;
      resultingNode = result.node;
    }
    if (ts.isTypeAssertionExpression(node)) {
      resultingNode = ts.factory.createAsExpression(node.expression, node.type);
      changed = true;
    }
    if (ts.isModuleDeclaration(node)) {
      const result = transformNamespace(node);
      changed ||= result.changed;
      resultingNode = result.node;
    }
    if (Array.isArray(resultingNode)) {
      return resultingNode.map((node) =>
        ts.visitEachChild(node, transformNode, undefined),
      );
    } else {
      return ts.visitEachChild(resultingNode, transformNode, undefined);
    }
  }
}

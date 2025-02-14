import ts from 'typescript';
export interface TransformerResult<TNode extends ts.Node | ts.Node[]> {
  changed: boolean;
  node: TNode;
}

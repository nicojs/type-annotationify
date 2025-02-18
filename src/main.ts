import {
  parse,
  transform,
  print,
  TransformOptions,
  DEFAULT_OPTIONS,
} from "type-annotationify/dist/transform.js";
const input = document.getElementById("input") as HTMLInputElement;
const output = document.getElementById("output") as HTMLTextAreaElement;
const form = document.querySelector("form")!;
const options: TransformOptions = { ...DEFAULT_OPTIONS };
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = input.value;
  const parsed = parse("ts.ts", code);
  const { report, node } = transform(parsed, options);
  if (report.changed) {
    const printed = print(node);
    output.value = printed;
  } else {
    output.value = code;
  }
});

function submitForm() {
  form.dispatchEvent(new SubmitEvent("submit", { cancelable: true }));
}

const generalDemo = `import { log } from './logger.js';

class Point {
    constructor(public x: number, public y: number) {
    }
}
enum Message {
    Start,
    Stop
}

const input = <HTMLInputElement>document.getElementById("input");
`;

const enumDemo = `enum Message {
    Start,
    Stop
}

enum Color {
    Red = '#F00',
    Green = '#0F0',
    Blue = '#00F'
}

enum LogLevel {
    Info = 1,
    Warn,
    Error
}`;

const classDemo = `class Point {
    constructor(public x: number, public y: number) {
    }
}

class Dog extends Animal {
    constructor(readonly name: string, legs: number) {
        super(legs);
    }
}
`;

const typeAssertionsDemo = `const foo = <string>JSON.parse('"foo"');`;
const namespacesDemo = `namespace Geometry {
  export const pi = 3.141527;
  export function areaOfCircle(radius: number): number {
    return pi * radius ** 2;
  }
}`;
const importDemo = `
import './a.js';
import { b } from './b.mjs';
import c from './c.cjs';
import * as d from './d.js';

const e = import('./e.js');
const f = import('./f.mjs');
const g = import('./g.cjs');

// Not touched, since these aren't relative imports
import 'bare/h.js';
import 'bare/i.mjs';
import 'bare/j.cjs';
`;

input.value = generalDemo;
submitForm();

function bindDemo(id: string, demo: string) {
  document.getElementById(id)!.addEventListener("click", () => {
    input.value = demo;
    submitForm();
  });
}
function bindOption(id: string, key: keyof TransformOptions, negate = false) {
  const checkbox = document.getElementById(id) as HTMLInputElement;
  checkbox.addEventListener("change", () => {
    options[key] = checkbox.checked !== negate;
    submitForm();
  });
}
bindDemo("type-assertions-demo", typeAssertionsDemo);
bindDemo("enums-demo", enumDemo);
bindDemo("general-demo", generalDemo);
bindDemo("namespaces-demo", namespacesDemo);
bindDemo("classes-demo", classDemo);
bindDemo("import-demo", importDemo);
bindOption("explicitPropertyTypes", "explicitPropertyTypes", false);
bindOption("noEnumNamespaceDeclaration", "enumNamespaceDeclaration", true);
bindOption("relativeImportExtensions", "relativeImportExtensions", false);

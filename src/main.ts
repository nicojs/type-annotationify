import { parse, transform, print } from "type-annotationify/dist/transform.js";
const input = document.getElementById("input") as HTMLInputElement;
const output = document.getElementById("output") as HTMLTextAreaElement;
const form = document.querySelector("form")!;
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = input.value;
  const parsed = parse("ts.ts", code);
  const { changed, node } = transform(parsed);
  if (changed) {
    const printed = print(node);
    output.value = printed;
  } else {
    output.value = code;
  }
});

function submitForm() {
  form.dispatchEvent(new SubmitEvent("submit", { cancelable: true }));
}

const generalDemo = `class Point {
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

input.value = generalDemo;
submitForm();

function bindDemo(id: string, demo: string) {
  document.getElementById(id)!.addEventListener("click", () => {
    input.value = demo;
    submitForm();
  });
}
bindDemo("type-assertions-demo", typeAssertionsDemo);
bindDemo("enums-demo", enumDemo);
bindDemo("general-demo", generalDemo);
bindDemo("namespaces-demo", namespacesDemo);
bindDemo("classes-demo", classDemo);

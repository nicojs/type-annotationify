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

document.getElementById("enums-demo")!.addEventListener("click", () => {
  input.value = enumDemo;
  submitForm();
});
document.getElementById("classes-demo")!.addEventListener("click", () => {
  input.value = classDemo;
  submitForm();
});
document.getElementById("general-demo")!.addEventListener("click", () => {
  input.value = generalDemo;
  submitForm();
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

input.value = generalDemo;
submitForm();

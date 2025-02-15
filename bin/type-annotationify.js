#!/usr/bin/env node
import { runTypeAnnotationifyCli } from '../dist/cli.js';
await runTypeAnnotationifyCli(process.argv.slice(2));

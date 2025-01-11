#!/usr/bin/env node
import { runTypeAnnotationify } from '../dist/cli.js';
await runTypeAnnotationify(process.argv.slice(2));

#!/usr/bin/env node
/* Runs every *.test.js in this folder and reports pass/fail.
 * Usage: node tests/run.js   (from google-apps-script/)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.js')).sort();
let failed = 0;

files.forEach(f => {
  try {
    execFileSync(process.execPath, [path.join(dir, f)], { stdio: 'pipe' });
    console.log('PASS  ' + f);
  } catch (e) {
    failed++;
    console.log('FAIL  ' + f);
    if (e.stdout) process.stdout.write(e.stdout.toString().split('\n').filter(l => l.indexOf('FAIL') >= 0).join('\n') + '\n');
  }
});

console.log('\n' + (files.length - failed) + '/' + files.length + ' test files passed');
process.exit(failed ? 1 : 0);

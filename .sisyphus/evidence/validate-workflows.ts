import { parse } from 'yaml';
import { readFileSync } from 'fs';

console.log('=== CI Workflow Validation ===\n');
const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf-8'));
console.log('Name:', ci.name);
console.log('Triggers:', Object.keys(ci.on || {}));
console.log('Jobs:', Object.keys(ci.jobs || {}));
console.log('');

console.log('=== Release Workflow Validation ===\n');
const release = parse(readFileSync('.github/workflows/release.yml', 'utf-8'));
console.log('Name:', release.name);
console.log('Triggers:', Object.keys(release.on || {}));
console.log('Jobs:', Object.keys(release.jobs || {}));
console.log('');

// Check job dependencies
console.log('=== CI Job Dependencies ===');
for (const [jobName, job] of Object.entries(ci.jobs || {})) {
  const needs = (job as any).needs;
  if (needs) {
    console.log(`${jobName} needs:`, needs);
  }
}

console.log('');
console.log('=== Release Job Dependencies ===');
for (const [jobName, job] of Object.entries(release.jobs || {})) {
  const needs = (job as any).needs;
  if (needs) {
    console.log(`${jobName} needs:`, needs);
  }
}

console.log('\n=== Validation Complete ===');

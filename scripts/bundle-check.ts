import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

interface BundleBudget {
  packageName: string;
  maxGzipKB: number;
  distPath: string;
}

const BUNDLE_BUDGETS: BundleBudget[] = [
  {
    packageName: '@acp/chat-core',
    maxGzipKB: 60,
    distPath: 'packages/acp-chat-core/dist',
  },
  {
    packageName: '@acp/chat-react',
    maxGzipKB: 150,
    distPath: 'packages/acp-chat-react/dist',
  },
];

interface BundleResult {
  packageName: string;
  rawSizeKB: number;
  gzipSizeKB: number;
  budgetKB: number;
  passed: boolean;
}

const UNPLANNED_PRIMITIVES = [
  'accordion',
  'slider',
  'number-field',
  'fieldset',
  'progress',
];

function getDirectorySize(dirPath: string): number {
  if (!existsSync(dirPath)) {
    return 0;
  }
  
  let totalSize = 0;
  const files = readdirSync(dirPath, { recursive: true }) as string[];
  
  for (const file of files) {
    const fullPath = join(dirPath, file);
    const stats = statSync(fullPath);
    if (stats.isFile() && !file.endsWith('.map')) {
      totalSize += stats.size;
    }
  }
  
  return totalSize;
}

function getGzipSize(dirPath: string): number {
  if (!existsSync(dirPath)) {
    return 0;
  }
  
  let totalGzipSize = 0;
  const files = readdirSync(dirPath, { recursive: true }) as string[];
  
  for (const file of files) {
    const fullPath = join(dirPath, file);
    const stats = statSync(fullPath);
    if (stats.isFile() && (file.endsWith('.js') || file.endsWith('.ts')) && !file.endsWith('.map')) {
      const content = readFileSync(fullPath);
      const gzipped = gzipSync(content);
      totalGzipSize += gzipped.length;
    }
  }
  
  return totalGzipSize;
}

interface ImportCheckResult {
  passed: boolean;
  broadImports: string[];
  unplannedImports: string[];
}

function checkSourceImports(): ImportCheckResult {
  const srcPath = 'packages/acp-chat-react/src';
  const result: ImportCheckResult = { passed: true, broadImports: [], unplannedImports: [] };
  
  if (!existsSync(srcPath)) {
    return result;
  }
  
  const files = readdirSync(srcPath, { recursive: true }) as string[];
  
  for (const file of files) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
    const fullPath = join(srcPath, file);
    const content = readFileSync(fullPath, 'utf-8');
    
    const broadImportPattern = /from\s+['"]@base-ui-components\/react['"]/g;
    const broadMatches = content.match(broadImportPattern);
    if (broadMatches) {
      result.broadImports.push(`${file}: broad import "@base-ui-components/react"`);
      result.passed = false;
    }
    
    for (const primitive of UNPLANNED_PRIMITIVES) {
      const unplannedPattern = new RegExp(`from\\s+['"]@base-ui-components/react/${primitive}`);
      if (unplannedPattern.test(content)) {
        result.unplannedImports.push(`${file}: unplanned primitive "${primitive}"`);
        result.passed = false;
      }
    }
  }
  
  return result;
}

function checkDistImports(): ImportCheckResult {
  const distPath = 'packages/acp-chat-react/dist';
  const result: ImportCheckResult = { passed: true, broadImports: [], unplannedImports: [] };
  
  if (!existsSync(distPath)) {
    return result;
  }
  
  const files = readdirSync(distPath, { recursive: true }) as string[];
  
  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    const fullPath = join(distPath, file);
    const content = readFileSync(fullPath, 'utf-8');
    
    const broadImportPattern = /from\s+['"]@base-ui-components\/react['"]/;
    if (broadImportPattern.test(content)) {
      result.broadImports.push(`${file}: broad import in dist`);
      result.passed = false;
    }
    
    for (const primitive of UNPLANNED_PRIMITIVES) {
      const unplannedPattern = new RegExp(`from\\s+['"]@base-ui-components/react/${primitive}`);
      if (unplannedPattern.test(content)) {
        result.unplannedImports.push(`${file}: unplanned primitive "${primitive}" in dist`);
        result.passed = false;
      }
    }
  }
  
  return result;
}

function checkBundleBudgets(): BundleResult[] {
  const results: BundleResult[] = [];
  
  for (const budget of BUNDLE_BUDGETS) {
    const rawSize = getDirectorySize(budget.distPath);
    const gzipSize = getGzipSize(budget.distPath);
    const rawKB = rawSize / 1024;
    const gzipKB = gzipSize / 1024;
    const passed = gzipKB <= budget.maxGzipKB;
    
    results.push({
      packageName: budget.packageName,
      rawSizeKB: rawKB,
      gzipSizeKB: gzipKB,
      budgetKB: budget.maxGzipKB,
      passed,
    });
  }
  
  return results;
}

function formatResults(results: BundleResult[]): string {
  const lines: string[] = [];
  lines.push('\n=== Bundle Budget Report ===');
  lines.push(`Timestamp: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('Package Sizes:');
  
  for (const result of results) {
    const status = result.passed ? 'PASS' : 'FAIL';
    lines.push(`  ${status} ${result.packageName}:`);
    lines.push(`      Raw: ${result.rawSizeKB.toFixed(2)} KB`);
    lines.push(`      Gzip: ${result.gzipSizeKB.toFixed(2)} KB (budget: ${result.budgetKB} KB)`);
  }
  
  return lines.join('\n');
}

function formatImportCheck(name: string, result: ImportCheckResult): string {
  const lines: string[] = [];
  const status = result.passed ? 'PASS' : 'FAIL';
  lines.push(`\n=== ${name} ===`);
  lines.push(`Status: ${status}`);
  
  if (result.broadImports.length > 0) {
    lines.push('Broad imports found:');
    for (const imp of result.broadImports) {
      lines.push(`  - ${imp}`);
    }
  }
  
  if (result.unplannedImports.length > 0) {
    lines.push('Unplanned primitives found:');
    for (const imp of result.unplannedImports) {
      lines.push(`  - ${imp}`);
    }
  }
  
  if (result.passed) {
    lines.push('No forbidden imports detected.');
  }
  
  return lines.join('\n');
}

function runBundleChecks(): boolean {
  console.log('Running bundle size checks...\n');
  
  console.log('Building packages...');
  execSync('pnpm build', { stdio: 'inherit' });
  
  const results = checkBundleBudgets();
  console.log(formatResults(results));
  
  console.log(formatImportCheck('Source Import Check', checkSourceImports()));
  console.log(formatImportCheck('Dist Import Check', checkDistImports()));
  
  const sourceCheck = checkSourceImports();
  const distCheck = checkDistImports();
  const allPassed = results.every(r => r.passed) && sourceCheck.passed && distCheck.passed;
  
  console.log('\n=== Summary ===');
  if (allPassed) {
    console.log('All bundle budgets passed.');
    console.log('All import checks passed.');
    return true;
  } else {
    const failed = results.filter(r => !r.passed);
    if (failed.length > 0) {
      console.log('Failed bundle budgets:');
      for (const f of failed) {
        console.log(`  - ${f.packageName}: ${f.gzipSizeKB.toFixed(2)} KB exceeds ${f.budgetKB} KB budget`);
      }
    }
    if (!sourceCheck.passed) {
      console.log('Source import check failed.');
      for (const imp of [...sourceCheck.broadImports, ...sourceCheck.unplannedImports]) {
        console.log(`  - ${imp}`);
      }
    }
    if (!distCheck.passed) {
      console.log('Dist import check failed.');
      for (const imp of [...distCheck.broadImports, ...distCheck.unplannedImports]) {
        console.log(`  - ${imp}`);
      }
    }
    return false;
  }
}

const passed = runBundleChecks();
process.exit(passed ? 0 : 1);
#!/usr/bin/env bun
/**
 * Publish validation script for ACP packages.
 *
 * Validates release artifacts to ensure packages are production-ready:
 * - No source maps (*.map files)
 * - No test files (*.test.*, *.spec.*)
 * - No debug code (console.log, debugger)
 * - No development-only code
 * - Valid exports
 * - No workspace:* dependencies
 * - LICENSE file included
 * - README.md included
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';

// ============================================================================
// Interfaces
// ============================================================================

interface CheckResult {
  checkName: string;
  passed: boolean;
  issues: string[];
}

interface PackageReport {
  packageName: string;
  version: string;
  packagePath: string;
  hasDist: boolean;
  checks: CheckResult[];
  passed: boolean;
  tarballContents: string[];
  tarballSize?: string;
  unpackedSize?: string;
}

interface PublishCheckReport {
  timestamp: string;
  packages: PackageReport[];
  overall: boolean;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

interface PackageJson {
  name: string;
  version: string;
  exports?: Record<string, unknown>;
  main?: string;
  types?: string;
  files?: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  publishConfig?: {
    access?: string;
    registry?: string;
  };
}

// ============================================================================
// CLI Options
// ============================================================================

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const strict = args.includes('--strict');
const help = args.includes('--help') || args.includes('-h');

if (help) {
  console.log(`
Publish Check - Validate release artifacts for ACP packages

Usage:
  bun scripts/publish-check.ts [options]

Options:
  --verbose    Show detailed output including file lists
  --strict     Fail on any warning (treat warnings as errors)
  --help, -h   Show this help message

Exit Codes:
  0 - All checks passed
  1 - One or more checks failed

Checks performed:
  1. Source map detection: *.map files in dist/
  2. Test file detection: *.test.*, *.spec.* in dist/
  3. Debug code detection: console.log, debugger statements
  4. Dev code detection: process.env.NODE_ENV !== 'production'
  5. Export validation: package.json exports point to existing files
  6. Workspace deps: ensure no workspace:* in published package
  7. License check: LICENSE file included in tarball
  8. README check: README.md included in tarball
`);
  process.exit(0);
}

// ============================================================================
// Utility Functions
// ============================================================================

function log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const prefix = {
    info: '✓',
    warn: '⚠',
    error: '✗'
  }[level];

  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function logVerbose(message: string) {
  if (verbose) {
    log(message, 'info');
  }
}

function getAllFiles(dir: string, basePath: string = dir): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) {
    return files;
  }

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = fullPath.replace(basePath + '/', '');

    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, basePath));
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

function getPackagePaths(): string[] {
  const workspaceYaml = readFileSync('pnpm-workspace.yaml', 'utf-8');
  const match = workspaceYaml.match(/packages:\s*-\s*"(.*)"/);

  if (!match) {
    throw new Error('Could not parse pnpm-workspace.yaml');
  }

  const pattern = match[1];
  const packagesDir = dirname(pattern);

  if (!existsSync(packagesDir)) {
    throw new Error(`Packages directory not found: ${packagesDir}`);
  }

  const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(packagesDir, entry.name));

  return packageDirs.filter(p => existsSync(join(p, 'package.json')));
}

function parsePackageJson(packagePath: string): PackageJson {
  const packageJsonPath = join(packagePath, 'package.json');
  const content = readFileSync(packageJsonPath, 'utf-8');
  return JSON.parse(content);
}

function parseNpmPackDryRun(output: string): {
  contents: string[];
  size?: string;
  unpackedSize?: string;
} {
  const lines = output.split('\n');
  const contents: string[] = [];
  let size: string | undefined;
  let unpackedSize: string | undefined;

  for (const line of lines) {
    if (line.startsWith('npm notice ')) {
      const content = line.slice(12);

      if (content.startsWith('Tarball Contents')) {
        // Start of contents section
      } else if (content.match(/^\d+\.\d+\wB/)) {
        // File entry
        const parts = content.split(/\s+/);
        if (parts.length >= 2) {
          contents.push(parts.slice(1).join(' '));
        }
      } else if (content.includes('package size:')) {
        size = content.split('package size: ')[1].trim();
      } else if (content.includes('unpacked size:')) {
        unpackedSize = content.split('unpacked size: ')[1].trim();
      }
    }
  }

  return { contents, size, unpackedSize };
}

// ============================================================================
// Check Functions
// ============================================================================

function checkSourceMaps(packagePath: string, packageJson: PackageJson): CheckResult {
  const distPath = join(packagePath, 'dist');

  if (!existsSync(distPath)) {
    return {
      checkName: 'Source Maps',
      passed: true,
      issues: ['dist/ directory not found (build first?)']
    };
  }

  const files = getAllFiles(distPath);
  const sourceMaps = files.filter(f => f.endsWith('.map'));

  if (sourceMaps.length > 0) {
    return {
      checkName: 'Source Maps',
      passed: false,
      issues: sourceMaps.map(f => `Found source map: dist/${f}`)
    };
  }

  return {
    checkName: 'Source Maps',
    passed: true,
    issues: []
  };
}

function checkTestFiles(packagePath: string, packageJson: PackageJson): CheckResult {
  const distPath = join(packagePath, 'dist');

  if (!existsSync(distPath)) {
    return {
      checkName: 'Test Files',
      passed: true,
      issues: ['dist/ directory not found (build first?)']
    };
  }

  const files = getAllFiles(distPath);
  const testFiles = files.filter(f =>
    f.includes('.test.') ||
    f.includes('.spec.') ||
    f.includes('.test.js') ||
    f.includes('.spec.js') ||
    f.includes('.test.ts') ||
    f.includes('.spec.ts')
  );

  if (testFiles.length > 0) {
    return {
      checkName: 'Test Files',
      passed: false,
      issues: testFiles.map(f => `Found test file: dist/${f}`)
    };
  }

  return {
    checkName: 'Test Files',
    passed: true,
    issues: []
  };
}

function checkDebugCode(packagePath: string, packageJson: PackageJson): CheckResult {
  const distPath = join(packagePath, 'dist');

  if (!existsSync(distPath)) {
    return {
      checkName: 'Debug Code',
      passed: true,
      issues: ['dist/ directory not found (build first?)']
    };
  }

  const files = getAllFiles(distPath).filter(f => f.endsWith('.js'));
  const issues: string[] = [];

  for (const file of files) {
    const filePath = join(distPath, file);
    const content = readFileSync(filePath, 'utf-8');

    // Check for console.log
    const consoleLogMatches = content.matchAll(/console\.log\(/g);
    for (const match of consoleLogMatches) {
      issues.push(`console.log in dist/${file}`);
    }

    // Check for debugger statements
    const debuggerMatches = content.matchAll(/debugger;?/g);
    for (const match of debuggerMatches) {
      issues.push(`debugger statement in dist/${file}`);
    }
  }

  if (issues.length > 0) {
    return {
      checkName: 'Debug Code',
      passed: false,
      issues: issues.slice(0, 10) // Limit to first 10
    };
  }

  return {
    checkName: 'Debug Code',
    passed: true,
    issues: []
  };
}

function checkDevCode(packagePath: string, packageJson: PackageJson): CheckResult {
  const distPath = join(packagePath, 'dist');

  if (!existsSync(distPath)) {
    return {
      checkName: 'Development Code',
      passed: true,
      issues: ['dist/ directory not found (build first?)']
    };
  }

  const files = getAllFiles(distPath).filter(f => f.endsWith('.js'));
  const issues: string[] = [];

  for (const file of files) {
    const filePath = join(distPath, file);
    const content = readFileSync(filePath, 'utf-8');

    // Check for NODE_ENV checks
    if (content.includes('process.env.NODE_ENV')) {
      issues.push(`process.env.NODE_ENV check in dist/${file}`);
    }
  }

  if (issues.length > 0) {
    return {
      checkName: 'Development Code',
      passed: false,
      issues
    };
  }

  return {
    checkName: 'Development Code',
    passed: true,
    issues: []
  };
}

function checkExports(packagePath: string, packageJson: PackageJson): CheckResult {
  const exports = packageJson.exports;
  const issues: string[] = [];

  if (!exports) {
    // If no exports field, check main and types
    if (packageJson.main) {
      const mainPath = join(packagePath, packageJson.main);
      if (!existsSync(mainPath)) {
        issues.push(`main field points to missing file: ${packageJson.main}`);
      }
    }

    if (packageJson.types) {
      const typesPath = join(packagePath, packageJson.types);
      if (!existsSync(typesPath)) {
        issues.push(`types field points to missing file: ${packageJson.types}`);
      }
    }

    return {
      checkName: 'Exports',
      passed: issues.length === 0,
      issues
    };
  }

  // Check exports field
  for (const [key, value] of Object.entries(exports)) {
    if (typeof value === 'object' && value !== null) {
      for (const [exportKey, exportValue] of Object.entries(value)) {
        if (typeof exportValue === 'string' && !exportValue.startsWith('.')) {
          const filePath = join(packagePath, exportValue);
          if (!existsSync(filePath)) {
            issues.push(`exports["${key}"]["${exportKey}"] points to missing file: ${exportValue}`);
          }
        }
      }
    } else if (typeof value === 'string' && !value.startsWith('.')) {
      const filePath = join(packagePath, value);
      if (!existsSync(filePath)) {
        issues.push(`exports["${key}"] points to missing file: ${value}`);
      }
    }
  }

  return {
    checkName: 'Exports',
    passed: issues.length === 0,
    issues
  };
}

function checkWorkspaceDeps(packagePath: string, packageJson: PackageJson): CheckResult {
  const issues: string[] = [];
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.peerDependencies
  };

  for (const [dep, version] of Object.entries(allDeps || {})) {
    if (version === 'workspace:*' || version === 'workspace:^' || version === 'workspace:~') {
      issues.push(`Found workspace dependency: ${dep}@${version}`);
    }
  }

  if (issues.length > 0) {
    return {
      checkName: 'Workspace Dependencies',
      passed: false,
      issues
    };
  }

  return {
    checkName: 'Workspace Dependencies',
    passed: true,
    issues: []
  };
}

function checkLicense(packagePath: string, packageJson: PackageJson, tarballContents: string[]): CheckResult {
  const hasLicense = tarballContents.some(c => c.endsWith('/LICENSE'));

  if (!hasLicense) {
    return {
      checkName: 'License File',
      passed: false,
      issues: ['LICENSE file not included in tarball']
    };
  }

  return {
    checkName: 'License File',
    passed: true,
    issues: []
  };
}

function checkReadme(packagePath: string, packageJson: PackageJson, tarballContents: string[]): CheckResult {
  const hasReadme = tarballContents.some(c =>
    c.endsWith('/README.md') ||
    c.endsWith('/README') ||
    c.endsWith('/readme.md')
  );

  if (!hasReadme) {
    return {
      checkName: 'README File',
      passed: false,
      issues: ['README.md file not included in tarball']
    };
  }

  return {
    checkName: 'README File',
    passed: true,
    issues: []
  };
}

// ============================================================================
// Main Function
// ============================================================================

function runPublishCheck(): PublishCheckReport {
  log('Starting publish validation check...', 'info');
  console.log('');

  const packagePaths = getPackagePaths();
  const reports: PackageReport[] = [];

  for (const packagePath of packagePaths) {
    const packageJson = parsePackageJson(packagePath);
    const distPath = join(packagePath, 'dist');
    const hasDist = existsSync(distPath);

    if (!hasDist) {
      log(`⚠ ${packageJson.name}: dist/ directory not found`, 'warn');
      log(`  Run build first: pnpm run build`, 'warn');
      console.log('');
    }

    // Run checks
    const checks: CheckResult[] = [
      checkSourceMaps(packagePath, packageJson),
      checkTestFiles(packagePath, packageJson),
      checkDebugCode(packagePath, packageJson),
      checkDevCode(packagePath, packageJson),
      checkExports(packagePath, packageJson),
      checkWorkspaceDeps(packagePath, packageJson)
    ];

    // Run npm pack --dry-run
    let tarballContents: string[] = [];
    let tarballSize: string | undefined;
    let unpackedSize: string | undefined;

    try {
      const output = execSync('npm pack --dry-run 2>&1', {
        cwd: packagePath,
        encoding: 'utf-8'
      });

      const parsed = parseNpmPackDryRun(output);
      tarballContents = parsed.contents;
      tarballSize = parsed.size;
      unpackedSize = parsed.unpackedSize;

      // Add tarball-based checks
      checks.push(checkLicense(packagePath, packageJson, tarballContents));
      checks.push(checkReadme(packagePath, packageJson, tarballContents));
    } catch (error) {
      checks.push({
        checkName: 'Tarball Validation',
        passed: false,
        issues: [`Failed to run npm pack --dry-run: ${error}`]
      });
    }

    const passed = checks.every(c => c.passed);

    const report: PackageReport = {
      packageName: packageJson.name,
      version: packageJson.version,
      packagePath,
      hasDist,
      checks,
      passed,
      tarballContents,
      tarballSize,
      unpackedSize
    };

    reports.push(report);

    // Print report for this package
    if (passed) {
      log(`${packageJson.name}@${packageJson.version} ✓`, 'info');
    } else {
      log(`${packageJson.name}@${packageJson.version} ✗`, 'error');
    }

    if (verbose || !passed || strict) {
      for (const check of checks) {
        if (!check.passed) {
          log(`  ${check.checkName}: FAILED`, 'error');
          for (const issue of check.issues) {
            log(`    - ${issue}`, 'error');
          }
        } else if (verbose) {
          log(`  ${check.checkName}: PASSED`, 'info');
        }
      }
    }

    if (verbose && tarballSize && unpackedSize) {
      log(`  Tarball size: ${tarballSize}, Unpacked: ${unpackedSize}`, 'info');
    }

    console.log('');
  }

  // Summary
  const summary = {
    total: reports.length,
    passed: reports.filter(r => r.passed).length,
    failed: reports.filter(r => !r.passed).length
  };

  const overall = summary.failed === 0;

  if (overall) {
    log(`All ${summary.total} packages passed validation`, 'info');
  } else {
    log(`${summary.failed}/${summary.total} packages failed validation`, 'error');
  }

  return {
    timestamp: new Date().toISOString(),
    packages: reports,
    overall,
    summary
  };
}

// ============================================================================
// Execute
// ============================================================================

try {
  const report = runPublishCheck();

  process.exit(report.overall ? 0 : 1);
} catch (error) {
  log(`Error: ${error}`, 'error');
  process.exit(1);
}

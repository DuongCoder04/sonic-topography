import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testRoots = ['src/lib', 'server', 'desktop'];

async function collectTests(relativeDir) {
  const absoluteDir = path.join(projectRoot, relativeDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const tests = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      tests.push(...await collectTests(relativePath));
    } else if (!entry.name.includes('.vitest.test.') && /\.test\.(?:ts|mjs)$/.test(entry.name)) {
      tests.push(relativePath);
    }
  }

  return tests;
}

const tests = (await Promise.all(testRoots.map(collectTests))).flat().sort();

for (const testFile of tests) {
  const args = testFile.endsWith('.ts')
    ? ['--import', 'tsx', testFile]
    : [testFile];
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    console.error(`Test failed: ${testFile}`);
    process.exit(result.status ?? 1);
  }
}

console.log(`Executed ${tests.length} Node/TypeScript test files.`);

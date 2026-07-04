import { strict as assert } from 'node:assert';
import {
  SKIPPED_UPDATE_VERSION_KEY,
  readSkippedUpdateVersionStorage,
  shouldShowUpdatePrompt,
  writeSkippedUpdateVersionStorage,
} from './updatePrompt';

const store = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  },
};

assert.equal(readSkippedUpdateVersionStorage(), '');

writeSkippedUpdateVersionStorage(' 1.1.2 ');
assert.equal(store.get(SKIPPED_UPDATE_VERSION_KEY), '1.1.2');
assert.equal(readSkippedUpdateVersionStorage(), '1.1.2');

assert.equal(shouldShowUpdatePrompt('1.1.2', '1.1.1'), true);
assert.equal(shouldShowUpdatePrompt('1.1.2', '1.1.2'), false);
assert.equal(shouldShowUpdatePrompt('', '1.1.2'), false);

writeSkippedUpdateVersionStorage('');
assert.equal(readSkippedUpdateVersionStorage(), '');

console.log('update prompt tests passed');

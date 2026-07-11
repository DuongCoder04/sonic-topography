import assert from 'node:assert/strict';
import { isRepeatOneMode, nextPlayMode } from './playMode';

assert.equal(nextPlayMode('sequence'), 'shuffle');
assert.equal(nextPlayMode('shuffle'), 'repeat-one');
assert.equal(nextPlayMode('repeat-one'), 'sequence');
assert.equal(isRepeatOneMode('repeat-one'), true);
assert.equal(isRepeatOneMode('sequence'), false);
assert.equal(isRepeatOneMode('shuffle'), false);

console.log('playMode tests passed');

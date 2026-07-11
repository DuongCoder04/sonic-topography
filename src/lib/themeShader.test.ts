import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const currentDir = dirname(fileURLToPath(import.meta.url));
const shaderPath = resolve(currentDir, '../components/AudioVisualizer/CustomShaderMaterial.ts');
const shaderSource = readFileSync(shaderPath, 'utf8');
const terrainFragmentEnd = shaderSource.indexOf('export const MapShaderMaterial');
const terrainFragmentSource = shaderSource.slice(0, terrainFragmentEnd);

assert.match(shaderSource, /vec3 brightCool = mix\(coolCore, vec3\(1\.0\), 0\.24\)/);
assert.match(shaderSource, /uniform vec3 uFogColor/);
assert.match(shaderSource, /vec3 backdropColor = uFogColor/);
assert.match(shaderSource, /mix\(finalColor, backdropColor, alphaBlend/);
assert.doesNotMatch(shaderSource, /vec3 atmosphericColor = uFogColor/);
assert.doesNotMatch(shaderSource, /vec3\(0\.4,\s*0\.8,\s*1\.0\)/);
assert.match(terrainFragmentSource, /varying float vInstanceRandom/);
assert.match(terrainFragmentSource, /float rnd = vInstanceRandom/);
assert.doesNotMatch(terrainFragmentSource, /random\(vInstancePos\)/);
assert.match(shaderSource, /float rnd = random\(pos2D\);\s+vInstanceRandom = rnd;/);

console.log('themeShader tests passed');

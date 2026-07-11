import assert from 'node:assert/strict';
import {
  ACTIVE_CUSTOM_THEME_STORAGE_KEY,
  ACTIVE_THEME_STORAGE_KEY,
  BUILT_IN_THEME_IDS,
  CUSTOM_THEME_ID,
  createCustomThemeColors,
  DEFAULT_THEME_ID,
  defaultCustomThemeSettings,
  defaultThemeRotationSettings,
  normalizeCustomThemeSettings,
  readActiveCustomThemeStorage,
  readActiveThemeStorage,
  readCustomThemeStorage,
  readThemeRotationStorage,
  themes,
} from './themes';

const storage = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, String(value)),
    removeItem: (key: string) => storage.delete(key),
  },
};

storage.clear();
assert.equal(DEFAULT_THEME_ID, 'minimal-monochrome');
assert.equal(readActiveThemeStorage(), 'minimal-monochrome');
assert.deepEqual(readCustomThemeStorage(), [defaultCustomThemeSettings]);
assert.equal(defaultCustomThemeSettings.background, '#ffffff');
assert.equal(defaultCustomThemeSettings.cool, '#98d2bf');
assert.equal(defaultCustomThemeSettings.warm, '#ff0000');
assert.equal(defaultCustomThemeSettings.accent, '#95abb1');
assert.equal(readActiveCustomThemeStorage(readCustomThemeStorage()), 'custom-default');
assert.deepEqual(defaultThemeRotationSettings, {
  enabled: false,
  intervalSeconds: 10,
  themeIds: [
    'glacier-day',
    'koi-pond',
    'neon-tokyo',
    'coral-reef',
    'cyber-forest',
    'moss-glass',
    'blue-hour',
    'minimal-monochrome',
    'porcelain-teal',
    'wine-signal',
    'daybreak-lime',
    'custom-default',
    'ink-wash',
    'nocturnal',
  ],
});
assert.deepEqual(
  readThemeRotationStorage([...BUILT_IN_THEME_IDS, 'custom-default']),
  defaultThemeRotationSettings,
);
assert.deepEqual(BUILT_IN_THEME_IDS, [
  'ink-wash',
  'nocturnal',
  'neon-tokyo',
  'cyber-forest',
  'minimal-monochrome',
  'glacier-day',
  'koi-pond',
  'coral-reef',
  'moss-glass',
  'blue-hour',
  'porcelain-teal',
  'wine-signal',
  'daybreak-lime',
]);
assert.equal(themes['glacier-day'].name, 'Glacier Day');
assert.equal(`#${themes['glacier-day'].uBaseColor1.getHexString()}`, '#d8e6ea');
assert.equal(`#${themes['glacier-day'].uFogColor.getHexString()}`, '#e5eef0');
assert.equal(`#${themes['glacier-day'].uCoolCore.getHexString()}`, '#2d8ea3');
assert.equal(`#${themes['glacier-day'].uWarmCore.getHexString()}`, '#d96f4d');
assert.equal(`#${themes['glacier-day'].uRippleColor.getHexString()}`, '#2f5963');
assert.equal(themes['glacier-day'].uGlowIntensity, 0.82);
assert.equal(themes['koi-pond'].name, 'Koi Pond');
assert.equal(`#${themes['koi-pond'].uBaseColor1.getHexString()}`, '#123a36');
assert.equal(`#${themes['koi-pond'].uFogColor.getHexString()}`, '#0f2c2a');
assert.equal(`#${themes['koi-pond'].uCoolCore.getHexString()}`, '#55d6b2');
assert.equal(`#${themes['koi-pond'].uWarmCore.getHexString()}`, '#f2a65a');
assert.equal(`#${themes['koi-pond'].uRippleColor.getHexString()}`, '#c8eee4');
assert.equal(themes['koi-pond'].uGlowIntensity, 1.12);
assert.equal(themes['coral-reef'].name, 'Coral Reef');
assert.equal(`#${themes['coral-reef'].uBaseColor1.getHexString()}`, '#40252a');
assert.equal(`#${themes['coral-reef'].uFogColor.getHexString()}`, '#2f2024');
assert.equal(`#${themes['coral-reef'].uCoolCore.getHexString()}`, '#5fcad0');
assert.equal(`#${themes['coral-reef'].uWarmCore.getHexString()}`, '#e8705f');
assert.equal(`#${themes['coral-reef'].uRippleColor.getHexString()}`, '#f0b7a4');
assert.equal(themes['coral-reef'].uGlowIntensity, 1.08);

storage.set(ACTIVE_THEME_STORAGE_KEY, 'ink-wash');
assert.equal(readActiveThemeStorage(), 'ink-wash');

storage.set(ACTIVE_THEME_STORAGE_KEY, 'missing-theme');
assert.equal(readActiveThemeStorage(), 'minimal-monochrome');

storage.set(ACTIVE_THEME_STORAGE_KEY, CUSTOM_THEME_ID);
storage.set(ACTIVE_CUSTOM_THEME_STORAGE_KEY, 'custom-default');
assert.equal(readActiveThemeStorage(), CUSTOM_THEME_ID);
assert.equal(readActiveCustomThemeStorage(readCustomThemeStorage()), 'custom-default');

const legacyTheme = normalizeCustomThemeSettings({
  id: 'legacy',
  name: 'Legacy',
  background: '#112233',
  cool: '#223344',
  warm: '#334455',
  accent: '#445566',
});

assert.equal(legacyTheme.fog, '#112233');
assert.equal(legacyTheme.fogLinkedToBackground, true);

const lockedTheme = normalizeCustomThemeSettings({
  ...legacyTheme,
  background: '#123456',
  fog: '#abcdef',
  fogLinkedToBackground: true,
});

assert.equal(lockedTheme.fog, '#123456');
assert.equal(lockedTheme.fogLinkedToBackground, true);

const unlockedTheme = normalizeCustomThemeSettings({
  ...legacyTheme,
  background: '#102030',
  fog: '#405060',
  fogLinkedToBackground: false,
});
const colors = createCustomThemeColors(unlockedTheme);

assert.equal(unlockedTheme.fog, '#405060');
assert.equal(unlockedTheme.fogLinkedToBackground, false);
assert.equal(`#${colors.uBaseColor1.getHexString()}`, '#102030');
assert.notEqual(`#${colors.uBaseColor2.getHexString()}`, '#405060');
assert.equal(`#${colors.uFogColor.getHexString()}`, '#405060');

console.log('themes tests passed');

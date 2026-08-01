#!/usr/bin/env node
// Prepares a GitHub release folder for TASK FM:
//   - copies the notarized DMG + updater artifact (.app.tar.gz + .sig)
//   - generates latest.json (consumed by tauri-plugin-updater)
// Usage: node scripts/prepare-release.mjs <version>   e.g. 0.2.0

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'fs';
import { join } from 'path';

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/prepare-release.mjs <version>');
  process.exit(1);
}

const REPO = 'Nedal-Elnono/task-fm-app';
const BUNDLE = 'src-tauri/target/universal-apple-darwin/release/bundle';
const macosDir = join(BUNDLE, 'macos');
const dmgDir = join(BUNDLE, 'dmg');
const out = `release-${version}`;
mkdirSync(out, { recursive: true });

// Locate artifacts (names contain spaces: "TASK FM.app.tar.gz")
const tarball = readdirSync(macosDir).find((f) => f.endsWith('.app.tar.gz'));
const sigFile = readdirSync(macosDir).find((f) => f.endsWith('.app.tar.gz.sig'));
const dmg = readdirSync(dmgDir).find((f) => f.endsWith('.dmg'));
if (!tarball || !sigFile || !dmg) {
  console.error('Missing artifacts. Found:', { tarball, sigFile, dmg });
  process.exit(1);
}

const tarName = `TASK-FM-${version}-universal.app.tar.gz`;
const dmgName = `TASK-FM-mac-${version}.dmg`;
copyFileSync(join(macosDir, tarball), join(out, tarName));
copyFileSync(join(macosDir, sigFile), join(out, `${tarName}.sig`));
copyFileSync(join(dmgDir, dmg), join(out, dmgName));

// Second copy under a version-less name. The landing page links to
// releases/latest/download/TASK-FM-mac.dmg, which GitHub resolves to whichever
// release is newest — so the site serves the current build without being edited.
copyFileSync(join(dmgDir, dmg), join(out, 'TASK-FM-mac.dmg'));

const signature = readFileSync(join(macosDir, sigFile), 'utf8').trim();
const url = `https://github.com/${REPO}/releases/download/v${version}/${tarName}`;
const platform = { signature, url };

const latest = {
  version,
  notes: `TASK FM v${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    'darwin-aarch64': platform,
    'darwin-x86_64': platform,
  },
};
writeFileSync(join(out, 'latest.json'), JSON.stringify(latest, null, 2));

console.log(`✓ Release folder ready: ${out}/`);
console.log(`  - ${dmgName}            (versioned download)`);
console.log(`  - TASK-FM-mac.dmg                      (stable URL the website links to)`);
console.log(`  - ${tarName}      (auto-update payload)`);
console.log(`  - ${tarName}.sig  (update signature)`);
console.log(`  - latest.json                          (update manifest)`);
console.log('');
console.log('Publish with:');
console.log(`  gh release create v${version} ${out}/* --title "TASK FM v${version}" --notes "..."`);

// Sizzle & Serve — the hand-in program for make.fun's "Make the best cooking game"
// bounty (Node 22, standard library only). It copies this repository's game/ and
// screenshots/ into the output directory and writes dossier.json there with the
// vendored make.fun library, so the sealed scorer can check the entry and the
// judge can read its screenshots and source outline.
//
// Run it from the repository root:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output; in the grader
// the variable is unset and the program writes to /output.

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps, as the kit's reference/gate.json states them: only
// text_max_bytes shapes the bytes; the rest refuse an entry the scorer would
// refuse, so a bad hand-in fails here instead of silently passing a broken one.
const DOSSIER_OPTIONS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function fail(message) {
  throw new Error(`sizzle-serve main.ts: ${message}`);
}

function checkGameTree(gameDir) {
  const index = join(gameDir, 'index.html');
  if (!existsSync(index) || !statSync(index).isFile()) {
    fail('game/index.html is missing — the game cannot be played');
  }
  let files = 0;
  let bytes = 0;
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const st = lstatSync(path);
      if (st.isSymbolicLink()) fail(`game/ holds a symlink: ${path}`);
      if (st.isDirectory()) walk(path);
      else if (st.isFile()) {
        files += 1;
        bytes += st.size;
      } else {
        fail(`game/ holds a non-file entry: ${path}`);
      }
    }
  };
  walk(gameDir);
  if (files > DOSSIER_OPTIONS.game_max_files) fail(`game/ holds ${files} files, over the 993 cap`);
  if (bytes > DOSSIER_OPTIONS.game_max_bytes) fail(`game/ is ${bytes} bytes, over the 48 MiB cap`);
}

function checkScreenshots(shotsDir) {
  if (!existsSync(shotsDir)) fail('screenshots/ is missing — the entry needs 3 or 4 screenshots');
  const shots = readdirSync(shotsDir)
    .filter((name) => !name.startsWith('.'))
    .filter((name) => statSync(join(shotsDir, name)).isFile());
  if (shots.length < 3 || shots.length > DOSSIER_OPTIONS.screenshots.max) {
    fail(`screenshots/ holds ${shots.length} images, need 3 or 4`);
  }
  for (const name of shots) {
    const lower = name.toLowerCase();
    if (!lower.endsWith('.png') && !lower.endsWith('.jpg') && !lower.endsWith('.jpeg')) {
      fail(`screenshot ${name} is not a PNG or JPEG file`);
    }
    const size = statSync(join(shotsDir, name)).size;
    if (size > DOSSIER_OPTIONS.screenshots.max_bytes) {
      fail(`screenshot ${name} is ${size} bytes, over the 256 KiB cap`);
    }
  }
  return shots;
}

function handIn() {
  const gameDir = join(repoRoot, 'game');
  const shotsDir = join(repoRoot, 'screenshots');
  checkGameTree(gameDir);
  const shots = checkScreenshots(shotsDir);

  mkdirSync(outDir, { recursive: true });
  cpSync(gameDir, join(outDir, 'game'), { recursive: true });
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  // Copy only the validated images, so a stray file in screenshots/ can never
  // ride along into the hand-in.
  for (const name of shots) {
    cpSync(join(shotsDir, name), join(outDir, 'screenshots', name));
  }

  const dossier = buildDossier(outDir, DOSSIER_OPTIONS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

handIn();

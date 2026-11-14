import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validatePreset } from '../config/validate.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const files = ['app', 'names', 'research'];

export async function readPreset(directory) {
  const [app, names, research] = await Promise.all(files.map(async file =>
    JSON.parse(await readFile(path.join(directory, `${file}.json`), 'utf8'))));
  return validatePreset({ app, names, research });
}

export async function configure(presetName, { check = false, destination = path.join(projectRoot, 'config') } = {}) {
  if (!presetName) throw new Error('Usage: node scripts/configure.mjs <starter|ru-br-en|preset-directory> [--check]');
  const directory = ['starter', 'ru-br-en'].includes(presetName)
    ? path.join(projectRoot, 'examples', presetName)
    : path.resolve(presetName);
  const preset = await readPreset(directory);
  if (!check) {
    await mkdir(destination, { recursive: true });
    const suffix = `.tmp-${process.pid}`;
    // Validate the entire preset before replacing any active file.
    for (const file of files) await writeFile(path.join(destination, `${file}.json${suffix}`), `${JSON.stringify(preset[file], null, 2)}\n`);
    for (const file of files) await rename(path.join(destination, `${file}.json${suffix}`), path.join(destination, `${file}.json`));
  }
  return { title: preset.app.title, names: preset.names.length, researchEnabled: preset.app.researchEnabled };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    const check = args.includes('--check');
    const positional = args.filter(argument => argument !== '--check');
    if (positional.length !== 1) throw new Error('Usage: node scripts/configure.mjs <starter|ru-br-en|preset-directory> [--check]');
    const result = await configure(positional[0], { check });
    console.log(`${check ? 'Validated' : 'Configured'} ${result.title}: ${result.names} names; research ${result.researchEnabled ? 'enabled' : 'disabled'}.`);
    if (!check) console.log('Restart the development server or rebuild to load the selected configuration.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

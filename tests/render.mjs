/* Renders every report sheet outside the browser, so the templates can be checked
   automatically: no DOM, no network. Used by tests/reports.test.js and handy by hand:

     node tests/render.mjs elcPurity          print the sheet HTML for one report
     node tests/render.mjs --list             report ids and names
*/
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const JS = join(here, '..', 'static', 'js');

/* The report modules are written for the browser: give them a window to hang things on. */
export function makeWindow() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.console = console;
  sandbox.document = { createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
  vm.createContext(sandbox);
  const run = f => vm.runInContext(readFileSync(join(JS, f), 'utf8'), sandbox, { filename: f });
  run('calc.js');
  const dir = join(JS, 'reports');
  const files = readdirSync(dir).filter(f => f.endsWith('.js')).sort();
  // registry first, then the particle count report (the app's default), then the rest
  ['registry.js', 'sheet.js', 'form.js'].forEach(f => run(join('reports', f)));
  ['particle.js'].forEach(f => run(join('reports', f)));
  files.filter(f => !['registry.js', 'sheet.js', 'form.js', 'sig.js', 'photo.js', 'index.js', 'particle.js'].includes(f))
    .forEach(f => run(join('reports', f)));
  return sandbox;
}

export function blankOf(win, id) {
  const def = win.PPSReports.get(id);
  if (!def) throw new Error('no report called ' + id);
  return def.blank();
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const win = makeWindow();
  const arg = process.argv[2];
  if (!arg || arg === '--list') {
    win.PPSReports.all().forEach(d => console.log(d.id.padEnd(18), d.form || '     ', d.name));
  } else {
    const def = win.PPSReports.get(arg);
    if (!def) { console.error('unknown report: ' + arg); process.exit(1); }
    console.log(def.render(def.blank()));
  }
}

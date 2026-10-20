// Run before `cap sync android` (via `npm run cap:sync`).
// Builds public/offline.html — the page the app shows when the site cannot be
// reached — with a "Try again" link to YOUR live URL, and refuses to continue
// if the live URL is missing, so an APK can never ship pointing at localhost.
import { readFileSync, writeFileSync } from 'node:fs';

const url = (process.env.CAPACITOR_SERVER_URL ?? '').trim().replace(/\/+$/, '');
if (!url) {
  console.error(
    '\n[prepare-android] CAPACITOR_SERVER_URL is not set.\n' +
      '  PowerShell:  $env:CAPACITOR_SERVER_URL="https://astrosage.onrender.com"\n' +
      '  Mac/Linux:   export CAPACITOR_SERVER_URL=https://astrosage.onrender.com\n',
  );
  process.exit(1);
}
if (!url.startsWith('https://')) {
  console.warn(`[prepare-android] Warning: ${url} is not https — fine for emulator tests, NOT for a release build.`);
}
const html = readFileSync(new URL('./offline.template.html', import.meta.url), 'utf8').replaceAll('__SERVER_URL__', url);
writeFileSync(new URL('../public/offline.html', import.meta.url), html);
console.log(`[prepare-android] offline.html → Try again opens ${url}`);

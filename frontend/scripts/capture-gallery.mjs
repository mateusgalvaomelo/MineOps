/* global URL, process, document, console, localStorage */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Read-only capture: preserves the running demo and existing screenshots.
const output = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await page.addInitScript(() => localStorage.setItem('mineops-basemap', 'satellite'));
const errors = [];
page.on('pageerror', error => errors.push(error.message));
async function capture(path, title, name) {
  await page.goto(`http://localhost:3000${path}`);
  await page.getByRole('heading', { name: title, exact: true, level: 1 }).waitFor();
  await page.waitForFunction(() => !document.querySelector('.loading'));
  await page.waitForTimeout(1800); // Allow chart transitions and map tiles to settle.
  if (await page.locator('.error, .map-error').count()) throw new Error(`Failed view: ${path}`);
  await page.screenshot({ path: `${output}${name}.png`, fullPage: true });
  console.log(`Captured ${name}`);
}
try {
  for (const view of [
    ['/noc', 'NOC Monitoring', 'noc-monitoring'],
    ['/incidents', 'Alarms & Incidents', 'alarms-incidents'],
    ['/sites', 'LTE Sites', 'lte-sites'],
    ['/inventory', 'Network Inventory', 'network-inventory'],
    ['/devices', 'Connected Devices', 'connected-devices'],
    ['/applications', 'Industrial Applications', 'industrial-applications'],
    ['/adoption', 'LTE Adoption', 'adoption-workflow'],
    ['/analytics', 'Analytics', 'analytics'],
    ['/simulation', 'Simulation Center', 'simulation-center'],
    ['/settings', 'Settings', 'settings'],
  ]) await capture(...view);
  await page.goto('http://localhost:3000/map');
  await page.locator('.site-pin').first().waitFor();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Map options', exact: true }).click();
  await page.screenshot({ path: `${output}map-controls.png`, fullPage: true });
  await page.getByRole('button', { name: 'Close map options' }).click();
  await page.getByRole('button', { name: 'Signal probe', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect SITE-LTE-014', exact: true }).click();
  await page.locator('.probe-value').waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${output}signal-probe.png`, fullPage: true });
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser.close();
}

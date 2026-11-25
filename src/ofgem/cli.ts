import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { formatPence, formatPounds } from '../domain/decimal';
import { nowIsoInstant } from '../domain/time';
import { discoverLatestAnnex9Workbook, OFGEM_INDEX_URL } from './discover';
import { parseAnnex9Workbook } from './parseAnnex9';

const USER_AGENT = 'price-cap-ofgem-fetcher/1.0 (+https://github.com/rstreefland/price-cap)';

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }
  return response.text();
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function runOfgemUpdate(outputPath: string): Promise<void> {
  const indexHtml = await fetchText(OFGEM_INDEX_URL);
  const discovered = discoverLatestAnnex9Workbook(indexHtml);
  const workbookBytes = await fetchBytes(discovered.workbookUrl);
  const dataset = parseAnnex9Workbook({
    bytes: workbookBytes,
    indexUrl: OFGEM_INDEX_URL,
    workbookUrl: discovered.workbookUrl,
    workbookFilename: discovered.workbookFilename,
    generatedAt: nowIsoInstant(),
  });

  const resolvedOutput = resolve(outputPath);
  await mkdir(dirname(resolvedOutput), { recursive: true });
  await writeFile(resolvedOutput, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');

  const latest = dataset.periods[dataset.periods.length - 1];
  const latestGb = latest.rates['direct-debit']['gb-average'];
  console.log(`Updated ${resolvedOutput}`);
  console.log(`Workbook: ${discovered.workbookFilename}`);
  console.log(
    `Periods parsed: ${dataset.periods.length} (${dataset.periods[0].id} to ${latest.id})`,
  );
  console.log(
    `Latest GB Direct Debit (${latest.label}): ${formatPounds({ value: latestGb.dualFuelAnnualPounds })}/yr | Elec ${formatPence({ value: latestGb.electricity.unitRatePence })}/kWh, ${formatPence({ value: latestGb.electricity.standingChargePence })}/day | Gas ${formatPence({ value: latestGb.gas.unitRatePence })}/kWh, ${formatPence({ value: latestGb.gas.standingChargePence })}/day`,
  );
}

const targetPath = process.argv[2] ?? 'data/price-cap.json';
await runOfgemUpdate(targetPath);

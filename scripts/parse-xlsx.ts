import { readFileSync, writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { parseWorkbook } from '../src/parse/parseWorkbook';

const src = process.argv[2] ?? 'SP Truck Breakdown SMO Wave Part Pallet.xlsx';
const wb = XLSX.read(readFileSync(src));
const loads = parseWorkbook(wb);
writeFileSync('src/data/loads.json', JSON.stringify(loads, null, 1) + '\n');
for (const l of loads) {
  const cases = l.lines.reduce((s, x) => s + x.cases, 0);
  console.log(`${l.po}  lines=${l.lines.length}  cases=${cases}  plant=${l.plant}`);
}

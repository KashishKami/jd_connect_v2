import fs from 'fs';
import readline from 'readline';

function unescapeCopyValue(val: string): string | null {
  if (val === '\\\\N' || val === '\\N') return null;
  return val
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\v/g, '\v')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\\/g, '\\');
}

export async function parseSqlDump(filePath: string): Promise<Record<string, Array<Record<string, string | null>>>> {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const data: Record<string, Array<Record<string, string | null>>> = {};
  let currentTable: string | null = null;
  let currentColumns: string[] = [];

  for await (const line of rl) {
    if (line.startsWith('COPY ')) {
      const match = line.match(/^COPY public\.(\w+) \((.+)\) FROM stdin;/);
      if (match) {
        currentTable = match[1];
        currentColumns = match[2].split(', ').map((c) => c.trim());
        data[currentTable] = [];
      }
    } else if (line === '\\.') {
      currentTable = null;
    } else if (currentTable !== null) {
      const parts = line.split('\t');
      const row: Record<string, string | null> = {};
      currentColumns.forEach((col, idx) => {
        const val = parts[idx];
        row[col] = val !== undefined ? unescapeCopyValue(val) : null;
      });
      data[currentTable].push(row);
    }
  }

  return data;
}

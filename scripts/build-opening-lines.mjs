import { readFile, writeFile } from 'node:fs/promises';
import { Chess } from 'chess.js';

// Same CC0 source revision as the shipped book; never replace personal game data.
const { commit } = JSON.parse(await readFile('frontend/chess/data/provenance.json', 'utf8'));
const lines = {};
for (const volume of ['a', 'b', 'c', 'd', 'e']) {
  const response = await fetch(
    `https://raw.githubusercontent.com/lichess-org/chess-openings/${commit}/${volume}.tsv`,
  );
  if (!response.ok) throw Error(`Opening source: ${response.status}`);
  for (const row of (await response.text()).trim().split('\n').slice(1)) {
    const [eco, name, pgn] = row.trim().split('\t');
    const chess = new Chess();
    chess.loadPgn(pgn);
    const moves = chess.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
    const family = name.split(':')[0].trim();
    if (!lines[family] || moves.length < lines[family].moves.length)
      lines[family] = { eco, name, moves };
  }
}
await writeFile('frontend/chess/data/openingLines.json', JSON.stringify(lines));
console.log(`${Object.keys(lines).length} reference lines, CC0, ${commit}`);

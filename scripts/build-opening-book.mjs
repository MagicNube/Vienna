import { Chess } from 'chess.js';
import { mkdir, writeFile } from 'node:fs/promises';

const source = 'https://github.com/lichess-org/chess-openings';
async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Vienna-opening-book-builder' } });
  if (!response.ok) throw Error(`${response.status}: ${url}`);
  return response.text();
}
const commit = JSON.parse(await fetchText('https://api.github.com/repos/lichess-org/chess-openings/commits/master')).sha;
const base = `https://raw.githubusercontent.com/lichess-org/chess-openings/${commit}`;
const entries = [];
for (const volume of ['a', 'b', 'c', 'd', 'e']) {
  const tsv = await fetchText(`${base}/${volume}.tsv`);
  for (const row of tsv.trim().split('\n').slice(1)) {
    const [eco, name, pgn] = row.trim().split('\t');
    const chess = new Chess();
    chess.loadPgn(pgn);
    entries.push({ eco, name, history: chess.history({ verbose: true }) });
  }
}
// Prefer the shortest named line for common prefixes such as 1.e4.
entries.sort((a, b) => a.history.length - b.history.length);
const book = {};
for (const entry of entries) {
  for (const move of entry.history.slice(0, 32)) {
    const key = move.before.split(' ').slice(0, 4).join(' ') + '|' + move.from + move.to + (move.promotion ?? '');
    book[key] ??= [entry.eco, entry.name];
  }
}
await mkdir('frontend/chess/data', { recursive: true });
await mkdir('licenses', { recursive: true });
await writeFile('frontend/chess/data/openings.json', JSON.stringify(book));
await writeFile('frontend/chess/data/provenance.json', JSON.stringify({ source, commit, license: 'CC0-1.0', openings: entries.length, edges: Object.keys(book).length, maxPly: 32 }, null, 2));
await writeFile('licenses/chess-openings-CC0.txt', await fetchText(`${base}/COPYING.txt`));
console.log(`${entries.length} openings; ${Object.keys(book).length} known position/move pairs; ${commit}`);

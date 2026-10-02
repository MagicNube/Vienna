import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { addMove, makeTree, pathTo, terminalAnalysis, spanishSan, importPgn, pvSan } from './game';
describe('reglas, PGN y variantes', () => {
  it('importa un PGN y conserva la secuencia legal', () => {
    const tree = makeTree('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *');
    expect(tree.mainIds).toHaveLength(7);
    expect(tree.nodes[6].uci).toBe('a7a6');
    expect(spanishSan(tree.nodes[5].san)).toBe('Ab5');
  });
  it('crea ramas anidadas y conserva la línea principal', () => {
    const original = makeTree('1. e4 e5 2. Nf3 *');
    const first = addMove(original, 'm1', 'c7', 'c5');
    const second = addMove(first.tree, first.node.id, 'g1', 'f3');
    const alternative = addMove(second.tree, first.node.id, 'b1', 'c3');
    expect(pathTo(alternative.tree, alternative.node.id).map((n) => n.uci)).toEqual([
      'e2e4',
      'c7c5',
      'b1c3',
    ]);
    expect(original.nodes).toHaveLength(4);
    expect(second.tree.nodes.find((n) => n.id === 'm3')?.fen).toBe(original.nodes[3].fen);
    expect(addMove(alternative.tree, 'm1', 'c7', 'c5').node.id).toBe(first.node.id);
  });
  it('valida movimientos ilegales', () =>
    expect(() => addMove(makeTree('*'), 'm0', 'e2', 'e5')).toThrow());
  it('conserva FEN personalizado, turno y número de jugada', () => {
    const t = makeTree('[SetUp "1"]\n[FEN "8/P6k/8/8/8/8/7K/8 w - - 0 27"]\n\n27. a8=Q *');
    expect(t.rootFen).toContain('w - - 0 27');
    expect(t.nodes[1].uci).toBe('a7a8q');
    expect(pvSan(t.rootFen, ['a7a8n'])).toEqual(['27.a8=C']);
  });
  it('permite subpromoción', () => {
    const t = makeTree('[SetUp "1"]\n[FEN "8/P6k/8/8/8/8/7K/8 w - - 0 27"]\n\n*');
    expect(new Chess(addMove(t, 'm0', 'a7', 'a8', 'n').node.fen).get('a8')?.type).toBe('n');
  });
  it('detecta mate y repetición con historial real', () => {
    const mate = makeTree('1. f3 e5 2. g4 Qh4# 0-1');
    expect(terminalAnalysis(mate, 'm4')?.wdl).toEqual([0, 0, 1000]);
    const draw = makeTree('1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8 *');
    expect(terminalAnalysis(draw, 'm8')?.wdl).toEqual([0, 1000, 0]);
  });
  it('da el mismo identificador al mismo PGN', async () => {
    const pgn = '[White "Ana"]\n[Black "Luis"]\n\n1. d4 d5 *';
    const a = await importPgn(pgn),
      b = await importPgn(pgn);
    expect(a.id).toBe(b.id);
    expect(a.white).toBe('Ana');
  });
});

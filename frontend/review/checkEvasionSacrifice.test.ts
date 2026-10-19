import { expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { hasSacrifice } from './sacrifice';
import { classify } from './classification';
import { upgradeReview } from './upgradeReview';
import { makeTree } from '../chess/game';
import fixture from './fixtures/check-evasion-sacrifice.json';
import type { EngineLine, PositionNode, Review } from '../types';

const examples = fixture.examples.map((example) => ({
  before: example.before as PositionNode,
  after: example.after as PositionNode,
  lines: example.lines as EngineLine[],
  next: example.next as EngineLine,
  previous: {
    node: example.previous.node as PositionNode,
    lines: example.previous.lines as EngineLine[],
  },
}));

it('keeps the original knight sacrifice Brilliant using the stored engine evidence', () => {
  const { before, after, lines, next, previous } = examples[0];
  expect(hasSacrifice(before.fen, 'w', lines[0].pv, 1)).toBe(true);
  expect(classify(before, after, lines, next, undefined, previous).category).toBe('brilliant');
});

it('does not repeat Brilliant when Ka1 improves recaptures while evading an intermediate check', () => {
  const { before, after, lines, next, previous } = examples[1];
  expect(new Chess(before.fen).isCheck()).toBe(true);
  expect(hasSacrifice(before.fen, 'w', lines[0].pv, 1)).toBe(false);
  const result = classify(before, after, lines, next, undefined, previous);
  expect(result.category).toBe('great');
  expect(result.loss).toBe(0);
});

it('handles the same intermediate check and inherited sacrifice for Black', () => {
  const { before, lines } = examples[1];
  const parts = before.fen.split(' ');
  parts[0] = parts[0]
    .split('/')
    .reverse()
    .map((rank) =>
      [...rank].map((p) => (p === p.toUpperCase() ? p.toLowerCase() : p.toUpperCase())).join(''),
    )
    .join('/');
  parts[1] = 'b';
  parts[2] = parts[2].replace(/./g, (c) =>
    c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase(),
  );
  const pv = lines[0].pv.map((move) => move.replace(/[1-8]/g, (n) => String(9 - Number(n))));
  expect(hasSacrifice(parts.join(' '), 'b', pv, 1)).toBe(false);
});

it('still permits a quiet king move that creates a genuinely new material offer', () => {
  const fen = '3r3k/8/8/8/8/8/8/2KR4 w - - 0 1';
  expect(new Chess(fen).isCheck()).toBe(false);
  expect(hasSacrifice(fen, 'w', ['c1b1', 'd8d1', 'b1c2'], 1)).toBe(true);
});

it('updates a saved Ka1 label without rerunning or losing its engine analysis', () => {
  const { before, lines, next } = examples[1];
  const tree = makeTree(`[SetUp "1"]\n[FEN "${before.fen}"]\n\n15. Ka1 *`);
  const saved: Review = {
    version: 1,
    classificationVersion: 10,
    engineId: 'saved',
    complete: true,
    options: { threads: 8, hash: 512, multiPv: 5, movetime: 5000, depth: null },
    positions: {
      m0: { lines, engineId: 'saved', cached: true },
      m1: { lines: [next], engineId: 'saved', cached: true },
    },
    moves: [
      {
        ply: 1,
        color: 'w',
        category: 'brilliant',
        loss: 0,
        explanation: 'Old label',
        best: 'b1a1',
      },
    ],
  };
  const updated = upgradeReview(tree, saved);
  expect(updated.moves[0].category).toBe('great');
  expect(updated.moves[0].loss).toBe(0);
  expect(updated.positions).toBe(saved.positions);
  expect(updated.options).toBe(saved.options);
  expect(saved.moves[0].category).toBe('brilliant');
});

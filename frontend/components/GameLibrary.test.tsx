import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameLibrary } from './GameLibrary';
import { SeenControl } from './SeenControl';
import type { Game } from '../types';

it('muestra un único estado final y mantiene la acción de estado fuera del botón que cubre la fila', () => {
  const games: Game[] = ['seen-only', 'analysis-only', 'pending', 'valid-seen'].map((id) => ({
    id,
    white: 'Me',
    black: 'Rival',
    whiteElo: '',
    blackElo: '',
    result: '1-0',
    date: 1,
    timeClass: 'blitz',
    timeControl: '180+2',
    source: 'pgn',
    pgn: '*',
  }));
  const html = renderToStaticMarkup(
    <GameLibrary
      games={games}
      now={1000}
      username="Me"
      onSelect={() => {}}
      onImport={() => {}}
      onSync={() => {}}
      syncing={false}
      reviewed={new Set(['analysis-only', 'valid-seen'])}
      loadingReviews={false}
      jobs={{}}
      seen={new Set(['seen-only', 'valid-seen'])}
      loadingSeen={false}
      pendingSeen={new Set()}
      onToggleSeen={() => {}}
    />,
  );
  const rows = html.split('class="game-entry ');
  expect(rows[1]).not.toContain('Revisada');
  expect(rows[1]).toContain('Sin analizar');
  expect(rows[1]).not.toContain('Analizada');
  expect(rows[1]).toContain('aria-pressed="false"');
  expect(rows[1]).toContain('disabled');
  expect(rows[2]).toContain('Analizada');
  expect(rows[2]).toContain('aria-pressed="false"');
  expect(rows[2]).not.toContain('disabled');
  expect(rows[3]).toContain('Sin analizar');
  expect(rows[3]).toContain('disabled');
  expect(rows[3]).toContain('Analiza la partida antes');
  expect(rows[4]).toContain('Revisada');
  expect(rows[4]).toContain('aria-pressed="true"');
  expect(html).toContain('Revisadas (1)');
  expect(html).toContain('Sin analizar (2)');
  expect(html).toContain('Estado de la partida');
  expect(html).toContain('class="game-open-target"');
  expect(html).toContain('</button><div class="game-row">');
  expect(html).not.toMatch(/<button[^>]*>(?:(?!<\/button>).)*<button/s);
});

it('la acción mantiene acceso a desmarcar y se bloquea mientras guarda', () => {
  const html = renderToStaticMarkup(
    <SeenControl seen analysed={false} disabled onToggle={() => {}} />,
  );
  expect(html).toContain('Marcar como sin revisar');
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain('disabled');
});

it('bajo el tablero solo permite marcar un análisis completo y conserva marcas previas', () => {
  const render = (analysed: boolean, seen = false, loadingAnalyses = false) =>
    renderToStaticMarkup(
      <SeenControl
        seen={seen}
        analysed={analysed}
        loadingAnalyses={loadingAnalyses}
        disabled={false}
        onToggle={() => {}}
      />,
    );
  expect(render(false)).toContain('disabled');
  expect(render(true, false, true)).toContain('disabled');
  expect(render(true)).not.toContain('disabled');
  expect(render(false, true)).not.toContain('disabled');
});

import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RecentGame } from './RecentGame';
import type { Game } from '../types';

it('deja vacío el estado sin analizar, incluso con una marca antigua, y conserva nombres y fecha', () => {
  const game = { id: 'g', white: 'Me', black: 'Opponent', result: '0-1', date: 60_000 } as Game;
  for (const seen of [false, true]) {
    const html = renderToStaticMarkup(
      <RecentGame
        game={game}
        selected={false}
        username="Me"
        onSelect={() => {}}
        now={360_000}
        reviewed={false}
        seen={seen}
      />,
    );
    expect(html).toContain('Me');
    expect(html).toContain('Opponent');
    expect(html).toContain('Hace 5m');
    expect(html).not.toContain('Sin analizar');
    expect(html).not.toContain('Revisada');
    expect((html.match(/<button/g) ?? []).length).toBe(1);
  }
});

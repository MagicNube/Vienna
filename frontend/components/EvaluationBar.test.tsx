import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EvaluationBar } from './EvaluationBar';
import type { Color, EngineLine } from '../types';

const line = (cp: number, mate: number | null = null): EngineLine => ({
  cp,
  mate,
  wdl: null,
  pv: [],
  rank: 1,
  depth: 20,
  nodes: 1000,
});
const render = (orientation: Color, evaluation = line(232), ownColor: Color = orientation) =>
  renderToStaticMarkup(
    <EvaluationBar
      evaluation={evaluation}
      orientation={orientation}
      ownColor={ownColor}
      busy={false}
    />,
  );

it('sitúa blancas junto al jugador blanco, abajo con blancas y arriba con negras', () => {
  const white = render('w'),
    black = render('b');
  expect(white).toContain('white-eval white-bottom');
  expect(black).not.toContain('white-bottom');
  expect(white).toContain('Tu color: blancas');
  expect(black).toContain('Tu color: negras');
  expect(white).toContain('+2.32');
  expect(black).toContain('+2.32');
});

it('pone la cifra sobre el color favorecido, también al girar el tablero', () => {
  expect(render('w', line(232))).toContain('class="on-white "');
  expect(render('b', line(232))).toContain('class="on-white on-top"');
  expect(render('w', line(-51))).toContain('class=" on-top"');
  expect(render('b', line(-51))).toContain('class=" "');
  expect(render('w', line(-51))).toContain('−0.51');
  expect(render('b', line(-51))).toContain('−0.51');
});

it('girar no cambia el color de la cuenta ni la proporción o el signo', () => {
  const normal = render('b', line(-51), 'b'),
    flipped = render('w', line(-51), 'b');
  expect(normal).toContain('Tu color: negras');
  expect(flipped).toContain('Tu color: negras');
  expect(normal.match(/height:([^";]+)/)?.[1]).toBe(flipped.match(/height:([^";]+)/)?.[1]);
  expect(flipped).toContain('−0.51');
});

it('mantiene el lado ganador en mates y una barra equilibrada mientras falta evaluación', () => {
  expect(render('w', line(0, -3))).toContain('class=" on-top"');
  expect(render('b', line(0, -3))).toContain('−M3');
  const empty = renderToStaticMarkup(
    <EvaluationBar evaluation={undefined} orientation="b" busy={true} />,
  );
  expect(empty).toContain('height:50%');
  expect(empty).toContain('Sin evaluar');
  expect(empty).not.toContain('Tu color');
});

const whiteHeight = (evaluation: EngineLine) =>
  Number(render('w', evaluation).match(/height:([^";]+)%/)?.[1]);

it('muestra una ventaja moderada con ±1 y crece progresivamente sin saturarse con +2', () => {
  expect(whiteHeight(line(0))).toBe(50);
  expect(whiteHeight(line(100))).toBeCloseTo(59.87, 2);
  expect(whiteHeight(line(-100))).toBeCloseTo(40.13, 2);
  expect(whiteHeight(line(200))).toBeCloseTo(69.00, 2);
  expect(whiteHeight(line(300))).toBeCloseTo(76.85, 2);
  expect(whiteHeight(line(500))).toBeCloseTo(88.08, 2);
  for (const cp of [1, 25, 100, 300, 800, 10000]) {
    expect(whiteHeight(line(cp)) + whiteHeight(line(-cp))).toBeCloseTo(100);
  }
});

it('mantiene la misma altura para la misma cifra aunque cambie WDL o no esté disponible', () => {
  const withDraws = { ...line(100), wdl: [500, 500, 0] as [number, number, number] };
  const withLosses = { ...line(100), wdl: [550, 400, 50] as [number, number, number] };
  expect(whiteHeight(withDraws)).toBe(whiteHeight(line(100)));
  expect(whiteHeight(withLosses)).toBe(whiteHeight(line(100)));
});

it('reserva los extremos para ventajas grandes y mates, incluido el mate terminado', () => {
  expect(whiteHeight(line(10000))).toBe(97);
  expect(whiteHeight(line(-10000))).toBe(3);
  expect(whiteHeight(line(0, 4))).toBe(97);
  expect(whiteHeight(line(0, -4))).toBe(3);
  expect(whiteHeight({ ...line(0, 0), wdl: [0, 0, 1000] })).toBe(3);
  expect(whiteHeight({ ...line(0, 0), wdl: [1000, 0, 0] })).toBe(97);
  expect(whiteHeight(line(0, 0))).toBe(50);
});

it('no inventa una ventaja cuando falta una puntuación numérica válida', () => {
  expect(whiteHeight({ ...line(0), cp: null, wdl: [1000, 0, 0] })).toBe(50);
  expect(whiteHeight(line(NaN))).toBe(50);
});

import { describe, it, expect } from 'vitest';
import { backdropGesture } from './modalInteraction';
const bounds = { left: 100, right: 500, top: 100, bottom: 500 };
describe('cierre del diálogo al pulsar fuera', () => {
  it('permite seleccionar texto arrastrando desde dentro hasta fuera', () => {
    expect(backdropGesture({ x: 200, y: 200 }, { x: 550, y: 200 }, bounds)).toBe(false);
  });
  it('mantiene abierto al pulsar el espacio interior o sus bordes', () => {
    expect(backdropGesture({ x: 105, y: 105 }, { x: 105, y: 105 }, bounds)).toBe(false);
    expect(backdropGesture({ x: 100, y: 100 }, { x: 100, y: 100 }, bounds)).toBe(false);
  });
  it('cierra cuando tanto el inicio como el final están fuera', () => {
    expect(backdropGesture({ x: 50, y: 150 }, { x: 50, y: 150 }, bounds)).toBe(true);
    expect(backdropGesture({ x: 200, y: 50 }, { x: 200, y: 50 }, bounds)).toBe(true);
  });
  it('no cierra al terminar dentro o con clic de teclado sin gesto previo', () => {
    expect(backdropGesture({ x: 50, y: 200 }, { x: 150, y: 200 }, bounds)).toBe(false);
    expect(backdropGesture(null, { x: 50, y: 200 }, bounds)).toBe(false);
  });
});

export interface Point {
  x: number;
  y: number;
}
export function outsideDialog(
  point: Point,
  rect: { left: number; right: number; top: number; bottom: number },
) {
  return point.x < rect.left || point.x > rect.right || point.y < rect.top || point.y > rect.bottom;
}
export function backdropGesture(
  start: Point | null,
  end: Point,
  rect: { left: number; right: number; top: number; bottom: number },
) {
  return start !== null && outsideDialog(start, rect) && outsideDialog(end, rect);
}

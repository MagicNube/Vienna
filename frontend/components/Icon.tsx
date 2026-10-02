const paths: Record<string, string> = {
  user: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M4 21v-2a8 8 0 0 1 16 0v2',
  alert: 'M12 3 2 21h20L12 3z M12 9v5 M12 18h.01',
  'played-move': 'M5 5v9a4 4 0 0 0 4 4h11 M15 13l5 5-5 5',
  crown: 'm3 6 4 4 5-7 5 7 4-4-2 12H5L3 6z M5 21h14',
  equal: 'M5 9h14 M5 15h14',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  board: 'M4 3h16v18H4z M4 9h16 M4 15h16 M10 3v18 M15 3v18',
  chart: 'M4 4v16h17 M7 15l4-5 4 3 6-8',
  settings:
    'M11.02 2.05 L12.98 2.05 L14.32 4.34 L15.77 4.94 L18.34 4.27 L19.73 5.66 L19.06 8.23 L19.66 9.68 L21.95 11.02 L21.95 12.98 L19.66 14.32 L19.06 15.77 L19.73 18.34 L18.34 19.73 L15.77 19.06 L14.32 19.66 L12.98 21.95 L11.02 21.95 L9.68 19.66 L8.23 19.06 L5.66 19.73 L4.27 18.34 L4.94 15.77 L4.34 14.32 L2.05 12.98 L2.05 11.02 L4.34 9.68 L4.94 8.23 L4.27 5.66 L5.66 4.27 L8.23 4.94 L9.68 4.34z M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7',
  import: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
  refresh: 'M20 10a8 8 0 0 0-14-5L3 8 M3 3v5h5 M4 14a8 8 0 0 0 14 5l3-3 M21 21v-5h-5',
  undo: 'M9 4 4 9l5 5 M4 9h10a6 6 0 0 1 0 12h-3',
  left: 'm14 6-6 6 6 6',
  right: 'm10 6 6 6-6 6',
  first: 'M5 5v14 m13-13-7 6 7 6',
  last: 'M19 5v14 M6 6l7 6-7 6',
  flip: 'M6 3v16l-3-3 M18 21V5l3 3 M6 19l3-3 M18 5l-3 3',
  arrow: 'M5 19 19 5 M8 5h11v11',
  close: 'm6 6 12 12 M6 18 18 6',
  play: 'm8 5 11 7-11 7z',
  stop: 'M6 6h12v12H6z',
  branch: 'M6 3v18 M6 8c9 0 12-2 12-5 M6 13c9 0 12 4 12 8',
  search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',
  check: 'm5 12 4 4L20 5',
  bolt: 'm13 2-9 12h7l-1 8 10-13h-7z',
  book: 'M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1z M12 5v16',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10 M12 11v2',
  folder: 'M3 6h7l2 3h9v11H3z M3 6V4h7l2 2h9v3',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v6l4 2',
};
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.board} />
    </svg>
  );
}

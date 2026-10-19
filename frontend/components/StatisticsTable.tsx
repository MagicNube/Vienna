import { useState, type ReactNode } from 'react';
import { sortStatisticsRows, type StatisticsSort } from '../review/statisticsInsights';

export type StatisticsRow = {
  name: string;
  color?: 'w' | 'b';
  games: number;
  wins: number;
  draws: number;
  losses: number;
  winrate: number | null;
  scoreRate: number | null;
  accuracy: number | null;
  analyzed: number;
  brilliant?: number;
};
const percent = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)}%`);

export function StatisticsTable({
  rows,
  nameLabel,
  openingAction,
  showBrilliant = false,
}: {
  rows: StatisticsRow[];
  nameLabel: string;
  openingAction?: (row: StatisticsRow) => ReactNode;
  showBrilliant?: boolean;
}) {
  const [sort, setSort] = useState<{ key: StatisticsSort; descending: boolean }>({
    key: 'games',
    descending: true,
  });
  const [minimum, setMinimum] = useState(1);
  const [all, setAll] = useState(false);
  const selected = sortStatisticsRows(
    rows.filter((row) => row.games >= minimum),
    sort.key,
    sort.descending,
  );
  const columns: [StatisticsSort, string][] = [
    ['games', 'Partidas'],
    ['winrate', 'Victorias %'],
    ['scoreRate', 'Puntuación %'],
    ['accuracy', 'Precisión'],
    ['analyzed', 'Analizadas'],
  ];
  if (showBrilliant) columns.push(['brilliant', 'Brillantes']);
  function heading(key: StatisticsSort, label: string) {
    const active = sort.key === key;
    return (
      <th key={key} aria-sort={active ? (sort.descending ? 'descending' : 'ascending') : undefined}>
        <button
          className="statistics-sort"
          onClick={() => setSort({ key, descending: active ? !sort.descending : key !== 'name' })}
        >
          {label}
          <span aria-hidden="true">{active ? (sort.descending ? '↓' : '↑') : '↕'}</span>
        </button>
      </th>
    );
  }
  return (
    <>
      <div className="statistics-table-tools">
        <label>
          Mínimo de partidas
          <select
            aria-label={`Mínimo de partidas en ${nameLabel}`}
            value={minimum}
            onChange={(e) => setMinimum(Number(e.target.value))}
          >
            {[1, 3, 5, 10, 20].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <span>
          {selected.length} {nameLabel.toLowerCase()}
        </span>
      </div>
      <div className="statistics-table-wrap">
        <table className="statistics-table">
          <thead>
            <tr>
              {heading('name', nameLabel)}
              {rows.some((r) => r.color) && <th>Tu color</th>}
              {heading('games', 'Partidas')}
              <th title="Victorias / Tablas / Derrotas">V / T / D</th>
              {columns.slice(1).map(([key, label]) => heading(key, label))}
            </tr>
          </thead>
          <tbody>
            {(all ? selected : selected.slice(0, 10)).map((row) => (
              <tr key={`${row.color ?? ''}:${row.name}`}>
                <th scope="row">
                  <span className="statistics-opening-name">
                    {row.name}
                    {openingAction?.(row)}
                  </span>
                </th>
                {rows.some((r) => r.color) && (
                  <td>
                    <span className={`statistics-side ${row.color}`}>
                      <i className={`move-color ${row.color}`} />
                      {row.color === 'w' ? 'Blancas' : 'Negras'}
                    </span>
                  </td>
                )}
                <td>{row.games}</td>
                <td
                  aria-label={`${row.wins} victorias, ${row.draws} tablas, ${row.losses} derrotas`}
                >
                  {row.wins} / {row.draws} / {row.losses}
                </td>
                <td>{percent(row.winrate)}</td>
                <td>{percent(row.scoreRate)}</td>
                <td>{percent(row.accuracy)}</td>
                <td>{row.analyzed}</td>
                {showBrilliant && <td>{row.brilliant}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!selected.length && (
        <p className="statistics-note">No hay datos con este mínimo de partidas.</p>
      )}
      {selected.length > 10 && (
        <button className="secondary statistics-more" onClick={() => setAll(!all)}>
          {all ? 'Ver menos' : `Ver todo (${selected.length})`}
        </button>
      )}
    </>
  );
}

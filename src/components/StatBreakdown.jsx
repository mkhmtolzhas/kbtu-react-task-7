import { Link } from 'react-router-dom';

/**
 * One breakdown of the fleet: a labelled bar per group, sized against the largest
 * group so the shape of the fleet is readable at a glance.
 *
 * Every row links to the list filtered the same way, so a number on the dashboard
 * is one click away from the cars behind it.
 */
export default function StatBreakdown({ title, rows, total }) {
  const largest = rows.reduce((max, row) => Math.max(max, row.count), 0);

  return (
    <section className="breakdown" aria-labelledby={`breakdown-${title.replaceAll(' ', '-').toLowerCase()}`}>
      <h3 className="breakdown__title" id={`breakdown-${title.replaceAll(' ', '-').toLowerCase()}`}>
        {title}
      </h3>

      {rows.length === 0 || total === 0 ? (
        <p className="breakdown__empty">No vehicles in this selection.</p>
      ) : (
        <ul className="breakdown__list">
          {rows.map((row) => (
            <li key={row.key} className="breakdown__row">
              <Link className="breakdown__link" to={row.to}>
                <span className="breakdown__label">{row.label}</span>
                <span className="breakdown__value">
                  {row.count}
                  <span className="breakdown__share">
                    {total === 0 ? '' : ` · ${Math.round((row.count / total) * 100)} %`}
                  </span>
                </span>
              </Link>
              <span
                className={`breakdown__bar breakdown__bar--${row.tone ?? 'accent'}`}
                style={{ '--bar-width': `${largest === 0 ? 0 : (row.count / largest) * 100}%` }}
                aria-hidden="true"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

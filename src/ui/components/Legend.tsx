import { LEGEND_ITEMS } from '../labels';

export function Legend() {
  return (
    <section className="legend" aria-label="Board legend" data-testid="legend">
      <ul className="legend-list">
        {LEGEND_ITEMS.map(({ key, className, label }) => (
          <li key={key} className="legend-item">
            <span className={`legend-swatch ${className}`} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}

import type { Ship } from '../../engine/types';

/** Cell side in SVG user units; the viewBox is sized in whole cells. */
const CELL = 10;

export interface ShipSvgProps {
  readonly ship: Ship;
  readonly sunk: boolean;
}

/**
 * Hull drawn along the x axis (bow to the right) in a `size * CELL` by `CELL`
 * box; a vertical ship is the same path rotated a quarter turn.
 */
function hullPath(length: number): string {
  const bow = length - CELL * 0.45;
  return [
    `M ${CELL * 0.22} ${CELL * 0.5}`,
    `L ${CELL * 0.6} ${CELL * 0.16}`,
    `L ${bow} ${CELL * 0.16}`,
    `Q ${length - CELL * 0.08} ${CELL * 0.5} ${bow} ${CELL * 0.84}`,
    `L ${CELL * 0.6} ${CELL * 0.84}`,
    'Z',
  ].join(' ');
}

export function ShipSvg({ ship, sunk }: ShipSvgProps) {
  const length = ship.size * CELL;
  const horizontal = ship.orientation === 'H';
  const [width, height] = horizontal ? [length, CELL] : [CELL, length];
  // rotate(90) maps (x, y) to (-y, x); the translate brings it back on screen.
  const transform = horizontal ? undefined : `translate(${CELL} 0) rotate(90)`;
  const decks = Array.from({ length: ship.size - 1 }, (_, i) => (i + 1) * CELL);

  return (
    <svg
      className={`ship-svg${sunk ? ' ship-svg--sunk' : ''}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      focusable="false"
      aria-hidden="true"
    >
      <g transform={transform}>
        <path className="ship-hull" d={hullPath(length)} />
        {decks.map((x) => (
          <line
            key={x}
            className="ship-deck"
            x1={x}
            y1={CELL * 0.22}
            x2={x}
            y2={CELL * 0.78}
          />
        ))}
        <circle
          className="ship-tower"
          cx={length * 0.5}
          cy={CELL * 0.5}
          r={CELL * 0.16}
        />
      </g>
    </svg>
  );
}

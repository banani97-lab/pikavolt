/**
 * Stylized Central Ohio coverage map — decorative SVG, no map dependency.
 * City positions are rough geography (Columbus anchored lower-right, Union /
 * Delaware counties to the northwest / north). Marked aria-hidden; pages that
 * use it must list the areas in text as well.
 */

interface City {
  name: string;
  x: number;
  y: number;
  anchor?: 'start' | 'end' | 'middle';
}

const CITIES: City[] = [
  { name: 'Columbus', x: 480, y: 470 },
  { name: 'Dublin', x: 396, y: 400 },
  { name: 'Hilliard', x: 372, y: 446, anchor: 'end' },
  { name: 'Powell', x: 446, y: 360 },
  { name: 'Delaware', x: 458, y: 286 },
  { name: 'Plain City', x: 310, y: 402, anchor: 'end' },
  { name: 'Marysville', x: 278, y: 336, anchor: 'end' },
  { name: 'Richwood', x: 314, y: 226, anchor: 'end' },
];

export function OhioMap({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 640"
      className={className}
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="pv-coverage" cx="0.6" cy="0.72" r="0.75">
          <stop offset="0%" stopColor="var(--color-teal)" stopOpacity="0.55" />
          <stop offset="55%" stopColor="var(--color-teal-deep)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-storm)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* coverage glow */}
      <rect width="800" height="640" fill="url(#pv-coverage)" rx="24" />

      {/* radiating service rings from Columbus */}
      {[70, 140, 215, 295].map((r) => (
        <circle
          key={r}
          cx="480"
          cy="470"
          r={r}
          stroke="var(--color-arc)"
          strokeOpacity={0.18}
          strokeDasharray="3 7"
        />
      ))}

      {/* stylized county lines */}
      <path
        d="M180 160 L420 150 L430 320 L200 340 Z"
        stroke="var(--color-muted)"
        strokeOpacity="0.25"
        strokeDasharray="6 6"
      />
      <text
        x="238"
        y="192"
        fill="var(--color-muted)"
        fillOpacity="0.7"
        fontSize="13"
        letterSpacing="3"
        style={{ textTransform: 'uppercase' }}
      >
        Union County
      </text>
      <path
        d="M430 200 L660 190 L668 350 L436 366 Z"
        stroke="var(--color-muted)"
        strokeOpacity="0.25"
        strokeDasharray="6 6"
      />
      <text
        x="486"
        y="232"
        fill="var(--color-muted)"
        fillOpacity="0.7"
        fontSize="13"
        letterSpacing="3"
        style={{ textTransform: 'uppercase' }}
      >
        Delaware County
      </text>

      {/* stylized highways */}
      <path
        d="M480 640 L480 470 L456 286 L448 120"
        stroke="var(--color-snow)"
        strokeOpacity="0.1"
        strokeWidth="3"
      />
      <path
        d="M760 520 L480 470 L278 336 L60 220"
        stroke="var(--color-snow)"
        strokeOpacity="0.1"
        strokeWidth="3"
      />

      {/* home-base bolt on Columbus */}
      <g transform="translate(462 440) scale(0.62)">
        <path
          d="M36 4 L14 36 H28 L24 60 L50 24 H34 L40 4 Z"
          fill="var(--color-volt)"
          stroke="var(--color-volt)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>

      {/* cities */}
      {CITIES.map((city) => (
        <g key={city.name}>
          <circle cx={city.x} cy={city.y} r="14" fill="var(--color-volt)" fillOpacity="0.12" />
          <circle
            cx={city.x}
            cy={city.y}
            r="5"
            fill="var(--color-volt)"
            stroke="var(--color-storm)"
            strokeWidth="2"
          />
          <text
            x={city.anchor === 'end' ? city.x - 14 : city.x + 14}
            y={city.y + 4}
            textAnchor={city.anchor ?? 'start'}
            fill="var(--color-snow)"
            fontSize="15"
            fontWeight="600"
          >
            {city.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

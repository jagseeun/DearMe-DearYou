import { useMemo } from 'react';

const HEART_COLORS = [
  { fill: 'rgba(126, 110, 210, 0.72)', glow: 'rgba(151, 132, 255, 0.44)' },
  { fill: 'rgba(38, 59, 116, 0.78)', glow: 'rgba(73, 101, 171, 0.42)' },
  { fill: 'rgba(178, 152, 224, 0.58)', glow: 'rgba(190, 162, 245, 0.34)' },
];

export default function Stars() {
  const hearts = useMemo(() =>
    Array.from({ length: 98 }, (_, i) => {
      const color = HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)];
      const opacity = Math.random() * 0.34 + 0.3;
      return {
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * 8 + 4,
        opacity,
        dimOpacity: opacity * 0.46,
        dur: Math.random() * 4 + 3.2,
        delay: Math.random() * 4,
        fill: color.fill,
        glow: color.glow,
      };
    }),
  []);

  return (
    <div className="heart-field heart-field-dark">
      {hearts.map(s => (
        <div
          key={s.id}
          className="heart-particle"
          style={{
            left: s.left + '%',
            top: s.top + '%',
            '--heart-size': s.size + 'px',
            '--heart-opacity': `${s.opacity}`,
            '--heart-dim-opacity': `${s.dimOpacity}`,
            '--heart-fill': s.fill,
            '--heart-glow': s.glow,
            '--dur': s.dur + 's',
            '--delay': s.delay + 's',
          }}
        />
      ))}
    </div>
  );
}

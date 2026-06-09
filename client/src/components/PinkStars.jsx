import { useMemo } from 'react';

const HEART_COLORS = [
  { fill: 'rgba(122, 76, 157, 0.74)', glow: 'rgba(179, 117, 214, 0.44)' },
  { fill: 'rgba(31, 50, 103, 0.72)', glow: 'rgba(70, 92, 164, 0.4)' },
  { fill: 'rgba(166, 91, 158, 0.6)', glow: 'rgba(221, 147, 206, 0.36)' },
];

export default function PinkStars() {
  const hearts = useMemo(() =>
    Array.from({ length: 116 }, (_, i) => {
      const color = HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)];
      const opacity = Math.random() * 0.34 + 0.34;
      return {
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * 7 + 4,
        opacity,
        dimOpacity: opacity * 0.46,
        dur: Math.random() * 4.2 + 3.2,
        delay: Math.random() * 4.8,
        fill: color.fill,
        glow: color.glow,
      };
    }),
  []);

  return (
    <div className="heart-field heart-field-pink">
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

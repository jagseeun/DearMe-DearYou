import { useMemo } from 'react';

export default function Stars() {
  const stars = useMemo(() =>
    Array.from({ length: 180 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      dur: Math.random() * 3 + 2,
      delay: Math.random() * 3,
    })),
  []);

  return (
    <div className="stars">
      {stars.map(s => (
        <div
          key={s.id}
          className="star"
          style={{
            left: s.left + '%',
            top: s.top + '%',
            width: s.size + 'px',
            height: s.size + 'px',
            '--dur': s.dur + 's',
            '--delay': s.delay + 's',
          }}
        />
      ))}
    </div>
  );
}

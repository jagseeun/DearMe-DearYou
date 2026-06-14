import { useRef, useEffect } from 'react';

export default function PinkStars() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < 96; i++) {
      const s = document.createElement('div');
      const large = Math.random() < 0.3;
      const hue = Math.random() < 0.55 ? '255,226,235' : '255,197,212';
      s.style.cssText = `position:absolute;border-radius:50%;background:rgba(${hue},0.92);
        width:${large ? 2.8 : 1.35}px;height:${large ? 2.8 : 1.35}px;
        top:${Math.random() * 100}%;left:${Math.random() * 100}%;
        opacity:${0.34 + Math.random() * 0.52};
        box-shadow:0 0 ${large ? 18 : 11}px rgba(255,202,220,0.76);
        animation:twinkle ${3.4 + Math.random() * 3.8}s ease-in-out infinite;
        animation-delay:${Math.random() * 4.5}s;`;
      el.appendChild(s);
    }
  }, []);
  return <div ref={ref} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen' }} />;
}

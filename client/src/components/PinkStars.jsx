import { useRef, useEffect } from 'react';

export default function PinkStars() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < 220; i++) {
      const s = document.createElement('div');
      const large = Math.random() < 0.24;
      const hue = Math.random() < 0.55 ? '255,226,235' : '255,197,212';
      s.style.cssText = `position:absolute;border-radius:50%;background:rgba(${hue},0.92);
        width:${large ? 2.4 : 1.2}px;height:${large ? 2.4 : 1.2}px;
        top:${Math.random() * 100}%;left:${Math.random() * 100}%;
        opacity:${0.2 + Math.random() * 0.48};
        box-shadow:0 0 ${large ? 14 : 9}px rgba(255,202,220,0.62);
        animation:twinkle ${3.4 + Math.random() * 3.8}s ease-in-out infinite;
        animation-delay:${Math.random() * 4.5}s;`;
      el.appendChild(s);
    }
  }, []);
  return <div ref={ref} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen' }} />;
}

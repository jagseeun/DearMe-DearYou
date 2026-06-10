import { useEffect, useRef, useState } from 'react';

const PALETTE = [
  '#000000', '#2a1a0a', '#5a3a1a', '#8b5e3c',
  '#cd9a63', '#e8c99a', '#fffcdf', '#ffffff',
  '#c0392b', '#e74c3c', '#e67e22', '#f39c12',
  '#f1c40f', '#27ae60', '#2ecc71', '#16a085',
  '#2980b9', '#3498db', '#1a1a2e', '#34495e',
  '#8e44ad', '#9b59b6', '#d87093', '#ff9fb2',
];

const BRUSH_SIZES = [
  { value: 2, dot: 5, label: '얇은 선' },
  { value: 5, dot: 9, label: '보통 선' },
  { value: 12, dot: 15, label: '굵은 선' },
];

const CANVAS_BG = '#fdf6e8';
const MAX_HISTORY = 50;
const DRAW_WIDTH = 1440;
const DRAW_HEIGHT = 1080;

export default function DrawCanvas({ initialImageUrl = '', onHasDrawn, onCanvasReady }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);
  const historyRef = useRef([]);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#2a1a0a');
  const [size, setSize] = useState(4);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    function storeHistory() {
      try {
        historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
      } catch {
        historyRef.current = [];
      }
      onCanvasReady?.(canvas);
    }

    if (initialImageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        storeHistory();
        setDrawn(true);
      };
      img.onerror = storeHistory;
      img.src = initialImageUrl;
      return;
    }

    storeHistory();
    setDrawn(false);
  }, [initialImageUrl, onCanvasReady]);

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function setDrawn(next) {
    setHasDrawn(next);
    onHasDrawn?.(next);
  }

  function saveHistory() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
  }

  function undo() {
    const canvas = canvasRef.current;
    if (!canvas || historyRef.current.length <= 1) return;

    historyRef.current.pop();
    const prev = historyRef.current[historyRef.current.length - 1];
    canvas.getContext('2d').putImageData(prev, 0, 0);
    if (historyRef.current.length === 1) setDrawn(false);
  }

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * (canvas.width / rect.width),
      y: (src.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function onDown(e) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    drawing.current = true;
    const pos = getPos(e, canvas);
    lastPos.current = pos;

    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, (tool === 'eraser' ? size * 4 : size) / 2, 0, Math.PI * 2);
    ctx.fillStyle = tool === 'eraser' ? CANVAS_BG : color;
    ctx.fill();
    if (!hasDrawn && tool === 'pen') setDrawn(true);
  }

  function onMove(e) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!drawing.current || !canvas || !lastPos.current) return;

    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === 'eraser' ? CANVAS_BG : color;
    ctx.lineWidth = tool === 'eraser' ? size * 4 : size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
    if (!hasDrawn) setDrawn(true);
  }

  function onUp(e) {
    e?.preventDefault();
    if (!drawing.current) return;
    drawing.current = false;
    lastPos.current = null;
    saveHistory();
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
    setDrawn(false);
  }

  return (
    <div className="draw-editor draw-editor-clean">
      <div className="draw-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={DRAW_WIDTH}
          height={DRAW_HEIGHT}
          className="draw-canvas"
          style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          onTouchStart={onDown}
          onTouchMove={onMove}
          onTouchEnd={onUp}
        />
      </div>

      <div className="draw-toolbar">
        <div className="draw-palette" aria-label="색상 선택">
          {PALETTE.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => { setColor(c); setTool('pen'); }}
              className={`draw-swatch ${color === c && tool === 'pen' ? 'is-active' : ''}`}
              style={{ background: c }}
              aria-label={`색상 ${c}`}
            />
          ))}
        </div>

        <div className="draw-divider" />

        <div className="draw-size-group" aria-label="선 굵기">
          {BRUSH_SIZES.map(({ value, dot, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => { setSize(value); setTool('pen'); }}
              className={`draw-size ${size === value && tool === 'pen' ? 'is-active' : ''}`}
              aria-label={label}
              title={label}
            >
              <span style={{ width: dot, height: dot }} />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setTool('eraser')}
          className={`draw-tool-button ${tool === 'eraser' ? 'is-active' : ''}`}
        >
          지우개
        </button>

        <button type="button" onClick={undo} className="draw-tool-button">
          되돌리기
        </button>

        <button type="button" onClick={clear} className="draw-tool-button danger">
          전체 지우기
        </button>
      </div>
    </div>
  );
}

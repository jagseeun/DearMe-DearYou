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

const CANVAS_BG = '#fffafd';
const MAX_HISTORY = 50;
const DRAW_WIDTH = 1440;
const DRAW_HEIGHT = 1080;

function getDrawContext(canvas) {
  return canvas.getContext('2d', { willReadFrequently: true });
}

function drawImageContained(ctx, img, width, height) {
  const sourceWidth = img.naturalWidth || img.width;
  const sourceHeight = img.naturalHeight || img.height;
  if (!sourceWidth || !sourceHeight) return;

  ctx.fillStyle = CANVAS_BG;
  ctx.fillRect(0, 0, width, height);

  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(img, x, y, drawWidth, drawHeight);
}

function DrawToolIcon({ name }) {
  const paths = {
    eraser: (
      <>
        <path d="m4 15.5 7.8-7.8a2.4 2.4 0 0 1 3.4 0l1.1 1.1a2.4 2.4 0 0 1 0 3.4l-5.3 5.3" />
        <path d="m8.4 11.1 4.5 4.5" />
        <path d="M4 15.5 7.5 19H19" />
      </>
    ),
    undo: (
      <>
        <path d="M9 7 5 11l4 4" />
        <path d="M5 11h8a5 5 0 1 1 0 10h-2" />
      </>
    ),
    clear: (
      <>
        <path d="M5 7h14" />
        <path d="M9 7V5h6v2" />
        <path d="M8 10v9h8v-9" />
        <path d="M10.5 12.5v4" />
        <path d="M13.5 12.5v4" />
      </>
    ),
  };

  return (
    <svg className="draw-tool-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

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

    const ctx = getDrawContext(canvas);
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
        drawImageContained(ctx, img, canvas.width, canvas.height);
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

    const ctx = getDrawContext(canvas);
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
  }

  function undo() {
    const canvas = canvasRef.current;
    if (!canvas || historyRef.current.length <= 1) return;

    historyRef.current.pop();
    const prev = historyRef.current[historyRef.current.length - 1];
    getDrawContext(canvas).putImageData(prev, 0, 0);
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
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    const pos = getPos(e, canvas);
    lastPos.current = pos;

    const ctx = getDrawContext(canvas);
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

    const ctx = getDrawContext(canvas);
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
    if (e?.pointerId !== undefined && e.currentTarget?.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    lastPos.current = null;
    saveHistory();
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = getDrawContext(canvas);
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
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          onPointerCancel={onUp}
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
          <DrawToolIcon name="eraser" />
          <span>지우개</span>
        </button>

        <button type="button" onClick={undo} className="draw-tool-button">
          <DrawToolIcon name="undo" />
          <span>되돌리기</span>
        </button>

        <button type="button" onClick={clear} className="draw-tool-button danger">
          <DrawToolIcon name="clear" />
          <span>전체 지우기</span>
        </button>
      </div>
    </div>
  );
}

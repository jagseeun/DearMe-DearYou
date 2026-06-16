import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { fetchJson } from '../utils/api.js';
import { listItemMotion, modalBackdropMotion, modalPanelMotion, motionEase, pageMotion } from '../utils/motion.js';

const ease = motionEase;
const CONTENT_MAX_LENGTH = 100;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const OPEN_DRAW_WIDTH = 960;
const OPEN_DRAW_HEIGHT = 720;
const modes = [
  { key: 'text', label: '텍스트' },
  { key: 'draw', label: '그림' },
  { key: 'photo', label: '사진' },
];

function formatDate(value) {
  return new Date(value).toLocaleDateString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
  });
}

function wasEdited(letter) {
  if (!letter?.createdAt || !letter?.updatedAt) return false;
  return new Date(letter.updatedAt).getTime() - new Date(letter.createdAt).getTime() > 5000;
}

function OpenMailboxLogo() {
  return (
    <div className="top-title open-mailbox-logo" aria-label="Dear Me; Dear You">
      <span className="to">Dear Me</span>
      <span className="semicolon">;</span>
      <span className="from">Dear You</span>
    </div>
  );
}

function OpenDrawCanvas({ canvasRef, onDrawn, initialImageUrl = '' }) {
  const drawingRef = useRef(false);
  const movedRef = useRef(false);
  const historyRef = useRef([]);

  function saveSnapshot() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      historyRef.current = [...historyRef.current.slice(-24), canvas.toDataURL('image/png')];
    } catch {
      historyRef.current = [];
    }
  }

  function paintBackground(ctx) {
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(0, 0, OPEN_DRAW_WIDTH, OPEN_DRAW_HEIGHT);
  }

  function restoreSnapshot(dataUrl) {
    const canvas = canvasRef.current;
    if (!canvas || !dataUrl) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      paintBackground(ctx);
      ctx.drawImage(img, 0, 0, OPEN_DRAW_WIDTH, OPEN_DRAW_HEIGHT);
      onDrawn(historyRef.current.length > 1 || Boolean(initialImageUrl));
    };
    img.src = dataUrl;
  }

  function undo() {
    if (historyRef.current.length <= 1) return;
    historyRef.current.pop();
    restoreSnapshot(historyRef.current[historyRef.current.length - 1]);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(OPEN_DRAW_WIDTH * dpr);
    canvas.height = Math.floor(OPEN_DRAW_HEIGHT * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#4e3d31';
    paintBackground(ctx);

    if (initialImageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        paintBackground(ctx);
        ctx.drawImage(img, 0, 0, OPEN_DRAW_WIDTH, OPEN_DRAW_HEIGHT);
        historyRef.current = [];
        saveSnapshot();
        onDrawn(true);
      };
      img.onerror = () => {
        historyRef.current = [];
        saveSnapshot();
        onDrawn(false);
      };
      img.src = initialImageUrl;
      return;
    }

    historyRef.current = [];
    saveSnapshot();
    onDrawn(false);
  }, [canvasRef, initialImageUrl, onDrawn]);

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function point(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const styles = window.getComputedStyle(canvas);
    const borderLeft = parseFloat(styles.borderLeftWidth) || 0;
    const borderTop = parseFloat(styles.borderTopWidth) || 0;
    const borderRight = parseFloat(styles.borderRightWidth) || 0;
    const borderBottom = parseFloat(styles.borderBottomWidth) || 0;
    const contentWidth = Math.max(1, rect.width - borderLeft - borderRight);
    const contentHeight = Math.max(1, rect.height - borderTop - borderBottom);
    const x = ((event.clientX - rect.left - borderLeft) / contentWidth) * OPEN_DRAW_WIDTH;
    const y = ((event.clientY - rect.top - borderTop) / contentHeight) * OPEN_DRAW_HEIGHT;
    return {
      x: Math.min(Math.max(x, 0), OPEN_DRAW_WIDTH),
      y: Math.min(Math.max(y, 0), OPEN_DRAW_HEIGHT),
    };
  }

  function start(event) {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture?.(event.pointerId);
    drawingRef.current = true;
    movedRef.current = false;
    const ctx = canvas.getContext('2d');
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(event) {
    if (!drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    movedRef.current = true;
    onDrawn(true);
  }

  function end(event) {
    if (event?.pointerId !== undefined && event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drawingRef.current && movedRef.current) saveSnapshot();
    drawingRef.current = false;
    movedRef.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    paintBackground(ctx);
    historyRef.current = [];
    saveSnapshot();
    onDrawn(false);
  }

  return (
    <div className="open-draw-wrap">
      <canvas
        ref={canvasRef}
        className="open-draw-canvas"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
      />
      <button type="button" className="open-tool-mini-button" onClick={clear}>지우기</button>
    </div>
  );
}

export default function OpenMailboxPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [letters, setLetters] = useState([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(8);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showComposer, setShowComposer] = useState(false);
  const [mode, setMode] = useState('text');
  const [nickname, setNickname] = useState('');
  const [content, setContent] = useState('');
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingSelected, setEditingSelected] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editDrawn, setEditDrawn] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const canvasRef = useRef(null);
  const editCanvasRef = useRef(null);
  const photoVideoRef = useRef(null);
  const photoStreamRef = useRef(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const emptySlots = Math.max(0, pageSize - letters.length);

  async function loadLetters(nextPage = page) {
    setLoading(true);
    try {
      const data = await fetchJson(`/public-letters?page=${nextPage}`);
      setLetters(data.letters || []);
      setTotal(data.total || 0);
      setPage(data.page || 0);
      setPageSize(data.pageSize || 8);
    } catch (err) {
      setMessage(err.message || '열린 편지함을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLetters(0);
  }, []);

  useEffect(() => {
    return () => {
      photoStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  useEffect(() => {
    setEditingSelected(false);
    setEditNickname(selected?.nickname || '');
    setEditContent(selected?.content || '');
    setEditDrawn(Boolean(selected?.type === 'draw' && selected?.imageUrl));
    setEditPin('');
    setConfirmingDelete(false);
  }, [selected]);

  async function uploadImageBlob(blob, ext, contentType) {
    if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error('이미지가 너무 큽니다. 조금 더 가볍게 올려 주세요.');
    const data = await fetchJson('/public-image-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ext }),
    });
    const put = await fetch(data.uploadUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': contentType },
    });
    if (!put.ok) throw new Error('이미지를 올리지 못했습니다. 잠시 후 다시 시도해 주세요.');
    return data.publicUrl;
  }

  async function openPhotoCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      photoStreamRef.current = stream;
      setShowCamera(true);
      requestAnimationFrame(() => {
        if (photoVideoRef.current && photoStreamRef.current === stream) {
          photoVideoRef.current.srcObject = stream;
          photoVideoRef.current.play?.().catch(() => {});
        }
      });
    } catch {
      setMessage('카메라 권한을 허용해 주시면 사진을 남길 수 있습니다.');
    }
  }

  function closePhotoCamera() {
    if (photoVideoRef.current) photoVideoRef.current.srcObject = null;
    photoStreamRef.current?.getTracks().forEach(track => track.stop());
    photoStreamRef.current = null;
    setShowCamera(false);
  }

  async function capturePhoto() {
    const video = photoVideoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 960;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    closePhotoCamera();
    setPhotoUploading(true);
    setMessage('');
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
      const publicUrl = await uploadImageBlob(blob, 'jpg', 'image/jpeg');
      setPhotoUrl(publicUrl);
    } catch (err) {
      setMessage(err.message || '사진을 올리지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setPhotoUploading(false);
    }
  }

  async function uploadDrawing(targetCanvasRef = canvasRef, hasDrawing = drawn) {
    const canvas = targetCanvasRef.current;
    if (!canvas || !hasDrawing) throw new Error('그림 편지에 남길 그림을 그려 주세요.');
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    return uploadImageBlob(blob, 'png', 'image/png');
  }

  function resetForm() {
    setMode('text');
    setNickname('');
    setContent('');
    setPin('');
    setPhotoUrl('');
    setDrawn(false);
  }

  function closeComposer() {
    closePhotoCamera();
    setShowComposer(false);
    setMessage('');
  }

  function openComposer() {
    closePhotoCamera();
    setSelected(null);
    setEditingSelected(false);
    setConfirmingDelete(false);
    setMessage('');
    setShowComposer(true);
  }

  function openLetter(letter) {
    closePhotoCamera();
    setShowComposer(false);
    setMessage('');
    setSelected(letter);
  }

  function closeSelectedLetter() {
    setMessage('');
    setEditingSelected(false);
    setConfirmingDelete(false);
    setSelected(null);
  }

  async function submitLetter(event) {
    event.preventDefault();
    const cleanNickname = nickname.trim();
    const cleanContent = content.trim();

    if (!cleanNickname) return setMessage('편지에 표시할 닉네임을 입력해 주세요을 입력해 주세요.');
    if (!/^\d{4}$/.test(pin)) return setMessage('나중에 수정하거나 삭제할 때 사용할 4자리 PIN을 입력해 주세요.');
    if (cleanContent.length > CONTENT_MAX_LENGTH) return setMessage(`내용을 입력해 주세요은 ${CONTENT_MAX_LENGTH}자를 넘을 수 없습니다.`);
    if (mode === 'text' && !cleanContent) return setMessage('모두에게 남길 마음을 입력해 주세요.');
    if (mode === 'photo' && !photoUrl) return setMessage('먼저 사진을 촬영해 주세요.');
    if (mode === 'draw' && !drawn) return setMessage('그림 편지에 남길 그림을 그려 주세요.');

    setSaving(true);
    setMessage('');
    try {
      const imageUrl = mode === 'draw' ? await uploadDrawing() : mode === 'photo' ? photoUrl : undefined;
      await fetchJson('/public-letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: cleanNickname,
          type: mode,
          content: mode === 'text' ? cleanContent : '',
          imageUrl,
          pin,
        }),
      });
      resetForm();
      setShowComposer(false);
      setMessage('');
      await loadLetters(0);
    } catch (err) {
      setMessage(err.message || '열린 편지를 남기지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  function changePage(nextPage) {
    if (nextPage < 0 || nextPage >= totalPages || loading) return;
    loadLetters(nextPage);
  }

  function chooseMode(nextMode) {
    setMode(nextMode);
    setMessage('');
    if (nextMode !== 'photo') setPhotoUrl('');
    if (nextMode !== 'draw') setDrawn(false);
    if (nextMode !== 'text') setContent('');
  }

  function changeContent(value) {
    setContent(value.slice(0, CONTENT_MAX_LENGTH));
  }

  function goBack() {
    if (location.key === 'default') {
      navigate('/');
      return;
    }
    navigate(-1);
  }

  async function updateSelectedLetter(event) {
    event.preventDefault();
    if (!selected) return;
    const cleanNickname = editNickname.trim();
    const cleanContent = editContent.trim();
    if (!cleanNickname) return setMessage('편지에 표시할 닉네임을 입력해 주세요을 입력해 주세요.');
    if (!/^\d{4}$/.test(editPin)) return setMessage('4자리 PIN을 입력해 주세요.');
    if (selected.type === 'text') {
      if (cleanContent.length > CONTENT_MAX_LENGTH) return setMessage(`내용을 입력해 주세요은 ${CONTENT_MAX_LENGTH}자를 넘을 수 없습니다.`);
      if (!cleanContent) return setMessage('모두에게 남길 마음을 입력해 주세요.');
    }
    if (selected.type === 'draw' && !editDrawn) return setMessage('수정할 그림을 다시 확인해 주세요.');

    setEditSaving(true);
    setMessage('');
    try {
      const body = {
        nickname: cleanNickname,
        pin: editPin,
      };
      if (selected.type === 'text') {
        body.content = cleanContent;
      }
      if (selected.type === 'draw') {
        body.imageUrl = await uploadDrawing(editCanvasRef, editDrawn);
      }
      const updated = await fetchJson(`/public-letters/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setLetters(prev => prev.map(letter => letter.id === updated.id ? updated : letter));
      setSelected(updated);
      setEditingSelected(false);
      setEditPin('');
      setMessage('수정했습니다.');
    } catch (err) {
      setMessage(err.message || '열린 편지를 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setEditSaving(false);
    }
  }

  function requestDeleteSelectedLetter() {
    if (!/^\d{4}$/.test(editPin)) return setMessage('삭제하시려면 4자리 PIN을 입력해 주세요.');
    setConfirmingDelete(true);
    setMessage('');
  }

  async function deleteSelectedLetter() {
    if (!selected) return;
    if (!/^\d{4}$/.test(editPin)) return setMessage('삭제하시려면 4자리 PIN을 입력해 주세요.');
    setEditSaving(true);
    setMessage('');
    try {
      await fetchJson(`/public-letters/${selected.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: editPin }),
      });
      closeSelectedLetter();
      await loadLetters(page);
    } catch (err) {
      setMessage(err.message || '열린 편지를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <motion.div
      className="open-mailbox-page"
      {...pageMotion}
    >
      <button type="button" className="open-mailbox-back" onClick={goBack}>← 뒤로가기</button>

      <OpenMailboxLogo />

      <main className="open-mailbox-shell">
        <section className="open-board-panel">
          <div className="open-board-header">
            <div className="open-board-title-row">
              <span>{total} letters</span>
              <h1 className="open-board-emoji-title" aria-label="열린 편지함">💌</h1>
              <p>모두에게 남기는 편지</p>
            </div>
            <div className="open-board-controls">
              <button type="button" className="open-compose-open-button" onClick={openComposer}>
                편지 남기기
              </button>
              <div className="open-page-arrows">
                <button type="button" onClick={() => changePage(page - 1)} disabled={page <= 0}>‹</button>
                <span>{page + 1}/{totalPages}</span>
                <button type="button" onClick={() => changePage(page + 1)} disabled={page + 1 >= totalPages}>›</button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="open-empty-letter">불러오는 중...</div>
          ) : letters.length === 0 ? (
            <div className="open-empty-letter">
              <strong>첫 마음을 기다리는 중입니다</strong>
              <span>첫 마음이 도착하면 이곳에 조용히 쌓입니다.</span>
              <button type="button" className="open-compose-open-button" onClick={openComposer}>
                첫 마음 남기기
              </button>
            </div>
          ) : (
            <div className="open-letter-grid">
              {letters.map((letter, index) => (
                <motion.button
                  type="button"
                  key={letter.id}
                  className={`open-letter-card ${letter.type} ${letter.content ? '' : 'has-no-copy'}`.trim()}
                  onClick={() => openLetter(letter)}
                  {...listItemMotion(index)}
                >
                  {(letter.type === 'draw' || letter.type === 'photo') && letter.imageUrl && (
                    <img src={letter.imageUrl} alt="" />
                  )}
                  {letter.content && <p>{letter.content}</p>}
                  <footer>
                    <span>{letter.nickname}</span>
                    <span className="open-letter-date-stack">
                      <time>{formatDate(letter.createdAt)}</time>
                      {wasEdited(letter) && <em>수정됨</em>}
                    </span>
                  </footer>
                </motion.button>
              ))}
              {Array.from({ length: emptySlots }).map((_, index) => (
                <div key={`empty-${page}-${index}`} className="open-letter-card placeholder" aria-hidden="true" />
              ))}
            </div>
          )}
        </section>
      </main>

      <AnimatePresence>
        {showComposer && (
          <motion.div
            className="open-compose-modal-backdrop"
            {...modalBackdropMotion}
            onClick={closeComposer}
          >
            <motion.section
              className="open-compose-panel open-compose-modal"
              {...modalPanelMotion}
              onClick={event => event.stopPropagation()}
            >
              <button type="button" className="open-compose-close" onClick={closeComposer}>닫기</button>
              <div className="open-compose-heading">
                <h2>모두에게 남기는 편지</h2>
                <span>남겨 주신 글은 모두에게 공개됩니다.</span>
              </div>

              <form className="open-compose-form" onSubmit={submitLetter}>
                <input
                  className="open-compose-input"
                  value={nickname}
                  onChange={event => setNickname(event.target.value)}
                  maxLength={12}
                  placeholder="닉네임을 입력해 주세요"
                />
                <input
                  className="open-compose-input"
                  type="password"
                  value={pin}
                  onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={4}
                  placeholder="수정/삭제용 PIN 4자리"
                />

                <div className="open-mode-tabs" aria-label="편지 형식">
                  {modes.map(item => (
                    <button
                      key={item.key}
                      type="button"
                      className={mode === item.key ? 'active' : ''}
                      onClick={() => chooseMode(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {mode === 'text' && (
                    <motion.textarea
                      key="text"
                      className="open-compose-textarea"
                      value={content}
                      onChange={event => changeContent(event.target.value)}
                      maxLength={CONTENT_MAX_LENGTH}
                      placeholder="모두에게 남길 마음을 적어 주세요"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                    />
                  )}

                  {mode === 'draw' && (
                    <motion.div
                      key="draw"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="open-compose-media"
                    >
                      <OpenDrawCanvas canvasRef={canvasRef} onDrawn={setDrawn} />
                    </motion.div>
                  )}

                  {mode === 'photo' && (
                    <motion.div
                      key="photo"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="open-photo-tool"
                    >
                      {photoUrl ? (
                        <div className="open-photo-preview">
                          <img src={photoUrl} alt="" />
                          <button type="button" onClick={() => setPhotoUrl('')}>다시 촬영하기</button>
                        </div>
                      ) : (
                        <button type="button" className="open-photo-button" onClick={openPhotoCamera} disabled={photoUploading}>
                          {photoUploading ? '업로드 중...' : '사진 남기기'}
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="open-compose-footer">
                  <span>{mode === 'text' ? `${content.length}/${CONTENT_MAX_LENGTH}` : mode === 'photo' ? '사진 1장' : '그림 1장'}</span>
                  <button type="submit" disabled={saving || photoUploading}>
                    {saving ? '저장 중...' : '남기기'}
                  </button>
                </div>
              </form>
              {message && <div className="open-message">{message}</div>}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && (
          <motion.div
            className="open-letter-modal-backdrop"
            {...modalBackdropMotion}
            onClick={closeSelectedLetter}
          >
            <motion.article
              className="open-letter-modal"
              {...modalPanelMotion}
              onClick={event => event.stopPropagation()}
            >
              <button type="button" onClick={closeSelectedLetter}>닫기</button>
              <span>
                {formatDate(selected.createdAt)}
                {wasEdited(selected) && <em className="open-edited-label">수정됨</em>}
              </span>
              {editingSelected ? (
                <form className="open-letter-edit-form" onSubmit={updateSelectedLetter}>
                  <input
                    className="open-compose-input"
                    value={editNickname}
                    onChange={event => setEditNickname(event.target.value)}
                    maxLength={12}
                    placeholder="닉네임을 입력해 주세요"
                  />
                  {selected.type === 'text' && (
                    <textarea
                      className="open-compose-textarea compact"
                      value={editContent}
                      onChange={event => setEditContent(event.target.value.slice(0, CONTENT_MAX_LENGTH))}
                      maxLength={CONTENT_MAX_LENGTH}
                      placeholder="내용을 입력해 주세요"
                    />
                  )}
                  {selected.type === 'draw' && (
                    <div className="open-edit-draw">
                      <OpenDrawCanvas
                        key={`edit-draw-${selected.id}`}
                        canvasRef={editCanvasRef}
                        initialImageUrl={selected.imageUrl || ''}
                        onDrawn={setEditDrawn}
                      />
                    </div>
                  )}
                  {selected.type === 'photo' && selected.imageUrl && (
                    <div className="open-edit-photo-note">
                      <img src={selected.imageUrl} alt="" />
                      <span>사진은 그대로 두고 닉네임만 수정하실 수 있습니다.</span>
                    </div>
                  )}
                  <input
                    className="open-compose-input"
                    type="password"
                    value={editPin}
                    onChange={event => setEditPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                    inputMode="numeric"
                    autoComplete="new-password"
                    maxLength={4}
                    placeholder="PIN 4자리"
                  />
                  <div className="open-letter-actions">
                    <button type="button" onClick={() => setEditingSelected(false)} disabled={editSaving}>돌아가기</button>
                    <button type="submit" disabled={editSaving}>{editSaving ? '저장 중...' : '수정 저장'}</button>
                  </div>
                </form>
              ) : (
                <>
                  {(selected.type === 'draw' || selected.type === 'photo') && selected.imageUrl && (
                    <img src={selected.imageUrl} alt="" />
                  )}
                  {selected.content && <p>{selected.content}</p>}
                  <footer>from. {selected.nickname}</footer>
                  <div className="open-letter-pin-actions">
                    <input
                      type="password"
                      value={editPin}
                      onChange={event => setEditPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                      inputMode="numeric"
                      autoComplete="new-password"
                      maxLength={4}
                      placeholder="PIN 4자리"
                    />
                    <button type="button" onClick={() => setEditingSelected(true)} disabled={editSaving}>수정하기</button>
                    <button type="button" onClick={requestDeleteSelectedLetter} disabled={editSaving}>삭제하기</button>
                  </div>
                  {confirmingDelete && (
                    <div className="open-delete-confirm">
                      <span>이 열린 편지를 삭제하시겠습니까?</span>
                      <button type="button" onClick={() => setConfirmingDelete(false)} disabled={editSaving}>돌아가기</button>
                      <button type="button" onClick={deleteSelectedLetter} disabled={editSaving}>
                        {editSaving ? '삭제하고 있습니다...' : '삭제하기'}
                      </button>
                    </div>
                  )}
                </>
              )}
              {message && <div className="open-message">{message}</div>}
            </motion.article>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCamera && (
          <motion.div
            className="photo-capture-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(3,3,3,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 120, gap: 24, transform: 'translateZ(0)', backfaceVisibility: 'hidden', willChange: 'opacity', isolation: 'isolate' }}
          >
            <div className="photo-capture-frame" style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', width: 'min(680px, calc(100vw - 32px))', aspectRatio: '4/3', background: '#000', transform: 'translateZ(0)', backfaceVisibility: 'hidden', contain: 'paint' }}>
              <video
                ref={photoVideoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={event => event.currentTarget.play?.().catch(() => {})}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
              />
            </div>
            <div className="photo-capture-actions" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <button type="button" onClick={closePhotoCamera} style={{ padding: '10px 26px', borderRadius: 50, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,252,223,0.72)' }}>돌아가기</button>
              <button type="button" onClick={capturePhoto} className="open-shutter-button" aria-label="촬영" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

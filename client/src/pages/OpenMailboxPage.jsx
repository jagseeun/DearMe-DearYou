import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { fetchJson } from '../utils/api.js';

const ease = [0.22, 1, 0.36, 1];
const CONTENT_MAX_LENGTH = 100;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
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

function OpenMailboxLogo() {
  return (
    <div className="top-title open-mailbox-logo" aria-label="Dear Me; Dear You">
      <span className="to">Dear Me</span>
      <span className="semicolon">;</span>
      <span className="from">Dear You</span>
    </div>
  );
}

function OpenDrawCanvas({ canvasRef, onDrawn }) {
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, canvas.clientWidth || canvas.getBoundingClientRect().width);
    const height = Math.max(1, canvas.clientHeight || canvas.getBoundingClientRect().height);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#4e3d31';
  }, [canvasRef]);

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
    const drawingWidth = Math.max(1, canvas.clientWidth || contentWidth);
    const drawingHeight = Math.max(1, canvas.clientHeight || contentHeight);
    const x = ((event.clientX - rect.left - borderLeft) / contentWidth) * drawingWidth;
    const y = ((event.clientY - rect.top - borderTop) / contentHeight) * drawingHeight;
    return {
      x: Math.min(Math.max(x, 0), drawingWidth),
      y: Math.min(Math.max(y, 0), drawingHeight),
    };
  }

  function start(event) {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture?.(event.pointerId);
    drawingRef.current = true;
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
    onDrawn(true);
  }

  function end(event) {
    if (event?.pointerId !== undefined && event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drawingRef.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.max(1, canvas.clientWidth || canvas.getBoundingClientRect().width);
    const height = Math.max(1, canvas.clientHeight || canvas.getBoundingClientRect().height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(0, 0, width, height);
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
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const canvasRef = useRef(null);
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
      setMessage(err.message || '열린 편지를 불러오지 못했습니다.');
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

  async function uploadImageBlob(blob, ext, contentType) {
    if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error('이미지가 너무 큽니다.');
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
    if (!put.ok) throw new Error('이미지 업로드에 실패했습니다.');
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
      setMessage('카메라 권한을 허용해주세요.');
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
      setMessage(err.message || '사진 업로드에 실패했습니다.');
    } finally {
      setPhotoUploading(false);
    }
  }

  async function uploadDrawing() {
    const canvas = canvasRef.current;
    if (!canvas || !drawn) throw new Error('그림을 그려주세요.');
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    return uploadImageBlob(blob, 'png', 'image/png');
  }

  function resetForm() {
    setMode('text');
    setNickname('');
    setContent('');
    setPhotoUrl('');
    setDrawn(false);
  }

  function closeComposer() {
    setShowComposer(false);
    setMessage('');
  }

  async function submitLetter(event) {
    event.preventDefault();
    const cleanNickname = nickname.trim();
    const cleanContent = content.trim();

    if (!cleanNickname) return setMessage('닉네임을 입력해주세요.');
    if (cleanContent.length > CONTENT_MAX_LENGTH) return setMessage(`내용은 ${CONTENT_MAX_LENGTH}자를 넘을 수 없습니다.`);
    if (mode === 'text' && !cleanContent) return setMessage('내용을 입력해주세요.');
    if (mode === 'photo' && !photoUrl) return setMessage('사진을 촬영해주세요.');
    if (mode === 'draw' && !drawn) return setMessage('그림을 그려주세요.');

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
        }),
      });
      resetForm();
      setShowComposer(false);
      setMessage('');
      await loadLetters(0);
    } catch (err) {
      setMessage(err.message || '열린 편지를 저장하지 못했습니다.');
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

  return (
    <motion.div
      className="open-mailbox-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      transition={{ duration: 0.5, ease }}
    >
      <button type="button" className="open-mailbox-back" onClick={() => navigate('/')}>돌아가기</button>

      <OpenMailboxLogo />

      <main className="open-mailbox-shell">
        <section className="open-board-panel">
          <div className="open-board-header">
            <div className="open-board-title-row">
              <span>{total} letters</span>
              <h1 className="open-board-emoji-title" aria-label="열린 편지함">💌</h1>
              <p>모두에게 보내는 편지</p>
            </div>
            <div className="open-board-controls">
              <button type="button" className="open-compose-open-button" onClick={() => setShowComposer(true)}>
                작성하기
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
              <strong>첫 편지를 기다리는 중</strong>
              <span>아무도 안 하면 우리가 첫 장을 열면 됩니다.</span>
              <button type="button" className="open-compose-open-button" onClick={() => setShowComposer(true)}>
                첫 편지 남기기
              </button>
            </div>
          ) : (
            <div className="open-letter-grid">
              {letters.map(letter => (
                <button
                  type="button"
                  key={letter.id}
                  className={`open-letter-card ${letter.type} ${letter.content ? '' : 'has-no-copy'}`.trim()}
                  onClick={() => setSelected(letter)}
                >
                  {(letter.type === 'draw' || letter.type === 'photo') && letter.imageUrl && (
                    <img src={letter.imageUrl} alt="" />
                  )}
                  {letter.content && <p>{letter.content}</p>}
                  <footer>
                    <span>{letter.nickname}</span>
                    <time>{formatDate(letter.createdAt)}</time>
                  </footer>
                </button>
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeComposer}
          >
            <motion.section
              className="open-compose-panel open-compose-modal"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              onClick={event => event.stopPropagation()}
            >
              <button type="button" className="open-compose-close" onClick={closeComposer}>닫기</button>
              <div className="open-compose-heading">
                <h2>모두에게 전하는 편지</h2>
                <span>모든 사람이 볼 수 있습니다.</span>
              </div>

              <form className="open-compose-form" onSubmit={submitLetter}>
                <input
                  className="open-compose-input"
                  value={nickname}
                  onChange={event => setNickname(event.target.value)}
                  maxLength={12}
                  placeholder="닉네임"
                />

                <div className="open-mode-tabs" aria-label="작성 형식">
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
                      placeholder="모두에게 남길 편지"
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
                          <button type="button" onClick={() => setPhotoUrl('')}>다시 촬영</button>
                        </div>
                      ) : (
                        <button type="button" className="open-photo-button" onClick={openPhotoCamera} disabled={photoUploading}>
                          {photoUploading ? '업로드 중...' : '사진 촬영'}
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.article
              className="open-letter-modal"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              onClick={event => event.stopPropagation()}
            >
              <button type="button" onClick={() => setSelected(null)}>닫기</button>
              <span>{formatDate(selected.createdAt)}</span>
              {(selected.type === 'draw' || selected.type === 'photo') && selected.imageUrl && (
                <img src={selected.imageUrl} alt="" />
              )}
              {selected.content && <p>{selected.content}</p>}
              <footer>from. {selected.nickname}</footer>
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
              <button type="button" onClick={closePhotoCamera} style={{ padding: '10px 26px', borderRadius: 50, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,252,223,0.72)' }}>취소</button>
              <button type="button" onClick={capturePhoto} className="open-shutter-button" aria-label="촬영" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

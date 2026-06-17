import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import fixWebmDuration from 'fix-webm-duration';
import DrawCanvas from '../components/DrawCanvas.jsx';
import NoticeModal from '../components/NoticeModal.jsx';
import { ALLOWED_EMAIL_MESSAGE, isAllowedEmail } from '../utils/email.js';

const ease = [0.16, 1, 0.3, 1];
const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.96, ease } } };
const LETTER_CONTENT_MAX_LENGTH = 500;
const LETTER_EMAIL_SUBJECT_MAX_LENGTH = 40;
const RECIPIENT_NAME_MAX_LENGTH = 50;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

function defaultOpenDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
}

function dataUrlToBlob(dataUrl) {
  const [header, data] = String(dataUrl || '').split(',');
  const mime = header?.match(/^data:([^;]+);base64$/)?.[1];
  if (!mime || !data) throw new Error('서명 이미지 형식을 확인해 주세요.');

  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function clampLetterText(value) {
  return String(value ?? '').slice(0, LETTER_CONTENT_MAX_LENGTH);
}

function WriteIcon({ name }) {
  const paths = {
    text: (
      <>
        <rect x="5" y="4.5" width="14" height="15" rx="2.2" />
        <path d="M8.5 9h7" />
        <path d="M8.5 12h7" />
        <path d="M8.5 15h4.5" />
      </>
    ),
    video: (
      <>
        <rect x="4" y="6" width="12" height="12" rx="2.5" />
        <path d="m16 10 4-2.2v8.4L16 14" />
      </>
    ),
    draw: (
      <>
        <path d="M15.8 5.2 18.8 8.2" />
        <path d="M17.3 3.7a2.1 2.1 0 0 1 3 3L8.8 18.2 4.6 19.4l1.2-4.2L17.3 3.7Z" />
        <path d="m6 15 3 3" />
      </>
    ),
    camera: (
      <>
        <path d="M8.5 7.5 10 5.5h4l1.5 2h2.2A2.3 2.3 0 0 1 20 9.8v6.4a2.3 2.3 0 0 1-2.3 2.3H6.3A2.3 2.3 0 0 1 4 16.2V9.8a2.3 2.3 0 0 1 2.3-2.3h2.2Z" />
        <circle cx="12" cy="13" r="3.2" />
      </>
    ),
    signature: (
      <>
        <path d="M4 17.6c2.3 1 4.3.7 6-.9l6.7-6.7a2.2 2.2 0 0 0-3.1-3.1l-6.7 6.7" />
        <path d="m12.4 8.1 3.1 3.1" />
        <path d="M14.5 18h5" />
      </>
    ),
    save: (
      <>
        <path d="M6 4.5h10.2L19 7.3v12.2H5V4.5h1Z" />
        <path d="M8 4.5v5h7v-5" />
        <path d="M8 19.5v-6h8v6" />
      </>
    ),
    send: (
      <>
        <path d="M4 12 20 4l-5 16-3.2-6.8L4 12Z" />
        <path d="m11.8 13.2 4.4-4.4" />
      </>
    ),
  };

  return (
    <svg className="write-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function LetterTextarea({ value, onChange, placeholder }) {
  return (
    <textarea
      id="textInput"
      value={value}
      onChange={e => onChange(clampLetterText(e.target.value))}
      placeholder={placeholder}
      maxLength={LETTER_CONTENT_MAX_LENGTH}
      className="write-textarea letters-scroll"
    />
  );
}
function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// ── 글자 하나씩 페이드인 글 편지 입력 컴포넌트 ──
function AnimatedTextarea({ value, onChange, placeholder }) {
  const textareaRef = useRef(null);
  const [chars, setChars] = useState([]); // [{ id, char }]
  const idCounter = useRef(0);
  const prevValue = useRef('');

  useEffect(() => {
    if (value === '') { setChars([]); prevValue.current = ''; }
  }, [value]);

  function handleChange(e) {
    const newVal = e.target.value;
    const oldVal = prevValue.current;
    // 공통 접두사 길이
    let common = 0;
    const minLen = Math.min(oldVal.length, newVal.length);
    while (common < minLen && oldVal[common] === newVal[common]) common++;

    setChars(prev => [
      ...prev.slice(0, common),
      ...newVal.slice(common).split('').map(ch => ({ id: idCounter.current++, char: ch })),
    ]);
    prevValue.current = newVal;
    onChange(newVal);
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* 시각적 오버레이 */}
      <div style={{
        position: 'absolute', inset: 0,
        padding: 'clamp(24px, 5vw, 38px)', fontSize: 'clamp(18px, 3vw, 23px)', fontWeight: 300, lineHeight: 1.8,
        pointerEvents: 'none', fontFamily: 'inherit', overflow: 'hidden',
      }}>
        {!value && (
          <span style={{ color: 'rgba(92,72,52,0.5)', fontSize: 'clamp(17px, 3vw, 21px)', fontWeight: 300 }}>
            {placeholder}
          </span>
        )}
        {chars.map(({ id, char }) =>
          char === '\n'
            ? <br key={id} />
            : (
              <motion.span
                key={id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                style={{ color: '#3f3025', display: 'inline' }}
              >
                {char}
              </motion.span>
            )
        )}
      </div>
      {/* 실제 textarea (투명 글 편지, 캐럿만 보임) */}
      <textarea
        ref={textareaRef}
        id="textInput"
        value={value}
        onChange={handleChange}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          background: 'transparent', border: 'none', outline: 'none',
          padding: 'clamp(24px, 5vw, 38px)', color: 'transparent', caretColor: '#5a3b25',
          fontSize: 'clamp(18px, 3vw, 23px)', fontWeight: 300, resize: 'none',
          fontFamily: 'inherit', lineHeight: 1.8,
        }}
      />
    </div>
  );
}

// ── 서명 캔버스 컴포넌트 ──
function SignatureCanvas({ onSave, onClose, existing }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const pendingData = useRef(null);
  const hasInk = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [locked, setLocked] = useState(false);

  // 기존 서명이 있으면 캔버스에 복원
  useEffect(() => {
    if (!existing || !canvasRef.current) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      hasInk.current = true;
      setHasDrawn(true);
      setLocked(true);
    };
    img.src = existing;
  }, []);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  }

  function onDown(e) {
    e.preventDefault();
    if (locked) return;
    drawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function onMove(e) {
    if (!drawing.current || locked) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = 'rgba(232,201,154,0.9)';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    hasInk.current = true;
    setHasDrawn(true);
  }

  function onUp() {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasInk.current) {
      pendingData.current = canvasRef.current.toDataURL('image/png');
      setLocked(true);
      setHasDrawn(true);
    }
  }

  useEffect(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  });

  function clear() {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    pendingData.current = null;
    hasInk.current = false;
    setHasDrawn(false);
    setLocked(false);
    onSave(null);
  }

  function confirm() {
    if (!hasDrawn) return;
    const data = pendingData.current || (existing && !existing.startsWith('data:') ? existing : canvasRef.current?.toDataURL('image/png'));
    if (!data) return;
    onSave(data);
    onClose();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* 캔버스 영역 */}
      <div style={{
        position: 'relative',
        borderBottom: locked
          ? '1px solid rgba(205,154,99,0.45)'
          : '1px solid rgba(255,255,255,0.18)',
        transition: 'border-color 0.4s ease',
        paddingBottom: 4,
      }}>
        {/* 서명란 힌트 */}
        {!hasDrawn && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
            color: 'rgba(255,252,223,0.18)', fontSize: 13, letterSpacing: 3,
            fontStyle: 'italic', fontWeight: 300,
          }}>
            sign here
          </div>
        )}
        {/* 왼쪽 작은 마크 */}
        <div style={{
          position: 'absolute', left: 0, bottom: -1,
          width: 8, height: 1,
          background: locked ? 'rgba(205,154,99,0.6)' : 'rgba(255,255,255,0.35)',
          transition: 'background 0.4s ease',
        }} />
        <canvas
          ref={canvasRef}
          width={680}
          height={110}
          style={{
            display: 'block', width: '100%', height: 110,
            cursor: locked ? 'default' : 'crosshair',
            touchAction: 'none',
          }}
          onMouseDown={onDown}
          onTouchStart={onDown}
          onTouchMove={onMove}
          onTouchEnd={onUp}
        />
      </div>

      {/* 버튼 영역 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, paddingTop: 10 }}>
        {hasDrawn && !locked && (
          <span style={{ fontSize: 12, color: 'rgba(255,252,223,0.25)', letterSpacing: 1, marginRight: 4 }}>
            서명을 마치신 뒤 확인을 눌러 주세요
          </span>
        )}
        <button onClick={clear} style={sigBtnStyle}>지우기</button>
        <motion.button
          onClick={confirm}
          disabled={!hasDrawn}
          whileHover={hasDrawn ? { scale: 1.018 } : {}}
          style={{
            ...sigBtnStyle,
            opacity: hasDrawn ? 1 : 0.35,
            background: hasDrawn ? 'rgba(205,154,99,0.2)' : 'transparent',
            borderColor: hasDrawn ? 'rgba(205,154,99,0.45)' : 'rgba(255,255,255,0.12)',
            color: hasDrawn ? '#e8c99a' : 'rgba(255,252,223,0.4)',
          }}>
          확인
        </motion.button>
      </div>
    </div>
  );
}
const sigBtnStyle = {
  padding: '6px 18px', borderRadius: 50, fontSize: 12, fontFamily: 'inherit',
  cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)',
  background: 'transparent', color: 'rgba(255,252,223,0.45)',
  transition: 'all 0.25s', letterSpacing: 0.5,
};

export default function WritePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const queryMode = queryParams.get('mode');
  const queryTheme = queryParams.get('theme');
  const requestedMode = location.state?.mode || queryMode;
  const requestedTheme = location.state?.emailTheme || queryTheme;
  const initialMode = ['text', 'video', 'draw'].includes(requestedMode)
    ? requestedMode
    : 'text';
  const [mode, setMode] = useState(initialMode);
  const [emailTheme, setEmailTheme] = useState(requestedTheme === 'pink' ? 'pink' : 'dark');
  const [text, setText] = useState('');
  const [textBorderTone, setTextBorderTone] = useState(0);

  // 영상 편지 상태
  const [stage, setStage] = useState('idle');
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(30);
  const [videoUrl, setVideoUrl] = useState('');
  const [showRetryConfirm, setShowRetryConfirm] = useState(false);

  // 사진 담기
  const [imageUrl, setImageUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const photoVideoRef = useRef(null);
  const photoStreamRef = useRef(null);

  // 그림 편지
  const [drawCanvasEl, setDrawCanvasEl] = useState(null);
  const [drawHasDrawn, setDrawHasDrawn] = useState(false);
  const [drawUploading, setDrawUploading] = useState(false);
  const [drawDraftImageUrl, setDrawDraftImageUrl] = useState('');
  const [drawPreviewImageUrl, setDrawPreviewImageUrl] = useState('');

  // 서명
  const [signatureData, setSignatureData] = useState(null);
  const [showSig, setShowSig] = useState(false);

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [openDate, setOpenDate] = useState(defaultOpenDate());
  const [sendNow, setSendNow] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [email, setEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  // 수신인 (타인에게 편지 보내기)
  const [toOther, setToOther] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [draft, setDraft] = useState(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailPreview, setEmailPreview] = useState({ subject: '', html: '' });
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);
  const [emailPreviewError, setEmailPreviewError] = useState('');
  const [emailPreviewScale, setEmailPreviewScale] = useState(0.6);
  const [emailPreviewHeight, setEmailPreviewHeight] = useState(0);
  const [emailPreviewFrameHeight, setEmailPreviewFrameHeight] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const recordingStartedAtRef = useRef(0);
  const chunksRef = useRef([]);
  const emailPreviewFrameRef = useRef(null);
  const emailPreviewDocumentRef = useRef(null);

  function showNotice(message, title = '확인해 주세요') {
    setShowModal(false);
    setShowRetryConfirm(false);
    setNotice({ title, message });
  }

  function showAccountEmailChangeNotice() {
    showNotice(
      accountEmail
        ? `내 편지를 받을 이메일은 ${accountEmail}로 저장되어 있어요. 바꾸려면 마이페이지에서 이메일을 변경해 주세요.`
        : '내 편지를 받을 이메일은 마이페이지에서 먼저 등록해 주세요.',
      '이메일 변경은 마이페이지에서'
    );
  }

  function handleTextChange(nextText) {
    setText(clampLetterText(nextText));
    setTextBorderTone(prev => (prev + 1) % 5);
  }

  useEffect(() => {
    fetch('/get-user-info', { cache: 'no-store' })
      .then(r => { if (r.status === 401) { navigate('/login'); return null; } return r.json(); })
      .then(d => {
        if (!d) return;
        const nextEmail = d.email || '';
        setAccountEmail(nextEmail);
        setEmail(nextEmail);
        if (d.name) setName(d.name);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/letter-draft')
      .then(r => {
        if (r.status === 401) return null;
        return r.json();
      })
      .then(data => {
        if (data?.draft) setDraft(data.draft);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!showEmailPreview) return;
    setShowEmailPreview(false);
    setEmailPreviewError('');
  }, [mode, text, videoUrl, imageUrl, drawHasDrawn, openDate, sendNow, emailSubject, emailTheme, toOther, recipientEmail, recipientName]);

  useEffect(() => {
    if (!showEmailPreview || emailPreviewLoading || !emailPreview.html) return undefined;

    let frameId = 0;
    function fitPreview() {
      const frame = emailPreviewFrameRef.current;
      const documentEl = emailPreviewDocumentRef.current;
      if (!frame || !documentEl) return;

      const frameWidth = frame.clientWidth || 1;
      const contentWidth = documentEl.scrollWidth || 700;
      const contentHeight = documentEl.scrollHeight || 1;
      const nextScale = Math.min(1, frameWidth / contentWidth);
      const safeScale = Number(nextScale.toFixed(3));
      const scaledHeight = Math.ceil(contentHeight * safeScale);
      const frameLimit = window.innerWidth <= 520
        ? Math.max(260, Math.min(380, window.innerHeight - 220))
        : Math.max(360, Math.min(560, window.innerHeight - 210));
      const frameFloor = window.innerWidth <= 520 ? 260 : 340;
      const nextFrameHeight = scaledHeight <= frameFloor
        ? scaledHeight
        : Math.min(scaledHeight, frameLimit);

      setEmailPreviewScale(safeScale);
      setEmailPreviewHeight(scaledHeight);
      setEmailPreviewFrameHeight(Math.max(1, nextFrameHeight));
    }

    frameId = requestAnimationFrame(fitPreview);
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fitPreview);
    if (resizeObserver) {
      if (emailPreviewFrameRef.current) resizeObserver.observe(emailPreviewFrameRef.current);
      if (emailPreviewDocumentRef.current) resizeObserver.observe(emailPreviewDocumentRef.current);
    }
    const previewImages = Array.from(emailPreviewDocumentRef.current?.querySelectorAll('img') || []);
    previewImages.forEach(image => {
      image.addEventListener('load', fitPreview);
      image.addEventListener('error', fitPreview);
    });
    const delayedFit = window.setTimeout(fitPreview, 300);
    window.addEventListener('resize', fitPreview);
    return () => {
      cancelAnimationFrame(frameId);
      window.clearTimeout(delayedFit);
      resizeObserver?.disconnect();
      previewImages.forEach(image => {
        image.removeEventListener('load', fitPreview);
        image.removeEventListener('error', fitPreview);
      });
      window.removeEventListener('resize', fitPreview);
    };
  }, [showEmailPreview, emailPreviewLoading, emailPreview.html]);

  useEffect(() => { return () => { streamRef.current?.getTracks().forEach(t => t.stop()); }; }, []);

  useEffect(() => {
    if (stage !== 'counting') return;
    if (countdown === 0) { startRecording(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, countdown]);

  useEffect(() => {
    if (stage !== 'recording') return;
    if (timeLeft === 0) { stopRecording(); return; }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, timeLeft]);

  async function prepareCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStage('counting');
      setCountdown(3);
      setVideoUrl('');
    } catch { showNotice('카메라 권한을 허용해 주시면 촬영을 이어갈 수 있습니다.', '카메라를 확인해 주세요'); }
  }

  function startRecording() {
    chunksRef.current = [];
    const mr = new MediaRecorder(streamRef.current, { mimeType: 'video/webm;codecs=vp8,opus' });
    mr.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = handleUpload;
    recordingStartedAtRef.current = Date.now();
    mr.start(1000);
    recorderRef.current = mr;
    setStage('recording');
    setTimeLeft(30);
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStage('uploading');
  }

  async function handleUpload() {
    try {
      const rawBlob = new Blob(chunksRef.current, { type: 'video/webm' });
      const durationMs = Math.max(1, Date.now() - recordingStartedAtRef.current);
      const blob = await fixWebmDuration(rawBlob, durationMs, { logger: false }).catch(() => rawBlob);
      if (blob.size > MAX_VIDEO_BYTES) throw new Error('영상 편지 파일이 너무 큽니다. 조금 짧게 다시 촬영해 주세요.');
      const res = await fetch('/get-upload-url');
      if (!res.ok) throw new Error();
      const { uploadUrl, publicUrl } = await res.json();
      const put = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'video/webm' } });
      if (!put.ok) throw new Error();
      setVideoUrl(publicUrl);
      setStage('done');
    } catch {
      showNotice('파일을 올리지 못했습니다. 잠시 후 다시 시도해 주세요.', '업로드하지 못했습니다');
      setStage('idle');
    }
  }

  function retryVideo() {
    setVideoUrl('');
    setStage('idle');
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function handleModeSwitch(m) {
    setMode(m);
    setDrawPreviewImageUrl('');
    if (m !== 'draw') setDrawDraftImageUrl('');
    if (m === 'text' && streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setStage('idle');
      setVideoUrl('');
    }
    if (m !== 'text' && streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setStage('idle');
      setVideoUrl('');
    }
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
    } catch { showNotice('카메라 권한을 허용해 주시면 촬영을 이어갈 수 있습니다.', '카메라를 확인해 주세요'); }
  }

  function closePhotoCamera() {
    if (photoVideoRef.current) photoVideoRef.current.srcObject = null;
    photoStreamRef.current?.getTracks().forEach(t => t.stop());
    photoStreamRef.current = null;
    setShowCamera(false);
  }

  async function capturePhoto() {
    const video = photoVideoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    closePhotoCamera();
    setImageUploading(true);
    try {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
      if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error();
      const res = await fetch('/get-image-upload-url?ext=jpg');
      if (!res.ok) throw new Error();
      const { uploadUrl, publicUrl } = await res.json();
      const put = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
      if (!put.ok) throw new Error();
      setImageUrl(publicUrl);
    } catch { showNotice('사진 파일을 올리지 못했습니다. 잠시 후 다시 시도해 주세요.', '업로드하지 못했습니다'); }
    finally { setImageUploading(false); }
  }

  async function uploadSignature(dataUrl) {
    try {
      const res = await fetch('/get-image-upload-url?ext=png');
      if (!res.ok) throw new Error('서명을 올릴 준비를 하지 못했습니다.');
      const { uploadUrl, publicUrl } = await res.json();
      const blob = dataUrlToBlob(dataUrl);
      if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error('서명 이미지가 너무 큽니다. 조금 더 가볍게 저장해 주세요.');
      const put = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/png' } });
      if (!put.ok) throw new Error('서명을 올리지 못했습니다.');
      return publicUrl;
    } catch (err) {
      throw new Error(err.message || '서명을 올리지 못했습니다.');
    }
  }

  async function uploadCanvas() {
    setDrawUploading(true);
    try {
      const canvas = drawCanvasEl;
      if (!canvas) throw new Error('canvas not ready');
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error('그림 편지 이미지가 너무 큽니다. 조금 더 가볍게 저장해 주세요.');
      const res = await fetch('/get-image-upload-url?ext=png');
      if (!res.ok) throw new Error();
      const { uploadUrl, publicUrl } = await res.json();
      const put = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/png' } });
      if (!put.ok) throw new Error();
      return publicUrl;
    } finally { setDrawUploading(false); }
  }

  function applyDraft(nextDraft) {
    if (!nextDraft) return;
    const nextMode = ['text', 'video', 'draw'].includes(nextDraft.type) ? nextDraft.type : 'text';
    setMode(nextMode);
    setText(clampLetterText(nextDraft.content || ''));
    setVideoUrl(nextDraft.videoUrl || '');
    setImageUrl(nextMode === 'text' ? (nextDraft.imageUrl || '') : '');
    setDrawDraftImageUrl(nextMode === 'draw' ? (nextDraft.imageUrl || '') : '');
    setDrawPreviewImageUrl('');
    setSignatureData(nextDraft.signatureData || null);
    setEmailTheme(nextDraft.emailTheme === 'pink' ? 'pink' : 'dark');
    setEmail(accountEmail || email);
    setEmailSubject(nextDraft.emailSubject || '');
    setToOther(Boolean(nextDraft.toOther));
    setRecipientName(nextDraft.recipientName || '');
    setRecipientEmail(nextDraft.recipientEmail || '');
    setOpenDate(nextDraft.openDate ? new Date(nextDraft.openDate).toISOString().split('T')[0] : defaultOpenDate());
    setSendNow(false);
    setStage(nextMode === 'video' && nextDraft.videoUrl ? 'done' : 'idle');
    setDrawHasDrawn(Boolean(nextMode === 'draw' && nextDraft.imageUrl));
    showNotice('저장해 둔 초안을 불러왔습니다.', '초안 불러오기');
  }

  async function saveDraft() {
    setDraftSaving(true);
    try {
      let draftImageUrl = mode === 'draw' ? (drawPreviewImageUrl || drawDraftImageUrl || undefined) : (imageUrl || undefined);
      if (mode === 'draw' && drawHasDrawn && drawCanvasEl && !drawPreviewImageUrl) {
        draftImageUrl = await uploadCanvas();
      }
      let draftSignatureData = mode === 'text' ? signatureData : undefined;
      if (mode === 'text' && draftSignatureData?.startsWith('data:')) {
        draftSignatureData = await uploadSignature(draftSignatureData);
        setSignatureData(draftSignatureData);
      }

      const draftContent = mode === 'text' ? clampLetterText(text) : '';

      const res = await fetch('/letter-draft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: mode,
          content: draftContent,
          videoUrl: mode === 'video' ? videoUrl || undefined : undefined,
          imageUrl: mode === 'text' ? imageUrl || undefined : mode === 'draw' ? draftImageUrl : undefined,
          signatureData: mode === 'text' ? draftSignatureData || undefined : undefined,
          openDate,
          emailSubject: emailSubject.trim(),
          emailTheme,
          deliveryEmail: toOther ? '' : (accountEmail || email).trim().toLowerCase(),
          toOther,
          recipientEmail: toOther ? recipientEmail.trim().toLowerCase() : '',
          recipientName: toOther ? recipientName.trim() : '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '초안을 저장하지 못했습니다.');
      setDraft(data.draft);
      showNotice(data.message || '초안을 저장했습니다.', '초안 저장');
    } catch (err) {
      showNotice(err.message || '초안을 저장하지 못했습니다.', '초안을 저장하지 못했습니다');
    } finally {
      setDraftSaving(false);
    }
  }

  async function deleteDraft() {
    setDraftSaving(true);
    try {
      const res = await fetch('/letter-draft', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '초안을 삭제하지 못했습니다.');
      setDraft(null);
      showNotice(data.message || '초안을 삭제했습니다.', '초안 삭제');
    } catch (err) {
      showNotice(err.message || '초안을 삭제하지 못했습니다.', '초안을 삭제하지 못했습니다');
    } finally {
      setDraftSaving(false);
    }
  }

  async function loadEmailPreview() {
    setEmailPreviewLoading(true);
    setEmailPreviewError('');
    setEmailPreviewHeight(0);
    setEmailPreviewFrameHeight(0);

    try {
      let previewImageUrl = mode === 'draw' ? (drawPreviewImageUrl || drawDraftImageUrl) : imageUrl;
      let previewSignatureData = signatureData;

      if (mode === 'draw' && drawHasDrawn && drawCanvasEl && !drawPreviewImageUrl) {
        previewImageUrl = await uploadCanvas();
        setDrawPreviewImageUrl(previewImageUrl);
      }

      if (mode === 'text' && signatureData?.startsWith('data:')) {
        previewSignatureData = await uploadSignature(signatureData);
        setSignatureData(previewSignatureData);
      }

      const effectiveOpenDate = sendNow ? new Date().toISOString() : openDate;
      const res = await fetch('/letter-email-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: mode,
          content: mode === 'text' ? clampLetterText(text) : '',
          videoUrl: mode === 'video' ? videoUrl : undefined,
          imageUrl: mode === 'text' ? (previewImageUrl || undefined) : mode === 'draw' ? (previewImageUrl || undefined) : undefined,
          signatureData: mode === 'text' ? (previewSignatureData || undefined) : undefined,
          openDate: effectiveOpenDate,
          emailSubject: emailSubject.trim(),
          emailTheme,
          toOther,
          recipientEmail: toOther ? recipientEmail.trim().toLowerCase() : '',
          recipientName: toOther ? recipientName.trim() : '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '이메일 미리보기를 만들지 못했습니다.');
      setEmailPreview({ subject: data.subject || '', html: data.html || '' });
    } catch (err) {
      setEmailPreviewError(err.message || '이메일 미리보기를 만들지 못했습니다.');
    } finally {
      setEmailPreviewLoading(false);
    }
  }

  function toggleEmailPreview() {
    if (showEmailPreview) {
      setShowEmailPreview(false);
      return;
    }

    setShowEmailPreview(true);
    loadEmailPreview();
  }

  async function handleFromMe() {
    if (mode === 'text' && !text.trim()) return showNotice('편지에 남길 내용을 입력해 주세요.');
    if (mode === 'video' && !videoUrl) return showNotice('먼저 영상 편지를 촬영해 주세요.');
    if (mode === 'draw' && !drawHasDrawn) return showNotice('그림 편지에 남길 그림을 그려 주세요.');
    setNotice(null);
    setShowEmailPreview(false);
    setEmailPreview({ subject: '', html: '' });
    setEmailPreviewError('');
    setShowModal(true);
  }

  async function handleSave() {
    const limitedText = clampLetterText(text);
    if (!openDate) return showNotice('편지를 열어 볼 날짜를 선택해 주세요.');
    const cleanEmail = (accountEmail || email).trim().toLowerCase();
    const cleanEmailSubject = emailSubject.trim();
    const cleanRecipientEmail = recipientEmail.trim().toLowerCase();
    const cleanRecipientName = recipientName.trim();
    const effectiveOpenDate = sendNow ? new Date().toISOString() : openDate;
    const isImmediateDelivery = sendNow || new Date(effectiveOpenDate) <= new Date();
    if (isImmediateDelivery && !toOther && !cleanEmail) return showNotice('바로 보내려면 받을 이메일을 입력해 주세요.');
    if (text.length > LETTER_CONTENT_MAX_LENGTH) return showNotice(`내용은 ${LETTER_CONTENT_MAX_LENGTH}자를 넘을 수 없습니다.`);
    if (cleanEmailSubject.length > LETTER_EMAIL_SUBJECT_MAX_LENGTH) return showNotice(`메일 제목은 ${LETTER_EMAIL_SUBJECT_MAX_LENGTH}자를 넘을 수 없습니다.`);
    if (cleanEmail && !isAllowedEmail(cleanEmail)) return showNotice(ALLOWED_EMAIL_MESSAGE);
    if (toOther) {
      if (!cleanRecipientEmail) return showNotice('받을 분의 이메일을 입력해 주세요.');
      if (!isAllowedEmail(cleanRecipientEmail)) return showNotice(ALLOWED_EMAIL_MESSAGE);
      if (cleanRecipientName.length > RECIPIENT_NAME_MAX_LENGTH) return showNotice(`받을 분의 이름은 ${RECIPIENT_NAME_MAX_LENGTH}자를 넘을 수 없습니다.`);
    }
    setSaving(true);
    try {
      // 서명이 base64라면 R2에 업로드 후 URL로 교체
      let finalSignature = signatureData;
      if (mode === 'text' && signatureData?.startsWith('data:')) {
        finalSignature = await uploadSignature(signatureData);
      }

      // 그림 편지 캔버스 업로드
      let drawImageUrl;
      if (mode === 'draw') {
        drawImageUrl = drawPreviewImageUrl || await uploadCanvas();
      }

      const body = {
        type: mode,
        content: mode === 'text' ? limitedText : undefined,
        videoUrl: mode === 'video' ? videoUrl : undefined,
        imageUrl: mode === 'text' ? (imageUrl || undefined) : mode === 'draw' ? drawImageUrl : undefined,
        signatureData: mode === 'text' ? (finalSignature || undefined) : undefined,
        openDate: effectiveOpenDate,
        emailSubject: cleanEmailSubject || undefined,
        emailTheme,
        email: toOther ? undefined : cleanEmail,
        recipientEmail: toOther ? cleanRecipientEmail : undefined,
        recipientName: toOther ? cleanRecipientName : undefined,
      };
      const res = await fetch('/write-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        navigate('/done', {
          state: {
            openDate: effectiveOpenDate,
            name,
            recipientName: toOther ? (cleanRecipientName || cleanRecipientEmail) : name,
            recipientEmail: toOther ? cleanRecipientEmail : '',
            sentNow: isImmediateDelivery,
            delivery: data.delivery,
          },
        });
      } else {
        showNotice(data.message || '편지를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.', '저장하지 못했습니다');
        if (res.status === 401) navigate('/login');
      }
    } catch (err) { showNotice(err.message || '서버와 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.', '저장하지 못했습니다'); }
    finally { setSaving(false); }
  }

  // ── 카메라 UI ──
  const cameraUI = (
    <motion.div key="camera"
      className="write-stage write-camera-stage"
      initial={{ opacity: 0.82, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease }}
      style={{ width: 'min(1320px, calc(100vw - 64px))', marginBottom: 24 }}
    >
      <div className="write-video-frame" style={{
        width: '100%',
        height: 'var(--write-video-frame-height, min(64vh, 640px))',
        minHeight: 'var(--write-video-frame-min-height, min(380px, 52vh))',
        background: '#0a0a0a',
        borderRadius: 'var(--write-video-frame-radius, 28px)',
        overflow: 'hidden', position: 'relative',
        border: 'none',
      }}>
        {stage === 'done' ? (
          <motion.video key={videoUrl} src={videoUrl} controls playsInline
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <video ref={videoRef} autoPlay muted playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: stage === 'idle' ? 0 : 1, transition: 'opacity 0.4s' }}
          />
        )}

        {/* 뷰파인더 코너 */}
        {stage !== 'done' && ['tl','tr','bl','br'].map(pos => (
          <div key={pos} style={{
            position: 'absolute',
            width: 24, height: 24,
            top: pos.startsWith('t') ? 20 : 'auto',
            bottom: pos.startsWith('b') ? 20 : 'auto',
            left: pos.endsWith('l') ? 20 : 'auto',
            right: pos.endsWith('r') ? 20 : 'auto',
            borderTop: pos.startsWith('t') ? '2px solid rgba(255,255,255,0.5)' : 'none',
            borderBottom: pos.startsWith('b') ? '2px solid rgba(255,255,255,0.5)' : 'none',
            borderLeft: pos.endsWith('l') ? '2px solid rgba(255,255,255,0.5)' : 'none',
            borderRight: pos.endsWith('r') ? '2px solid rgba(255,255,255,0.5)' : 'none',
          }} />
        ))}

        {/* REC 표시 */}
        {stage === 'recording' && (
          <div style={{ position: 'absolute', top: 20, left: 52, display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(0,0,0,0.55)', padding: '5px 12px', borderRadius: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff3333', animation: 'recPulse 1.2s infinite' }} />
            <span style={{ color: '#ff3333', fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>REC</span>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginLeft: 4 }}>
              {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
            </span>
          </div>
        )}

        {/* 카운트다운 */}
        {stage === 'counting' && (
          <AnimatePresence mode="wait">
            <motion.div key={countdown}
              initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 140, fontWeight: 700, color: 'white', textShadow: '0 0 40px rgba(255,255,255,0.4)' }}
            >
              {countdown}
            </motion.div>
          </AnimatePresence>
        )}

        {/* 업로드 중 */}
        {stage === 'uploading' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', color: '#fffcdf', fontSize: 18 }}>
            업로드 중...
          </motion.div>
        )}

        {/* 셔터 버튼 */}
        {stage === 'idle' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, letterSpacing: 2 }}>CAMERA</span>
            <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }} onClick={prepareCamera}
              style={{ width: 76, height: 76, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'rgba(255,255,255,0.88)' }} />
            </motion.div>
          </div>
        )}

        {/* 녹화 중지 버튼 */}
        {stage === 'recording' && (
          <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)' }}>
            <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }} onClick={stopRecording}
              style={{ width: 76, height: 76, borderRadius: '50%', border: '3px solid rgba(255,80,80,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: '#ff3333' }} />
            </motion.div>
          </div>
        )}

        {/* 다시 촬영 */}
        {stage === 'done' && !showRetryConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }} onClick={() => setShowRetryConfirm(true)}
              style={{ width: 76, height: 76, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
              <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'rgba(255,255,255,0.88)' }} />
            </motion.div>
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, letterSpacing: 1 }}>다시 촬영</span>
          </motion.div>
        )}

        {/* 다시 촬영 확인 오버레이 */}
        <AnimatePresence>
          {showRetryConfirm && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, borderRadius: 28 }}>
              <span style={{ color: '#fffcdf', fontSize: 22, fontWeight: 300 }}>다시 촬영하시겠습니까?</span>
              <div style={{ display: 'flex', gap: 14 }}>
                <motion.button whileHover={{ background: 'rgba(255,255,255,0.14)' }}
                  onClick={() => setShowRetryConfirm(false)}
                  style={{ width: 130, height: 50, borderRadius: 50, fontSize: 17, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.08)', color: '#f2efe8', transition: 'all 0.2s' }}>
                  유지하기
                </motion.button>
                <motion.button whileHover={{ scale: 1.018 }}
                  onClick={() => { setShowRetryConfirm(false); retryVideo(); }}
                  style={{ width: 130, height: 50, borderRadius: 50, fontSize: 17, fontFamily: 'inherit', cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg,#e7cfa1,#cfa874)', color: '#2b1e10', transition: 'all 0.2s' }}>
                  다시 촬영하기
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      className="write-shell"
      initial="hidden" animate="show"
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      variants={container}
    >
      {/* 상단 로고 */}
      <motion.div className="top-title"
        variants={{ hidden: { opacity: 0, y: -10 }, show: { opacity: 1, y: 0, transition: { duration: 0.92, ease } } }}
      >
        <span className="to">Dear Me</span><span className="semicolon">;</span><span className="from">Dear You</span>
      </motion.div>

      {/* 돌아가기 */}
      <motion.button
        variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.88, ease } } }}
        onClick={() => navigate(-1)}
        className="back-link"
      >
        ← 돌아가기
      </motion.button>

      <div className="write-layout">

        {/* 제목 + 모드 토글 */}
        <motion.div variants={item} className="write-header">
          <div className="write-heading">
            편지 남기기
          </div>
          <div className="write-draft-actions">
            {draft && (
              <>
                <button type="button" onClick={() => applyDraft(draft)} disabled={draftSaving}>
                  초안 불러오기
                </button>
                <button type="button" onClick={deleteDraft} disabled={draftSaving}>
                  초안 삭제
                </button>
              </>
            )}
          </div>
          <div className="mode-tabs">
            {[
              { key: 'text', label: '글 편지', icon: 'text' },
              { key: 'video', label: '영상 편지', icon: 'video' },
              { key: 'draw', label: '그림 편지', icon: 'draw' },
            ].map(({ key, label, icon }) => (
              <button key={key} type="button" className="write-mode-button" onClick={() => handleModeSwitch(key)} style={{
                padding: '7px 18px', borderRadius: 50, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                border: '1px solid', transition: 'all 0.25s',
                borderColor: mode === key ? 'rgba(255,220,160,0.45)' : 'rgba(255,255,255,0.15)',
                background: mode === key ? 'rgba(72,56,41,0.75)' : 'rgba(255,255,255,0.05)',
                color: mode === key ? '#ffeacd' : 'rgba(255,252,223,0.4)',
                boxShadow: mode === key ? '0 0 8px rgba(255,220,160,0.12)' : 'none',
              }}>
                <WriteIcon name={icon} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* 모드 콘텐츠 */}
        <AnimatePresence mode="wait" initial={false}>
          {mode === 'text' ? (
            <motion.div key="text"
              initial={{ opacity: 0.82, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease }}
              className="write-stage write-stage-text"
              style={{ marginBottom: 20 }}
            >
              {/* 글 편지 입력 */}
              <div
                className={`write-paper write-paper-tone-${textBorderTone} ${showSig ? 'is-signing' : ''}`}
                onClick={() => document.getElementById('textInput')?.focus()}
              >
                <LetterTextarea
                  value={text}
                  onChange={handleTextChange}
                  placeholder="지금 전하고 싶은 마음을 천천히 기록해 주세요"
                />

                {/* 사진 담기 */}
                <div
                  className={`write-char-count ${text.length >= LETTER_CONTENT_MAX_LENGTH ? 'is-limit' : ''}`}
                  aria-live="polite"
                >
                  {text.length}/{LETTER_CONTENT_MAX_LENGTH}
                </div>

                <div className="write-tools-row">
                  <button onClick={imageUploading ? undefined : openPhotoCamera} disabled={imageUploading} className="write-tool-button-inline"
                    style={{ padding: '7px 18px', borderRadius: 50, fontSize: 13, fontFamily: 'inherit', cursor: imageUploading ? 'default' : 'pointer', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,252,223,0.65)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6, opacity: imageUploading ? 0.6 : 1 }}>
                    {imageUploading ? '업로드 중...' : (
                      <>
                        <WriteIcon name="camera" />
                        <span>사진 담기</span>
                      </>
                    )}
                  </button>
                  {imageUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <img src={imageUrl} style={{ height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)' }} />
                      <button onClick={() => setImageUrl('')} style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.7)', cursor: 'pointer', fontSize: 16 }}>×</button>
                    </div>
                  )}
                  <button onClick={() => setShowSig(s => !s)} className="write-tool-button-inline"
                    style={{ padding: '7px 18px', borderRadius: 50, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid', transition: 'all 0.2s', borderColor: showSig ? 'rgba(205,154,99,0.5)' : 'rgba(255,255,255,0.2)', background: showSig ? 'rgba(72,56,41,0.6)' : 'rgba(255,255,255,0.07)', color: showSig ? '#ffeacd' : 'rgba(255,252,223,0.65)' }}>
                    <WriteIcon name="signature" />
                    <span>{signatureData ? '서명 완료' : '서명 남기기'}</span>
                  </button>
                </div>

                {/* 서명 캔버스 */}
                <AnimatePresence>
                  {showSig && (
                    <motion.div
                      className="write-signature-drawer"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.25, ease }}
                      onClick={event => event.stopPropagation()}
                    >
                      <SignatureCanvas onSave={(data) => setSignatureData(data)} onClose={() => setShowSig(false)} existing={signatureData} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : mode === 'draw' ? (
            <motion.div key="draw"
              initial={{ opacity: 0.82, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease }}
              className="write-stage write-stage-draw"
              style={{ marginBottom: 20 }}
            >
              <DrawCanvas
                initialImageUrl={mode === 'draw' ? drawDraftImageUrl : ''}
                onHasDrawn={setDrawHasDrawn}
                onCanvasReady={setDrawCanvasEl}
                onCanvasChange={() => setDrawPreviewImageUrl('')}
              />
            </motion.div>
          ) : (
            cameraUI
          )}
        </AnimatePresence>

        {/* 저장 버튼 */}
        <motion.div variants={item} className="write-action-row">
          <button
            type="button"
            onClick={saveDraft}
            disabled={draftSaving || drawUploading || imageUploading}
            className="write-draft-save"
          >
            {draftSaving ? '저장 중...' : (
              <>
                <WriteIcon name="save" />
                <span>초안 저장</span>
              </>
            )}
          </button>
          <motion.button
            whileHover={{ scale: 1.018, boxShadow: '0 0 24px rgba(205,154,99,0.26), 0 18px 42px rgba(0,0,0,0.26)' }}
            onClick={handleFromMe}
            className="write-submit"
          >
            <WriteIcon name="send" />
            <span>편지 보내기</span>
          </motion.button>
        </motion.div>
      </div>

      {/* ── 카메라 촬영 모달 ── */}
      <AnimatePresence>
        {showCamera && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="photo-capture-overlay"
            style={{ position: 'fixed', inset: 0, background: 'rgba(3,3,3,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 110, gap: 24, transform: 'translateZ(0)', backfaceVisibility: 'hidden', willChange: 'opacity', isolation: 'isolate' }}
          >
            <div className="photo-capture-frame" style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', width: 480, aspectRatio: '4/3', background: '#000', transform: 'translateZ(0)', backfaceVisibility: 'hidden', contain: 'paint' }}>
              <video ref={photoVideoRef} autoPlay playsInline muted
                onLoadedMetadata={(event) => event.currentTarget.play?.().catch(() => {})}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'translateZ(0)', backfaceVisibility: 'hidden' }} />
              {/* 뷰파인더 코너 */}
              {['tl','tr','bl','br'].map(pos => (
                <div key={pos} style={{
                  position: 'absolute', width: 22, height: 22,
                  top: pos.startsWith('t') ? 18 : 'auto', bottom: pos.startsWith('b') ? 18 : 'auto',
                  left: pos.endsWith('l') ? 18 : 'auto', right: pos.endsWith('r') ? 18 : 'auto',
                  borderTop: pos.startsWith('t') ? '2px solid rgba(255,255,255,0.6)' : 'none',
                  borderBottom: pos.startsWith('b') ? '2px solid rgba(255,255,255,0.6)' : 'none',
                  borderLeft: pos.endsWith('l') ? '2px solid rgba(255,255,255,0.6)' : 'none',
                  borderRight: pos.endsWith('r') ? '2px solid rgba(255,255,255,0.6)' : 'none',
                }} />
              ))}
            </div>
            <div className="photo-capture-actions" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <button onClick={closePhotoCamera}
                style={{ padding: '10px 26px', borderRadius: 50, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,252,223,0.6)' }}>
                취소
              </button>
              <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={capturePhoto}
                style={{ width: 72, height: 72, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.9)' }} />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 저장 모달 ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          >
            <motion.div
              className={`write-modal-panel ${showEmailPreview ? 'has-email-preview' : ''}`}
              role="dialog"
              aria-label="편지 전송 설정"
              aria-modal="true"
              initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.4, ease }}
              style={{ background: 'rgba(30,40,55,0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 28, padding: '44px 52px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, minWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}
            >
              {/* 열람일 */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button type="button" onClick={() => setSendNow(false)}
                    style={{ padding: '10px 0', borderRadius: 12, border: '1px solid', borderColor: !sendNow ? 'rgba(255,220,160,0.5)' : 'rgba(255,255,255,0.2)', background: !sendNow ? 'rgba(72,56,41,0.75)' : 'rgba(255,255,255,0.06)', color: !sendNow ? '#ffeacd' : 'rgba(255,252,223,0.55)', fontFamily: 'inherit', cursor: 'pointer' }}>
                    예약 보내기
                  </button>
                  <button type="button" onClick={() => setSendNow(true)}
                    style={{ padding: '10px 0', borderRadius: 12, border: '1px solid', borderColor: sendNow ? 'rgba(255,220,160,0.5)' : 'rgba(255,255,255,0.2)', background: sendNow ? 'rgba(72,56,41,0.75)' : 'rgba(255,255,255,0.06)', color: sendNow ? '#ffeacd' : 'rgba(255,252,223,0.55)', fontFamily: 'inherit', cursor: 'pointer' }}>
                    바로 보내기
                  </button>
                </div>
                {sendNow ? (
                  <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', color: 'rgba(255,252,223,0.72)' }}>
                    이메일을 바로 보냅니다
                  </div>
                ) : (
                  <input type="date" min={tomorrow()} value={openDate} onChange={e => setOpenDate(e.target.value)} style={inputStyle} />
                )}
              </div>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={labelStyle}>편지 분위기</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { value: 'dark', label: '다크' },
                    { value: 'pink', label: '핑크' },
                  ].map(option => {
                    const selected = emailTheme === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setEmailTheme(option.value)}
                        style={{
                          padding: '10px 0',
                          borderRadius: 12,
                          border: '1px solid',
                          borderColor: selected ? 'rgba(255,220,160,0.5)' : 'rgba(255,255,255,0.2)',
                          background: selected
                            ? option.value === 'pink'
                              ? 'linear-gradient(135deg, rgba(192,99,135,0.78), rgba(90,54,92,0.78))'
                              : 'rgba(72,56,41,0.75)'
                            : 'rgba(255,255,255,0.06)',
                          color: selected ? '#ffeacd' : 'rgba(255,252,223,0.55)',
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={labelStyle}>
                  메일 제목 <span style={{ color: 'rgba(255,252,223,0.3)' }}>(선택)</span>
                </label>
                <input
                  type="text"
                  placeholder="비워 두시면 편지에 어울리는 제목으로 보내드립니다"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value.slice(0, LETTER_EMAIL_SUBJECT_MAX_LENGTH))}
                  maxLength={LETTER_EMAIL_SUBJECT_MAX_LENGTH}
                  style={inputStyle}
                />
                <div className={`write-subject-count ${emailSubject.length >= LETTER_EMAIL_SUBJECT_MAX_LENGTH ? 'is-limit' : ''}`}>
                  {emailSubject.length}/{LETTER_EMAIL_SUBJECT_MAX_LENGTH}
                </div>
              </div>

              {/* 수신인 토글 */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ val: false, label: '나에게' }, { val: true, label: '다른 분에게' }].map(({ val, label }) => (
                    <button key={String(val)} onClick={() => setToOther(val)}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 50, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid', transition: 'all 0.2s',
                        borderColor: toOther === val ? 'rgba(255,220,160,0.5)' : 'rgba(255,255,255,0.2)',
                        background: toOther === val ? 'rgba(72,56,41,0.75)' : 'rgba(255,255,255,0.06)',
                        color: toOther === val ? '#ffeacd' : 'rgba(255,252,223,0.5)',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>

                <AnimatePresence>
                  {toOther && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input type="text" placeholder="받을 사람 이름 (선택)" value={recipientName} onChange={e => setRecipientName(e.target.value)} style={inputStyle} />
                      <input type="email" placeholder="받을 사람 이메일 *" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} style={inputStyle} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {!toOther && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={labelStyle}>✉ 받을 이메일 <span style={{ color: 'rgba(255,252,223,0.3)' }}>(열람일에 자동 발송)</span></label>
                  <input
                    type="email"
                    placeholder="이메일 주소를 입력해 주세요"
                    value={accountEmail || email}
                    readOnly
                    aria-readonly="true"
                    onClick={showAccountEmailChangeNotice}
                    onFocus={showAccountEmailChangeNotice}
                    style={{ ...inputStyle, cursor: 'default', opacity: 0.82 }}
                  />
                </div>
              )}

              <section className={`write-email-preview ${emailTheme}`}>
                <label className={`write-email-preview-switch ${showEmailPreview ? 'is-open' : ''} ${emailPreviewLoading || drawUploading ? 'is-loading' : ''}`}>
                  <input
                    type="checkbox"
                    checked={showEmailPreview}
                    onChange={toggleEmailPreview}
                    disabled={emailPreviewLoading || drawUploading}
                    aria-label="이메일 미리보기"
                  />
                  <span className="write-email-preview-switch-copy">
                    <strong>이메일 미리보기</strong>
                    <em>{emailPreviewLoading || drawUploading ? '만드는 중' : '실제 발송 화면'}</em>
                  </span>
                  <span className="write-email-preview-switch-track" aria-hidden="true">
                    <span className="write-email-preview-switch-thumb" />
                  </span>
                </label>

                <AnimatePresence initial={false}>
                  {showEmailPreview && (
                    <motion.div
                      className="write-email-preview-frame-wrap"
                      initial={{ opacity: 0, height: 0, y: -6 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -6 }}
                      transition={{ duration: 0.24, ease }}
                    >
                      <div className="write-email-preview-toolbar">
                        <span>메일 제목</span>
                        <strong>{emailPreview.subject || '미리보기를 준비하고 있습니다'}</strong>
                      </div>

                      {emailPreviewError ? (
                        <div className="write-email-preview-message">{emailPreviewError}</div>
                      ) : (
                        <div
                          ref={emailPreviewFrameRef}
                          className="write-email-preview-frame"
                          style={{
                            '--email-preview-scale': emailPreviewScale,
                            height: emailPreviewLoading || drawUploading ? undefined : (emailPreviewFrameHeight || undefined),
                          }}
                        >
                          {emailPreviewLoading || drawUploading ? (
                            <div className="write-email-preview-message">이메일 화면을 만들고 있습니다...</div>
                          ) : (
                            <div className="write-email-preview-scale-box" style={{ height: emailPreviewHeight || undefined }}>
                              <div
                                ref={emailPreviewDocumentRef}
                                className="write-email-preview-document"
                                dangerouslySetInnerHTML={{ __html: emailPreview.html }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* 버튼 */}
              <div className="write-modal-actions">
                <motion.button whileHover={{ background: 'rgba(255,255,255,0.14)' }}
                  onClick={() => { setShowModal(false); setShowEmailPreview(false); }}
                  style={{ width: 170, height: 54, borderRadius: 50, fontSize: 20, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.07)', color: '#f2efe8', backdropFilter: 'blur(6px)', transition: 'all 0.3s' }}>
                  취소
                </motion.button>
                <motion.button whileHover={{ scale: 1.018, boxShadow: '0 0 24px rgba(231,207,161,.7)' }}
                  onClick={handleSave} disabled={saving}
                  style={{ width: 170, height: 54, borderRadius: 50, fontSize: 20, fontFamily: 'inherit', cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg, #e7cfa1, #cfa874)', color: '#2b1e10', boxShadow: '0 0 16px rgba(231,207,161,.4)', transition: 'all 0.3s', opacity: saving ? 0.6 : 1 }}>
                  {saving ? '전송 중...' : '전송하기'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <NoticeModal
        open={Boolean(notice)}
        title={notice?.title}
        message={notice?.message}
        onClose={() => setNotice(null)}
      />
    </motion.div>
  );
}

const inputStyle = {
  padding: '12px 18px', borderRadius: 14, width: '100%',
  border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)',
  color: '#fffcdf', fontSize: 15, fontFamily: 'inherit', outline: 'none',
  backdropFilter: 'blur(6px)', colorScheme: 'dark',
  transition: 'border-color 0.2s',
};
const labelStyle = { color: 'rgba(255,252,223,0.5)', fontSize: 13, paddingLeft: 4 };

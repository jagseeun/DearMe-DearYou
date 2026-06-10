import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import fixWebmDuration from 'fix-webm-duration';
import DrawCanvas from '../components/DrawCanvas.jsx';

const ease = [0.22, 1, 0.36, 1];
const container = { hidden: {}, show: { transition: { staggerChildren: 0.18 } } };
const item = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 1.2, ease } } };
const LETTER_CONTENT_MAX_LENGTH = 5000;
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
  if (!mime || !data) throw new Error('서명 이미지 형식이 올바르지 않습니다.');

  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function LetterTextarea({ value, onChange, placeholder }) {
  return (
    <textarea
      id="textInput"
      value={value}
      onChange={e => onChange(e.target.value)}
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

// ── 글자 하나씩 페이드인 텍스트 입력 컴포넌트 ──
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
      {/* 실제 textarea (투명 텍스트, 캐럿만 보임) */}
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
    setHasDrawn(true);
  }

  function onUp() {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasDrawn) {
      pendingData.current = canvasRef.current.toDataURL('image/png');
      setLocked(true);
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
    setHasDrawn(false);
    setLocked(false);
    onSave(null);
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
            서명 완료 후 확인을 눌러주세요
          </span>
        )}
        <button onClick={clear} style={sigBtnStyle}>지우기</button>
        <motion.button
          onClick={() => { if (hasDrawn && pendingData.current) { onSave(pendingData.current); onClose(); } }}
          disabled={!hasDrawn}
          whileHover={hasDrawn ? { translateY: -1 } : {}}
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
  const initialMode = ['text', 'video', 'draw'].includes(location.state?.mode)
    ? location.state.mode
    : 'text';
  const [mode, setMode] = useState(initialMode);
  const [text, setText] = useState('');

  // 영상 상태
  const [stage, setStage] = useState('idle');
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(30);
  const [videoUrl, setVideoUrl] = useState('');
  const [showRetryConfirm, setShowRetryConfirm] = useState(false);

  // 사진 촬영
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

  // 서명
  const [signatureData, setSignatureData] = useState(null);
  const [showSig, setShowSig] = useState(false);

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [openDate, setOpenDate] = useState(defaultOpenDate());
  const [sendNow, setSendNow] = useState(false);
  const [emailTheme, setEmailTheme] = useState('dark');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  // 수신인 (타인에게 보내기)
  const [toOther, setToOther] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [draft, setDraft] = useState(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const recordingStartedAtRef = useRef(0);
  const chunksRef = useRef([]);

  useEffect(() => {
    fetch('/get-user-info')
      .then(r => { if (r.status === 401) { navigate('/login'); return null; } return r.json(); })
      .then(d => { if (!d) return; if (d.email) setEmail(d.email); if (d.name) setName(d.name); })
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
    } catch { alert('카메라 권한을 허용해주세요.'); }
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
      if (blob.size > MAX_VIDEO_BYTES) throw new Error('영상 파일이 너무 큽니다. 다시 촬영해주세요.');
      const res = await fetch('/get-upload-url');
      if (!res.ok) throw new Error();
      const { uploadUrl, publicUrl } = await res.json();
      const put = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'video/webm' } });
      if (!put.ok) throw new Error();
      setVideoUrl(publicUrl);
      setStage('done');
    } catch {
      alert('업로드 실패. 다시 시도해주세요.');
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
    } catch { alert('카메라 권한을 허용해주세요.'); }
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
    } catch { alert('사진 업로드 실패. 다시 시도해주세요.'); }
    finally { setImageUploading(false); }
  }

  async function uploadSignature(dataUrl) {
    try {
      const res = await fetch('/get-image-upload-url?ext=png');
      if (!res.ok) throw new Error('서명 업로드 URL 발급에 실패했습니다.');
      const { uploadUrl, publicUrl } = await res.json();
      const blob = dataUrlToBlob(dataUrl);
      if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error('서명 이미지가 너무 큽니다.');
      const put = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/png' } });
      if (!put.ok) throw new Error('서명 업로드에 실패했습니다.');
      return publicUrl;
    } catch (err) {
      throw new Error(err.message || '서명 업로드에 실패했습니다.');
    }
  }

  async function uploadCanvas() {
    setDrawUploading(true);
    try {
      const canvas = drawCanvasEl;
      if (!canvas) throw new Error('canvas not ready');
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error('그림 이미지가 너무 큽니다.');
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
    setText(nextDraft.content || '');
    setVideoUrl(nextDraft.videoUrl || '');
    setImageUrl(nextMode === 'text' ? (nextDraft.imageUrl || '') : '');
    setDrawDraftImageUrl(nextMode === 'draw' ? (nextDraft.imageUrl || '') : '');
    setSignatureData(nextDraft.signatureData || null);
    setEmail(nextDraft.deliveryEmail || email);
    setEmailTheme(nextDraft.emailTheme || 'dark');
    setToOther(Boolean(nextDraft.toOther));
    setRecipientName(nextDraft.recipientName || '');
    setRecipientEmail(nextDraft.recipientEmail || '');
    setOpenDate(nextDraft.openDate ? new Date(nextDraft.openDate).toISOString().split('T')[0] : defaultOpenDate());
    setSendNow(false);
    setStage(nextMode === 'video' && nextDraft.videoUrl ? 'done' : 'idle');
    setDrawHasDrawn(Boolean(nextMode === 'draw' && nextDraft.imageUrl));
    setDraftMessage('임시저장을 불러왔어요.');
  }

  async function saveDraft() {
    setDraftSaving(true);
    setDraftMessage('');
    try {
      let draftImageUrl = mode === 'draw' ? (drawDraftImageUrl || undefined) : (imageUrl || undefined);
      if (mode === 'draw' && drawHasDrawn && drawCanvasEl) {
        draftImageUrl = await uploadCanvas();
      }

      const res = await fetch('/letter-draft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: mode,
          content: mode === 'text' ? text : '',
          videoUrl: mode === 'video' ? videoUrl || undefined : undefined,
          imageUrl: mode === 'text' ? imageUrl || undefined : mode === 'draw' ? draftImageUrl : undefined,
          signatureData: mode === 'text' ? signatureData || undefined : undefined,
          openDate,
          emailTheme,
          deliveryEmail: email.trim().toLowerCase(),
          toOther,
          recipientEmail: toOther ? recipientEmail.trim().toLowerCase() : '',
          recipientName: toOther ? recipientName.trim() : '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '임시저장에 실패했습니다.');
      setDraft(data.draft);
      setDraftMessage(data.message || '임시저장했습니다.');
    } catch (err) {
      setDraftMessage(err.message || '임시저장에 실패했습니다.');
    } finally {
      setDraftSaving(false);
    }
  }

  async function deleteDraft() {
    setDraftSaving(true);
    setDraftMessage('');
    try {
      const res = await fetch('/letter-draft', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '임시저장을 삭제하지 못했습니다.');
      setDraft(null);
      setDraftMessage(data.message || '임시저장을 삭제했습니다.');
    } catch (err) {
      setDraftMessage(err.message || '임시저장을 삭제하지 못했습니다.');
    } finally {
      setDraftSaving(false);
    }
  }

  async function handleFromMe() {
    if (mode === 'text' && !text.trim()) return alert('내용을 작성해주세요!');
    if (mode === 'video' && !videoUrl) return alert('먼저 영상을 촬영해주세요!');
    if (mode === 'draw' && !drawHasDrawn) return alert('그림을 그려주세요!');
    setShowModal(true);
  }

  async function handleSave() {
    if (!openDate) return alert('개봉일을 선택해주세요!');
    const cleanEmail = email.trim().toLowerCase();
    const cleanRecipientEmail = recipientEmail.trim().toLowerCase();
    const cleanRecipientName = recipientName.trim();
    const effectiveOpenDate = sendNow ? new Date().toISOString() : openDate;
    const isImmediateDelivery = sendNow || new Date(effectiveOpenDate) <= new Date();
    if (isImmediateDelivery && !toOther && !cleanEmail) return alert('바로 보내려면 발송 이메일을 입력해주세요.');
    if (text.length > LETTER_CONTENT_MAX_LENGTH) return alert(`내용은 ${LETTER_CONTENT_MAX_LENGTH}자를 넘을 수 없습니다.`);
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return alert('이메일 형식이 올바르지 않습니다.');
    if (toOther) {
      if (!cleanRecipientEmail) return alert('받는 사람 이메일을 입력해주세요.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanRecipientEmail)) return alert('받는 사람 이메일 형식이 올바르지 않습니다.');
      if (cleanRecipientName.length > RECIPIENT_NAME_MAX_LENGTH) return alert(`받는 사람 이름은 ${RECIPIENT_NAME_MAX_LENGTH}자를 넘을 수 없습니다.`);
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
        drawImageUrl = await uploadCanvas();
      }

      const body = {
        type: mode,
        content: mode === 'text' ? text : undefined,
        videoUrl: mode === 'video' ? videoUrl : undefined,
        imageUrl: mode === 'text' ? (imageUrl || undefined) : mode === 'draw' ? drawImageUrl : undefined,
        signatureData: mode === 'text' ? (finalSignature || undefined) : undefined,
        openDate: effectiveOpenDate,
        emailTheme,
        email: cleanEmail,
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
        if (isImmediateDelivery && data.delivery && data.delivery.sent === 0) {
          alert(data.delivery.message || '편지는 저장됐지만 이메일 발송은 실패했습니다. 관리자에서 다시 발송해주세요.');
        }
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
        alert(data.message || '오류가 발생했습니다.');
        if (res.status === 401) navigate('/login');
      }
    } catch (err) { alert(err.message || '서버 연결 오류'); }
    finally { setSaving(false); }
  }

  // ── 카메라 UI ──
  const cameraUI = (
    <motion.div key="camera"
      className="write-stage write-camera-stage"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
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
                  아니요
                </motion.button>
                <motion.button whileHover={{ translateY: -2 }}
                  onClick={() => { setShowRetryConfirm(false); retryVideo(); }}
                  style={{ width: 130, height: 50, borderRadius: 50, fontSize: 17, fontFamily: 'inherit', cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg,#e7cfa1,#cfa874)', color: '#2b1e10', transition: 'all 0.2s' }}>
                  예
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
        variants={{ hidden: { opacity: 0, y: -20 }, show: { opacity: 1, y: 0, transition: { duration: 1.4, ease } } }}
      >
        <span className="to">Dear Me</span><span className="semicolon">;</span><span className="from">Dear You</span>
      </motion.div>

      {/* 돌아가기 */}
      <motion.button
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 1, delay: 0.4 } } }}
        onClick={() => navigate(-1)}
        className="back-link"
      >
        ← 돌아가기
      </motion.button>

      <div className="write-layout">

        {/* 제목 + 모드 토글 */}
        <motion.div variants={item} className="write-header">
          <div className="write-heading">
            편지 쓰기
          </div>
          <div className="mode-tabs">
            {[
              { key: 'text', label: '✉ 텍스트' },
              { key: 'video', label: '🎥 영상' },
              { key: 'draw', label: '🎨 그림' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => handleModeSwitch(key)} style={{
                padding: '7px 18px', borderRadius: 50, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                border: '1px solid', transition: 'all 0.25s',
                borderColor: mode === key ? 'rgba(255,220,160,0.45)' : 'rgba(255,255,255,0.15)',
                background: mode === key ? 'rgba(72,56,41,0.75)' : 'rgba(255,255,255,0.05)',
                color: mode === key ? '#ffeacd' : 'rgba(255,252,223,0.4)',
                boxShadow: mode === key ? '0 0 8px rgba(255,220,160,0.12)' : 'none',
              }}>
                {label}
              </button>
            ))}
          </div>
          <div className="write-draft-actions">
            <button type="button" onClick={saveDraft} disabled={draftSaving || drawUploading}>
              {draftSaving ? '저장 중...' : '임시저장'}
            </button>
            {draft && (
              <>
                <button type="button" onClick={() => applyDraft(draft)} disabled={draftSaving}>
                  불러오기
                </button>
                <button type="button" onClick={deleteDraft} disabled={draftSaving}>
                  초안 삭제
                </button>
              </>
            )}
            {draftMessage && <span>{draftMessage}</span>}
          </div>
        </motion.div>

        {/* 모드 콘텐츠 */}
        <AnimatePresence mode="wait">
          {mode === 'text' ? (
            <motion.div key="text"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease }}
              className="write-stage write-stage-text"
              style={{ marginBottom: 20 }}
            >
              {/* 텍스트 입력 */}
              <div
                className="write-paper"
                onClick={() => document.getElementById('textInput')?.focus()}
              >
                <LetterTextarea
                  value={text}
                  onChange={setText}
                  placeholder="내년의 나에게 하고 싶은 말을 적어주세요"
                />
              </div>

              {/* 사진 촬영 */}
              <div className="write-tools-row">
                <button onClick={imageUploading ? undefined : openPhotoCamera} disabled={imageUploading}
                  style={{ padding: '7px 18px', borderRadius: 50, fontSize: 13, fontFamily: 'inherit', cursor: imageUploading ? 'default' : 'pointer', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,252,223,0.65)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6, opacity: imageUploading ? 0.6 : 1 }}>
                  {imageUploading ? '업로드 중...' : '📷 사진 촬영'}
                </button>
                {imageUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src={imageUrl} style={{ height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)' }} />
                    <button onClick={() => setImageUrl('')} style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.7)', cursor: 'pointer', fontSize: 16 }}>×</button>
                  </div>
                )}
                <button onClick={() => setShowSig(s => !s)}
                  style={{ padding: '7px 18px', borderRadius: 50, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid', transition: 'all 0.2s', borderColor: showSig ? 'rgba(205,154,99,0.5)' : 'rgba(255,255,255,0.2)', background: showSig ? 'rgba(72,56,41,0.6)' : 'rgba(255,255,255,0.07)', color: showSig ? '#ffeacd' : 'rgba(255,252,223,0.65)' }}>
                  ✍ 서명 {signatureData ? '✓' : ''}
                </button>
              </div>

              {/* 서명 캔버스 */}
              <AnimatePresence>
                {showSig && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                    <SignatureCanvas onSave={(data) => setSignatureData(data)} onClose={() => setShowSig(false)} existing={signatureData} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : mode === 'draw' ? (
            <motion.div key="draw"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease }}
              className="write-stage write-stage-draw"
              style={{ marginBottom: 20 }}
            >
              <DrawCanvas initialImageUrl={mode === 'draw' ? drawDraftImageUrl : ''} onHasDrawn={setDrawHasDrawn} onCanvasReady={setDrawCanvasEl} />
            </motion.div>
          ) : (
            cameraUI
          )}
        </AnimatePresence>

        {/* 저장 버튼 */}
        <motion.button variants={item} whileHover={{ translateY: -2, boxShadow: '0 0 28px rgba(232,194,138,0.32), 0 18px 42px rgba(0,0,0,0.24)' }} onClick={handleFromMe}
          className="write-submit">
          보내기
        </motion.button>
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
              className="write-modal-panel"
              initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.4, ease }}
              style={{ background: 'rgba(30,40,55,0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 28, padding: '44px 52px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, minWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}
            >
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={labelStyle}>메일 테마</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { value: 'dark', label: '다크', border: 'rgba(255,220,160,0.5)', bg: 'rgba(72,56,41,0.75)', color: '#ffeacd' },
                    { value: 'pink', label: '핑크', border: 'rgba(255,176,204,0.68)', bg: 'rgba(255,180,204,0.22)', color: '#ffd7e5' },
                  ].map(theme => {
                    const active = emailTheme === theme.value;
                    return (
                      <button
                        key={theme.value}
                        type="button"
                        onClick={() => setEmailTheme(theme.value)}
                        style={{
                          padding: '10px 0',
                          borderRadius: 12,
                          border: '1px solid',
                          borderColor: active ? theme.border : 'rgba(255,255,255,0.2)',
                          background: active ? theme.bg : 'rgba(255,255,255,0.06)',
                          color: active ? theme.color : 'rgba(255,252,223,0.55)',
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                        }}
                      >
                        {theme.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ order: -1, fontSize: 32, fontWeight: 400, color: '#e9dcc6', textShadow: '0 0 12px rgba(255,252,223,.3)' }}>
                편지를 저장하시겠습니까?
              </div>

              {/* 개봉일 */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={labelStyle}>📅 개봉일</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button type="button" onClick={() => setSendNow(false)}
                    style={{ padding: '10px 0', borderRadius: 12, border: '1px solid', borderColor: !sendNow ? 'rgba(255,220,160,0.5)' : 'rgba(255,255,255,0.2)', background: !sendNow ? 'rgba(72,56,41,0.75)' : 'rgba(255,255,255,0.06)', color: !sendNow ? '#ffeacd' : 'rgba(255,252,223,0.55)', fontFamily: 'inherit', cursor: 'pointer' }}>
                    예약 발송
                  </button>
                  <button type="button" onClick={() => setSendNow(true)}
                    style={{ padding: '10px 0', borderRadius: 12, border: '1px solid', borderColor: sendNow ? 'rgba(255,220,160,0.5)' : 'rgba(255,255,255,0.2)', background: sendNow ? 'rgba(72,56,41,0.75)' : 'rgba(255,255,255,0.06)', color: sendNow ? '#ffeacd' : 'rgba(255,252,223,0.55)', fontFamily: 'inherit', cursor: 'pointer' }}>
                    바로 보내기
                  </button>
                </div>
                {sendNow ? (
                  <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', color: 'rgba(255,252,223,0.72)' }}>
                    저장하면 바로 이메일을 발송합니다
                  </div>
                ) : (
                  <input type="date" min={tomorrow()} value={openDate} onChange={e => setOpenDate(e.target.value)} style={inputStyle} />
                )}
              </div>

              {/* 수신인 토글 */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={labelStyle}>📬 받는 사람</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ val: false, label: '나에게' }, { val: true, label: '다른 사람에게' }].map(({ val, label }) => (
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
                      <input type="text" placeholder="받는 사람 이름 (선택)" value={recipientName} onChange={e => setRecipientName(e.target.value)} style={inputStyle} />
                      <input type="email" placeholder="받는 사람 이메일 *" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} style={inputStyle} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 내 발송 이메일 */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={labelStyle}>✉ {toOther ? '내 이메일 (선택)' : '발송 이메일'} <span style={{ color: 'rgba(255,252,223,0.3)' }}>(개봉일에 자동 발송)</span></label>
                <input type="email" placeholder="이메일 주소" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
              </div>

              {/* 버튼 */}
              <div className="write-modal-actions">
                <motion.button whileHover={{ background: 'rgba(255,255,255,0.14)' }}
                  onClick={() => setShowModal(false)}
                  style={{ width: 170, height: 54, borderRadius: 50, fontSize: 20, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.07)', color: '#f2efe8', backdropFilter: 'blur(6px)', transition: 'all 0.3s' }}>
                  아니요
                </motion.button>
                <motion.button whileHover={{ translateY: -2, boxShadow: '0 0 24px rgba(231,207,161,.7)' }}
                  onClick={handleSave} disabled={saving}
                  style={{ width: 170, height: 54, borderRadius: 50, fontSize: 20, fontFamily: 'inherit', cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg, #e7cfa1, #cfa874)', color: '#2b1e10', boxShadow: '0 0 16px rgba(231,207,161,.4)', transition: 'all 0.3s', opacity: saving ? 0.6 : 1 }}>
                  {saving ? '저장 중...' : '저장'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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

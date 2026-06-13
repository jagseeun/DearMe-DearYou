import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import fixWebmDuration from 'fix-webm-duration';
import { formatDate, daysSince } from '../utils/dates.js';

const ease = [0.22, 1, 0.36, 1];
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

function waitForVideoReady(video) {
  return new Promise((resolve, reject) => {
    const done = () => resolve();
    const fail = () => reject(new Error('video load failed'));
    video.addEventListener('loadedmetadata', done, { once: true });
    video.addEventListener('error', fail, { once: true });
    if (video.readyState >= 1) resolve();
  });
}

async function fixRecordedWebmDuration(blob, durationMs) {
  if (!durationMs || durationMs <= 0) return blob;
  return fixWebmDuration(blob, durationMs, { logger: false }).catch(() => blob);
}

function waitForVideoEvent(video, eventName, timeout = 1200) {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, timeout);
    video.addEventListener(eventName, () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

async function getFiniteVideoDuration(video) {
  await waitForVideoReady(video);
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;

  const originalTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  try {
    video.currentTime = 60 * 60;
    await Promise.race([
      waitForVideoEvent(video, 'durationchange'),
      waitForVideoEvent(video, 'timeupdate'),
      waitForVideoEvent(video, 'seeked'),
    ]);
  } catch {}

  const discoveredDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
  try {
    video.currentTime = Math.min(originalTime, discoveredDuration || originalTime);
    await waitForVideoEvent(video, 'seeked', 500);
  } catch {}

  return discoveredDuration;
}

function drawCover(ctx, video, x, y, w, h, mirror = false) {
  const vw = video.videoWidth || w;
  const vh = video.videoHeight || h;
  const scale = Math.max(w / vw, h / vh);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (vw - sw) / 2;
  const sy = (vh - sh) / 2;

  ctx.save();
  if (mirror) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
  } else {
    ctx.drawImage(video, sx, sy, sw, sh, x, y, w, h);
  }
  ctx.restore();
}

async function createCombinedCallBlob(pastVideoUrl, presentBlob, name) {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 1280;
  const ctx = canvas.getContext('2d');
  const presentUrl = URL.createObjectURL(presentBlob);
  const audioContext = new AudioContext();
  const audioDestination = audioContext.createMediaStreamDestination();

  const pastVideo = document.createElement('video');
  pastVideo.crossOrigin = 'anonymous';
  pastVideo.src = pastVideoUrl;
  pastVideo.muted = false;
  pastVideo.playsInline = true;

  const presentVideo = document.createElement('video');
  presentVideo.src = presentUrl;
  presentVideo.muted = false;
  presentVideo.playsInline = true;

  try {
    await Promise.all([waitForVideoReady(pastVideo), waitForVideoReady(presentVideo)]);
    pastVideo.currentTime = 0;
    presentVideo.currentTime = 0;

    audioContext.createMediaElementSource(pastVideo).connect(audioDestination);
    audioContext.createMediaElementSource(presentVideo).connect(audioDestination);
    if (audioContext.state === 'suspended') await audioContext.resume();

    const canvasStream = canvas.captureStream(30);
    const stream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDestination.stream.getAudioTracks(),
    ]);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';
    await Promise.all([pastVideo.play(), presentVideo.play()]);

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    const duration = Math.min(
      Number.isFinite(presentVideo.duration) ? presentVideo.duration : 30,
      Number.isFinite(pastVideo.duration) ? pastVideo.duration : 30,
      120
    );
    const finished = new Promise(resolve => {
      recorder.ondataavailable = e => { if (e.data?.size > 0) chunks.push(e.data); };
      recorder.onstop = resolve;
    });

    recorder.start(500);
    const startedAt = performance.now();

    function drawFrame() {
      const elapsed = (performance.now() - startedAt) / 1000;
      ctx.fillStyle = '#050608';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawCover(ctx, pastVideo, 0, 0, 720, 640);
      drawCover(ctx, presentVideo, 0, 640, 720, 640, true);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(0, 638, 720, 4);

      if (elapsed >= duration || presentVideo.ended || pastVideo.ended) {
        recorder.stop();
        return;
      }
      requestAnimationFrame(drawFrame);
    }

    drawFrame();
    await finished;
    const rawBlob = new Blob(chunks, { type: 'video/webm' });
    return fixRecordedWebmDuration(rawBlob, Math.max(1, duration * 1000));
  } finally {
    pastVideo.pause();
    presentVideo.pause();
    audioContext.close();
    URL.revokeObjectURL(presentUrl);
  }
}

async function uploadVideoBlob(blob) {
  if (!blob || blob.size > MAX_VIDEO_BYTES) throw new Error('영상 파일이 너무 큽니다.');
  const res = await fetch('/get-upload-url');
  if (!res.ok) throw new Error('업로드 URL을 만들지 못했습니다.');
  const { uploadUrl, publicUrl } = await res.json();
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': 'video/webm' },
  });
  if (!put.ok) throw new Error('영상 업로드에 실패했습니다.');
  return publicUrl;
}

// ── 영상통화 수신 화면 ──
function CallIncoming({ name, openDate, onAnswer, onDecline }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(i => i + 1), 600);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      className="letter-view-root"
      style={{
        position: 'fixed', inset: 0, zIndex: 20,
        background: 'linear-gradient(to bottom, #0a1a0a 0%, #0d220d 40%, #0a1a0a 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* 수신 링 애니메이션 */}
      <div style={{ position: 'relative', marginBottom: 48 }}>
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            style={{
              position: 'absolute',
              width: 160, height: 160,
              borderRadius: '50%',
              border: '1px solid rgba(0,220,100,0.3)',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
            animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
            transition={{ duration: 2, delay: i * 0.65, repeat: Infinity, ease: 'easeOut' }}
          />
        ))}
        <div style={{
          width: 130, height: 130, borderRadius: '50%',
          background: 'linear-gradient(135deg, #1a3a1a, #0d2a0d)',
          border: '2px solid rgba(0,220,100,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 52, position: 'relative', zIndex: 2,
          boxShadow: '0 0 30px rgba(0,200,80,0.3)',
        }}>
          👤
        </div>
      </div>

      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, letterSpacing: 2, marginBottom: 10 }}>
        영상통화 수신 중
      </div>
      <div style={{ color: '#fff', fontSize: 32, fontWeight: 300, marginBottom: 8 }}>
        {formatDate(openDate)}의 나
      </div>
      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 15, marginBottom: 60 }}>
        먼저 도착한 영상
        {['.', '..', '...'][tick % 3]}
      </div>

      {/* 수락 / 거절 버튼 */}
      <div style={{ display: 'flex', gap: 60 }}>
        {/* 거절 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <motion.div
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={onDecline}
            style={{ width: 72, height: 72, borderRadius: '50%', background: '#c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 28, boxShadow: '0 4px 20px rgba(192,57,43,0.4)' }}>
            📵
          </motion.div>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>거절</span>
        </div>
        {/* 수락 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <motion.div
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={onAnswer}
            style={{ width: 72, height: 72, borderRadius: '50%', background: '#27ae60', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 28, boxShadow: '0 4px 20px rgba(39,174,96,0.4)', animation: 'callPulse 1.2s infinite' }}>
            📱
          </motion.div>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>수락</span>
        </div>
      </div>
    </motion.div>
  );
}


// ── 영상통화 통화 화면 ──
function CallActive({ letter, name, onHangup }) {
  const pastVideoRef  = useRef(null);
  const presentVideoRef = useRef(null);
  const streamRef     = useRef(null);
  const recorderRef   = useRef(null);
  const recordingStartedAtRef = useRef(0);
  const chunksRef     = useRef([]);

  const [elapsed, setElapsed]       = useState(0);
  const [phase, setPhase]           = useState('call'); // 'call' | 'confirm'
  const [presentBlob, setPresentBlob] = useState(null);
  const [email, setEmail]           = useState('');
  const [uploading, setUploading]   = useState(false);
  const [sendMsg, setSendMsg]       = useState('');
  const [camOk, setCamOk]           = useState(false);

  // 이메일 미리 채우기
  useEffect(() => {
    fetch('/get-user-info').then(r => r.json()).then(d => { if (d.email) setEmail(d.email); }).catch(() => {});
  }, []);

  // 카메라 + 녹화 시작
  useEffect(() => {
    async function startCam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (presentVideoRef.current) presentVideoRef.current.srcObject = stream;
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus' : 'video/webm';
        const recorder = new MediaRecorder(stream, { mimeType });
        recorderRef.current = recorder;
        chunksRef.current = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recordingStartedAtRef.current = Date.now();
        recorder.start(500);
        setCamOk(true);
      } catch (err) { console.warn('카메라 접근 실패:', err); }
    }
    startCam();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  // 과거 영상 자동 재생
  useEffect(() => { pastVideoRef.current?.play(); }, []);

  // 타이머
  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);


  async function hangup() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      await new Promise(resolve => { recorder.onstop = resolve; recorder.stop(); });
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (chunksRef.current.length > 0) {
      const rawBlob = new Blob(chunksRef.current, { type: 'video/webm' });
      const durationMs = Math.max(1, Date.now() - recordingStartedAtRef.current);
      setPresentBlob(await fixRecordedWebmDuration(rawBlob, durationMs));
    }
    setPhase('confirm');
  }

  async function handleSend() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSendMsg('이메일 형식을 확인해 주세요.'); return;
    }
    setUploading(true); setSendMsg('');
    try {
      let presentVideoUrl = '';
      let compositeVideoUrl = '';
      if (presentBlob) {
        setSendMsg('통화 화면을 영상 하나로 저장하는 중...');
        try {
          const compositeBlob = await createCombinedCallBlob(letter.videoUrl, presentBlob, name);
          compositeVideoUrl = await uploadVideoBlob(compositeBlob);
        } catch (err) {
          console.warn('combined call export failed:', err);
        }
        setSendMsg('현재 영상을 저장하는 중...');
        presentVideoUrl = await uploadVideoBlob(presentBlob);
      }
      await fetch('/send-call-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ letterId: letter.id, presentVideoUrl, compositeVideoUrl, email }),
      }).then(r => r.json()).then(d => { if (d.message) throw new Error(d.message); return d; });
        setSendMsg('이메일 발송 요청이 접수되었습니다.');
      setTimeout(onHangup, 1500);
    } catch (err) {
      setSendMsg(err.message || '발송 실패');
    } finally { setUploading(false); }
  }

  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const secs = String(elapsed % 60).padStart(2, '0');
  const daysAgo = daysSince(letter.createdAt);

  // ── 이메일 확인 화면 ──
  if (phase === 'confirm') {
    return (
      <motion.div key="confirm"
        style={{ position: 'fixed', inset: 0, zIndex: 20, background: '#0a0a12', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
        <div style={{ fontSize: 32, fontWeight: 300, color: '#fff' }}>통화가 종료되었습니다</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, textAlign: 'center', lineHeight: 1.9 }}>
          과거와 현재의 영상을 함께 이메일로 보내드릴게요.<br/>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>이메일 주소를 확인해 주세요</span>
        </div>
        <input
          value={email} onChange={e => { setEmail(e.target.value); setSendMsg(''); }}
          placeholder="이메일 주소"
          style={{ padding: '14px 24px', borderRadius: 50, width: 360, fontSize: 16, fontFamily: 'inherit', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', outline: 'none', textAlign: 'center' }}
        />
        {sendMsg && (
          <div style={{ fontSize: 14, color: sendMsg.includes('됐') ? '#81c784' : '#ff8a80' }}>{sendMsg}</div>
        )}
        <div style={{ display: 'flex', gap: 16 }}>
          <motion.button whileHover={{ background: 'rgba(255,255,255,0.1)' }} onClick={onHangup}
            style={{ padding: '14px 32px', borderRadius: 50, fontSize: 16, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', transition: 'all 0.2s' }}>
            건너뛰기
          </motion.button>
          <motion.button whileHover={{ translateY: -2 }} onClick={handleSend} disabled={uploading}
            style={{ padding: '14px 40px', borderRadius: 50, fontSize: 16, fontFamily: 'inherit', cursor: uploading ? 'default' : 'pointer', background: 'linear-gradient(135deg,#e7cfa1,#cfa874)', border: 'none', color: '#2b1e10', fontWeight: 600, opacity: uploading ? 0.6 : 1, transition: 'all 0.25s' }}>
            {uploading ? '업로드 중…' : '✉ 이메일로 받기'}
          </motion.button>
        </div>
      </motion.div>
    );
  }

  // ── 통화 화면 ──
  return (
    <motion.div
      style={{ position: 'fixed', inset: 0, zIndex: 20, background: '#000', display: 'flex', flexDirection: 'column' }}
      initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* 상태바 */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, background: 'linear-gradient(to bottom,rgba(0,0,0,0.7),transparent)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#27ae60', boxShadow: '0 0 6px #27ae60' }} />
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 300 }}>영상통화 중</span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{mins}:{secs}</span>
      </div>

      {/* 위: 과거의 나 */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderBottom: '1.5px solid #111' }}>
        <video ref={pastVideoRef} src={letter.videoUrl} playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onEnded={hangup} />
        {/* 이름 태그 */}
        <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: '6px 16px' }}>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 300 }}>
            {daysAgo}일 전의 {name}
          </span>
        </div>

      </div>

      {/* 아래: 현재의 나 */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0a0a0a' }}>
        {camOk
          ? <video ref={presentVideoRef} autoPlay playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>카메라 권한을 허용해 주세요</div>
        }
        {/* 이름 태그 */}
        <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: '6px 16px' }}>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 300 }}>지금 남기는 영상</span>
        </div>
        {/* REC 표시 */}
        {camOk && (
          <div style={{ position: 'absolute', top: 14, right: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#e74c3c', animation: 'recPulse 1.2s infinite' }} />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: 1 }}>REC</span>
          </div>
        )}

        {/* 통화 종료 버튼 */}
        <div style={{ position: 'absolute', bottom: 20, right: 20 }}>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={hangup}
            style={{ width: 56, height: 56, borderRadius: '50%', background: '#c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 22, boxShadow: '0 4px 20px rgba(192,57,43,0.6)' }}>
            📵
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function LegacySavedCallView({ letter, name, returnTo }) {
  const navigate = useNavigate();
  const savedDate = letter.callReplySentAt ? `${formatDate(letter.callReplySentAt)} 저장` : '저장 완료';
  const hasComposite = Boolean(letter.callCompositeVideoUrl);

  return (
    <motion.div
      key="saved-call"
      style={{
        position: 'absolute',
        inset: 0,
        padding: '74px 5vw 28px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
    >
      <motion.div
        className="top-title"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, ease }}
      >
        <span style={{ color: '#fff', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.4))' }}>Dear Me</span>
        <span style={{ color: 'rgba(255,255,255,0.6)', margin: '0 10px' }}> ; </span>
        <span style={{ color: '#5a3e33' }}>Dear You</span>
      </motion.div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#7a4545', fontSize: 13, letterSpacing: 2, marginBottom: 8 }}>통화 기록</div>
        <div style={{ color: '#2e1414', fontSize: 28, fontWeight: 300 }}>그날의 나와 지금의 내가 만났습니다</div>
        <div style={{ color: '#8a5252', fontSize: 14, marginTop: 8 }}>
          이 편지는 다시 울리지 않으며, 남겨진 영상으로만 열람됩니다.
        </div>
        <div style={{ color: '#b07878', fontSize: 12, marginTop: 10 }}>{savedDate}</div>
      </div>

      {hasComposite ? (
        <div style={{ height: 'min(68vh, 820px)', aspectRatio: '9 / 16', maxWidth: '92vw', background: '#111', border: '1px solid rgba(150,80,80,0.16)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 16px 44px rgba(120,50,50,0.16)' }}>
          <video src={letter.callCompositeVideoUrl} controls playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#111' }} />
        </div>
      ) : (
        <div style={{
          width: 'min(1120px, 94vw)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
        }}>
          <div style={{ background: 'rgba(255,250,248,0.68)', border: '1px solid rgba(150,80,80,0.16)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 12px 36px rgba(120,50,50,0.12)' }}>
            <div style={{ padding: '12px 16px', color: '#7a4545', fontSize: 13 }}>처음 남긴 영상</div>
            <video src={letter.videoUrl} controls playsInline style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block', background: '#111' }} />
          </div>
          <div style={{ background: 'rgba(255,250,248,0.68)', border: '1px solid rgba(150,80,80,0.16)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 12px 36px rgba(120,50,50,0.12)' }}>
            <div style={{ padding: '12px 16px', color: '#7a4545', fontSize: 13 }}>오늘 남긴 영상</div>
            <video src={letter.callReplyVideoUrl} controls playsInline style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block', background: '#111' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <motion.button whileHover={{ translateY: -2 }} onClick={() => navigate(returnTo || '/letters')}
          style={{ padding: '12px 28px', borderRadius: 14, border: '1px solid rgba(150,80,80,0.25)', background: 'rgba(255,255,255,0.35)', color: '#7a4545', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer' }}>
          편지 목록
        </motion.button>
        <motion.button whileHover={{ translateY: -2 }} onClick={() => navigate('/')}
          style={{ padding: '12px 28px', borderRadius: 14, border: '1px solid rgba(180,110,110,0.28)', background: 'rgba(255,255,255,0.48)', color: '#5a2828', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer' }}>
          처음으로
        </motion.button>
      </div>
    </motion.div>
  );
}

function SavedCallView({ letter, returnTo }) {
  const navigate = useNavigate();
  const pastVideoRef = useRef(null);
  const presentVideoRef = useRef(null);
  const playbackWatchRef = useRef(null);
  const playbackStopTimerRef = useRef(null);
  const playbackIntervalRef = useRef(null);
  const playbackLimitRef = useRef(null);
  const playingRef = useRef(false);
  const stoppingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [pastEnded, setPastEnded] = useState(false);
  const [presentEnded, setPresentEnded] = useState(false);
  const savedDate = letter.callReplySentAt ? `${formatDate(letter.callReplySentAt)} 저장` : '저장된 통화';

  useEffect(() => {
    return () => {
      clearPlaybackGuards();
    };
  }, []);

  function isAtEnd(video) {
    const duration = Number(video.dataset.duration || video.duration);
    return video.ended || (Number.isFinite(duration) && duration > 0 && video.currentTime >= duration - 0.18);
  }

  function clearPlaybackGuards() {
    if (playbackWatchRef.current) {
      cancelAnimationFrame(playbackWatchRef.current);
      playbackWatchRef.current = null;
    }
    if (playbackStopTimerRef.current) {
      clearTimeout(playbackStopTimerRef.current);
      playbackStopTimerRef.current = null;
    }
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
  }

  function setPlaybackState(value) {
    playingRef.current = value;
    setPlaying(value);
  }

  function stopBoth(resetToStart = false) {
    clearPlaybackGuards();
    stoppingRef.current = true;
    pastVideoRef.current?.pause();
    presentVideoRef.current?.pause();
    if (resetToStart) {
      if (pastVideoRef.current) pastVideoRef.current.currentTime = 0;
      if (presentVideoRef.current) presentVideoRef.current.currentTime = 0;
      playbackLimitRef.current = null;
    } else if (playbackLimitRef.current) {
      const { pastStopAt, presentStopAt } = playbackLimitRef.current;
      if (pastVideoRef.current && Number.isFinite(pastStopAt)) pastVideoRef.current.currentTime = pastStopAt;
      if (presentVideoRef.current && Number.isFinite(presentStopAt)) presentVideoRef.current.currentTime = presentStopAt;
      playbackLimitRef.current = null;
    }
    setPlaybackState(false);
    requestAnimationFrame(() => {
      stoppingRef.current = false;
    });
  }

  function watchPlaybackEnd() {
    const past = pastVideoRef.current;
    const present = presentVideoRef.current;
    if (!past || !present) return;
    if (!playingRef.current) return;

    if (isAtEnd(past) || isAtEnd(present)) {
      stopBoth(true);
      return;
    }

    playbackWatchRef.current = requestAnimationFrame(watchPlaybackEnd);
  }

  function startPlaybackGuards() {
    clearPlaybackGuards();
    const past = pastVideoRef.current;
    const present = presentVideoRef.current;
    if (!past || !present) return;

    const pastDuration = Number(past.dataset.duration || past.duration);
    const presentDuration = Number(present.dataset.duration || present.duration);
    const pastRemaining = Number.isFinite(pastDuration) && pastDuration > 0
      ? Math.max(0, pastDuration - past.currentTime)
      : 0;
    const presentRemaining = Number.isFinite(presentDuration) && presentDuration > 0
      ? Math.max(0, presentDuration - present.currentTime)
      : 0;
    const sharedSeconds = Math.min(pastRemaining, presentRemaining);

    if (sharedSeconds > 0) {
      const startedAt = performance.now();
      const pastStartedAt = past.currentTime;
      const presentStartedAt = present.currentTime;
      playbackLimitRef.current = {
        startedAt,
        sharedSeconds,
        pastStopAt: Math.min(pastDuration, pastStartedAt + sharedSeconds),
        presentStopAt: Math.min(presentDuration, presentStartedAt + sharedSeconds),
      };

      const stopAfterMs = Math.max(0, sharedSeconds * 1000);
      playbackStopTimerRef.current = setTimeout(() => stopBoth(true), stopAfterMs);
      playbackIntervalRef.current = setInterval(() => {
        const limit = playbackLimitRef.current;
        if (!limit || !playingRef.current) return;
        const elapsed = (performance.now() - limit.startedAt) / 1000;
        if (
          elapsed >= limit.sharedSeconds ||
          past.currentTime >= limit.pastStopAt - 0.04 ||
          present.currentTime >= limit.presentStopAt - 0.04 ||
          past.ended ||
          present.ended
        ) {
          stopBoth(true);
        }
      }, 40);
    }

    playbackWatchRef.current = requestAnimationFrame(watchPlaybackEnd);
  }

  async function togglePlayback() {
    const past = pastVideoRef.current;
    const present = presentVideoRef.current;
    if (!past || !present) return;

    if (playing) {
      clearPlaybackGuards();
      past.pause();
      present.pause();
      setPlaybackState(false);
      return;
    }

    clearPlaybackGuards();
    past.pause();
    present.pause();
    past.currentTime = 0;
    present.currentTime = 0;
    setPastEnded(false);
    setPresentEnded(false);

    try {
      await Promise.all([waitForVideoReady(past), waitForVideoReady(present)]);
      await Promise.all([past.play(), present.play()]);
      setPlaybackState(true);
    } catch {
      past.pause();
      present.pause();
      setPlaybackState(false);
    }
  }

  function syncPause() {
    const past = pastVideoRef.current;
    const present = presentVideoRef.current;
    if (!past || !present) return;
    if (stoppingRef.current) return;
    if (playingRef.current) {
      stopBoth(true);
      return;
    }
    if (past.paused && present.paused) setPlaybackState(false);
  }

  function handleEnded() {
    stopBoth(true);
  }

  function handlePaneEnded(side) {
    const past = pastVideoRef.current;
    const present = presentVideoRef.current;

    if (side === 'past') {
      past?.pause();
      setPastEnded(true);
      if (present?.ended || presentEnded) setPlaybackState(false);
      return;
    }

    present?.pause();
    setPresentEnded(true);
    if (past?.ended || pastEnded) setPlaybackState(false);
  }

  function stopIfEitherEnded() {
    const past = pastVideoRef.current;
    const present = presentVideoRef.current;
    if (!past || !present) return;
    if (isAtEnd(past) || isAtEnd(present)) stopBoth(true);
  }

  return (
    <motion.div
      key="saved-call"
      style={{
        position: 'absolute',
        inset: 0,
        padding: '72px 5vw 28px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
    >
      <motion.div
        className="top-title"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, ease }}
      >
        <span style={{ color: '#fff', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.4))' }}>Dear Me</span>
        <span style={{ color: 'rgba(255,255,255,0.6)', margin: '0 10px' }}> ; </span>
        <span style={{ color: '#5a3e33' }}>Dear You</span>
      </motion.div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#2e1414', fontSize: 24, fontWeight: 300 }}>남겨진 통화</div>
        <div style={{ color: '#8a5252', fontSize: 12, marginTop: 6 }}>{savedDate}</div>
      </div>

      <div
        style={{
          position: 'relative',
          width: 'min(880px, 94vw)',
          height: 'min(76vh, 760px)',
          minHeight: 'min(560px, 70vh)',
          background: '#050505',
          borderRadius: 20,
          overflow: 'hidden',
          border: '1px solid rgba(150,80,80,0.16)',
          boxShadow: '0 18px 48px rgba(80,30,30,0.18)',
        }}
      >
        <div style={{ position: 'relative', height: '50%', borderBottom: '2px solid rgba(255,255,255,0.12)', background: '#050505' }}>
          <video
            ref={pastVideoRef}
            src={letter.videoUrl}
            playsInline
            preload="metadata"
            onEnded={() => handlePaneEnded('past')}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          {pastEnded && (
            <div style={{ position: 'absolute', inset: 0, background: '#000' }} />
          )}
        </div>

        <div style={{ position: 'relative', height: '50%', background: '#050505' }}>
          <video
            ref={presentVideoRef}
            src={letter.callReplyVideoUrl}
            playsInline
            preload="metadata"
            onEnded={() => handlePaneEnded('present')}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }}
          />
          {presentEnded && (
            <div style={{ position: 'absolute', inset: 0, background: '#000' }} />
          )}
        </div>

        <button
          type="button"
          onClick={togglePlayback}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 72,
            height: 72,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.35)',
            background: playing ? 'rgba(20,20,20,0.58)' : 'rgba(255,255,255,0.82)',
            color: playing ? '#fff' : '#4b2626',
            fontSize: 28,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
            backdropFilter: 'blur(10px)',
          }}
          aria-label={playing ? '일시정지' : '재생'}
        >
          {playing ? 'Ⅱ' : '▶'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <motion.button whileHover={{ translateY: -2 }} onClick={() => navigate(returnTo || '/letters')}
          style={{ padding: '12px 28px', borderRadius: 14, border: '1px solid rgba(150,80,80,0.25)', background: 'rgba(255,255,255,0.35)', color: '#7a4545', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer' }}>
          편지 목록
        </motion.button>
        <motion.button whileHover={{ translateY: -2 }} onClick={() => navigate('/')}
          style={{ padding: '12px 28px', borderRadius: 14, border: '1px solid rgba(180,110,110,0.28)', background: 'rgba(255,255,255,0.48)', color: '#5a2828', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer' }}>
          처음으로
        </motion.button>
      </div>
    </motion.div>
  );
}

export default function LetterViewPage() {
  const navigate = useNavigate();
  const { letter, name, returnTo } = useLocation().state || {};
  const [phase, setPhase] = useState('envelope');

  if (!letter) { navigate('/login', { replace: true }); return null; }
  if (letter.locked) { navigate(returnTo || '/letters', { replace: true }); return null; }
  if (letter.type === 'call') { navigate(returnTo || '/letters', { replace: true }); return null; }

  const isPink = letter.emailTheme === 'pink' || returnTo === '/pink-letters';
  const d = daysSince(letter.openDate);
  const dChars = ['D', '+', ...String(d).split('')];
  const senderName = letter.senderName || name || '나';
  const recipientName = letter.recipientName || (letter.mailbox === 'received' ? name : '') || name || '나';

  // 핑크 테마 색상 시스템
  const textMain        = isPink ? '#fff1e8'                  : '#fff1f2';
  const textSub         = isPink ? 'rgba(241,205,213,0.86)'   : 'rgba(241,205,224,0.72)';
  const textHint        = isPink ? 'rgba(232,190,202,0.76)'   : 'rgba(232,190,216,0.66)';
  const textBtn         = isPink ? '#fff1e8'                  : '#fff0f6';
  const btnBg           = isPink ? 'linear-gradient(135deg, rgba(138,74,104,0.82), rgba(72,42,76,0.82)), rgba(232,190,202,0.1)' : 'linear-gradient(135deg, rgba(146,74,126,0.84), rgba(86,50,104,0.8)), rgba(232,190,216,0.1)';
  const btnBorder       = isPink ? '1px solid rgba(244,211,218,0.38)'        : '1px solid rgba(244,190,218,0.34)';
  const backColor       = isPink ? 'rgba(255,239,232,0.9)'    : 'rgba(255,236,246,0.88)';
  const backBg          = isPink ? 'linear-gradient(135deg, rgba(88,50,84,0.72), rgba(47,29,50,0.68)), rgba(232,190,202,0.08)' : 'linear-gradient(135deg, rgba(94,54,106,0.62), rgba(62,39,78,0.58)), rgba(232,190,216,0.09)';
  const backBorder      = isPink ? '1px solid rgba(232,190,202,0.3)'         : '1px solid rgba(232,190,216,0.26)';
  const dividerBg       = isPink ? 'rgba(232,190,202,0.2)'    : 'rgba(232,190,216,0.2)';
  const sidebarBg       = isPink ? 'linear-gradient(to bottom, rgba(255,241,232,0.12), rgba(128,86,134,0.16)), rgba(42,27,43,0.46)' : 'linear-gradient(to bottom, rgba(170,95,142,0.28), rgba(48,28,64,0.76))';
  const sidebarBorder   = isPink ? '1px solid rgba(232,190,202,0.22)'        : '1px solid rgba(232,190,216,0.2)';
  const letterBoxBg     = isPink ? 'linear-gradient(135deg, rgba(255,241,232,0.12), rgba(218,157,176,0.09) 56%, rgba(128,86,134,0.08)), rgba(42,27,43,0.5)' : 'linear-gradient(135deg, rgba(255,220,232,0.09), rgba(156,108,174,0.08)), rgba(40,23,52,0.48)';
  const letterBoxBorder = isPink ? '1px solid rgba(232,190,202,0.24)'        : '1px solid rgba(232,190,216,0.25)';

  const btnStyle = {
    padding: '14px 56px', borderRadius: 50,
    border: btnBorder, background: btnBg,
    color: textBtn, fontSize: 17, fontFamily: 'inherit', cursor: 'pointer',
    boxShadow: isPink ? '0 0 28px rgba(218,157,176,0.2), 0 16px 38px rgba(21,12,25,0.32), inset 0 1px 0 rgba(255,255,255,0.18)' : '0 0 26px rgba(218,157,196,0.17), 0 16px 38px rgba(21,12,30,0.28), inset 0 1px 0 rgba(255,255,255,0.14)',
    backdropFilter: 'blur(24px)', whiteSpace: 'nowrap',
    transition: 'all 0.3s cubic-bezier(0.22,1,0.36,1)',
    letterSpacing: 0,
    textShadow: isPink ? '0 1px 7px rgba(24,13,28,0.42)' : '0 1px 7px rgba(24,13,34,0.4)',
  };

  const backBtnStyle = {
    position: 'absolute', top: 28, left: 36, zIndex: 10,
    padding: '8px 20px', borderRadius: 50, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
    border: backBorder, background: backBg, color: backColor,
    backdropFilter: 'blur(18px)', transition: 'all 0.25s',
    boxShadow: isPink ? '0 0 22px rgba(218,157,176,0.14), 0 12px 28px rgba(21,12,25,0.24)' : '0 0 20px rgba(218,157,196,0.12), 0 12px 28px rgba(21,12,30,0.24)',
    textShadow: isPink ? '0 1px 7px rgba(24,13,28,0.38)' : '0 1px 7px rgba(24,13,34,0.36)',
  };

  return (
    <motion.div
      className={`letter-view-root letter-view-${letter.type} letter-view-phase-${phase} ${isPink ? 'pink-letter-view' : ''}`.trim()}
      style={{
        position: 'fixed', inset: 0, zIndex: 10, width: '100%', height: '100vh',
        background: isPink ? 'linear-gradient(180deg, rgba(255,241,232,0.035), rgba(218,157,176,0.04))' : undefined,
      }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      <AnimatePresence mode="sync">

        {/* ── 봉투 화면 ── */}
        {phase === 'envelope' && (
          <motion.div key="envelope" style={{ position: 'absolute', inset: 0 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}>

            <motion.div className="top-title"
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease }}>
              {isPink ? (<>
                <span style={{ color: '#fff1e8', filter: 'drop-shadow(0 0 18px rgba(218,157,176,0.34)) drop-shadow(0 2px 8px rgba(24,13,28,0.42))' }}>Dear Me</span>
                <span style={{ color: 'rgba(241,205,213,0.62)', margin: '0 10px' }}>;</span>
                <span style={{ color: '#e0a4b0', filter: 'drop-shadow(0 0 14px rgba(160,93,122,0.32)) drop-shadow(0 2px 8px rgba(24,13,28,0.38))' }}>Dear You</span>
              </>) : (<>
                <span className="to">Dear Me</span>
                <span className="semicolon">;</span>
                <span className="from">Dear You</span>
              </>)}
            </motion.div>

            <motion.button
              className="letter-view-back"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              onClick={() => navigate(returnTo || -1)}
              style={backBtnStyle}
            >
              ← 목록
            </motion.button>

            <div className="letter-envelope-stage">

              <motion.div
                className="letter-envelope-info letter-from"
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.15, ease }}>
                <div className="letter-envelope-label" style={{ color: textHint }}>보낸 날</div>
                <div className="letter-envelope-value">
                  <span>{formatDate(letter.createdAt)}</span>
                  <small className="letter-envelope-person">보낸 사람 {senderName}</small>
                </div>
              </motion.div>

              <div className="letter-envelope-divider" style={{ background: dividerBg }} />

              <motion.div
                className="letter-envelope-info letter-to"
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.22, ease }}>
                <div className="letter-envelope-label" style={{ color: textHint }}>열린 날</div>
                <div className="letter-envelope-value">
                  <span>{formatDate(letter.openDate)}</span>
                  <small className="letter-envelope-person">받는 사람 {recipientName}</small>
                </div>
              </motion.div>

              {/* D+0 사이드바 */}
              <motion.div
                className="letter-day-sidebar"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.3, ease }}
                style={{
                  position: 'absolute', right: 0, top: 0, width: 96, height: '100%',
                  background: sidebarBg,
                  borderTopLeftRadius: 36, borderBottomLeftRadius: 36,
                  backdropFilter: 'blur(20px)',
                  border: sidebarBorder, borderRight: 'none',
                  display: 'flex', flexDirection: 'column',
                  justifyContent: 'center', alignItems: 'center', gap: 12,
                }}>
                {dChars.map((ch, i) => (
                  <div key={i} style={{ fontSize: 27, fontWeight: 300, color: textSub, lineHeight: 1.1 }}>{ch}</div>
                ))}
              </motion.div>

              <div className="letter-mobile-day">D+{d}</div>

              <motion.button
                className="letter-view-button letter-open-button"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5, ease }}
                onClick={() => setPhase('content')}
                whileHover={{ translateY: -2 }}
                style={{ ...btnStyle, position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)' }}>
                {letter.type === 'video' ? '영상 열기' : letter.type === 'draw' ? '그림 열기' : '편지 읽기'}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── 일반: 내용 화면 ── */}
        {phase === 'content' && (
          <motion.div key="content" style={{ position: 'absolute', inset: 0 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}>

            <motion.div className="top-title"
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease }}>
              {isPink ? (<>
                <span style={{ color: '#fff1e8', filter: 'drop-shadow(0 0 18px rgba(218,157,176,0.34)) drop-shadow(0 2px 8px rgba(24,13,28,0.42))' }}>Dear Me</span>
                <span style={{ color: 'rgba(241,205,213,0.62)', margin: '0 10px' }}>;</span>
                <span style={{ color: '#e0a4b0', filter: 'drop-shadow(0 0 14px rgba(160,93,122,0.32)) drop-shadow(0 2px 8px rgba(24,13,28,0.38))' }}>Dear You</span>
              </>) : (<>
                <span className="to">Dear Me</span>
                <span className="semicolon">;</span>
                <span className="from">Dear You</span>
              </>)}
            </motion.div>

            <motion.button
              className="letter-view-back"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              onClick={() => setPhase('envelope')}
              style={backBtnStyle}
            >
              ← 봉투로
            </motion.button>

            <div className="letter-content-viewport">
              <motion.div
                className={`letter-content-wrap ${letter.type === 'draw' ? 'letter-content-wrap-draw' : letter.type === 'video' ? 'letter-content-wrap-video' : ''}`.trim()}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease }}
                style={{ width: '100%', maxWidth: letter.type === 'video' ? 1480 : letter.type === 'draw' ? 1680 : 1120 }}>

                {letter.type === 'draw' ? (
                  <div
                    className="letter-draw-frame"
                    style={{
                      border: letterBoxBorder,
                      background: isPink
                        ? 'linear-gradient(180deg, rgba(255,249,244,0.98), rgba(255,238,232,0.96))'
                        : 'linear-gradient(180deg, rgba(255,253,247,0.98), rgba(255,246,231,0.96))',
                    }}
                  >
                    <img className="letter-draw-image" src={letter.imageUrl} alt="그림 편지" />
                  </div>
                ) : letter.type === 'text' ? (
                  <div className="letters-scroll letter-content-box" style={{
                    width: '100%', minHeight: 360, maxHeight: '66vh',
                    background: letterBoxBg,
                    border: letterBoxBorder,
                    borderRadius: 24, backdropFilter: 'blur(16px)',
                    padding: '52px 64px', overflowY: 'auto',
                    boxShadow: isPink ? '0 0 34px rgba(218,157,176,0.14), 0 18px 44px rgba(21,12,25,0.26)' : '0 4px 40px rgba(0,0,0,0.1)',
                  }}>
                    <p className="letter-content-text" style={{ color: textMain, fontSize: 24, fontWeight: 300, lineHeight: 2.15, whiteSpace: 'pre-wrap', margin: 0, letterSpacing: 0.4 }}>
                      {letter.content}
                    </p>

                    {/* 첨부 이미지 */}
                    {letter.imageUrl && (
                      <div style={{ marginTop: 24 }}>
                        <img
                          src={letter.imageUrl}
                          style={{ maxWidth: '100%', borderRadius: 12, border: `1px solid ${isPink ? 'rgba(102,43,44,0.2)' : 'rgba(255,255,255,0.15)'}` }}
                        />
                      </div>
                    )}

                    {/* 서명 */}
                    {letter.signatureData && (
                      <div style={{ marginTop: 20, textAlign: 'right', paddingTop: 16, borderTop: `1px solid ${isPink ? 'rgba(102,43,44,0.1)' : 'rgba(255,255,255,0.1)'}` }}>
                        <img src={letter.signatureData} style={{ maxHeight: 70, opacity: 0.85 }} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="letter-video-frame" style={{ width: '100%', borderRadius: 20, overflow: 'hidden', boxShadow: '0 16px 44px rgba(0,0,0,0.24)', background: '#080808' }}>
                    <video src={letter.videoUrl} controls playsInline style={{ width: '100%', height: 'min(76vh, 800px)', minHeight: 'min(480px, 62vh)', objectFit: 'contain', display: 'block', background: '#080808' }} />
                  </div>
                )}
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35, ease }}
                onClick={() => setPhase('done')}
                whileHover={{ translateY: -2 }}
                className="letter-view-button"
                style={btnStyle}>
                확인 완료
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── 완료 화면 ── */}
        {phase === 'done' && (
          <motion.div key="done" style={{ position: 'absolute', inset: 0 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}>

            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease }}
                style={{ fontSize: 28, fontWeight: 300, color: textMain }}>
                다음은 어떻게 할까요?
              </motion.div>

              <motion.div
                className="letter-done-actions"
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.18, ease }}
                style={{ display: 'flex', gap: 18 }}>
                <motion.button
                  whileHover={{ translateY: -2 }}
                  onClick={() => navigate(returnTo || '/letters')}
                  style={{ ...btnStyle, background: backBg, border: backBorder, color: backColor }}>
                  편지 목록
                </motion.button>
                <motion.button
                  whileHover={{ translateY: -2 }}
                  onClick={() => navigate('/write')}
                  style={{ ...btnStyle, background: backBg, border: backBorder, color: backColor }}>
                  편지 쓰기
                </motion.button>
                <motion.button
                  whileHover={{ translateY: -2 }}
                  onClick={() => navigate('/')}
                  style={btnStyle}>
                  마무리
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  );
}

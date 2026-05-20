import React, { useState, useRef, useEffect } from "react";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: import.meta.env.VITE_R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY,
  },
});

function App() {
  const [stage, setStage] = useState("idle");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(30);
  const [videoUrl, setVideoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const videoChunks = useRef([]);
  const videoPreviewRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    let timer;
    if (stage === "counting" && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (stage === "counting" && countdown === 0) {
      startRecording();
    }
    return () => clearTimeout(timer);
  }, [stage, countdown]);

  useEffect(() => {
    let timer;
    if (stage === "recording" && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (stage === "recording" && timeLeft === 0) {
      stopRecording();
    }
    return () => clearTimeout(timer);
  }, [stage, timeLeft]);

  const prepareCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoPreviewRef.current) videoPreviewRef.current.srcObject = stream;
      setStage("counting");
      setCountdown(3);
      setVideoUrl(""); // 이전 영상 기록 삭제
    } catch (err) {
      alert("카메라 권한을 허용해주세요.");
    }
  };

  const startRecording = () => {
    videoChunks.current = [];
    const mimeType = 'video/webm;codecs=vp8,opus';
    mediaRecorderRef.current = new MediaRecorder(streamRef.current, { mimeType });

    mediaRecorderRef.current.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) videoChunks.current.push(e.data);
    };

    mediaRecorderRef.current.onstop = async () => {
      const videoBlob = new Blob(videoChunks.current, { type: "video/webm" });
      await handleUpload(videoBlob);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };

    mediaRecorderRef.current.start(1000);
    setStage("recording");
    setTimeLeft(30);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  };

  const handleUpload = async (blob) => {
    setUploading(true);
    const fileName = `video_${Date.now()}.webm`;
    try {
      const arrayBuffer = await blob.arrayBuffer();
      await s3.send(new PutObjectCommand({
        Bucket: import.meta.env.VITE_R2_BUCKET_NAME,
        Key: fileName,
        Body: new Uint8Array(arrayBuffer),
        ContentType: "video/webm",
      }));
      
      // 🔥 캐시 방지를 위해 URL 끝에 랜덤 숫자를 붙입니다 (매우 중요)
      const finalUrl = `${import.meta.env.VITE_R2_PUBLIC_URL}/${fileName}?t=${Date.now()}`;
      setVideoUrl(finalUrl);
      setStage("uploaded");
    } catch (err) {
      alert("업로드 실패");
      setStage("idle");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ textAlign: "center", padding: "40px" }}>
      <div style={{ position: "relative", width: "640px", height: "360px", margin: "0 auto", background: "#000", borderRadius: "10px", overflow: "hidden" }}>
        {stage !== "uploaded" ? (
          <video ref={videoPreviewRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          /* 🔥 key 속성을 videoUrl로 주면, URL이 바뀔 때 비디오 태그가 강제로 새로고침됩니다 */
          <video 
            key={videoUrl} 
            src={videoUrl} 
            controls 
            autoPlay 
            playsInline 
            style={{ width: "100%", height: "100%", objectFit: "cover" }} 
          />
        )}
        
        {stage === "counting" && <div style={overlayStyle}>{countdown}</div>}
        {stage === "recording" && <div style={timerStyle}>● REC {timeLeft}s</div>}
      </div>

      <div style={{ marginTop: "20px" }}>
        {stage === "idle" && <button onClick={prepareCamera} style={btnStyle}>🎥 촬영 시작</button>}
        {stage === "recording" && <button onClick={stopRecording} style={{...btnStyle, backgroundColor: "red"}}>⏹ 중지</button>}
        {uploading && <p style={{ color: "blue", fontWeight: "bold" }}>📤 업로드 중...</p>}
        {stage === "uploaded" && (
          <div>
            <p style={{ fontSize: "12px", color: "#666" }}>저장 완료: <a href={videoUrl} target="_blank">{videoUrl}</a></p>
            <button onClick={() => setStage("idle")} style={{...btnStyle, backgroundColor: "#28a745"}}>🔄 다시 촬영</button>
          </div>
        )}
      </div>
    </div>
  );
}

const overlayStyle = { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: "100px", color: "white", fontWeight: "bold" };
const timerStyle = { position: "absolute", top: "20px", left: "20px", color: "red", fontWeight: "bold", background: "rgba(0,0,0,0.5)", padding: "5px 10px", borderRadius: "5px" };
const btnStyle = { padding: "15px 30px", fontSize: "18px", cursor: "pointer", borderRadius: "8px", border: "none", backgroundColor: "#007bff", color: "white" };

export default App;
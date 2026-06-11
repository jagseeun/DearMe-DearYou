# Dear Me; Dear You

미래의 나 또는 다른 사람에게 편지를 보내는 웹 서비스입니다.
텍스트, 그림, 영상 형식으로 편지를 작성하고 지정한 날짜에 이메일로 자동 발송합니다.

## 주요 기능

- 회원가입/로그인
- 텍스트 편지 작성, 사진 첨부, 서명
- 그림 편지 작성
- 영상 편지 작성 및 업로드
- 편지 임시 저장, 불러오기, 초안 삭제
- 다른 사람에게 편지 보내기
- 지정 날짜 예약 발송
- 이메일 자동 발송
- 편지 목록 조회, 즐겨찾기, 삭제
- 열린 편지함 게시판 작성, 수정, 삭제
- 개발자에게 마음 보내기
- 커스텀 알림 모달과 반응형 작성 화면
- 핑크 테마 편지 읽기
- Cloudflare R2 파일 업로드

## 기술 스택

| 분류 | 기술 |
| --- | --- |
| Runtime | Node.js 22+ |
| Backend | Express 5, dotenv |
| Database | PostgreSQL, Prisma ORM, pg |
| Session/Auth | express-session, connect-pg-simple, bcrypt |
| Security | helmet, express-rate-limit |
| Scheduler | node-cron |
| Email | nodemailer |
| Storage | Cloudflare R2, AWS SDK S3 Presigner |
| Frontend | React 18, Vite, React Router |
| UI/Animation | Framer Motion, GSAP, CSS |
| Media | Canvas API, MediaRecorder API, fix-webm-duration |
| 3D/Visual | Three.js |

## 실행 방법

### 1. 패키지 설치

```bash
npm install
cd client
npm install
```

### 2. 환경 변수 설정

루트에 `.env` 파일을 만들고 필요한 값을 채웁니다.

```env
DATABASE_URL=postgresql://...
NODE_ENV=production
SESSION_SECRET=긴_랜덤_문자열
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password
EMAIL_FROM=your_email@gmail.com
EMAIL_REPLY_TO=your_email@gmail.com
ENABLE_SCHEDULED_EMAILS=true
R2_BUCKET_NAME=...
R2_PUBLIC_URL=https://...
R2_ENDPOINT=https://...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
ADMIN_USERIDS=admin-userid
```

### 3. DB 마이그레이션

```bash
npx prisma migrate dev
```

### 4. 프론트엔드 빌드

```bash
npm run build
```

### 5. 서버 실행

```bash
npm start
```

## 프로젝트 구조

```text
DearMe_DearYou/
├── app.js
├── prisma/
│   └── schema.prisma
├── client/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── utils/
│   └── dist/
└── .env
```

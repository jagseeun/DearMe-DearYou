# Dear Me; Dear You

> 지금의 마음을 미래의 나 또는 누군가에게 보내는 디지털 타임캡슐 편지 서비스

**Dear Me; Dear You**는 사용자가 텍스트, 사진, 그림, 영상으로 편지를 작성하고 원하는 날짜에 이메일로 받아볼 수 있도록 만든 웹 서비스입니다.
개인 편지함과 익명 열린 편지함을 분리해, 사적인 기록과 모두가 함께 보는 공개 메시지를 각각 다른 경험으로 설계했습니다.

서비스 URL: https://dearme-dearyou.onrender.com

## Project Overview

| 항목 | 내용 |
| --- | --- |
| 프로젝트명 | Dear Me; Dear You |
| 형태 | Full-stack Web Application |
| 핵심 경험 | 미래 날짜에 도착하는 편지 작성, 보관, 이메일 발송 |
| 주요 사용자 | 미래의 자신에게 편지를 남기고 싶은 사용자, 전시장에서 익명 메시지를 남기고 싶은 방문자 |
| 개발 범위 | 프론트엔드, 백엔드, DB 설계, 파일 업로드, 이메일 발송, 관리자 기능 |

## Why This Project

일상에서 많은 말과 감정은 빠르게 지나가지만, 시간이 지난 뒤 다시 꺼내 보고 싶은 순간은 분명히 존재합니다.
이 프로젝트는 지금의 마음을 단순히 저장하는 것을 넘어, 정해진 날짜에 이메일로 다시 받아볼 수 있게 만드는 데 초점을 두었습니다.

편지를 쓰는 순간에는 감정을 정리하고, 도착한 편지를 읽는 순간에는 작성 당시의 생각과 마음을 다시 확인할 수 있습니다.

## Core Features

### 미래 편지 작성

- 텍스트 편지 작성
- 사진 첨부 및 서명 추가
- Canvas 기반 그림 편지 작성
- MediaRecorder 기반 영상 편지 촬영
- 최대 3년 이내의 열람 날짜 설정
- 실제 이메일 형태에 가까운 미리보기 제공

### 이메일 예약 발송

- 지정된 날짜가 되면 서버 스케줄러가 발송 대상 편지를 조회
- Nodemailer 기반 이메일 발송
- 발송 완료 시간과 실제 발송 이메일 기록
- 수동 발송 및 재발송을 위한 관리자 기능 제공

### 내 편지함

- 내가 보낸 편지 조회
- 내가 받은 편지 조회
- 열람 가능 여부에 따른 잠금 상태 표시
- 다시 보고 싶은 편지 하트 저장
- 열람 전 편지 삭제

### 열린 편지함

- 로그인 없이 접근 가능한 익명 공개 편지함
- 텍스트, 그림, 사진 기반 공개 편지 작성
- PIN 기반 수정 및 삭제
- 관리자 공개 여부 관리
- 전시 환경에서 방문자가 빠르게 참여할 수 있는 구조

### 관리자 기능

- 회원 목록 조회
- 개인 편지 목록 조회 및 선택 삭제
- 열린 편지함 글 공개/비공개 및 삭제
- 선생님 편지 작성, 수정, 테스트 발송
- 예약 발송 수동 실행

## User Flow

```text
첫 화면
  ├─ 회원가입 / 로그인
  │   └─ Hello 화면
  │       ├─ 편지 쓰기
  │       │   ├─ 편지 형식 선택
  │       │   ├─ 내용 작성 및 미리보기
  │       │   ├─ 파일 업로드
  │       │   └─ 예약 저장
  │       └─ 내 편지함
  │           ├─ 내가 보낸 편지
  │           ├─ 받은 편지
  │           └─ 편지 열람
  └─ 열린 편지함
      ├─ 익명 편지 작성
      ├─ 공개 편지 조회
      └─ 작성한 편지 수정 / 삭제
```

## Screen Flow

### 1. 첫 화면

서비스 진입 화면입니다.
로그인, 회원가입, 편지함, 열린 편지함으로 이동할 수 있습니다.

로그인이 필요한 기능은 보호 라우트를 통해 접근을 제한하고, 로그인하지 않은 사용자는 로그인 화면으로 이동합니다.
열린 편지함은 전시 체험을 위해 로그인 없이 접근할 수 있도록 분리했습니다.

### 2. 회원가입 / 로그인

사용자는 아이디, 이름, 이메일, 비밀번호를 입력해 가입합니다.
아이디 중복 확인, 이메일 형식 확인, 비밀번호 길이 검증을 거친 뒤 계정을 생성합니다.

서버에서는 bcrypt로 비밀번호를 해시 처리하고, 회원가입 또는 로그인 성공 시 세션을 생성합니다.

### 3. 편지 쓰기

편지 쓰기는 프로젝트의 핵심 화면입니다.
사용자는 텍스트, 그림, 영상 중 하나를 선택하고 받는 사람, 받을 이메일, 열람 날짜를 입력합니다.

사진, 그림, 영상 파일은 서버에서 발급한 presigned URL을 통해 Cloudflare R2에 업로드됩니다.
편지 데이터에는 업로드된 파일의 공개 URL만 저장해 서버 부하를 줄였습니다.

### 4. 완료 화면

편지 저장이 성공하면 완료 화면으로 이동합니다.
동일 요청이 여러 번 실행되지 않도록 버튼 중복 클릭 방지 로직을 적용했습니다.

### 5. 내 편지함

내가 보낸 편지와 받은 편지를 구분해 보여줍니다.
열람 날짜가 지나지 않은 편지는 잠금 상태로 표시하고, 열람 가능한 편지만 상세 화면으로 이동할 수 있습니다.

### 6. 편지 보기

편지를 바로 보여주지 않고 봉투를 먼저 보여준 뒤, 사용자가 직접 열어보는 흐름을 만들었습니다.
텍스트, 그림, 영상 등 편지 형식에 따라 렌더링 방식을 다르게 처리합니다.

### 7. 열린 편지함

누구나 익명으로 짧은 편지, 그림, 사진을 남길 수 있는 공개 공간입니다.
개인 편지와 데이터 흐름을 분리해 익명성과 공개성을 중심으로 설계했습니다.

### 8. 관리자 화면

전시 운영 중 필요한 관리 기능을 모아둔 화면입니다.
회원, 개인 편지, 열린 편지함, 선생님 편지를 확인하고 관리할 수 있습니다.

## Technical Architecture

```text
React / Vite Client
  ├─ React Router
  ├─ Framer Motion / GSAP
  ├─ Canvas API
  ├─ MediaRecorder API
  └─ Email Preview UI

Express Server
  ├─ Session Authentication
  ├─ REST API
  ├─ Rate Limiting
  ├─ Presigned Upload URL
  ├─ Scheduled Email Job
  └─ Admin APIs

PostgreSQL + Prisma
  ├─ Member
  ├─ Letter
  ├─ LetterDraft
  ├─ PublicLetter
  ├─ TeacherLetter
  └─ SupportMessage

External Services
  ├─ Cloudflare R2
  └─ Gmail SMTP / Email Provider
```

## Tech Stack

| 영역 | 기술 |
| --- | --- |
| Runtime | Node.js 22+ |
| Backend | Express 5 |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | express-session, connect-pg-simple, bcrypt |
| Security | helmet, express-rate-limit |
| Scheduler | node-cron |
| Email | nodemailer |
| Storage | Cloudflare R2, AWS S3 SDK Presigned URL |
| Frontend | React 18, Vite |
| Routing | React Router |
| Animation | Framer Motion, GSAP |
| Media | Canvas API, MediaRecorder API, fix-webm-duration |
| Styling | CSS |

## Data Model

| 모델 | 역할 |
| --- | --- |
| Member | 사용자 계정, 이메일, 로그인 정보 |
| Letter | 개인 편지 데이터, 열람 날짜, 발송 상태 |
| LetterDraft | 작성 중인 편지 임시 저장 |
| PublicLetter | 열린 편지함의 익명 공개 편지 |
| TeacherLetter | 관리자/선생님 편지 |
| TeacherLetterDelivery | 선생님 편지 발송 이력 |
| SupportMessage | 개발자에게 보내는 응원 메시지 |

## API Highlights

| 기능 | API |
| --- | --- |
| 회원가입 | `POST /register` |
| 로그인 | `POST /login` |
| 사용자 정보 | `GET /get-user-info` |
| 이미지 업로드 URL | `GET /get-image-upload-url` |
| 영상 업로드 URL | `GET /get-upload-url` |
| 편지 미리보기 | `POST /letter-email-preview` |
| 편지 작성 | `POST /write-letter` |
| 내 편지 조회 | `GET /my-letters` |
| 받은 편지 조회 | `GET /received-letters` |
| 즐겨찾기 | `PATCH /letters/:id/favorite` |
| 열린 편지함 조회 | `GET /public-letters` |
| 열린 편지 작성 | `POST /public-letters` |
| 관리자 편지 관리 | `GET /admin/letters` |

## Key Implementation Details

### 세션 기반 인증

로그인 상태는 서버 세션으로 관리합니다.
세션 저장소는 PostgreSQL을 사용해 배포 환경에서도 로그인 상태가 안정적으로 유지되도록 했습니다.

### 파일 업로드 구조

이미지와 영상은 서버에 직접 저장하지 않습니다.
프론트엔드가 서버에 업로드 URL을 요청하면, 서버가 Cloudflare R2 presigned URL을 발급합니다.
프론트엔드는 해당 URL로 파일을 업로드하고, 편지 데이터에는 공개 URL을 저장합니다.

```text
Client → Server: 업로드 URL 요청
Server → Client: Presigned URL 발급
Client → Cloudflare R2: 파일 업로드
Client → Server: 편지 데이터 + 파일 URL 저장
```

### 예약 이메일 발송

서버는 매일 정해진 시간에 발송 대상 편지를 조회합니다.
열람 날짜가 지났고 아직 발송되지 않은 편지를 이메일로 보내고, 성공 시 `sentAt` 값을 기록합니다.

### 중복 요청 방지

로그인, 로그아웃, 편지 보내기, 열린 편지함 이동처럼 한 번만 실행되어야 하는 동작은 중복 클릭을 막았습니다.
사용자가 버튼을 여러 번 눌러도 같은 요청이 반복 실행되지 않도록 프론트엔드에서 클릭 잠금 처리를 적용했습니다.

### 반응형 UI

전시 환경에서는 데스크톱과 모바일 모두에서 화면이 열릴 수 있기 때문에, 입력창, 버튼, 편지 미리보기, 편지함 카드가 겹치지 않도록 화면 크기별 CSS를 조정했습니다.

### 이메일 검증

이메일 입력 시 기본 이메일 형식을 검증하고, 자주 발생하는 도메인 오타를 확인합니다.
학교 이메일의 경우 `s24`, `s25`, `s26`, `d24`, `d25`, `d26`으로 시작하는 주소만 허용하도록 처리했습니다.

## UX Decisions

- 편지를 바로 보여주지 않고 봉투를 먼저 보여줘 “열어본다”는 감각을 강화했습니다.
- 개인 편지와 열린 편지함의 색감을 다르게 설계해 공간의 성격을 구분했습니다.
- 편지 작성 화면에서 미리보기를 제공해 실제 발송 화면을 예상할 수 있게 했습니다.
- 열린 편지함은 전시장에서 빠르게 참여할 수 있도록 로그인 없이 접근 가능하게 했습니다.
- 글자 수 제한, 날짜 제한, 이메일 검증을 통해 작성 중 실수를 줄였습니다.

## Getting Started

### 1. Install

```bash
npm install
cd client
npm install
```

### 2. Environment Variables

루트 경로에 `.env` 파일을 생성합니다.

```env
DATABASE_URL=postgresql://...
NODE_ENV=development
SESSION_SECRET=your_session_secret

GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password
EMAIL_SENDER_NAME=Dear Me; Dear You

R2_BUCKET_NAME=your_bucket
R2_PUBLIC_URL=https://your-public-url
R2_ENDPOINT=https://your-r2-endpoint
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key

ENABLE_SCHEDULED_EMAILS=true
```

선택적으로 사용할 수 있는 값입니다.

```env
BREVO_API_KEY=...
BREVO_SENDER_EMAIL=...
BREVO_REPLY_TO=...
DEVELOPER_EMAIL=...
TEACHER_TEST_EMAIL=...
MAIL_SEND_TIMEOUT_MS=20000
```

### 3. Database

```bash
npx prisma migrate dev
```

배포 환경에서는 다음 명령이 postinstall에서 실행됩니다.

```bash
prisma generate
prisma migrate deploy
```

### 4. Development

```bash
npm run dev
```

### 5. Production Build

```bash
npm run build
npm start
```

## Folder Structure

```text
DearMe_DearYou/
├─ app.js
├─ package.json
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
├─ client/
│  ├─ package.json
│  ├─ src/
│  │  ├─ pages/
│  │  ├─ components/
│  │  ├─ utils/
│  │  ├─ App.jsx
│  │  └─ index.css
│  └─ dist/
└─ EXHIBITION_GUIDE.md
```

## Portfolio Notes

이 프로젝트에서는 단순히 편지 작성 기능만 구현한 것이 아니라, 실제 서비스 운영에 필요한 다음 흐름까지 함께 구성했습니다.

- 사용자 인증과 세션 유지
- 파일 업로드와 외부 스토리지 연동
- 예약 날짜 기반 이메일 발송
- 개인 데이터와 공개 데이터 분리
- 관리자 운영 도구
- 모바일/데스크톱 반응형 UI
- 전시 환경에서 빠른 체험이 가능한 열린 편지함

## Future Improvements

- 편지 검색 및 필터 기능 고도화
- 이메일 템플릿 다양화
- 발송 실패 재시도 UI 개선
- 열린 편지함 신고 기능
- 접근성 테스트와 키보드 탐색 개선
- 운영 로그 대시보드 추가

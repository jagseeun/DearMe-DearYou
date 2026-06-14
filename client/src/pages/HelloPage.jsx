import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import NoticeModal from '../components/NoticeModal.jsx';
import { useAuth } from '../auth.jsx';

const ease = [0.16, 1, 0.3, 1];
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.98, ease } },
};

const questions = [
  '내년의 나에게 남기고 싶은 약속은 무엇인가요?',
  '지금의 나에게 전하고 싶은 감사의 말은 무엇인가요?',
  '지금 이 시기를 한 단어로 기록한다면 무엇인가요?',
  '지금의 나에게 가장 필요한 문장은 무엇인가요?',
  '미래의 나에게 전하고 싶은 말은 무엇인가요?',
  '그동안 가장 크게 달라진 것은 무엇인가요?',
  '지금의 나에게 건네고 싶은 응원의 말은 무엇인가요?',
  '미래의 내가 과거의 나에게 남기고 싶은 말은 무엇인가요?',
  '미래의 나는 어떤 모습으로 변해 있을까요?',
  '미래의 나에게 부탁하고 싶은 것은 무엇인가요?',
];

const helloQuestions = [
  '오늘의 마음은 어떤 색으로 남기고 싶나요?',
  '지금의 나에게 가장 먼저 건네고 싶은 말은 무엇인가요?',
  '작은 안부 하나를 남긴다면 어떤 문장이 좋을까요?',
  '고마웠던 순간 하나를 떠올리면 무엇이 보이나요?',
  '미래의 내가 잊지 않았으면 하는 마음은 무엇인가요?',
  '오늘 가장 오래 머문 생각은 무엇인가요?',
  '나에게 조금 다정해질 수 있는 말은 무엇인가요?',
  '언젠가 다시 읽을 나에게 남기고 싶은 약속은 무엇인가요?',
  '지금 붙잡고 싶은 장면은 어떤 모습인가요?',
  '내일의 나에게 조용히 전하고 싶은 말은 무엇인가요?',
];

export default function HelloPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [qIdx, setQIdx] = useState(0);
  const [deliveryNotice, setDeliveryNotice] = useState(location.state?.deliveryNotice || null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const displayName = name || user?.name || '';

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  useEffect(() => {
    fetch('/get-user-info')
      .then(response => {
        if (response.status === 401) {
          navigate('/login');
          return null;
        }
        return response.json();
      })
      .then(data => {
        if (data?.name) setName(data.name);
      })
      .catch(() => {});
  }, [navigate]);

  useEffect(() => {
    const timer = setInterval(() => setQIdx(index => (index + 1) % helloQuestions.length), 5600);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!location.state?.deliveryNotice) return;
    setDeliveryNotice(location.state.deliveryNotice);
    navigate('/hello', { replace: true });
  }, [location.state, navigate]);

  useEffect(() => {
    if (!deliveryNotice) return undefined;
    const timer = setTimeout(() => setDeliveryNotice(null), 4200);
    return () => clearTimeout(timer);
  }, [deliveryNotice]);

  function confirmLogout() {
    window.location.href = '/logout';
  }

  return (
    <motion.div
      className="hello-shell"
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      variants={container}
    >
      <motion.div
        className="top-title"
        variants={{
          hidden: { opacity: 0, y: -10 },
          show: { opacity: 1, y: 0, transition: { duration: 0.92, ease } },
        }}
      >
        <span className="to">Dear Me</span>
        <span className="semicolon">;</span>
        <span className="from">Dear You</span>
      </motion.div>

      <motion.div
        variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.88, delay: 0.04, ease } } }}
        className="hello-nav"
      >
        <motion.button
          onClick={() => navigate('/letters')}
          whileHover={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,252,223,0.9)' }}
          style={navBtnStyle}
        >
          나의 편지
        </motion.button>
        <motion.button
          onClick={() => navigate('/mypage')}
          whileHover={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,252,223,0.9)' }}
          style={navBtnStyle}
        >
          마이페이지
        </motion.button>
        <motion.button
          onClick={() => setShowLogoutModal(true)}
          whileHover={{ scale: 1.018, color: 'rgba(255,238,238,0.96)', borderColor: 'rgba(255,138,146,0.46)', boxShadow: '0 8px 24px rgba(174,66,76,0.18)' }}
          style={{ ...navBtnStyle, ...logoutNavBtnStyle }}
        >
          로그아웃
        </motion.button>
      </motion.div>

      <div className="hello-content">
        <motion.div variants={item} className="hello-greeting">
          반갑습니다. <span style={{ color: '#E6C395' }}>{displayName}</span>님
        </motion.div>

        <div className="hello-question-wrap">
          <AnimatePresence mode="wait">
            <motion.div
              key={qIdx}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.92, ease }}
              className="hello-question"
            >
              {helloQuestions[qIdx]}
            </motion.div>
          </AnimatePresence>
        </div>

        <motion.div variants={item} className="hello-divider" />

        <motion.button
          variants={item}
          onClick={() => navigate('/write')}
          whileHover={{ scale: 1.018, boxShadow: '0 8px 32px rgba(0,0,0,0.24), 0 0 20px rgba(205,154,99,0.18)' }}
          className="primary-cta"
        >
          편지 쓰기
        </motion.button>
      </div>

      <AnimatePresence>
        {deliveryNotice && (
          <motion.div
            className={`hello-delivery-toast ${deliveryNotice.kind === 'failed' ? 'is-failed' : ''}`}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.32, ease }}
          >
            <div>
              <strong>{deliveryNotice.title}</strong>
              <span>{deliveryNotice.message}</span>
            </div>
            <button type="button" onClick={() => setDeliveryNotice(null)}>확인</button>
          </motion.div>
        )}
      </AnimatePresence>

      <NoticeModal
        open={showLogoutModal}
        title="로그아웃하시겠습니까?"
        message="다시 로그인하면 편지를 이어서 확인할 수 있습니다."
        cancelLabel="취소"
        confirmLabel="로그아웃"
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
        variant="logout"
      />
    </motion.div>
  );
}

const navBtnStyle = {
  padding: '8px 16px',
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'inherit',
  cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,252,223,0.55)',
  backdropFilter: 'blur(8px)',
  transition: 'all 0.25s',
};

const logoutNavBtnStyle = {
  borderColor: 'rgba(255, 118, 128, 0.3)',
  background: 'linear-gradient(135deg, rgba(174, 66, 76, 0.22), rgba(255, 255, 255, 0.055))',
  color: 'rgba(255, 203, 207, 0.88)',
};

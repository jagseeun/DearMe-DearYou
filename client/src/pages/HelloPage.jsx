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
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 1.08, ease } },
};

const helloQuestions = [
  '오늘 전하고 싶은 마음은 어떤 문장으로 남길까요?',
  '받는 사람이 오래 기억했으면 하는 말은 무엇인가요?',
  '작은 안부 하나를 남긴다면 어떤 온도가 좋을까요?',
  '고마웠던 순간을 떠올리면 가장 먼저 무엇이 보이나요?',
  '언젠가 다시 읽어도 다정하게 남을 말은 무엇인가요?',
  '오늘 가장 오래 머문 마음을 누구에게 건네고 싶나요?',
  '말로 다 하지 못했던 마음이 있다면 어떻게 적어볼까요?',
  '편지를 받는 사람이 미소 지을 문장은 무엇일까요?',
  '지금 붙잡아두고 싶은 장면은 어떤 모습인가요?',
  '조용히 전하고 싶은 진심을 한 줄로 적는다면요?',
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
          내 편지함
        </motion.button>
        <motion.button
          onClick={() => navigate('/mypage')}
          whileHover={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,252,223,0.9)' }}
          style={navBtnStyle}
        >
          계정 관리
        </motion.button>
        <motion.button
          onClick={() => setShowLogoutModal(true)}
          whileHover={{ color: 'rgba(255,238,238,0.96)', borderColor: 'rgba(255,138,146,0.46)', boxShadow: '0 8px 24px rgba(174,66,76,0.18)' }}
          style={{ ...navBtnStyle, ...logoutNavBtnStyle }}
        >
          로그아웃
        </motion.button>
      </motion.div>

      <div className="hello-content">
        <motion.div variants={item} className="hello-greeting">
          오늘도 반갑습니다, <span style={{ color: '#E6C395' }}>{displayName}</span>님
        </motion.div>

        <div className="hello-question-wrap">
          <AnimatePresence mode="wait">
            <motion.div
              key={qIdx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 1.14, ease }}
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
          whileHover={{ boxShadow: '0 8px 32px rgba(0,0,0,0.24), 0 0 20px rgba(205,154,99,0.18)' }}
          className="primary-cta"
        >
          편지 남기기
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
            <button type="button" onClick={() => setDeliveryNotice(null)}>확인했습니다</button>
          </motion.div>
        )}
      </AnimatePresence>

      <NoticeModal
        open={showLogoutModal}
        title="로그아웃하시겠습니까?"
        message="다시 로그인하시면 편지를 이어서 확인하실 수 있습니다."
        cancelLabel="머무르기"
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

import { useState } from 'react';
import { motion } from 'framer-motion';

function EyeIcon({ visible }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.6 12s3.2-5.2 9.4-5.2 9.4 5.2 9.4 5.2-3.2 5.2-9.4 5.2S2.6 12 2.6 12Z" />
      <circle cx="12" cy="12" r="2.7" />
      {!visible && <path className="password-eye-slash" d="M4.4 4.4 19.6 19.6" />}
    </svg>
  );
}

export default function PasswordField({
  variants,
  wrapperClassName = 'password-field',
  className = 'input-field',
  inputStyle,
  wrapperStyle,
  toggleClassName = 'password-toggle',
  toggleStyle,
  visibleLabel = '비밀번호 숨기기',
  hiddenLabel = '비밀번호 보기',
  ...inputProps
}) {
  const [visible, setVisible] = useState(false);
  const Wrapper = variants ? motion.div : 'div';

  return (
    <Wrapper variants={variants} className={wrapperClassName} style={wrapperStyle}>
      <input
        {...inputProps}
        className={className}
        style={inputStyle}
        type={visible ? 'text' : 'password'}
      />
      <button
        type="button"
        className={toggleClassName}
        style={toggleStyle}
        aria-label={visible ? visibleLabel : hiddenLabel}
        title={visible ? visibleLabel : hiddenLabel}
        onClick={() => setVisible(value => !value)}
      >
        <EyeIcon visible={visible} />
      </button>
    </Wrapper>
  );
}

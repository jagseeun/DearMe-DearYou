export const motionEase = [0.22, 1, 0.36, 1];

export const pageMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.42, ease: motionEase },
};

export const panelMotion = {
  initial: { opacity: 0, y: 18, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 12, scale: 0.985 },
  transition: { duration: 0.34, ease: motionEase },
};

export const modalBackdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.22, ease: motionEase },
};

export const modalPanelMotion = {
  initial: { opacity: 0, y: 24, scale: 0.965 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 14, scale: 0.965 },
  transition: { duration: 0.3, ease: motionEase },
};

export const listItemMotion = index => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.36,
    delay: Math.min(index, 10) * 0.035,
    ease: motionEase,
  },
});

export const buttonMotion = {
  whileHover: { scale: 1.018 },
  whileTap: { scale: 0.985 },
  transition: { duration: 0.18, ease: motionEase },
};

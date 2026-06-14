export const motionEase = [0.16, 1, 0.3, 1];

export const pageMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.94, ease: motionEase },
};

export const panelMotion = {
  initial: { opacity: 0, y: 12, scale: 0.998 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 6, scale: 0.998 },
  transition: { duration: 0.76, ease: motionEase },
};

export const modalBackdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.42, ease: motionEase },
};

export const modalPanelMotion = {
  initial: { opacity: 0, y: 12, scale: 0.998 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 6, scale: 0.998 },
  transition: { duration: 0.72, ease: motionEase },
};

export const listItemMotion = index => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.82,
    delay: Math.min(index, 4) * 0.035,
    ease: motionEase,
  },
});

export const buttonMotion = {
  whileHover: {},
  whileTap: {},
  transition: { duration: 0.28, ease: motionEase },
};

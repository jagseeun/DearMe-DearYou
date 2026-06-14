export const motionEase = [0.16, 1, 0.3, 1];

export const pageMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.74, ease: motionEase },
};

export const panelMotion = {
  initial: { opacity: 0, y: 14, scale: 0.996 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.996 },
  transition: { duration: 0.54, ease: motionEase },
};

export const modalBackdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.36, ease: motionEase },
};

export const modalPanelMotion = {
  initial: { opacity: 0, y: 16, scale: 0.996 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.996 },
  transition: { duration: 0.56, ease: motionEase },
};

export const listItemMotion = index => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.62,
    delay: Math.min(index, 4) * 0.025,
    ease: motionEase,
  },
});

export const buttonMotion = {
  whileHover: {},
  whileTap: {},
  transition: { duration: 0.28, ease: motionEase },
};

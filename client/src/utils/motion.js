export const motionEase = [0.22, 1, 0.36, 1];

export const pageMotion = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 2 },
  transition: { duration: 1.08, ease: motionEase },
};

export const panelMotion = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 3 },
  transition: { duration: 0.88, ease: motionEase },
};

export const modalBackdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.54, ease: motionEase },
};

export const modalPanelMotion = {
  initial: { opacity: 0, y: 8, scale: 0.996 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 4, scale: 0.998 },
  transition: { duration: 0.9, ease: motionEase },
};

export const listItemMotion = index => ({
  initial: { opacity: 0, y: 5 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.9,
    delay: Math.min(index, 4) * 0.025,
    ease: motionEase,
  },
});

export const buttonMotion = {
  whileHover: {},
  whileTap: {},
  transition: { duration: 0.42, ease: motionEase },
};

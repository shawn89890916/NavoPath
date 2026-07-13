export const MOTION = {
  instant: 90,
  fade: 140,
  base: 180,
  layout: 240,
  story: 520,
} as const;

export type MotionDirection = "backward" | "forward" | "neutral";

type ViewTransitionLike = {
  finished: Promise<unknown>;
};

type MotionDocument = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => ViewTransitionLike;
};

export function prefersReducedMotion(targetWindow: Window | null | undefined = typeof window === "undefined" ? undefined : window) {
  return Boolean(targetWindow?.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

function clearTransitionState(root: HTMLElement) {
  delete root.dataset.motionDirection;
  delete root.dataset.motionFallback;
  delete root.dataset.motionScope;
  root.style.removeProperty("--motion-shift-x");
}

export async function runMotionTransition(
  update: () => void,
  options: {
    direction?: MotionDirection;
    document?: Document | null;
    duration?: number;
    scope?: "timeline" | "workspace";
  } = {},
) {
  const targetDocument = options.document === undefined
    ? (typeof document === "undefined" ? null : document)
    : options.document;
  const targetWindow = targetDocument?.defaultView;

  if (!targetDocument || prefersReducedMotion(targetWindow)) {
    update();
    return;
  }

  const direction = options.direction ?? "neutral";
  const root = targetDocument.documentElement;
  root.dataset.motionDirection = direction;
  root.dataset.motionScope = options.scope ?? "workspace";
  root.style.setProperty("--motion-shift-x", direction === "backward" ? "-6px" : direction === "forward" ? "6px" : "0px");

  const startViewTransition = (targetDocument as MotionDocument).startViewTransition;
  if (typeof startViewTransition === "function") {
    try {
      const transition = startViewTransition.call(targetDocument, update);
      await transition.finished;
    } finally {
      clearTransitionState(root);
    }
    return;
  }

  root.dataset.motionFallback = "true";
  update();
  await new Promise<void>((resolve) => {
    const finish = () => {
      clearTransitionState(root);
      resolve();
    };
    targetWindow?.setTimeout(finish, options.duration ?? MOTION.layout);
    if (!targetWindow) finish();
  });
}

export function scheduleMotionCommit(
  commit: () => void,
  duration: number = MOTION.fade,
  targetWindow: Window | null | undefined = typeof window === "undefined" ? undefined : window,
) {
  let committed = false;
  let timer: number | undefined;
  const finish = () => {
    if (committed) return;
    committed = true;
    if (timer !== undefined) targetWindow?.clearTimeout(timer);
    commit();
  };
  const cancel = () => {
    if (committed) return;
    committed = true;
    if (timer !== undefined) targetWindow?.clearTimeout(timer);
  };

  if (!targetWindow || prefersReducedMotion(targetWindow) || duration <= 0) finish();
  else timer = targetWindow.setTimeout(finish, duration);

  return { cancel, finish };
}

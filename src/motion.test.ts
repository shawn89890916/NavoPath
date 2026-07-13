import { describe, expect, it, vi } from "vitest";
import { MOTION, prefersReducedMotion, runMotionTransition, scheduleMotionCommit } from "./motion";

function motionWindow(reduced = false) {
  return {
    matchMedia: () => ({ matches: reduced }),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  } as unknown as Window;
}

function motionRoot() {
  return {
    dataset: {} as DOMStringMap,
    style: {
      setProperty: vi.fn(),
      removeProperty: vi.fn(),
    },
  } as unknown as HTMLElement;
}

function motionDocument(targetWindow: Window, startViewTransition?: (callback: () => void) => { finished: Promise<unknown> }) {
  return {
    defaultView: targetWindow,
    documentElement: motionRoot(),
    ...(startViewTransition ? { startViewTransition } : {}),
  } as unknown as Document & { startViewTransition?: typeof startViewTransition };
}

describe("motion helpers", () => {
  it("reads the reduced-motion preference", () => {
    expect(prefersReducedMotion(motionWindow(false))).toBe(false);
    expect(prefersReducedMotion(motionWindow(true))).toBe(true);
  });

  it("uses a view transition when available", async () => {
    const update = vi.fn();
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return { finished: Promise.resolve() };
    });
    const targetDocument = motionDocument(motionWindow(false), startViewTransition);
    const root = targetDocument.documentElement;

    await runMotionTransition(update, { direction: "forward", document: targetDocument });

    expect(startViewTransition).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
    expect(root.dataset.motionDirection).toBeUndefined();
  });

  it("updates immediately when reduced motion is enabled", async () => {
    const update = vi.fn();
    const startViewTransition = vi.fn();
    const targetDocument = motionDocument(motionWindow(true), startViewTransition);

    await runMotionTransition(update, { document: targetDocument });

    expect(update).toHaveBeenCalledOnce();
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it("falls back to a timed CSS state", async () => {
    vi.useFakeTimers();
    const update = vi.fn();
    const targetDocument = motionDocument(motionWindow(false));
    const root = targetDocument.documentElement;

    const transition = runMotionTransition(update, { document: targetDocument, duration: MOTION.layout });
    expect(update).toHaveBeenCalledOnce();
    expect(root.dataset.motionFallback).toBe("true");
    await vi.advanceTimersByTimeAsync(MOTION.layout);
    await transition;
    expect(root.dataset.motionFallback).toBeUndefined();
    vi.useRealTimers();
  });

  it("commits an exit only once", () => {
    vi.useFakeTimers();
    const commit = vi.fn();
    const scheduled = scheduleMotionCommit(commit, MOTION.fade, motionWindow(false));
    scheduled.finish();
    vi.advanceTimersByTime(MOTION.fade);
    scheduled.finish();
    expect(commit).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});

import { useCallback, useRef, useState } from "react";

/**
 * usePointerReorder — shared pointer-based list reorder hook.
 *
 * Mirrors the exact drag feel of Today's Candidate reorder in main.tsx
 * (beginShelfDrag): pointer-capture, 5px movement threshold, half-height
 * before/after detection via document.elementFromPoint, the same
 * `.df-list-insertion-line` indicator, the same `is-dragging-source`
 * placeholder class, and click suppression after a real drag.
 *
 * Designed so both the template list and (future) the candidate list can
 * share one reorder code path instead of maintaining two near-identical
 * inline implementations.
 *
 * Usage:
 *   const reorder = usePointerReorder<ListRow>({
 *     getId: (row) => row.id,
 *     selector: "[data-template-row-key]",
 *     attrName: "templateRowKey",
 *     onReorder: (dragId, targetId, position) => { ... persist ... },
 *   });
 *   // row: <CandidateBlock onPointerDown={(e) => reorder.beginDrag(e, row)} ... />
 *   // overlay: {reorder.drag && <TaskDragLayer ...><CandidateBlock .../></TaskDragLayer>}
 *   // guard click: if (reorder.suppressedRef.current) return;
 */

export type ReorderInsertion = { id: string; position: "before" | "after" } | null;

export type ReorderDrag<T> = {
  item: T;
  pointer: { x: number; y: number };
  sourceRect: { width: number; height: number };
  offset: { x: number; y: number };
} | null;

export type ReorderOptions<T> = {
  /** Stable id for the dragged item (used to skip self as drop target). */
  getId: (item: T) => string;
  /** CSS selector used with elementFromPoint().closest() to find a drop row, e.g. "[data-template-row-key]". */
  selector: string;
  /** The dataset key (camelCase) to read the target id from the matched row, e.g. "templateRowKey". */
  attrName: string;
  /** Called on drop with (dragId, targetId, position). Persists the new order. */
  onReorder: (dragId: string, targetId: string, position: "before" | "after") => void;
  /** Movement threshold before drag activates. Defaults to 5 (matches candidate drag). */
  threshold?: number;
};

export function usePointerReorder<T>(opts: ReorderOptions<T>): {
  drag: ReorderDrag<T>;
  insertion: ReorderInsertion;
  beginDrag: (event: React.PointerEvent, item: T) => void;
  /** True briefly after a real drag so onClick handlers can no-op. Resets on next tick. */
  suppressedRef: React.MutableRefObject<boolean>;
  /** Imperatively cancel an in-flight drag (e.g. on Escape or unmount). */
  cancelDrag: () => void;
} {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const [drag, setDrag] = useState<ReorderDrag<T>>(null);
  const [insertion, setInsertion] = useState<ReorderInsertion>(null);
  const suppressedRef = useRef(false);
  // Mutable per-drag context. Held in a ref so the window listeners can read/modify it.
  const ctxRef = useRef<{
    pointerId: number;
    element: HTMLElement;
    item: T;
    startX: number;
    startY: number;
    rect: { width: number; height: number };
    offset: { x: number; y: number };
    active: boolean;
    move: (pe: PointerEvent) => void;
    up: (pe: PointerEvent) => void;
    cancel: () => void;
    keydown: (e: KeyboardEvent) => void;
  } | null>(null);

  const cancelDrag = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    window.removeEventListener("pointermove", ctx.move);
    window.removeEventListener("pointerup", ctx.up);
    window.removeEventListener("pointercancel", ctx.cancel);
    window.removeEventListener("keydown", ctx.keydown);
    document.body.classList.remove("df-timeline-pointer-drag");
    ctx.element.classList.remove("is-dragging-source");
    if (ctx.element.hasPointerCapture(ctx.pointerId)) ctx.element.releasePointerCapture(ctx.pointerId);
    setDrag(null);
    setInsertion(null);
    ctxRef.current = null;
  }, []);

  const beginDrag = useCallback((event: React.PointerEvent, item: T) => {
    if (event.button !== 0) return;
    // Don't start a reorder drag from interactive controls (rename input, action buttons).
    const target = event.target as HTMLElement;
    if (target.closest("button,input,textarea,select,a")) return;
    const element = event.currentTarget as HTMLElement;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = element.getBoundingClientRect();
    const offset = { x: startX - rect.left, y: startY - rect.top };
    let active = false;

    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", keydown);
      document.body.classList.remove("df-timeline-pointer-drag");
      element.classList.remove("is-dragging-source");
      if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
      setDrag(null);
      setInsertion(null);
      ctxRef.current = null;
    };

    const move = (pe: PointerEvent) => {
      if (!active) {
        const { threshold = 5 } = optsRef.current;
        if (Math.abs(pe.clientX - startX) < threshold && Math.abs(pe.clientY - startY) < threshold) return;
        active = true;
        document.body.classList.add("df-timeline-pointer-drag");
        element.classList.add("is-dragging-source");
        try { element.setPointerCapture(pointerId); } catch { /* ignore */ }
      }
      setDrag({ item, pointer: { x: pe.clientX, y: pe.clientY }, sourceRect: { width: rect.width, height: rect.height }, offset });
      const { selector, attrName, getId } = optsRef.current;
      const pointed = document.elementFromPoint(pe.clientX, pe.clientY);
      const row = pointed ? pointed.closest<HTMLElement>(selector) : null;
      if (row) {
        const targetId = (row.dataset as Record<string, string | undefined>)[attrName] || "";
        const dragId = getId(item);
        if (targetId && targetId !== dragId) {
          const r = row.getBoundingClientRect();
          const position = (pe.clientY - r.top) < r.height / 2 ? "before" : "after";
          setInsertion({ id: targetId, position });
        } else {
          setInsertion(null);
        }
      } else {
        setInsertion(null);
      }
    };

    const up = (pe: PointerEvent) => {
      if (active) {
        const { selector, attrName, getId, onReorder } = optsRef.current;
        const pointed = document.elementFromPoint(pe.clientX, pe.clientY);
        const row = pointed ? pointed.closest<HTMLElement>(selector) : null;
        if (row) {
          const targetId = (row.dataset as Record<string, string | undefined>)[attrName] || "";
          const dragId = getId(item);
          if (targetId && targetId !== dragId) {
            const r = row.getBoundingClientRect();
            const position = (pe.clientY - r.top) < r.height / 2 ? "before" : "after";
            onReorder(dragId, targetId, position);
          }
        }
        // Suppress the click that fires right after pointerup so we don't select the dragged row.
        suppressedRef.current = true;
        window.setTimeout(() => { suppressedRef.current = false; }, 0);
      }
      cleanup();
    };

    const cancel = () => cleanup();
    const keydown = (e: KeyboardEvent) => { if (e.key === "Escape") cleanup(); };

    ctxRef.current = { pointerId, element, item, startX, startY, rect, offset, active, move, up, cancel, keydown };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", keydown);
  }, []);

  return { drag, insertion, beginDrag, suppressedRef, cancelDrag };
}

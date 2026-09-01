const EDGE_PX = 56;
const MAX_STEP_PX = 28;

/** Scroll the nearest active planning surface while a pointer drag approaches
 * its edge, then fall back to the document for page-level movement. */
export function autoScrollAtDragEdge(
  clientX: number,
  clientY: number,
  containers: Array<HTMLElement | null | undefined>,
) {
  const seen = new Set<HTMLElement>();
  for (const container of containers) {
    if (!container || seen.has(container)) continue;
    seen.add(container);
    const rect = container.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) continue;
    const maxScroll = container.scrollHeight - container.clientHeight;
    if (maxScroll <= 0) continue;
    const topDistance = clientY - rect.top;
    const bottomDistance = rect.bottom - clientY;
    const direction = topDistance < EDGE_PX ? -1 : bottomDistance < EDGE_PX ? 1 : 0;
    if (!direction) continue;
    const proximity = 1 - Math.min(EDGE_PX, direction < 0 ? topDistance : bottomDistance) / EDGE_PX;
    container.scrollTop = Math.max(0, Math.min(maxScroll, container.scrollTop + direction * Math.ceil(6 + proximity * MAX_STEP_PX)));
    return;
  }

  const root = document.scrollingElement;
  if (!root || root.scrollHeight <= root.clientHeight) return;
  const direction = clientY < EDGE_PX ? -1 : clientY > window.innerHeight - EDGE_PX ? 1 : 0;
  if (!direction) return;
  const proximity = direction < 0
    ? 1 - Math.max(0, clientY) / EDGE_PX
    : 1 - Math.max(0, window.innerHeight - clientY) / EDGE_PX;
  root.scrollTop = Math.max(0, Math.min(root.scrollHeight - root.clientHeight, root.scrollTop + direction * Math.ceil(6 + proximity * MAX_STEP_PX)));
}

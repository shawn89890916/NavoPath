export const MIN_TIMELINE_ZOOM = 0.65;
export const MAX_TIMELINE_ZOOM = 2.5;

export function clampTimelineZoom(zoom: number) {
  return Math.min(MAX_TIMELINE_ZOOM, Math.max(MIN_TIMELINE_ZOOM, zoom));
}

export function timelineZoomFromPinch(startZoom: number, startDistance: number, currentDistance: number) {
  if (!Number.isFinite(startDistance) || startDistance <= 0) return clampTimelineZoom(startZoom);
  return clampTimelineZoom(startZoom * (currentDistance / startDistance));
}

export function anchoredTimelineScrollTop(anchorBaseY: number, zoom: number, anchorViewportY: number) {
  return Math.max(0, anchorBaseY * zoom - anchorViewportY);
}

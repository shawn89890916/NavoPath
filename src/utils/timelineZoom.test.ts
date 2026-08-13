import { describe, expect, it } from "vitest";
import {
  MAX_TIMELINE_ZOOM,
  MIN_TIMELINE_ZOOM,
  anchoredTimelineScrollTop,
  timelineZoomFromPinch,
} from "./timelineZoom";

describe("timeline pinch zoom", () => {
  it("tracks the vertical finger distance and respects the zoom limits", () => {
    expect(timelineZoomFromPinch(1, 100, 160)).toBeCloseTo(1.6);
    expect(timelineZoomFromPinch(1, 100, 10)).toBe(MIN_TIMELINE_ZOOM);
    expect(timelineZoomFromPinch(2, 100, 200)).toBe(MAX_TIMELINE_ZOOM);
  });

  it("keeps the time under the pinch centre anchored in the viewport", () => {
    const anchorBaseY = (900 + 240) / 1;
    expect(anchoredTimelineScrollTop(anchorBaseY, 1.5, 240)).toBe(1470);
  });
});

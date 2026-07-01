import { describe, expect, it } from "vitest";
import { SHORTCUTS, isTypingContext } from "./shortcuts";

describe("shortcuts", () => {
  it("contains the fixed first-version shortcut set", () => {
    expect(SHORTCUTS.map((shortcut) => shortcut.id)).toEqual(expect.arrayContaining(["command-search", "help", "new-task", "today", "execute", "planning", "timer-toggle"]));
  });

  it("does not fire while typing", () => {
    expect(isTypingContext({ tagName: "input" } as unknown as EventTarget)).toBe(true);
    expect(isTypingContext({ tagName: "div", isContentEditable: true } as unknown as EventTarget)).toBe(true);
    expect(isTypingContext({ tagName: "button" } as unknown as EventTarget)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import type { Subtask } from "../types";
import {
  insertSubtaskRelativeInTree,
  moveSubtaskInsideTree,
  moveSubtaskRelativeInTree,
} from "./treeOrder";

function subtask(id: string, subtasks: Subtask[] = []): Subtask {
  return {
    id,
    title: id,
    completed: false,
    createdAt: "2026-07-28T00:00:00.000Z",
    subtasks,
  };
}

describe("tree order", () => {
  it("does not lose a subtree when it is moved inside its own descendant", () => {
    const tree = [subtask("parent", [subtask("child")])];
    const moved = moveSubtaskInsideTree(tree, "parent", "child");

    expect(moved).toEqual(tree);
    expect(moved).toBe(tree);
  });

  it("moves a subtree inside a valid target atomically", () => {
    const tree = [subtask("source", [subtask("leaf")]), subtask("target")];
    const moved = moveSubtaskInsideTree(tree, "source", "target", 10);

    expect(moved).toEqual([
      subtask("target", [{
        ...subtask("source", [subtask("leaf")]),
        order: 10,
      }]),
    ]);
  });

  it("keeps a nested subtree beside its target when moving after it", () => {
    const tree = [subtask("parent", [subtask("source"), subtask("target")])];
    const moved = moveSubtaskRelativeInTree(tree, "source", "target", true);

    expect(moved).toEqual([
      subtask("parent", [
        { ...subtask("target"), order: 0 },
        { ...subtask("source"), order: 1 },
      ]),
    ]);
  });

  it("does not lose an ancestor moved beside its own descendant", () => {
    const tree = [subtask("parent", [subtask("child")])];
    const moved = moveSubtaskRelativeInTree(tree, "parent", "child", true);

    expect(moved).toBe(tree);
  });

  it("inserts a subtree beside a nested target from another tree", () => {
    const tree = [subtask("parent", [subtask("target")])];
    const moved = insertSubtaskRelativeInTree(
      tree,
      subtask("source"),
      "target",
      false,
    );

    expect(moved).toEqual([
      subtask("parent", [
        { ...subtask("source"), order: 0 },
        { ...subtask("target"), order: 1 },
      ]),
    ]);
  });
});

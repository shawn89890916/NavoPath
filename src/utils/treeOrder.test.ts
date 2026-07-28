import { describe, expect, it } from "vitest";
import type { Subtask } from "../types";
import { moveSubtaskInsideTree } from "./treeOrder";

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
});

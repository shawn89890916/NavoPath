import { describe, expect, it } from "vitest";
import { buildAiProfile, predictTaskIntelligence } from "./aiPersonalization";
import type { PlannerData, Project, Task } from "./types";

const projects: Project[] = [
  { id: "esat", title: "ESAT", category: "exam", notes: "", completed: false, createdAt: "1", updatedAt: "1" },
  { id: "portfolio", title: "Portfolio", category: "project", notes: "", completed: false, createdAt: "1", updatedAt: "1" },
];

function task(id: string, title: string, projectId: string, minutes: number): Task {
  return { id, title, projectId, dueDate: "2026-07-13", category: "personal", priority: "medium", notes: "", goalId: "", completed: true, estimatedHours: minutes / 60, createdAt: "1", updatedAt: "1" };
}

function data(tasks: Task[]): PlannerData {
  return { version: 1, importedSeedVersion: "test", generatedAt: "1", goals: [], projects, tasks, longTasks: [], events: [], notes: [], drafts: [], chat: [], aiMemories: [] };
}

describe("AI personalization", () => {
  it("prefers actual timer history when estimating a similar task", () => {
    const planner = data([task("t1", "整理 ESAT 错题", "esat", 30)]);
    planner.timeEntries = [{ id: "e1", taskId: "t1", projectId: "esat", startAt: "1", endAt: "2", durationMinutes: 75, source: "timer", createdAt: "1", updatedAt: "1" }];
    const prediction = predictTaskIntelligence({ title: "整理 ESAT 错因", data: planner, projects });
    expect(prediction.duration.minutes).toBe(75);
    expect(prediction.duration.source).toBe("history");
  });

  it("suggests only existing projects and leaves weak matches unassigned", () => {
    const planner = data([
      task("t1", "ESAT 物理做题", "esat", 60),
      task("t2", "ESAT 数学做题", "esat", 60),
      task("t3", "更新作品集首页", "portfolio", 45),
    ]);
    expect(predictTaskIntelligence({ title: "ESAT 错题复习", data: planner, projects }).project?.projectId).toBe("esat");
    expect(predictTaskIntelligence({ title: "买牛奶", data: planner, projects }).project).toBeUndefined();
  });

  it("builds a compact synced profile", () => {
    const profile = buildAiProfile(data([task("t1", "更新作品集首页", "portfolio", 45)]));
    expect(profile.version).toBe(1);
    expect(profile.durationByProject.portfolio.minutes).toBe(45);
    expect(profile.projectTokenWeights.portfolio).toBeTruthy();
  });
});

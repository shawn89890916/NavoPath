import type { AiPersonalizationProfile, PlannerData, Project, Task } from "./types";
import { durationMinutes, SLOT_MINUTES } from "./timelineGeometry";

export const AI_PROFILE_VERSION = 1 as const;
export const AI_INFERENCE_MODEL_VERSION = "local-profile-v1";

export type TaskIntelligencePrediction = {
  duration: { minutes: number; confidence: number; source: "default" | "history" };
  project?: { projectId: string; confidence: number; source: "history" };
};

export function tokenizeTaskTitle(title: string): string[] {
  const text = title.toLowerCase().replace(/#[^\s#]+/g, " ");
  const latin = text.match(/[a-z0-9&+-]{2,}/g) || [];
  const chinese = text.match(/[\u4e00-\u9fff]{2,}/g) || [];
  const grams = chinese.flatMap((chunk) =>
    Array.from({ length: Math.max(chunk.length - 1, 0) }, (_, index) => chunk.slice(index, index + 2)),
  );
  return Array.from(new Set([...latin, ...grams])).filter((token) => token.length >= 2);
}

function taskDurationMinutes(task: Task): number {
  if (task.scheduledStart && task.scheduledEnd) {
    return Math.max(durationMinutes(task.scheduledStart, task.scheduledEnd), SLOT_MINUTES);
  }
  return Math.max(Math.round((task.estimatedHours || 0.5) * 60), SLOT_MINUTES);
}

export function learnedTaskDurationMinutes(title: string, tasks: Task[], projectId?: string): number {
  const tokens = tokenizeTaskTitle(title);
  const fallback = /复习|做题|刷题|essay|文书|编程|coding|debug|项目|申请|准备/i.test(title) ? 60
    : /整理|检查|回复|阅读|确认|查看|邮件/i.test(title) ? 30
      : 45;
  const scored = tasks
    .filter((task) => task.title && Math.round((task.estimatedHours || 0) * 60) >= SLOT_MINUTES)
    .map((task) => {
      const taskTokens = tokenizeTaskTitle(task.title);
      const overlap = tokens.filter((token) => taskTokens.includes(token)).length;
      const projectBoost = projectId && task.projectId === projectId ? 2 : 0;
      const score = overlap + projectBoost;
      return { score, minutes: taskDurationMinutes(task) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  if (scored.length === 0) return fallback;
  const weighted = scored.reduce((sum, item) => sum + item.minutes * item.score, 0);
  const weight = scored.reduce((sum, item) => sum + item.score, 0);
  const estimate = Math.round((weighted / Math.max(weight, 1)) / SLOT_MINUTES) * SLOT_MINUTES;
  return Math.min(Math.max(estimate, SLOT_MINUTES), 180);
}

function roundToQuarterHour(minutes: number): number {
  return Math.min(240, Math.max(15, Math.round(minutes / 15) * 15));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function fallbackDuration(title: string): number {
  if (/复习|做题|刷题|essay|文书|编程|coding|debug|项目|申请|准备|论文|实验/i.test(title)) return 60;
  if (/整理|检查|回复|阅读|确认|查看|邮件|浏览/i.test(title)) return 30;
  return 45;
}

function actualMinutesByTask(data: PlannerData): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of data.timeEntries || []) {
    if (!entry.taskId || !Number.isFinite(entry.durationMinutes) || entry.durationMinutes <= 0) continue;
    totals.set(entry.taskId, (totals.get(entry.taskId) || 0) + entry.durationMinutes);
  }
  return totals;
}

export function buildAiProfile(data: PlannerData): AiPersonalizationProfile {
  const actual = actualMinutesByTask(data);
  const durationSamples = new Map<string, number[]>();
  const projectTokenWeights: Record<string, Record<string, number>> = {};
  const startSamples = new Map<string, number[]>();

  const historySince = data.aiProfile?.historySince;
  for (const task of data.tasks || []) {
    if (historySince && task.updatedAt < historySince) continue;
    const projectId = task.projectId || "__unassigned__";
    const minutes = actual.get(task.id) || Math.round((task.estimatedHours || 0) * 60);
    if (minutes >= 5 && minutes <= 720) {
      const samples = durationSamples.get(projectId) || [];
      samples.push(minutes);
      durationSamples.set(projectId, samples);
    }
    if (task.projectId) {
      const weights = projectTokenWeights[task.projectId] || {};
      for (const token of tokenizeTaskTitle(task.title)) weights[token] = (weights[token] || 0) + (actual.has(task.id) ? 2 : 1);
      projectTokenWeights[task.projectId] = weights;
      for (const record of task.timelineRecords || []) {
        if (!record.scheduledStart || record.executionStatus === "cancelled") continue;
        const hour = Number(record.scheduledStart.slice(0, 2));
        if (!Number.isFinite(hour)) continue;
        const samples = startSamples.get(task.projectId) || [];
        samples.push(hour);
        startSamples.set(task.projectId, samples);
      }
    }
  }

  const durationByProject = Object.fromEntries(
    [...durationSamples.entries()].map(([projectId, samples]) => [
      projectId,
      { minutes: roundToQuarterHour(median(samples)), sampleCount: samples.length },
    ]),
  );
  const preferredStartHourByProject = Object.fromEntries(
    [...startSamples.entries()].map(([projectId, samples]) => [projectId, Math.round(median(samples))]),
  );

  return {
    version: AI_PROFILE_VERSION,
    updatedAt: new Date().toISOString(),
    historySince,
    durationByProject,
    projectTokenWeights,
    preferredStartHourByProject,
    feedback: data.aiProfile?.feedback || {
      durationCorrections: 0,
      projectCorrections: 0,
      assignmentUndos: 0,
      scheduleAccepts: 0,
      scheduleRejects: 0,
    },
  };
}

function taskSimilarity(tokens: string[], task: Task, projectId?: string): number {
  const taskTokens = tokenizeTaskTitle(task.title);
  const overlap = tokens.filter((token) => taskTokens.includes(token)).length;
  return overlap + (projectId && task.projectId === projectId ? 2 : 0);
}

export function predictTaskIntelligence(params: {
  title: string;
  projectId?: string;
  data: PlannerData;
  projects: Project[];
}): TaskIntelligencePrediction {
  const { title, projectId, data, projects } = params;
  const tokens = tokenizeTaskTitle(title);
  const actual = actualMinutesByTask(data);
  const durationMatches = (data.tasks || [])
    .map((task) => {
      const score = taskSimilarity(tokens, task, projectId);
      const minutes = actual.get(task.id) || Math.round((task.estimatedHours || 0) * 60);
      return { score: score * (actual.has(task.id) ? 1.5 : 1), minutes };
    })
    .filter((match) => match.score > 0 && match.minutes >= 5 && match.minutes <= 720)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  let duration = fallbackDuration(title);
  let durationConfidence = 0.35;
  let durationSource: "default" | "history" = "default";
  if (durationMatches.length > 0) {
    const totalWeight = durationMatches.reduce((sum, match) => sum + match.score, 0);
    duration = durationMatches.reduce((sum, match) => sum + match.minutes * match.score, 0) / totalWeight;
    durationConfidence = Math.min(0.95, 0.52 + totalWeight / 18);
    durationSource = "history";
  } else if (projectId && data.aiProfile?.durationByProject[projectId]) {
    const stat = data.aiProfile.durationByProject[projectId];
    duration = stat.minutes;
    durationConfidence = Math.min(0.82, 0.45 + stat.sampleCount / 20);
    durationSource = "history";
  }

  const validProjectIds = new Set(projects.map((project) => project.id));
  const profile = buildAiProfile(data);
  const projectScores = Object.entries(profile.projectTokenWeights)
    .filter(([candidateId]) => validProjectIds.has(candidateId))
    .map(([candidateId, weights]) => ({
      projectId: candidateId,
      score: tokens.reduce((sum, token) => sum + (weights[token] || 0), 0),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);
  const top = projectScores[0];
  const second = projectScores[1]?.score || 0;
  const project = top
    ? {
        projectId: top.projectId,
        confidence: Math.min(0.98, top.score / (top.score + second + 1)),
        source: "history" as const,
      }
    : undefined;

  return {
    duration: { minutes: roundToQuarterHour(duration), confidence: durationConfidence, source: durationSource },
    project,
  };
}

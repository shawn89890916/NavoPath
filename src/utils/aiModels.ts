export type AiModelOption = {
  id: string;
  label: string;
  family: string;
  tier: "economy" | "standard" | "pro";
  pro: boolean;
};

export type AiModelGroup = {
  family: string;
  models: AiModelOption[];
};

export type AiReasoningMode = "instant" | "high" | "xhigh";

export function reasoningModesForModel(id: string): AiReasoningMode[] {
  const label = id.replace(/^Pro\//i, "").split("/").pop() || id;
  if (/DeepSeek-V4-(?:Flash|Pro)|GLM-5\.2|Kimi-K2\.7-Code|LongCat-2\.0|Nex-N2-Pro/i.test(label)) {
    return ["instant", "high", "xhigh"];
  }
  if (/Qwen3\.6|MiniMax-M2\.5/i.test(label)) return ["instant", "high"];
  return ["instant"];
}

const MODEL_FAMILIES: Array<{ family: string; pattern: RegExp }> = [
  { family: "DeepSeek", pattern: /deepseek/i },
  { family: "Qwen", pattern: /qwen/i },
  { family: "GLM", pattern: /(?:glm|zai-org)/i },
  { family: "Kimi", pattern: /(?:kimi|moonshot)/i },
  { family: "MiniMax", pattern: /minimax/i },
  { family: "LongCat", pattern: /longcat/i },
  { family: "Nex", pattern: /nex-(?:agi|n2)/i },
  { family: "Llama", pattern: /llama/i },
  { family: "Mistral", pattern: /mistral|mixtral/i },
  { family: "Gemma", pattern: /gemma/i },
];

const PRO_MODEL = /(?:deepseek-v4-pro|glm-5\.2|kimi-k2\.7-code|longcat-2\.0|nex-n2-pro)/i;
const ECONOMY_MODEL = /(?:deepseek-v4-flash|qwen3\.6-27b|minimax-m2\.5)/i;
const NON_ASSISTANT_MODEL = /(?:ocr|vision|[-_.]vl(?:[-_.]|$)|omni|caption|audio|image|embedding|rerank|translate|mt[-_.])/i;
const ASSISTANT_MODEL_ALLOWLIST = [
  /DeepSeek-V4-(?:Flash|Pro)$/i,
  /Qwen3\.6-(?:27B|35B-A3B)$/i,
  /GLM-5\.2$/i,
  /Kimi-K2\.7-Code$/i,
  /LongCat-2\.0$/i,
  /MiniMax-M2\.5$/i,
  /Nex-N2-Pro$/i,
];

export function filterAiModels(ids: string[]): string[] {
  const byLabel = new Map<string, string>();
  ids.forEach((id) => {
    const cleanId = id.replace(/^Pro\//i, "");
    const label = cleanId.split("/").pop() || cleanId;
    if (NON_ASSISTANT_MODEL.test(label) || !ASSISTANT_MODEL_ALLOWLIST.some((pattern) => pattern.test(label))) return;
    const key = label.toLowerCase();
    const existing = byLabel.get(key);
    if (!existing || (/^Pro\//i.test(existing) && !/^Pro\//i.test(id))) byLabel.set(key, id);
  });
  return Array.from(byLabel.values()).sort((a, b) => {
    const modelA = describeAiModel(a);
    const modelB = describeAiModel(b);
    const familyA = MODEL_FAMILIES.findIndex((entry) => entry.family === modelA.family);
    const familyB = MODEL_FAMILIES.findIndex((entry) => entry.family === modelB.family);
    return familyA - familyB || modelB.label.localeCompare(modelA.label);
  });
}

export function describeAiModel(id: string): AiModelOption {
  const cleanId = id.replace(/^Pro\//i, "");
  const family = MODEL_FAMILIES.find((entry) => entry.pattern.test(cleanId))?.family || "Other";
  const tier = PRO_MODEL.test(cleanId) ? "pro" : ECONOMY_MODEL.test(cleanId) ? "economy" : "standard";
  return {
    id,
    label: cleanId.split("/").pop() || cleanId,
    family,
    tier,
    pro: tier === "pro",
  };
}

export function groupAiModels(ids: string[]): AiModelGroup[] {
  const familyOrder = [...MODEL_FAMILIES.map((entry) => entry.family), "Other"];
  const groups = new Map<string, AiModelOption[]>();
  const uniqueLabels = new Map<string, string>();
  Array.from(new Set(ids.filter(Boolean))).forEach((id) => {
    const model = describeAiModel(id);
    const key = model.label.toLowerCase();
    const existing = uniqueLabels.get(key);
    const isCanonical = id.includes("/");
    if (!existing || (!existing.includes("/") && isCanonical)) uniqueLabels.set(key, id);
  });
  uniqueLabels.forEach((id) => {
    const model = describeAiModel(id);
    groups.set(model.family, [...(groups.get(model.family) || []), model]);
  });
  return familyOrder
    .filter((family) => groups.has(family))
    .map((family) => ({
      family,
      models: (groups.get(family) || []).sort((a, b) => Number(b.pro) - Number(a.pro) || a.label.localeCompare(b.label)),
    }));
}

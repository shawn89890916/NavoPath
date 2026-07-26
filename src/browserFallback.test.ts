import { describe, expect, it } from "vitest";
import { parseLocalPreviewSettings, shouldUseLocalPreviewByDefault } from "./browserFallback";

describe("browser fallback preview mode", () => {
  it("defaults localhost dev app routes to local preview unless cloud mode is explicit", () => {
    expect(shouldUseLocalPreviewByDefault("127.0.0.1", "/app", null)).toBe(true);
    expect(shouldUseLocalPreviewByDefault("localhost", "/app", null)).toBe(true);
    expect(shouldUseLocalPreviewByDefault("127.0.0.1", "/app", "cloud")).toBe(false);
    expect(shouldUseLocalPreviewByDefault("navopath.app", "/app", null)).toBe(false);
  });

  it("uses canonical migrations while preserving local preview defaults", () => {
    const settings = parseLocalPreviewSettings(JSON.stringify({
      language: "zh",
      model: "deepseek-chat",
      executeAccentColor: "#C69CF9",
      _apiKey: "1234567890",
    }));

    expect(settings.displayName).toBe("NavoPath Preview");
    expect(settings.panelWidths).toEqual({ left: 310, right: 360 });
    expect(settings.language).toBe("zh");
    expect(settings.model).toBe("deepseek-ai/DeepSeek-V3.2");
    expect(settings.executeAccentColor).toBe("");
    expect(settings.hasApiKey).toBe(true);
    expect(settings.apiKeyPreview).toBe("123456...7890");
  });

  it("recovers from a corrupt local settings snapshot", () => {
    const settings = parseLocalPreviewSettings("{broken");

    expect(settings.displayName).toBe("NavoPath Preview");
    expect(settings.activeMode).toBe("execute");
    expect(settings.widgetTimerPreferences?.mode).toBe("stopwatch");
  });

  it("discards malformed local API key values", () => {
    const settings = parseLocalPreviewSettings(JSON.stringify({ _apiKey: 123456 }));

    expect(settings._apiKey).toBeUndefined();
    expect(settings.hasApiKey).toBe(false);
  });
});

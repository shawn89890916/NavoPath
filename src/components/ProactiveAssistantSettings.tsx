import { useEffect, useState } from "react";
import type { Language, PlannerData, Settings } from "../types";
import { SettingActionButton, SettingDivider, SettingRow, SettingSelect, SettingToggle } from "./SettingsControls";
import { ProactiveAssistantInbox } from "./ProactiveAssistantInbox";
import { readProactiveEmailEnabled, requestProactiveNotificationPermission, setProactiveEmailEnabled } from "../proactiveAssistant";

export function ProactiveAssistantSettings({ settings, data, lang, cloudReady, onSave, onSaveData, onRequestLocation }: {
  settings: Settings;
  data: PlannerData;
  lang: Language;
  cloudReady: boolean;
  onSave: (patch: Partial<Settings>) => void;
  onSaveData: (data: PlannerData) => void;
  onRequestLocation: () => void;
}) {
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  useEffect(() => {
    if (!cloudReady) return;
    void readProactiveEmailEnabled().then(setEmailEnabled).catch(() => undefined);
  }, [cloudReady]);
  const changeEmail = async (enabled: boolean) => {
    setEmailEnabled(enabled);
    setEmailBusy(true);
    try { await setProactiveEmailEnabled(enabled); }
    catch { setEmailEnabled(!enabled); }
    finally { setEmailBusy(false); }
  };
  const enableSystemNotifications = async () => setNotificationPermission(await requestProactiveNotificationPermission());
  return <>
    {cloudReady && <ProactiveAssistantInbox data={data} lang={lang} onSaveData={onSaveData} />}
    <SettingDivider />
    <SettingRow
      anchor="proactive-assistant"
      title={lang === "zh" ? "主动日程助理" : "Proactive schedule assistant"}
      description={lang === "zh" ? "默认主动检查截止风险、资料变化与日程，并可在 24 小时内撤销自动调整。" : "Proactively checks deadline risk, workspace changes, and the schedule; automatic changes remain undoable for 24 hours."}
      control={<SettingToggle checked={settings.proactiveAssistantEnabled !== false} disabled={!cloudReady} ariaLabel={lang === "zh" ? "主动日程助理" : "Proactive schedule assistant"} onChange={(next) => onSave({ proactiveAssistantEnabled: next, proactiveAssistantIntroSeen: next ? settings.proactiveAssistantIntroSeen : true })} />}
    />
    {!settings.proactiveAssistantIntroSeen && <SettingRow
      title={lang === "zh" ? "了解主动规则" : "Acknowledge proactive rules"}
      description={lang === "zh" ? "普通任务可被自动安排；锁定日程、硬截止和删除仍需你的确认。" : "Ordinary tasks may be automatically scheduled; locked schedules, hard deadlines, and deletion still need your confirmation."}
      control={<SettingActionButton onClick={() => onSave({ proactiveAssistantIntroSeen: true })}>{lang === "zh" ? "我知道了" : "Got it"}</SettingActionButton>}
    />}
    <SettingRow
      title={lang === "zh" ? "直接调整普通任务" : "Auto-adjust ordinary tasks"}
      description={lang === "zh" ? "关闭后仍给出主动简报和风险提示，但不自动改动任务。" : "When off, the assistant still briefs and flags risk but does not change tasks automatically."}
      control={<SettingToggle checked={settings.proactiveAssistantAutoAdjust !== false} disabled={settings.proactiveAssistantEnabled === false} ariaLabel={lang === "zh" ? "直接调整普通任务" : "Auto-adjust ordinary tasks"} onChange={(next) => onSave({ proactiveAssistantAutoAdjust: next })} />}
    />
    <SettingRow
      title={lang === "zh" ? "补记未安排空档" : "Ask about unplanned gaps"}
      description={lang === "zh" ? "工作时间内，已过去且未安排的空档会提醒你补记实际工作。" : "During working hours, unplanned past gaps prompt you to log what you actually did."}
      control={<SettingToggle checked={settings.proactiveAssistantGapChecks !== false} disabled={settings.proactiveAssistantEnabled === false} ariaLabel={lang === "zh" ? "补记未安排空档" : "Ask about unplanned gaps"} onChange={(next) => onSave({ proactiveAssistantGapChecks: next })} />}
    />
    <SettingRow
      title={lang === "zh" ? "空档阈值" : "Gap threshold"}
      control={<SettingSelect<string> value={String(settings.proactiveAssistantGapThresholdMinutes || 30)} ariaLabel={lang === "zh" ? "空档阈值" : "Gap threshold"} onChange={(value) => onSave({ proactiveAssistantGapThresholdMinutes: Number(value) })} options={[15, 30, 45, 60, 90].map((minutes) => ({ value: String(minutes), label: `${minutes} ${lang === "zh" ? "分钟" : "min"}` }))} />}
    />
    <SettingRow
      title={lang === "zh" ? "晨间天气地点" : "Morning weather location"}
      description={settings.proactiveAssistantLocation ? (lang === "zh" ? `已于 ${new Date(settings.proactiveAssistantLocation.capturedAt).toLocaleDateString()} 更新设备定位。` : `Device location updated ${new Date(settings.proactiveAssistantLocation.capturedAt).toLocaleDateString()}.`) : (lang === "zh" ? "允许设备定位后，晨间简报才会包含本地天气。" : "Allow device location to include local weather in morning briefs.")}
      control={<SettingActionButton onClick={onRequestLocation}>{lang === "zh" ? "更新定位" : "Update location"}</SettingActionButton>}
    />
    <SettingRow
      title={lang === "zh" ? "邮件通知" : "Email notifications"}
      description={lang === "zh" ? "仅在已连接邮件服务且当前账户地址可用时发送；应用内通知始终保留。" : "Sent only when email delivery is connected and this account has an address; in-app notifications remain available."}
      control={<SettingToggle checked={emailEnabled} disabled={!cloudReady || emailBusy} ariaLabel={lang === "zh" ? "邮件通知" : "Email notifications"} onChange={(next) => void changeEmail(next)} />}
    />
    <SettingRow
      title={lang === "zh" ? "系统通知" : "System notifications"}
      description={lang === "zh"
        ? (notificationPermission === "granted" ? "新的主动提醒会显示为系统通知。" : notificationPermission === "denied" ? "系统通知已被浏览器或系统阻止；请在系统权限中重新允许。" : "允许后，新的主动提醒会在应用外显示。")
        : (notificationPermission === "granted" ? "New proactive messages appear as system notifications." : notificationPermission === "denied" ? "System notifications are blocked. Re-enable them in your browser or system settings." : "Allow notifications to see new proactive messages outside the app.")}
      control={<SettingActionButton disabled={!cloudReady || notificationPermission === "granted" || notificationPermission === "denied" || notificationPermission === "unsupported"} onClick={() => void enableSystemNotifications()}>{notificationPermission === "granted" ? (lang === "zh" ? "已开启" : "Enabled") : (lang === "zh" ? "开启" : "Enable")}</SettingActionButton>}
    />
  </>;
}

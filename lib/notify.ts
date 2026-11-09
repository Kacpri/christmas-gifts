const FLAG = "notify-enabled";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notifyPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export function isNotifyMuted(): boolean {
  try {
    return localStorage.getItem(FLAG) === "0";
  } catch {
    return false;
  }
}

export function setNotifyMuted(muted: boolean) {
  try {
    localStorage.setItem(FLAG, muted ? "0" : "1");
  } catch {
    // localStorage niedostępny — ignoruj
  }
}

export async function requestNotifyPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  return Notification.requestPermission();
}

export function notify(title: string, body: string) {
  if (!notificationsSupported()) return;
  if (Notification.permission !== "granted") return;
  if (isNotifyMuted()) return;
  if (typeof document !== "undefined" && !document.hidden) return;
  try {
    const n = new Notification(title, { body, icon: "/icon.svg" });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // np. iOS Safari bez wsparcia — ignoruj
  }
}

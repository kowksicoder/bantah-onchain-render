const DEFAULT_BASE = "https://bantah.com";
const DEFAULT_SETTINGS = {
  bantah_base: DEFAULT_BASE,
  bantah_notify: true,
  bantah_interval_minutes: 5,
};

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (res) => {
      resolve(res);
    });
  });
}

function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, resolve);
  });
}

function normalizeBaseUrl(value) {
  try {
    return new URL(value || DEFAULT_BASE).origin;
  } catch (_error) {
    return DEFAULT_BASE;
  }
}

function openUrl(base, path = '/') {
  try {
    const url = new URL(path, normalizeBaseUrl(base)).toString();
    chrome.tabs.create({ url });
  } catch (_error) {
    chrome.tabs.create({ url: normalizeBaseUrl(base) });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const baseInput = document.getElementById('baseUrl');
  const saveBtn = document.getElementById('save-url');
  const openRoot = document.getElementById('open-root');
  const openEvents = document.getElementById('open-events');
  const openCreate = document.getElementById('open-create');
  const quickLogin = document.getElementById('quick-login');
  const openTab = document.getElementById('open-tab');
  const notifyToggle = document.getElementById('notifyToggle');
  const intervalInput = document.getElementById('interval');

  const settings = await getSettings();
  baseInput.value = normalizeBaseUrl(settings.bantah_base);
  notifyToggle.checked = settings.bantah_notify !== false;
  intervalInput.value = settings.bantah_interval_minutes || 5;

  saveBtn.addEventListener('click', async () => {
    const v = normalizeBaseUrl(baseInput.value);
    const minutes = parseInt(intervalInput.value, 10) || 5;
    const notify = notifyToggle.checked;
    await saveSettings({ bantah_base: v, bantah_interval_minutes: minutes, bantah_notify: notify });
    chrome.alarms.create('bantah_poll_notifications', { periodInMinutes: Math.max(1, minutes) });
    window.close();
  });

  openRoot.addEventListener('click', () => openUrl(baseInput.value || DEFAULT_BASE, '/'));
  openEvents.addEventListener('click', () => openUrl(baseInput.value || DEFAULT_BASE, '/events'));
  openCreate.addEventListener('click', () => openUrl(baseInput.value || DEFAULT_BASE, '/events/create'));
  openTab.addEventListener('click', () => chrome.tabs.create({ url: normalizeBaseUrl(baseInput.value || DEFAULT_BASE) }));

  quickLogin.addEventListener('click', () => {
    openUrl(baseInput.value || DEFAULT_BASE, '/?show_login=1');
  });

  notifyToggle.addEventListener('change', async () => {
    const minutes = parseInt(intervalInput.value, 10) || 5;
    await saveSettings({
      bantah_base: normalizeBaseUrl(baseInput.value || DEFAULT_BASE),
      bantah_interval_minutes: minutes,
      bantah_notify: notifyToggle.checked,
    });
    if (notifyToggle.checked) {
      chrome.alarms.create('bantah_poll_notifications', { periodInMinutes: Math.max(1, minutes) });
    } else {
      chrome.alarms.clear('bantah_poll_notifications');
    }
  });

  document.getElementById('open-root').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'trigger-poll' });
  });
});

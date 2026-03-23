// ── Browser API shim (Chrome uses chrome.*, Firefox uses browser.*) ──────────
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

// Storage keys
const STORAGE_KEYS = {
  HISTORY: 'timeconv_history',
  SETTINGS: 'timeconv_settings'
};

// Default settings
const DEFAULT_SETTINGS = {
  format24: true,
  showMilliseconds: false,
  autoConvert: true,
  saveHistory: true,
  historyLimit: 10,
  autoTimezone: true,
  manualOffset: 0
};

// Global state
let settings = { ...DEFAULT_SETTINGS };
let conversionHistory = [];
let currentDate = null;
let isUpdating = false;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadHistory();
  initializeUI();
  startClock();
});

// ── Storage helpers (works with both Promise-based browser.* and callback chrome.*) ──
function storageGet(key) {
  return new Promise((resolve, reject) => {
    const result = browserAPI.storage.local.get(key);
    // browser.* returns a Promise; chrome.* returns undefined and uses a callback
    if (result && typeof result.then === 'function') {
      result.then(resolve).catch(reject);
    } else {
      browserAPI.storage.local.get(key, (data) => {
        if (browserAPI.runtime.lastError) {
          reject(browserAPI.runtime.lastError);
        } else {
          resolve(data);
        }
      });
    }
  });
}

function storageSet(data) {
  return new Promise((resolve, reject) => {
    const result = browserAPI.storage.local.set(data);
    if (result && typeof result.then === 'function') {
      result.then(resolve).catch(reject);
    } else {
      browserAPI.storage.local.set(data, () => {
        if (browserAPI.runtime.lastError) {
          reject(browserAPI.runtime.lastError);
        } else {
          resolve();
        }
      });
    }
  });
}

// ── Settings ──────────────────────────────────────────────────────────────────

async function loadSettings() {
  try {
    const result = await storageGet(STORAGE_KEYS.SETTINGS);
    if (result[STORAGE_KEYS.SETTINGS]) {
      settings = { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
    } else {
      const systemOffset = -new Date().getTimezoneOffset();
      settings.manualOffset = systemOffset / 60;
    }
  } catch (e) {
    console.warn('Failed to load settings:', e);
  }
  applySettings();
}

function saveSettings() {
  storageSet({ [STORAGE_KEYS.SETTINGS]: settings }).catch(e =>
    console.warn('Failed to save settings:', e)
  );
}

function applySettings() {
  document.getElementById('format24Toggle').checked = settings.format24;
  document.getElementById('millisecondsToggle').checked = settings.showMilliseconds;
  document.getElementById('autoConvertToggle').checked = settings.autoConvert;
  document.getElementById('historyToggle').checked = settings.saveHistory;
  document.getElementById('historyLimit').value = settings.historyLimit;
  document.getElementById('autoTimezoneToggle').checked = settings.autoTimezone;
  document.getElementById('timezoneOffset').value = settings.manualOffset;

  const manualOffsetSetting = document.getElementById('manualOffsetSetting');
  if (settings.autoTimezone) {
    manualOffsetSetting.style.opacity = '0.5';
    manualOffsetSetting.style.pointerEvents = 'none';
  } else {
    manualOffsetSetting.style.opacity = '1';
    manualOffsetSetting.style.pointerEvents = 'auto';
  }
}

// ── History ───────────────────────────────────────────────────────────────────

async function loadHistory() {
  try {
    const result = await storageGet(STORAGE_KEYS.HISTORY);
    conversionHistory = result[STORAGE_KEYS.HISTORY] || [];
  } catch (e) {
    console.warn('Failed to load history:', e);
    conversionHistory = [];
  }
  renderHistory();
}

function saveHistory() {
  if (!settings.saveHistory) return;
  if (conversionHistory.length > settings.historyLimit) {
    conversionHistory = conversionHistory.slice(0, settings.historyLimit);
  }
  storageSet({ [STORAGE_KEYS.HISTORY]: conversionHistory }).catch(e =>
    console.warn('Failed to save history:', e)
  );
}

// ── UI ────────────────────────────────────────────────────────────────────────

function initializeUI() {
  const utcInput = document.getElementById('utcInput');
  const localInput = document.getElementById('localInput');

  let utcTimeout;
  utcInput.addEventListener('input', (e) => {
    if (isUpdating) return;
    clearTimeout(utcTimeout);
    const value = e.target.value.trim();
    if (!value) { clearLocalInput(); return; }
    if (settings.autoConvert) {
      utcTimeout = setTimeout(() => handleUtcInput(value), 300);
    }
  });

  utcInput.addEventListener('paste', () => {
    if (settings.autoConvert) {
      setTimeout(() => handleUtcInput(utcInput.value.trim()), 50);
    }
  });

  let localTimeout;
  localInput.addEventListener('input', (e) => {
    if (isUpdating) return;
    clearTimeout(localTimeout);
    const value = e.target.value.trim();
    if (!value) { clearUtcInput(); return; }
    if (settings.autoConvert) {
      localTimeout = setTimeout(() => handleLocalInput(value), 300);
    }
  });

  localInput.addEventListener('paste', () => {
    if (settings.autoConvert) {
      setTimeout(() => handleLocalInput(localInput.value.trim()), 50);
    }
  });

  document.querySelectorAll('.input-action-btn').forEach(btn => {
    btn.addEventListener('click', handleActionButton);
  });

  document.getElementById('clearBtn').addEventListener('click', clearAll);
  document.getElementById('settingsBtn').addEventListener('click', showSettings);
  document.getElementById('backBtn').addEventListener('click', showMain);

  document.getElementById('format24Toggle').addEventListener('change', (e) => {
    settings.format24 = e.target.checked;
    saveSettings();
    if (currentDate) updateDisplays(currentDate);
  });

  document.getElementById('millisecondsToggle').addEventListener('change', (e) => {
    settings.showMilliseconds = e.target.checked;
    saveSettings();
    if (currentDate) updateDisplays(currentDate);
  });

  document.getElementById('autoConvertToggle').addEventListener('change', (e) => {
    settings.autoConvert = e.target.checked;
    saveSettings();
  });

  document.getElementById('autoTimezoneToggle').addEventListener('change', (e) => {
    settings.autoTimezone = e.target.checked;
    saveSettings();
    applySettings();
    if (currentDate) {
      isUpdating = true;
      updateLocalFromUtc(currentDate);
      updateDisplays(currentDate);
      isUpdating = false;
    }
  });

  document.getElementById('timezoneOffset').addEventListener('change', (e) => {
    settings.manualOffset = parseFloat(e.target.value);
    saveSettings();
    if (currentDate && !settings.autoTimezone) {
      isUpdating = true;
      updateLocalFromUtc(currentDate);
      updateDisplays(currentDate);
      isUpdating = false;
    }
  });

  document.getElementById('historyToggle').addEventListener('change', (e) => {
    settings.saveHistory = e.target.checked;
    saveSettings();
    renderHistory();
  });

  document.getElementById('historyLimit').addEventListener('change', (e) => {
    settings.historyLimit = parseInt(e.target.value);
    saveSettings();
  });

  document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
}

// ── Conversion logic ──────────────────────────────────────────────────────────

function handleUtcInput(input) {
  const parsedDate = parseTimeInput(input, true);
  if (!parsedDate) return;
  currentDate = parsedDate;
  isUpdating = true;
  updateLocalFromUtc(parsedDate);
  updateDisplays(parsedDate);
  isUpdating = false;
  addToHistory(parsedDate);
}

function handleLocalInput(input) {
  const parsedDate = parseTimeInput(input, false);
  if (!parsedDate) return;
  currentDate = parsedDate;
  isUpdating = true;
  updateUtcFromLocal(parsedDate);
  updateDisplays(parsedDate);
  isUpdating = false;
  addToHistory(parsedDate);
}

function parseTimeInput(input, isUtc) {
  if (input.toLowerCase() === 'now') return new Date();

  if (/^\d{10}$/.test(input)) return new Date(parseInt(input) * 1000);
  if (/^\d{13}$/.test(input)) return new Date(parseInt(input));

  let cleaned = input
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // DD/MM/YYYY HH:MM:SS
  const ddmmyyyyMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year, hours, minutes, seconds, ms] = ddmmyyyyMatch;
    if (isUtc) {
      // Always treat as UTC
      return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, ms || 0));
    } else if (!settings.autoTimezone) {
      const localDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, ms || 0));
      const offsetMinutes = getTimezoneOffset();
      return new Date(localDate.getTime() - offsetMinutes * 60000);
    } else {
      const date = new Date(year, month - 1, day, hours, minutes, seconds, ms || 0);
      if (!isNaN(date.getTime())) return date;
    }
  }

  if (isUtc && !cleaned.includes('Z') && !cleaned.match(/[+-]\d{2}:\d{2}$/)) {
    // No timezone info provided — force interpret as UTC by appending Z.
    // Normalize separator: JS requires 'T' between date and time for ISO parsing.
    const normalized = cleaned.replace(' ', 'T') + 'Z';
    const date = new Date(normalized);
    if (!isNaN(date.getTime())) return date;
  }

  if (!isUtc && !cleaned.includes('Z') && !cleaned.match(/[+-]\d{2}:\d{2}$/)) {
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      if (!settings.autoTimezone) {
        const systemOffset = -date.getTimezoneOffset();
        const manualOffset = getTimezoneOffset();
        const offsetDiff = manualOffset - systemOffset;
        return new Date(date.getTime() - offsetDiff * 60000);
      }
      return date;
    }
  }

  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) return date;

  return null;
}

function getTimezoneOffset() {
  if (settings.autoTimezone) {
    return -new Date().getTimezoneOffset();
  } else {
    return settings.manualOffset * 60;
  }
}

function updateLocalFromUtc(date) {
  document.getElementById('localInput').value = formatInputTime(date, false);
}

function updateUtcFromLocal(date) {
  document.getElementById('utcInput').value = date.toISOString();
}

function formatInputTime(date, isUtc) {
  if (isUtc) return date.toISOString();

  const offsetMinutes = getTimezoneOffset();
  const localDate = new Date(date.getTime() + offsetMinutes * 60000);

  const year    = localDate.getUTCFullYear();
  const month   = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const day     = String(localDate.getUTCDate()).padStart(2, '0');
  const hours   = String(localDate.getUTCHours()).padStart(2, '0');
  const minutes = String(localDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(localDate.getUTCSeconds()).padStart(2, '0');

  if (settings.showMilliseconds) {
    const ms = String(localDate.getUTCMilliseconds()).padStart(3, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}.${ms}`;
  }
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function updateDisplays(date) {
  const utcIso      = date.toISOString();
  const utcUnix     = Math.floor(date.getTime() / 1000);
  const utcReadable = formatReadable(date, true);

  document.getElementById('utcIso').textContent      = utcIso;
  document.getElementById('utcUnix').textContent     = utcUnix;
  document.getElementById('utcReadable').textContent = utcReadable;

  const localIso = formatLocalISO(date);
  document.getElementById('localIso').textContent = localIso;

  if (settings.autoTimezone) {
    const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
    document.getElementById('timezoneInfo').textContent = tzName;
  } else {
    const tzOffset  = getTimezoneOffset();
    const tzHours   = Math.floor(Math.abs(tzOffset) / 60);
    const tzMinutes = Math.abs(tzOffset) % 60;
    const tzSign    = tzOffset >= 0 ? '+' : '-';
    document.getElementById('timezoneInfo').textContent =
      `UTC${tzSign}${String(tzHours).padStart(2, '0')}:${String(tzMinutes).padStart(2, '0')}`;
  }

  const now    = new Date();
  const diffMs = date.getTime() - now.getTime();
  document.getElementById('timeDiff').textContent = formatTimeDifference(diffMs);
}

function formatLocalISO(date) {
  const tzOffset  = getTimezoneOffset();
  const tzHours   = Math.floor(Math.abs(tzOffset) / 60);
  const tzMinutes = Math.abs(tzOffset) % 60;
  const tzSign    = tzOffset >= 0 ? '+' : '-';

  const localDate = new Date(date.getTime() + tzOffset * 60000);

  const year    = localDate.getUTCFullYear();
  const month   = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const day     = String(localDate.getUTCDate()).padStart(2, '0');
  const hours   = String(localDate.getUTCHours()).padStart(2, '0');
  const minutes = String(localDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(localDate.getUTCSeconds()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds} ${tzSign}${String(tzHours).padStart(2, '0')}:${String(tzMinutes).padStart(2, '0')}`;
}

function formatReadable(date, isUtc) {
  let displayDate;
  if (isUtc) {
    displayDate = date;
  } else {
    const offsetMinutes = getTimezoneOffset();
    displayDate = new Date(date.getTime() + offsetMinutes * 60000);
  }

  const year    = displayDate.getUTCFullYear();
  const month   = String(displayDate.getUTCMonth() + 1).padStart(2, '0');
  const day     = String(displayDate.getUTCDate()).padStart(2, '0');
  const hours   = displayDate.getUTCHours();
  const minutes = String(displayDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(displayDate.getUTCSeconds()).padStart(2, '0');

  const weekday = displayDate.toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: 'UTC'
  });

  if (settings.format24) {
    const hoursStr = String(hours).padStart(2, '0');
    return `${weekday}, ${day}/${month}/${year} ${hoursStr}:${minutes}:${seconds}`;
  } else {
    let hour12 = hours % 12;
    hour12 = hour12 ? hour12 : 12;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    return `${weekday}, ${day}/${month}/${year} ${hour12}:${minutes}:${seconds} ${ampm}`;
  }
}

function formatTimeDifference(diffMs) {
  const absDiff = Math.abs(diffMs);
  const isPast  = diffMs < 0;

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);

  let parts = [];
  if (days > 0) {
    parts.push(`${days}d`);
    if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  } else if (hours > 0) {
    parts.push(`${hours}h`);
    if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  } else if (minutes > 0) {
    parts.push(`${minutes}m`);
    if (seconds % 60 > 0) parts.push(`${seconds % 60}s`);
  } else {
    parts.push(`${seconds}s`);
  }

  if (Math.abs(seconds) < 10) return 'just now';
  return isPast ? `${parts.join(' ')} ago` : `in ${parts.join(' ')}`;
}

// ── Inputs ────────────────────────────────────────────────────────────────────

function clearUtcInput() {
  document.getElementById('utcInput').value = '';
  document.getElementById('utcIso').textContent = '';
  document.getElementById('utcUnix').textContent = '';
  document.getElementById('utcReadable').textContent = '';
}

function clearLocalInput() {
  document.getElementById('localInput').value = '';
  document.getElementById('localIso').textContent = '';
  document.getElementById('timezoneInfo').textContent = '';
  document.getElementById('timeDiff').textContent = '';
}

function clearAll() {
  isUpdating = true;
  clearUtcInput();
  clearLocalInput();
  currentDate = null;
  isUpdating = false;
}

// ── Action buttons ────────────────────────────────────────────────────────────

function handleActionButton(e) {
  const action = e.currentTarget.dataset.action;
  switch (action) {
    case 'now-utc':   insertNowUtc();   break;
    case 'now-local': insertNowLocal(); break;
    case 'copy-utc':
      copyToClipboard(document.getElementById('utcIso').textContent, e.currentTarget);
      break;
    case 'copy-local':
      copyToClipboard(document.getElementById('localIso').textContent, e.currentTarget);
      break;
  }
}

function insertNowUtc() {
  const now = new Date();
  document.getElementById('utcInput').value = now.toISOString();
  handleUtcInput(now.toISOString());
}

function insertNowLocal() {
  const now = new Date();
  document.getElementById('localInput').value = formatInputTime(now, false);
  handleLocalInput(formatInputTime(now, false));
}

// Clipboard — navigator.clipboard requires a secure context/user gesture.
// Fallback covers edge cases in both browsers.
function copyToClipboard(text, button) {
  if (!text) return;

  const showCopied = () => {
    const originalHTML = button.innerHTML;
    button.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>`;
    button.classList.add('copied');
    setTimeout(() => {
      button.innerHTML = originalHTML;
      button.classList.remove('copied');
    }, 2000);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(showCopied).catch(() => {
      clipboardFallback(text);
      showCopied();
    });
  } else {
    clipboardFallback(text);
    showCopied();
  }
}

function clipboardFallback(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try { document.execCommand('copy'); } catch (e) { /* silent */ }
  document.body.removeChild(textarea);
}

// ── History ───────────────────────────────────────────────────────────────────

function addToHistory(date) {
  if (!settings.saveHistory) return;
  const entry = { timestamp: Date.now(), date: date.toISOString() };
  conversionHistory = conversionHistory.filter(h => h.date !== entry.date);
  conversionHistory.unshift(entry);
  saveHistory();
  renderHistory();
}

function renderHistory() {
  const historyList    = document.getElementById('historyList');
  const historySection = document.getElementById('historySection');

  if (!settings.saveHistory || conversionHistory.length === 0) {
    historySection.classList.add('hidden');
    return;
  }

  historySection.classList.remove('hidden');

  historyList.innerHTML = conversionHistory.slice(0, 5).map(entry => {
    const date    = new Date(entry.date);
    const timeStr = formatInputTime(date, false);
    const ago     = formatTimeDifference(date.getTime() - Date.now());
    return `
      <div class="history-item" data-date="${entry.date}">
        <span class="history-time">${timeStr}</span>
        <span class="history-date">${ago}</span>
      </div>
    `;
  }).join('');

  historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const dateStr = item.dataset.date;
      document.getElementById('utcInput').value = dateStr;
      handleUtcInput(dateStr);
    });
  });
}

// ── confirm() is blocked in Firefox extension popups — use inline modal ───────

function clearHistory() {
  showConfirmModal('Clear all conversion history?', () => {
    conversionHistory = [];
    saveHistory();
    renderHistory();
  });
}

function showConfirmModal(message, onConfirm) {
  // Remove any existing modal first
  const existing = document.getElementById('confirmModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'confirmModal';
  modal.style.cssText = `
    position: fixed; inset: 0; z-index: 9999;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  `;

  modal.innerHTML = `
    <div style="
      background: #1a1a1a;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 12px;
      padding: 24px;
      max-width: 280px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    ">
      <p style="
        color: rgba(255,255,255,0.9);
        font-size: 14px;
        font-family: 'Inter', sans-serif;
        margin-bottom: 20px;
        line-height: 1.5;
      ">${message}</p>
      <div style="display:flex; gap:10px; justify-content:flex-end;">
        <button id="modalCancel" style="
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.7);
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
        ">Cancel</button>
        <button id="modalConfirm" style="
          background: rgba(239,68,68,0.2);
          border: 1px solid rgba(239,68,68,0.4);
          color: #ef4444;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
        ">Confirm</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('modalCancel').addEventListener('click', () => modal.remove());
  document.getElementById('modalConfirm').addEventListener('click', () => {
    modal.remove();
    onConfirm();
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

// ── Navigation ────────────────────────────────────────────────────────────────

function showSettings() {
  document.getElementById('mainView').classList.add('hidden');
  document.getElementById('settingsView').classList.remove('hidden');
}

function showMain() {
  document.getElementById('settingsView').classList.add('hidden');
  document.getElementById('mainView').classList.remove('hidden');
}

// ── Clock ─────────────────────────────────────────────────────────────────────

function startClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now    = new Date();
  const utcStr = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  document.getElementById('currentTime').textContent = utcStr;
}

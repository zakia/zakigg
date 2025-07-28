// File: src/routes/xls/historyStorage.ts

export interface HistoryEntry {
  id: string;
  name: string;
  type: 'file' | 'paste';
  data: string; // base64 for files, TSV string for pastes
  date: number; // timestamp
  size: number;
  meta?: Record<string, any>; // e.g., original filename, mimetype
}

const STORAGE_KEY = 'xls-history';

function getHistory(): HistoryEntry[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(history: HistoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function addEntry(entry: HistoryEntry) {
  const history = getHistory();
  history.unshift(entry); // newest first
  saveHistory(history);
}

function removeEntry(id: string) {
  const history = getHistory().filter(e => e.id !== id);
  saveHistory(history);
}

function renameEntry(id: string, newName: string) {
  const history = getHistory().map(e => e.id === id ? { ...e, name: newName } : e);
  saveHistory(history);
}

function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

function exportHistory(): string {
  return localStorage.getItem(STORAGE_KEY) || '[]';
}

function importHistory(json: string) {
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr)) {
      saveHistory(arr);
      return true;
    }
  } catch {}
  return false;
}

// --- Helpers for Svelte integration ---

/** Get the most recent entry (or null if none) */
function getMostRecentEntry(): HistoryEntry | null {
  const history = getHistory();
  return history.length > 0 ? history[0] : null;
}

/** Get a specific entry by id */
function getEntryById(id: string): HistoryEntry | null {
  const history = getHistory();
  return history.find(e => e.id === id) || null;
}

/** Convert a File to a HistoryEntry (async, returns Promise<HistoryEntry>) */
async function fileToHistoryEntry(file: File): Promise<HistoryEntry> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  // Convert to base64 in chunks to avoid call stack overflow
  let binaryString = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    binaryString += String.fromCharCode(...chunk);
  }
  const base64String = btoa(binaryString);
  return {
    id: crypto.randomUUID(),
    name: file.name,
    type: 'file',
    data: base64String,
    date: Date.now(),
    size: file.size,
    meta: {
      mimetype: file.type
    }
  };
}

/** Convert pasted table (TSV string) to a HistoryEntry */
function pasteToHistoryEntry(tsv: string, columns: string[]): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    name: 'Clipboard Data',
    type: 'paste',
    data: tsv,
    date: Date.now(),
    size: tsv.length,
    meta: { columns }
  };
}

/** Convert a HistoryEntry to a File (for type 'file') */
function historyEntryToFile(entry: HistoryEntry): File | null {
  if (entry.type !== 'file') return null;
  const binaryString = atob(entry.data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const name = entry.name || 'data';
  const type = entry.meta?.mimetype || 'application/octet-stream';
  return new File([bytes], name, { type });
}

/** Convert a HistoryEntry (type 'paste') to parsed data and columns */
function historyEntryToParsedPaste(entry: HistoryEntry): { columns: string[], parsedData: any[] } | null {
  if (entry.type !== 'paste') return null;
  const rows = entry.data.split('\n').map(row => row.split('\t'));
  if (!rows.length || !rows[0].length) return null;
  const columns = entry.meta?.columns || rows[0];
  const parsedData = rows.slice(1).map(row => {
    const obj: any = {};
    columns.forEach((col: string, idx: number) => {
      obj[col] = row[idx];
    });
    return obj;
  });
  return { columns, parsedData };
}

export default {
  getHistory,
  addEntry,
  removeEntry,
  renameEntry,
  clearHistory,
  exportHistory,
  importHistory,
  // New helpers:
  getMostRecentEntry,
  getEntryById,
  fileToHistoryEntry,
  pasteToHistoryEntry,
  historyEntryToFile,
  historyEntryToParsedPaste
}; 
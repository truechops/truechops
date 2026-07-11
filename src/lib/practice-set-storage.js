export const PRACTICE_SET_LIMIT = 3;

const STORAGE_VERSION = "v1";
const SLOTS_KEY = `truechops.practiceSet.${STORAGE_VERSION}`;
const PENDING_KEY = `truechops.practiceSet.pending.${STORAGE_VERSION}`;
const SELECTED_KEY = `truechops.practiceSet.selected.${STORAGE_VERSION}`;
const CHANGE_EVENT = "truechops-practice-set-change";

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emptySlots() {
  return Array.from({ length: PRACTICE_SET_LIMIT }, () => null);
}

function readJson(key, fallback) {
  if (!canUseLocalStorage()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function removeItem(key) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(key);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getPracticePageKey(pageRef) {
  if (!pageRef) {
    return "";
  }

  return [
    pageRef.book,
    pageRef.edition,
    pageRef.page,
    pageRef.contentVersion,
  ].join(":");
}

export function normalizePracticePageRef(pageRef) {
  if (!pageRef || !pageRef.token) {
    return null;
  }

  return {
    token: String(pageRef.token),
    book: String(pageRef.book || "true-chops"),
    edition: Number(pageRef.edition || 1),
    page: Number(pageRef.page),
    contentVersion: Number(pageRef.contentVersion || 1),
    title: pageRef.title || `Page ${pageRef.page}`,
    scannedAt: pageRef.scannedAt || new Date().toISOString(),
  };
}

export function normalizePracticeSlots(value) {
  const rawSlots = Array.isArray(value)
    ? value
    : Array.isArray(value?.slots)
      ? value.slots
      : [];
  const slots = [];
  const seenTokens = new Set();

  for (const slot of rawSlots) {
    const normalized = normalizePracticePageRef(slot);
    if (!normalized) {
      slots.push(null);
      continue;
    }

    if (seenTokens.has(normalized.token)) {
      slots.push(null);
      continue;
    }

    seenTokens.add(normalized.token);
    slots.push(normalized);
  }

  const compacted = slots.filter(Boolean).slice(0, PRACTICE_SET_LIMIT);

  while (compacted.length < PRACTICE_SET_LIMIT) {
    compacted.push(null);
  }

  return compacted;
}

export function readPracticeSlots() {
  return normalizePracticeSlots(readJson(SLOTS_KEY, emptySlots()));
}

export function writePracticeSlots(nextSlots) {
  const normalizedSlots = normalizePracticeSlots(nextSlots);
  writeJson(SLOTS_KEY, {
    slots: normalizedSlots,
    updatedAt: new Date().toISOString(),
  });
  return normalizedSlots;
}

export function readActivePracticeTokens() {
  return readPracticeSlots()
    .filter(Boolean)
    .map((slot) => slot.token)
    .slice(0, PRACTICE_SET_LIMIT);
}

export function readSelectedPracticeToken() {
  return canUseLocalStorage() ? window.localStorage.getItem(SELECTED_KEY) : null;
}

export function selectPracticePage(token) {
  if (!canUseLocalStorage()) {
    return;
  }

  if (token) {
    window.localStorage.setItem(SELECTED_KEY, token);
  } else {
    window.localStorage.removeItem(SELECTED_KEY);
  }

  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function readPendingPracticePage() {
  return normalizePracticePageRef(readJson(PENDING_KEY, null));
}

export function setPendingPracticePage(pageRef) {
  const normalized = normalizePracticePageRef(pageRef);

  if (!normalized) {
    clearPendingPracticePage();
    return null;
  }

  writeJson(PENDING_KEY, normalized);
  return normalized;
}

export function clearPendingPracticePage() {
  removeItem(PENDING_KEY);
}

export function handleScannedPracticePage(pageRef) {
  const incomingPage = normalizePracticePageRef(pageRef);
  const slots = readPracticeSlots();
  const existingIndex = slots.findIndex((slot) => slot?.token === incomingPage?.token);

  if (!incomingPage) {
    return { status: "invalid", slots };
  }

  if (existingIndex >= 0) {
    clearPendingPracticePage();
    selectPracticePage(incomingPage.token);
    return { status: "selected", slots, selectedIndex: existingIndex };
  }

  setPendingPracticePage(incomingPage);
  return {
    status: slots.some((slot) => !slot) ? "pending-add" : "pending-replace",
    slots,
    pendingPage: incomingPage,
  };
}

export function addPendingPageToPracticeSet() {
  const pendingPage = readPendingPracticePage();
  const slots = readPracticeSlots();

  if (!pendingPage) {
    return { status: "missing-pending", slots };
  }

  const duplicateIndex = slots.findIndex((slot) => slot?.token === pendingPage.token);
  if (duplicateIndex >= 0) {
    clearPendingPracticePage();
    selectPracticePage(pendingPage.token);
    return { status: "selected", slots, selectedIndex: duplicateIndex };
  }

  const emptyIndex = slots.findIndex((slot) => !slot);
  if (emptyIndex < 0) {
    return { status: "full", slots, pendingPage };
  }

  const nextSlots = [...slots];
  nextSlots[emptyIndex] = pendingPage;
  const savedSlots = writePracticeSlots(nextSlots);
  clearPendingPracticePage();
  selectPracticePage(pendingPage.token);

  return {
    status: "added",
    slots: savedSlots,
    selectedIndex: emptyIndex,
    addedPage: pendingPage,
  };
}

export function replacePracticeSlot(slotIndex, pageRef) {
  const incomingPage = normalizePracticePageRef(pageRef);
  const slots = readPracticeSlots();

  if (!incomingPage || slotIndex < 0 || slotIndex >= PRACTICE_SET_LIMIT) {
    return { status: "invalid", slots };
  }

  const duplicateIndex = slots.findIndex((slot) => slot?.token === incomingPage.token);
  if (duplicateIndex >= 0) {
    clearPendingPracticePage();
    selectPracticePage(incomingPage.token);
    return { status: "selected", slots, selectedIndex: duplicateIndex };
  }

  const replacedPage = slots[slotIndex] || null;
  const nextSlots = [...slots];
  nextSlots[slotIndex] = incomingPage;
  const savedSlots = writePracticeSlots(nextSlots);
  clearPendingPracticePage();
  selectPracticePage(incomingPage.token);

  return {
    status: "replaced",
    slots: savedSlots,
    selectedIndex: slotIndex,
    addedPage: incomingPage,
    replacedPage,
  };
}

export function subscribeToPracticeSet(callback) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => callback();
  const handleStorage = (event) => {
    if ([SLOTS_KEY, PENDING_KEY, SELECTED_KEY].includes(event.key)) {
      callback();
    }
  };

  window.addEventListener(CHANGE_EVENT, handleChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handleChange);
    window.removeEventListener("storage", handleStorage);
  };
}

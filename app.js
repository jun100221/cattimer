const STORAGE_KEYS = {
  cats: "cattimer.cats",
  events: "cattimer.events",
  settings: "cattimer.settings",
};

const DEFAULT_SETTINGS = {
  displayTitle: "猫の記録をすぐ残せる",
  displayLead: "投薬、給餌、目薬、食事、排便の時刻をワンタップで保存します。",
  listTitle: "登録中の猫",
};

const PHOTO_MAX_BYTES = 80 * 1024;
const MAX_CUSTOM_FIELDS = 10;
const BACKUP_VERSION = 1;

const state = {
  cats: [],
  events: [],
  selectedCatId: "",
  historyFilter: "all",
  photoData: "",
  settings: { ...DEFAULT_SETTINGS },
  cropImage: null,
  cropObjectUrl: "",
  cropPointer: null,
  pendingDeleteCatId: "",
  eventsBound: false,
};

const elements = {
  views: document.querySelectorAll(".view"),
  backButton: document.querySelector(".back-button"),
  homeTitle: document.querySelector("#home-title"),
  homeLead: document.querySelector("#home-lead"),
  summaryTitle: document.querySelector("#summary-title"),
  catCount: document.querySelector("#cat-count"),
  homeCatList: document.querySelector("#home-cat-list"),
  displayForm: document.querySelector("#display-form"),
  settingsMessage: document.querySelector("#settings-message"),
  displayTitle: document.querySelector("#display-title"),
  displayLead: document.querySelector("#display-lead"),
  displayListTitle: document.querySelector("#display-list-title"),
  settingsSubmitButton: document.querySelector("#settings-submit-button"),
  catForm: document.querySelector("#cat-form"),
  formMessage: document.querySelector("#form-message"),
  catId: document.querySelector("#cat-id"),
  catPhoto: document.querySelector("#cat-photo"),
  photoPreview: document.querySelector("#photo-preview"),
  photoPlaceholder: document.querySelector("#photo-placeholder"),
  cropEditor: document.querySelector("#crop-editor"),
  cropCanvas: document.querySelector("#crop-canvas"),
  cropX: document.querySelector("#crop-x"),
  cropY: document.querySelector("#crop-y"),
  cropZoom: document.querySelector("#crop-zoom"),
  applyCropButton: document.querySelector("#apply-crop-button"),
  cancelPhotoButton: document.querySelector("#cancel-photo-button"),
  registerTabs: document.querySelectorAll(".register-tab"),
  catRegisterPanel: document.querySelector("#cat-register-panel"),
  catListPanel: document.querySelector("#cat-list-panel"),
  homeDisplayPanel: document.querySelector("#home-display-panel"),
  backupPanel: document.querySelector("#backup-panel"),
  backupMessage: document.querySelector("#backup-message"),
  exportBackupButton: document.querySelector("#export-backup-button"),
  importBackupInput: document.querySelector("#import-backup-input"),
  catName: document.querySelector("#cat-name"),
  catSex: document.querySelector("#cat-sex"),
  catBirthday: document.querySelector("#cat-birthday"),
  catRescueDate: document.querySelector("#cat-rescue-date"),
  catWeight: document.querySelector("#cat-weight"),
  catMedicalHistory: document.querySelector("#cat-medical-history"),
  catNotes: document.querySelector("#cat-notes"),
  catSubmitButton: document.querySelector("#cat-submit-button"),
  customFieldsList: document.querySelector("#custom-fields-list"),
  addCustomFieldButton: document.querySelector("#add-custom-field-button"),
  registeredCatList: document.querySelector("#registered-cat-list"),
  manageCatSelect: document.querySelector("#manage-cat-select"),
  selectedCatCard: document.querySelector("#selected-cat-card"),
  careActions: document.querySelector("#care-actions"),
  historyFilters: document.querySelector("#history-filters"),
  historyList: document.querySelector("#history-list"),
  catSettings: document.querySelector("#cat-settings"),
  deleteDialog: document.querySelector("#delete-dialog"),
  deleteDialogMessage: document.querySelector("#delete-dialog-message"),
  confirmDeleteButton: document.querySelector("#confirm-delete-button"),
  cancelDeleteButton: document.querySelector("#cancel-delete-button"),
  tabs: document.querySelectorAll(".tab"),
  carePanel: document.querySelector("#care-panel"),
  historyPanel: document.querySelector("#history-panel"),
  settingsPanel: document.querySelector("#settings-panel"),
  topbar: document.querySelector(".topbar"),
  latestMemoText: document.querySelector("#latest-memo-text"),
  memoInput: document.querySelector("#memo-input"),
  saveMemoButton: document.querySelector("#save-memo-button"),
};

async function saveCatRecord(cat) {
  const existingIndex = state.cats.findIndex((item) => item.id === cat.id);
  if (existingIndex >= 0) {
    state.cats[existingIndex] = cat;
  } else {
    state.cats.push(cat);
  }
  if (!writeJson(STORAGE_KEYS.cats, state.cats)) {
    throw new Error("Failed to save cats");
  }
}

async function saveEventRecord(event) {
  if (!state.events.some((item) => item.id === event.id)) {
    state.events.push(event);
  }
  if (!writeJson(STORAGE_KEYS.events, state.events)) {
    throw new Error("Failed to save events");
  }
}

async function saveSettings() {
  if (!writeJson(STORAGE_KEYS.settings, state.settings)) {
    throw new Error("Failed to save settings");
  }
}

async function deleteCatAndEvents(catId) {
  state.cats = state.cats.filter((item) => item.id !== catId);
  state.events = state.events.filter((item) => item.catId !== catId);
  if (!writeJson(STORAGE_KEYS.cats, state.cats) || !writeJson(STORAGE_KEYS.events, state.events)) {
    throw new Error("Failed to delete cat");
  }
}

function loadState() {
  state.cats = readJson(STORAGE_KEYS.cats, [])
    .map((cat) => ({ ...cat, sex: normalizeSex(cat.sex) }))
    .sort((a, b) => timeValue(a.createdAt || a.updatedAt) - timeValue(b.createdAt || b.updatedAt));
  state.events = readJson(STORAGE_KEYS.events, []);
  state.settings = { ...DEFAULT_SETTINGS, ...readJson(STORAGE_KEYS.settings, {}) };
  state.selectedCatId = getActiveCats()[0]?.id || state.cats[0]?.id || "";
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("Failed to save local data", error);
    return false;
  }
}

function init() {
  loadState();
  bindEvents();
  showView("home");
}

function showView(name) {
  elements.views.forEach((view) => {
    view.classList.toggle("active", view.id === `${name}-view`);
  });
  if (name === "manage") {
    ensureSelectedCat();
  }
  if (name === "register") {
    switchRegisterTab("add");
  }
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function ensureSelectedCat() {
  const activeCats = getActiveCats();
  if (!activeCats.length) {
    state.selectedCatId = "";
    return;
  }
  if (!activeCats.some((cat) => cat.id === state.selectedCatId)) {
    state.selectedCatId = activeCats[0].id;
  }
}

function render() {
  renderHome();
  renderDisplaySettings();
  renderRegisterList();
  renderManage();
}

function renderHome() {
  const activeCats = getActiveCats();
  elements.homeTitle.textContent = state.settings.displayTitle || DEFAULT_SETTINGS.displayTitle;
  elements.homeLead.textContent = state.settings.displayLead || DEFAULT_SETTINGS.displayLead;
  elements.summaryTitle.textContent = state.settings.listTitle || DEFAULT_SETTINGS.listTitle;
  elements.catCount.textContent = `${activeCats.length}匹`;
  elements.homeCatList.innerHTML = "";

  if (!activeCats.length) {
    elements.homeCatList.append(createEmptyState("まだ猫が登録されていません", ""));
    return;
  }

  activeCats.forEach((cat) => {
    const item = document.createElement("button");
    item.className = "cat-pill";
    item.type = "button";
    item.addEventListener("click", () => {
      state.selectedCatId = cat.id;
      showView("manage");
    });
    item.append(createCatImage(cat, "cat-photo"));
    item.append(createText("strong", compactCatMeta(cat), "cat-card-line"));
    elements.homeCatList.append(item);
  });
}

function renderRegisterList() {
  elements.registeredCatList.innerHTML = "";

  if (!state.cats.length) {
    elements.registeredCatList.append(createEmptyState("登録済みの猫はいません", "写真、名前、病歴などを保存できます。"));
    return;
  }

  state.cats.forEach((cat) => {
    const row = document.createElement("article");
    row.className = "cat-row";
    row.append(createCatImage(cat, "cat-photo-small"));

    const body = document.createElement("div");
    body.append(createText("strong", compactCatMeta(cat), "cat-card-line"));
    if (cat.archived) {
      body.append(createText("small", "アーカイブ中", "archive-label"));
    }
    row.append(body);

    const actions = document.createElement("div");
    actions.className = "row-actions";

    const editButton = document.createElement("button");
    editButton.className = "mini-button";
    editButton.type = "button";
    editButton.textContent = "編集";
    editButton.addEventListener("click", () => populateForm(cat));

    const deleteButton = document.createElement("button");
    deleteButton.className = "mini-button danger";
    deleteButton.type = "button";
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", () => openDeleteDialog(cat.id));

    actions.append(editButton);
    if (cat.archived) {
      const restoreButton = document.createElement("button");
      restoreButton.className = "mini-button";
      restoreButton.type = "button";
      restoreButton.textContent = "復帰";
      restoreButton.addEventListener("click", () => setCatArchived(cat.id, false));
      actions.append(restoreButton);
    }
    actions.append(deleteButton);
    row.append(actions);
    elements.registeredCatList.append(row);
  });
}

function renderDisplaySettings() {
  elements.displayTitle.value = state.settings.displayTitle || DEFAULT_SETTINGS.displayTitle;
  elements.displayLead.value = state.settings.displayLead || DEFAULT_SETTINGS.displayLead;
  elements.displayListTitle.value = state.settings.listTitle || DEFAULT_SETTINGS.listTitle;
}

function renderManage() {
  const activeCats = getActiveCats();
  elements.manageCatSelect.innerHTML = "";
  elements.selectedCatCard.innerHTML = "";
  elements.careActions.innerHTML = "";
  elements.historyFilters.innerHTML = "";
  elements.historyList.innerHTML = "";
  elements.catSettings.innerHTML = "";

  if (!activeCats.length) {
    const option = new Option("記録対象の猫がいません", "");
    elements.manageCatSelect.append(option);
    elements.selectedCatCard.append(createEmptyState("猫を追加してください"));
    return;
  }

  activeCats.forEach((cat) => {
    elements.manageCatSelect.append(new Option(cat.name, cat.id, cat.id === state.selectedCatId, cat.id === state.selectedCatId));
  });

  const cat = getSelectedCat();
  if (!cat) return;

  elements.selectedCatCard.append(createCatImage(cat, "cat-photo-small"));

  const body = document.createElement("div");
  body.append(createText("strong", cat.name));
  if (cat.medicalHistory) {
    body.append(createText("small", cat.medicalHistory));
  }

  const details = document.createElement("dl");
  addDefinitionIfPresent(details, "性別", sexLabel(cat.sex));
  addDefinitionIfPresent(details, "体重", cat.weight);
  addDefinitionIfPresent(details, "保護", formatDate(cat.rescueDate));
  if (details.children.length) {
    body.append(details);
  }
  elements.selectedCatCard.append(body);

  renderCareActions(cat.id);
  renderHistoryFilters(cat.id);
  renderHistory(cat.id);
  renderCatSettings(cat.id);
}

function renderCatSettings(catId) {
  const cat = state.cats.find((item) => item.id === catId);
  if (!cat) return;

  const row = document.createElement("article");
  row.className = "setting-row";

  const body = document.createElement("div");
  body.append(createText("strong", "アーカイブ"));
  body.append(createText("small", "ONにするとホームと記録画面に表示されません。登録画面から復帰できます。"));

  const label = document.createElement("label");
  label.className = "switch";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(cat.archived);
  input.addEventListener("change", () => setCatArchived(cat.id, input.checked));

  const slider = document.createElement("span");
  slider.className = "switch-slider";

  label.append(input, slider);
  row.append(body, label);
  elements.catSettings.append(row);
}

function renderCareActions(catId) {
  const careTypes = getCareTypesForCat(catId);
  
  if (careTypes.length === 0) {
    elements.careActions.append(createEmptyState("記録項目がありません", "「登録 > アプリ設定」から記録する項目を追加してください。"));
    return;
  }

  careTypes.forEach((type) => {
    const row = document.createElement("div");
    row.className = "care-row";

    const body = document.createElement("div");
    body.append(createText("span", type.label, "care-title"));
    body.append(createText("small", getLastEventText(catId, type.id), "care-last"));

    const button = document.createElement("button");
    button.className = "care-button";
    button.type = "button";
    button.textContent = "記録";
    button.addEventListener("click", async () => {
      button.disabled = true;
      const saved = await addCareEvent(catId, type.id);
      flashButton(button, saved ? "完了" : "保存失敗", saved);
    });

    row.append(body, button);
    elements.careActions.append(row);
  });
  
  // Refresh latest memo
  const latestMemo = state.events
    .filter((event) => event.catId === catId && event.type === "memo")
    .sort((a, b) => timeValue(eventCreatedAt(b)) - timeValue(eventCreatedAt(a)))[0];
  elements.latestMemoText.textContent = latestMemo ? latestMemo.text : "まだメモがありません";
}

function renderHistoryFilters(catId) {
  const filters = [{ id: "all", label: "すべて" }, ...getCareTypesForCat(catId), { id: "memo", label: "メモ" }];
  filters.forEach((filter) => {
    const button = document.createElement("button");
    button.className = "filter-chip";
    button.classList.toggle("active", state.historyFilter === filter.id);
    button.type = "button";
    button.textContent = filter.label;
    button.addEventListener("click", () => {
      state.historyFilter = filter.id;
      renderManage();
    });
    elements.historyFilters.append(button);
  });
}

function renderHistory(catId) {
  const events = state.events
    .filter((event) => event.catId === catId)
    .filter((event) => state.historyFilter === "all" || event.type === state.historyFilter)
    .sort((a, b) => timeValue(eventCreatedAt(b)) - timeValue(eventCreatedAt(a)));

  if (!events.length) {
    elements.historyList.append(createEmptyState("履歴はまだありません", "ケア画面の記録ボタンを押すと一覧に表示されます。"));
    return;
  }

  events.forEach((event) => {
    const item = document.createElement("article");
    item.className = "history-item";

    if (event.type === "memo") {
      item.classList.add("is-memo");
      
      const header = document.createElement("div");
      header.className = "history-memo-header";
      
      const headerLeft = document.createElement("div");
      headerLeft.append(createText("span", "メモ", "history-type"));
      headerLeft.append(createText("small", formatFullDate(eventCreatedAt(event))));
      
      const time = createText("strong", formatTime(eventCreatedAt(event)), "history-time");
      header.append(headerLeft, time);
      
      item.append(header, createText("div", event.text, "history-memo-text"));
    } else {
      const body = document.createElement("div");
      body.append(createText("span", event.label || careLabel(event.type, catId), "history-type"));
      body.append(createText("small", formatFullDate(eventCreatedAt(event))));
      
      const time = createText("strong", formatTime(eventCreatedAt(event)), "history-time");
      item.append(body, time);
    }

    elements.historyList.append(item);
  });
}

function getLastEventText(catId, type) {
  const last = state.events
    .filter((event) => event.catId === catId && event.type === type)
    .sort((a, b) => timeValue(eventCreatedAt(b)) - timeValue(eventCreatedAt(a)))[0];

  return last ? `最終 ${formatFullDate(eventCreatedAt(last))} ${formatTime(eventCreatedAt(last))}` : "未記録";
}

const LEGACY_CARE_LABELS = {
  medicine: "投薬",
  feeding: "給餌",
  eyeDrops: "目薬",
  meal: "ご飯",
  poop: "うんこ",
};

function careLabel(typeId, catId = state.selectedCatId) {
  return getCareTypesForCat(catId).find((type) => type.id === typeId)?.label ?? LEGACY_CARE_LABELS[typeId] ?? typeId.replace(/^custom:/, "");
}

function getCareTypesForCat(catId) {
  const cat = state.cats.find((item) => item.id === catId);
  return (cat?.customFields || [])
    .filter((field) => field.label)
    .map((field) => ({
      id: `custom:${field.id || field.label}`,
      label: field.label,
    }));
}

function getSelectedCat() {
  return state.cats.find((cat) => cat.id === state.selectedCatId);
}

function getActiveCats() {
  return state.cats.filter((cat) => !cat.archived);
}

function populateForm(cat) {
  switchRegisterTab("add");
  elements.catId.value = cat.id;
  elements.catName.value = cat.name;
  elements.catSex.value = normalizeSex(cat.sex);
  elements.catBirthday.value = cat.birthday;
  elements.catRescueDate.value = cat.rescueDate;
  elements.catWeight.value = cat.weight;
  elements.catMedicalHistory.value = cat.medicalHistory;
  elements.catNotes.value = cat.notes;
  renderCustomFields(normalizeCustomFields(cat.customFields || []));
  state.photoData = cat.photo;
  clearCropEditor();
  updatePhotoPreview();
  elements.catName.focus();
}

function resetForm() {
  elements.catForm.reset();
  elements.catId.value = "";
  state.photoData = "";
  renderCustomFields([]);
  clearCropEditor();
  updatePhotoPreview();
  clearMessage(elements.formMessage);
}

function renderCustomFields(fields) {
  elements.customFieldsList.innerHTML = "";
  const normalized = normalizeCustomFields(fields).slice(0, MAX_CUSTOM_FIELDS);
  normalized.forEach((field) => addCustomFieldRow(field));
  updateCustomFieldButton();
}

function addCustomFieldRow(field = { id: "", label: "" }) {
  if (elements.customFieldsList.children.length >= MAX_CUSTOM_FIELDS) return;

  const row = document.createElement("div");
  row.className = "custom-field-row";
  row.dataset.fieldId = field.id || createId("custom");

  const labelField = document.createElement("label");
  labelField.append(createText("span", "記録名"));
  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.maxLength = 18;
  labelInput.placeholder = "例: 猫砂交換";
  labelInput.value = field.label || "";
  labelField.append(labelInput);

  const reorderContainer = document.createElement("div");
  reorderContainer.className = "row-actions";

  const upButton = document.createElement("button");
  upButton.className = "mini-button";
  upButton.type = "button";
  upButton.innerHTML = "↑";
  upButton.title = "上に移動";
  upButton.addEventListener("click", () => {
    const prev = row.previousElementSibling;
    if (prev) {
      row.parentNode.insertBefore(row, prev);
    }
  });

  const downButton = document.createElement("button");
  downButton.className = "mini-button";
  downButton.type = "button";
  downButton.innerHTML = "↓";
  downButton.title = "下に移動";
  downButton.addEventListener("click", () => {
    const next = row.nextElementSibling;
    if (next) {
      row.parentNode.insertBefore(next, row);
    }
  });

  const removeButton = document.createElement("button");
  removeButton.className = "mini-button danger";
  removeButton.type = "button";
  removeButton.textContent = "削除";
  removeButton.addEventListener("click", () => {
    row.remove();
    updateCustomFieldButton();
  });

  reorderContainer.append(upButton, downButton, removeButton);
  row.append(labelField, reorderContainer);
  elements.customFieldsList.append(row);
  updateCustomFieldButton();
}

function readCustomFields() {
  return [...elements.customFieldsList.querySelectorAll(".custom-field-row")]
    .map((row) => {
      const input = row.querySelector("input");
      return {
        id: row.dataset.fieldId || createId("custom"),
        label: input.value.trim(),
      };
    })
    .filter((field) => field.label)
    .slice(0, MAX_CUSTOM_FIELDS);
}

function normalizeCustomFields(fields) {
  return fields
    .map((field) => ({
      id: field.id || createId("custom"),
      label: field.label || field.value || "",
    }))
    .filter((field) => field.label);
}

function updateCustomFieldButton() {
  const count = elements.customFieldsList.children.length;
  elements.addCustomFieldButton.disabled = count >= MAX_CUSTOM_FIELDS;
  elements.addCustomFieldButton.textContent = count >= MAX_CUSTOM_FIELDS ? `最大${MAX_CUSTOM_FIELDS}個` : "追加";
}

async function saveDisplaySettings(event) {
  event.preventDefault();
  clearMessage(elements.settingsMessage);

  state.settings = {
    displayTitle: cleanText(elements.displayTitle.value, DEFAULT_SETTINGS.displayTitle),
    displayLead: cleanText(elements.displayLead.value, DEFAULT_SETTINGS.displayLead),
    listTitle: cleanText(elements.displayListTitle.value, DEFAULT_SETTINGS.listTitle),
  };

  try {
    await saveSettings();
  } catch (error) {
    console.error("Failed to save settings", error);
    flashButton(elements.settingsSubmitButton, "保存失敗", false);
    return;
  }

  render();
  flashButton(elements.settingsSubmitButton, "保存しました");
}

async function exportBackup() {
  const backup = {
    app: "CatTimer",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    cats: state.cats,
    events: state.events,
    settings: state.settings,
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const fileName = `cattimer-backup-${backupTimestamp()}.json`;

  try {
    if (typeof File === "function" && navigator.canShare && navigator.share) {
      const file = new File([blob], fileName, { type: "application/json" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "CatTimerバックアップ",
        });
        clearMessage(elements.backupMessage);
        flashButton(elements.exportBackupButton, "共有しました");
        return;
      }
    }

    downloadBackupBlob(blob, fileName);
    clearMessage(elements.backupMessage);
    flashButton(elements.exportBackupButton, "書き出しました");
  } catch (error) {
    if (error?.name === "AbortError") return;
    console.error("Failed to export backup", error);
    showMessage(elements.backupMessage, "バックアップを書き出せませんでした。", "error");
    flashButton(elements.exportBackupButton, "失敗", false);
  }
}

function downloadBackupBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const backup = JSON.parse(await file.text());
    const restored = normalizeBackup(backup);
    const confirmed = window.confirm("現在のCatTimerデータをバックアップ内容で置き換えます。読み込みますか？");
    if (!confirmed) return;

    if (!writeJson(STORAGE_KEYS.cats, restored.cats) || !writeJson(STORAGE_KEYS.events, restored.events) || !writeJson(STORAGE_KEYS.settings, restored.settings)) {
      throw new Error("Failed to write backup data");
    }

    state.cats = restored.cats;
    state.events = restored.events;
    state.settings = restored.settings;
    state.selectedCatId = getActiveCats()[0]?.id || state.cats[0]?.id || "";
    resetForm();
    render();
    switchRegisterTab("backup");
    showMessage(elements.backupMessage, "バックアップを読み込みました。");
  } catch (error) {
    console.error("Failed to import backup", error);
    showMessage(elements.backupMessage, "バックアップを読み込めませんでした。", "error");
  } finally {
    elements.importBackupInput.value = "";
  }
}

function normalizeBackup(backup) {
  if (!backup || backup.app !== "CatTimer" || !Array.isArray(backup.cats) || !Array.isArray(backup.events)) {
    throw new Error("Invalid backup");
  }

  return {
    cats: backup.cats.map((cat) => ({ ...cat, sex: normalizeSex(cat.sex) })),
    events: backup.events,
    settings: { ...DEFAULT_SETTINGS, ...(backup.settings || {}) },
  };
}

function backupTimestamp() {
  const date = new Date();
  const parts = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}-${values.hour}${values.minute}`;
}

async function saveCat(event) {
  event.preventDefault();
  clearMessage(elements.formMessage);

  if (state.cropImage) {
    showMessage(elements.formMessage, "写真の位置を調整して「写真を確定」を押してください。", "error");
    return;
  }

  const isNewCat = !elements.catId.value;
  const existingCat = state.cats.find((item) => item.id === elements.catId.value);

  const cat = {
    id: elements.catId.value || createId("cat"),
    photo: state.photoData,
    name: elements.catName.value.trim(),
    sex: normalizeSex(elements.catSex.value),
    birthday: elements.catBirthday.value,
    rescueDate: elements.catRescueDate.value,
    weight: elements.catWeight.value.trim(),
    medicalHistory: elements.catMedicalHistory.value.trim(),
    notes: elements.catNotes.value.trim(),
    customFields: readCustomFields(),
    archived: existingCat?.archived ?? false,
    createdAt: existingCat?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!cat.name) {
    showMessage(elements.formMessage, "名前を入力してください。", "error");
    elements.catName.focus();
    return;
  }

  const existingIndex = state.cats.findIndex((item) => item.id === cat.id);
  const previousCats = [...state.cats];
  if (existingIndex >= 0) {
    state.cats[existingIndex] = cat;
  } else {
    state.cats.push(cat);
  }

  state.selectedCatId = cat.id;
  elements.catSubmitButton.disabled = true;
  try {
    await saveCatRecord(cat);
  } catch (error) {
    console.error("Failed to save cat", error);
    state.cats = previousCats;
    flashButton(elements.catSubmitButton, "保存失敗", false);
    return;
  }

  flashButton(elements.catSubmitButton, "保存しました");
  window.setTimeout(() => {
    if (isNewCat) {
      resetForm();
    } else {
      switchRegisterTab("list");
    }
    render();
  }, 1000);
}

function openDeleteDialog(catId) {
  const cat = state.cats.find((item) => item.id === catId);
  if (!cat) return;
  state.pendingDeleteCatId = catId;
  elements.deleteDialogMessage.textContent = `${cat.name}の登録と履歴を削除します。`;
  elements.deleteDialog.classList.remove("hidden");
  elements.cancelDeleteButton.focus();
}

function closeDeleteDialog() {
  state.pendingDeleteCatId = "";
  elements.deleteDialog.classList.add("hidden");
  switchRegisterTab("list");
}

async function confirmDeleteCat() {
  const catId = state.pendingDeleteCatId;
  if (!catId) {
    closeDeleteDialog();
    return;
  }

  const previousCats = [...state.cats];
  const previousEvents = [...state.events];
  state.cats = state.cats.filter((item) => item.id !== catId);
  state.events = state.events.filter((item) => item.catId !== catId);
  ensureSelectedCat();
  try {
    await deleteCatAndEvents(catId);
  } catch (error) {
    console.error("Failed to delete cat", error);
    state.cats = previousCats;
    state.events = previousEvents;
    window.alert("削除できませんでした。通信状態を確認してください。");
    closeDeleteDialog();
    render();
    return;
  }
  resetForm();
  render();
  closeDeleteDialog();
  switchRegisterTab("list");
}

function handlePhotoChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  showMessage(elements.formMessage, "正方形に切り抜く位置を調整してください。");

  loadCropImage(file)
    .then((image) => {
      clearCropEditor();
      state.cropImage = image;
      state.cropObjectUrl = image.dataset.objectUrl;
      state.photoData = "";
      elements.cropX.value = "50";
      elements.cropY.value = "50";
      elements.cropZoom.value = "1.15";
      elements.cropEditor.classList.remove("hidden");
      updatePhotoPreview();
      drawCropPreview();
    })
    .catch(() => {
      showMessage(elements.formMessage, "写真を読み込めませんでした。別の写真を選ぶか、写真なしで保存してください。", "error");
      state.photoData = "";
      elements.catPhoto.value = "";
      clearCropEditor();
      updatePhotoPreview();
    });
}

function loadCropImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.addEventListener("load", () => {
      image.dataset.objectUrl = objectUrl;
      resolve(image);
    });

    image.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image load failed"));
    });

    image.src = objectUrl;
  });
}

function drawCropPreview() {
  if (!state.cropImage) return;

  const canvas = elements.cropCanvas;
  const context = canvas.getContext("2d");
  if (!context) return;

  const source = getCropSource();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    state.cropImage,
    source.x,
    source.y,
    source.size,
    source.size,
    0,
    0,
    canvas.width,
    canvas.height,
  );
}

function getCropSource() {
  const image = state.cropImage;
  const zoom = Math.max(1, Number(elements.cropZoom.value) || 1);
  const cropSize = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
  const maxX = image.naturalWidth - cropSize;
  const maxY = image.naturalHeight - cropSize;
  const x = Math.round((Number(elements.cropX.value) / 100) * maxX);
  const y = Math.round((Number(elements.cropY.value) / 100) * maxY);
  return { x, y, size: Math.round(cropSize) };
}

function applyCrop() {
  if (!state.cropImage) return;

  showMessage(elements.formMessage, "写真を500kB以下に圧縮しています。");

  try {
    const result = compressCropToTarget();
    state.photoData = result.dataUrl;
    elements.catPhoto.value = "";
    clearCropEditor();
    updatePhotoPreview();
    showMessage(elements.formMessage, `写真を確定しました。約${Math.ceil(result.bytes / 1024)}kBです。`);
  } catch {
    showMessage(elements.formMessage, "写真を圧縮できませんでした。別の写真を選んでください。", "error");
  }
}

function compressCropToTarget() {
  const source = getCropSource();
  let best = null;
  let outputSize = 400;

  while (outputSize >= 160) {
    for (let quality = 0.82; quality >= 0.32; quality -= 0.05) {
      const dataUrl = createCroppedDataUrl(source, outputSize, quality);
      const bytes = dataUrlByteSize(dataUrl);
      best = !best || bytes < best.bytes ? { dataUrl, bytes } : best;
      if (bytes <= PHOTO_MAX_BYTES) {
        return { dataUrl, bytes };
      }
    }
    outputSize = Math.floor(outputSize * 0.82);
  }

  if (best) return best;
  throw new Error("Compression failed");
}

function createCroppedDataUrl(source, outputSize, quality) {
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is unavailable");
  }

  context.drawImage(
    state.cropImage,
    source.x,
    source.y,
    source.size,
    source.size,
    0,
    0,
    outputSize,
    outputSize,
  );

  return canvas.toDataURL("image/jpeg", quality);
}

function dataUrlByteSize(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function clearPhoto() {
  state.photoData = "";
  elements.catPhoto.value = "";
  clearCropEditor();
  updatePhotoPreview();
  showMessage(elements.formMessage, "写真を外しました。");
}

function clearCropEditor() {
  if (state.cropObjectUrl) {
    URL.revokeObjectURL(state.cropObjectUrl);
  }

  state.cropImage = null;
  state.cropObjectUrl = "";
  state.cropPointer = null;
  elements.cropEditor.classList.add("hidden");
}

function handleCropPointerDown(event) {
  if (!state.cropImage) return;
  state.cropPointer = { x: event.clientX, y: event.clientY };
  elements.cropCanvas.setPointerCapture?.(event.pointerId);
}

function handleCropPointerMove(event) {
  if (!state.cropPointer || !state.cropImage) return;

  const rect = elements.cropCanvas.getBoundingClientRect();
  const dx = ((event.clientX - state.cropPointer.x) / rect.width) * 100;
  const dy = ((event.clientY - state.cropPointer.y) / rect.height) * 100;
  elements.cropX.value = clamp(Number(elements.cropX.value) - dx, 0, 100);
  elements.cropY.value = clamp(Number(elements.cropY.value) - dy, 0, 100);
  state.cropPointer = { x: event.clientX, y: event.clientY };
  drawCropPreview();
}

function handleCropPointerUp() {
  state.cropPointer = null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function showMessage(element, message, tone = "success") {
  element.textContent = message;
  element.classList.toggle("error", tone === "error");
  element.classList.remove("hidden");
}

function clearMessage(element) {
  element.textContent = "";
  element.classList.remove("error");
  element.classList.add("hidden");
}

function cleanText(value, fallback) {
  return value.trim() || fallback;
}

function normalizeSex(value) {
  if (value === "女の子") return "メス";
  if (value === "男の子") return "オス";
  return value || "";
}

function sexLabel(value) {
  return normalizeSex(value) || "性別未入力";
}

function flashButton(button, text, success = true) {
  const originalText = button.dataset.originalText || button.textContent;
  button.dataset.originalText = originalText;
  button.textContent = text;
  button.classList.toggle("button-error", !success);
  button.disabled = true;

  window.setTimeout(() => {
    button.textContent = originalText;
    button.classList.remove("button-error");
    button.disabled = false;
  }, 1400);
}

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function addCareEvent(catId, type) {
  const now = new Date().toISOString();
  const event = {
    id: createId("event"),
    catId,
    type,
    label: careLabel(type, catId),
    createdAt: now,
  };
  state.events.push(event);

  try {
    await saveEventRecord(event);
  } catch (error) {
    console.error("Failed to save event", error);
    state.events = state.events.filter((item) => item.id !== event.id);
    return false;
  }

  renderManage();
  return true;
}

async function setCatArchived(catId, archived) {
  const cat = state.cats.find((item) => item.id === catId);
  if (!cat) return;

  const previousArchived = cat.archived;
  cat.archived = archived;
  cat.updatedAt = new Date().toISOString();
  try {
    await saveCatRecord(cat);
  } catch (error) {
    console.error("Failed to save archive setting", error);
    cat.archived = previousArchived;
    window.alert("設定を保存できませんでした。");
    return;
  }

  ensureSelectedCat();
  if (archived) {
    switchManageTab("care");
  }
  render();
}

function updatePhotoPreview() {
  const hasPhoto = Boolean(state.photoData);
  elements.photoPreview.classList.toggle("hidden", !hasPhoto);
  elements.photoPlaceholder.classList.toggle("hidden", hasPhoto);
  if (hasPhoto) {
    elements.photoPreview.src = state.photoData;
  } else {
    elements.photoPreview.removeAttribute("src");
  }
}

function createCatImage(cat, className) {
  if (cat.photo) {
    const image = document.createElement("img");
    image.className = className;
    image.src = cat.photo;
    image.alt = `${cat.name}の写真`;
    return image;
  }

  const fallback = document.createElement("div");
  fallback.className = `${className} photo-fallback`;
  fallback.textContent = cat.name.slice(0, 1) || "猫";
  return fallback;
}

function createText(tagName, text, className = "") {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function createEmptyState(title, message) {
  const template = document.querySelector("#empty-state-template");
  const fragment = template.content.cloneNode(true);
  fragment.querySelector("strong").textContent = title;
  const messageElement = fragment.querySelector("p");
  messageElement.textContent = message;
  messageElement.classList.toggle("hidden", !message);
  return fragment;
}

function addDefinition(list, term, value) {
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = term;
  dd.textContent = value;
  list.append(dt, dd);
}

function addDefinitionIfPresent(list, term, value) {
  if (!term || !value) return;
  addDefinition(list, term, value);
}

function compactCatMeta(cat) {
  return [cat.name || "名前未入力", sexLabel(cat.sex), catAge(cat.birthday)].join("・");
}

function catAge(birthday) {
  if (!birthday) return "年齢未入力";

  const birthDate = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return "年齢未入力";

  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  if (today.getDate() < birthDate.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return `${Math.max(years, 0)}歳`;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatFullDate(value) {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function formatTime(value) {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function eventCreatedAt(event) {
  return event.createdAt;
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.toMillis === "function") return new Date(value.toMillis());
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function timeValue(value) {
  return toDate(value)?.getTime() || 0;
}

function bindEvents() {
  if (state.eventsBound) return;
  state.eventsBound = true;

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.action));
  });

  elements.displayForm.addEventListener("submit", saveDisplaySettings);
  elements.exportBackupButton.addEventListener("click", exportBackup);
  elements.importBackupInput.addEventListener("change", importBackup);
  elements.catForm.addEventListener("submit", saveCat);
  elements.catPhoto.addEventListener("change", handlePhotoChange);
  elements.cropX.addEventListener("input", drawCropPreview);
  elements.cropY.addEventListener("input", drawCropPreview);
  elements.cropZoom.addEventListener("input", drawCropPreview);
  elements.applyCropButton.addEventListener("click", applyCrop);
  elements.cancelPhotoButton.addEventListener("click", clearPhoto);
  elements.cropCanvas.addEventListener("pointerdown", handleCropPointerDown);
  elements.cropCanvas.addEventListener("pointermove", handleCropPointerMove);
  elements.cropCanvas.addEventListener("pointerup", handleCropPointerUp);
  elements.cropCanvas.addEventListener("pointercancel", handleCropPointerUp);
  elements.addCustomFieldButton.addEventListener("click", () => addCustomFieldRow());
  elements.registerTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.dataset.registerTab === "add") {
        resetForm();
      }
      switchRegisterTab(tab.dataset.registerTab);
    });
  });
  elements.confirmDeleteButton.addEventListener("click", confirmDeleteCat);
  elements.cancelDeleteButton.addEventListener("click", closeDeleteDialog);

  elements.manageCatSelect.addEventListener("change", (event) => {
    state.selectedCatId = event.target.value;
    renderManage();
  });

  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      switchManageTab(tab.dataset.tab);
    });
  });

  elements.saveMemoButton.addEventListener("click", async () => {
    const text = elements.memoInput.value.trim();
    if (!text) {
      flashButton(elements.saveMemoButton, "入力してください", false);
      elements.memoInput.focus();
      return;
    }
    
    const catId = state.selectedCatId;
    if (!catId) return;
    
    const now = new Date().toISOString();
    const event = {
      id: createId("event"),
      catId,
      type: "memo",
      text,
      createdAt: now,
    };
    
    state.events.push(event);
    try {
      await saveEventRecord(event);
    } catch (error) {
      console.error("Failed to save memo", error);
      state.events = state.events.filter((item) => item.id !== event.id);
      flashButton(elements.saveMemoButton, "保存失敗", false);
      return;
    }
    
    elements.memoInput.value = "";
    flashButton(elements.saveMemoButton, "記録しました");
    renderManage();
  });
}

function switchRegisterTab(selected) {
  elements.registerTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.registerTab === selected);
    tab.setAttribute("aria-selected", String(tab.dataset.registerTab === selected));
  });
  elements.catRegisterPanel.classList.toggle("active", selected === "add");
  elements.catListPanel.classList.toggle("active", selected === "list");
  elements.homeDisplayPanel.classList.toggle("active", selected === "home");
  elements.backupPanel.classList.toggle("active", selected === "backup");
}

function switchManageTab(selected) {
  elements.tabs.forEach((item) => {
    item.classList.toggle("active", item.dataset.tab === selected);
    item.setAttribute("aria-selected", String(item.dataset.tab === selected));
  });
  elements.carePanel.classList.toggle("active", selected === "care");
  elements.historyPanel.classList.toggle("active", selected === "history");
  elements.settingsPanel.classList.toggle("active", selected === "settings");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
registerServiceWorker();

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // The app still works online if service worker registration is unavailable.
    });
  });
}

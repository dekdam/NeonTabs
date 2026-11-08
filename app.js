/**
 * NeonTabs - Universal Client-Side Counter App (PWA)
 * Vanilla JavaScript & Tailwind CSS implementation
 */

// Default State & Storage
const STORAGE_KEY = 'neontabs_data_v1';

const DEFAULT_CATEGORIES = [
  { id: 'cat-general', name: 'ทั่วไป', color: '#00ff66' }, // Lime Green
  { id: 'cat-sports', name: 'กีฬา/เกม', color: '#00e5ff' }, // Cyan
  { id: 'cat-habits', name: 'พฤติกรรม/สุขภาพ', color: '#ff007f' }, // Cyberpink
  { id: 'cat-work', name: 'งาน/โปรเจกต์', color: '#ffbc00' } // Amber
];

const DEFAULT_COUNTERS = [
  {
    id: 'cnt-1',
    name: 'แก้วกาแฟวันนี้',
    categoryId: 'cat-habits',
    type: 'single', // single, dual, multi
    value: 2,
    goal: 4,
    limit: 8,
    autoReset: 'daily', // none, daily, weekly, monthly, yearly
    lastUpdated: new Date().toISOString(),
    lastResetDate: new Date().toDateString()
  },
  {
    id: 'cnt-2',
    name: 'แบดมินตัน (ทีม A vs ทีม B)',
    categoryId: 'cat-sports',
    type: 'dual',
    subCounts: [
      { name: 'ทีม A', value: 11 },
      { name: 'ทีม B', value: 9 }
    ],
    goal: 21,
    limit: 30,
    autoReset: 'none',
    lastUpdated: new Date().toISOString(),
    lastResetDate: new Date().toDateString()
  },
  {
    id: 'cnt-3',
    name: 'รูดบัตรเข้าอาคาร',
    categoryId: 'cat-general',
    type: 'single',
    value: 1,
    goal: 2,
    limit: 5,
    autoReset: 'daily',
    lastUpdated: new Date().toISOString(),
    lastResetDate: new Date().toDateString()
  }
];

let appState = {
  counters: [],
  categories: [],
  settings: {
    haptic: true,
    wakeLock: false
  }
};

let currentView = 'dashboard'; // 'dashboard', 'editor', 'arena', 'settings'
let editingCounterId = null;
let arenaCounterId = null;
let undoStack = null; // { counterId, prevValue, timer }
let wakeLockSentinel = null;

// Neon Color Palette Options
const NEON_COLORS = [
  '#00ff66', // Lime Green
  '#00e5ff', // Cyan
  '#ff007f', // Cyberpink
  '#ffbc00', // Neon Amber
  '#bf00ff', // Neon Purple
  '#ff3366', // Neon Red
  '#33ccff', // Sky Blue
  '#33ff00'  // Electric Green
];

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  checkAutoResets();
  initServiceWorker();
  initWakeLock();
  render();
});

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      appState.counters = parsed.counters || DEFAULT_COUNTERS;
      appState.categories = parsed.categories || DEFAULT_CATEGORIES;
      appState.settings = { ...appState.settings, ...(parsed.settings || {}) };
    } else {
      appState.counters = DEFAULT_COUNTERS;
      appState.categories = DEFAULT_CATEGORIES;
      saveData();
    }
  } catch (e) {
    console.error('Failed to load data from localStorage', e);
    appState.counters = DEFAULT_COUNTERS;
    appState.categories = DEFAULT_CATEGORIES;
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.error('Failed to save data', e);
  }
}

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log('Service Worker registration failed: ', err);
    });
  }
}

async function initWakeLock() {
  if ('wakeLock' in navigator && appState.settings.wakeLock) {
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
    } catch (err) {
      console.error(`${err.name}, ${err.message}`);
    }
  }
}

async function toggleWakeLock(enable) {
  appState.settings.wakeLock = enable;
  saveData();
  if (enable) {
    if ('wakeLock' in navigator) {
      try {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.error(err);
      }
    }
  } else {
    if (wakeLockSentinel) {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
    }
  }
}

function triggerHaptic(type = 'light') {
  if (!appState.settings.haptic) return;
  if ('vibrate' in navigator) {
    if (type === 'light') navigator.vibrate(25);
    else if (type === 'medium') navigator.vibrate(50);
    else if (type === 'heavy') navigator.vibrate([40, 30, 40]);
  }
}

// Auto Reset Mechanics
function checkAutoResets() {
  const now = new Date();
  const todayStr = now.toDateString();
  let updated = false;

  appState.counters = appState.counters.map(cnt => {
    if (!cnt.autoReset || cnt.autoReset === 'none') return cnt;
    const lastReset = cnt.lastResetDate ? new Date(cnt.lastResetDate) : new Date(0);
    let shouldReset = false;

    if (cnt.autoReset === 'daily') {
      shouldReset = now.toDateString() !== lastReset.toDateString();
    } else if (cnt.autoReset === 'weekly') {
      const diffTime = Math.abs(now - lastReset);
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      if (diffDays >= 7 || now.getDay() < lastReset.getDay()) {
        shouldReset = true;
      }
    } else if (cnt.autoReset === 'monthly') {
      shouldReset = now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();
    } else if (cnt.autoReset === 'yearly') {
      shouldReset = now.getFullYear() !== lastReset.getFullYear();
    }

    if (shouldReset) {
      updated = true;
      if (cnt.type === 'single') {
        cnt.value = 0;
      } else if (cnt.type === 'dual' && cnt.subCounts) {
        cnt.subCounts.forEach(s => s.value = 0);
      } else if (cnt.type === 'multi' && cnt.subCounts) {
        cnt.subCounts.forEach(s => s.value = 0);
      }
      cnt.lastResetDate = todayStr;
      cnt.lastUpdated = now.toISOString();
    }
    return cnt;
  });

  if (updated) {
    saveData();
  }
}

// App Navigation & View Renderer
function render() {
  const root = document.getElementById('app-root');
  if (!root) return;

  root.innerHTML = '';

  if (currentView === 'dashboard') {
    root.innerHTML = renderDashboard();
    attachDashboardEvents();
  } else if (currentView === 'editor') {
    root.innerHTML = renderEditor();
    attachEditorEvents();
  } else if (currentView === 'arena') {
    root.innerHTML = renderArena();
    attachArenaEvents();
  } else if (currentView === 'settings') {
    root.innerHTML = renderSettings();
    attachSettingsEvents();
  }
}

// 1. Dashboard View
function renderDashboard() {
  const catMap = {};
  appState.categories.forEach(c => catMap[c.id] = c);

  const cardsHtml = appState.counters.map(cnt => {
    const cat = catMap[cnt.categoryId] || { name: 'ทั่วไป', color: '#00ff66' };
    
    let statusColorClass = 'text-white';
    let glowStyle = `border-color: ${cat.color};`;
    
    if (cnt.type === 'single') {
      if (cnt.limit && cnt.value >= cnt.limit) {
        statusColorClass = 'text-red-500';
        glowStyle = 'border-color: #ff3366; box-shadow: 0 0 15px rgba(255,51,102,0.4);';
      } else if (cnt.goal && cnt.value >= cnt.goal) {
        statusColorClass = 'text-green-400';
        glowStyle = `border-color: #00ff66; box-shadow: 0 0 15px rgba(0,255,102,0.4);`;
      }
    }

    let centerDisplay = '';
    if (cnt.type === 'single') {
      centerDisplay = `<div class="text-6xl sm:text-7xl font-black font-mono tabular-nums tracking-wider ${statusColorClass} my-2">${cnt.value}</div>`;
    } else if (cnt.type === 'dual' && cnt.subCounts && cnt.subCounts.length >= 2) {
      centerDisplay = `
        <div class="grid grid-cols-2 gap-2 my-2 w-full text-center">
          <div class="bg-black/40 p-2 rounded border border-white/10">
            <div class="text-xs text-gray-400 truncate">${cnt.subCounts[0].name}</div>
            <div class="text-3xl font-black font-mono tabular-nums text-cyan-400">${cnt.subCounts[0].value}</div>
          </div>
          <div class="bg-black/40 p-2 rounded border border-white/10">
            <div class="text-xs text-gray-400 truncate">${cnt.subCounts[1].name}</div>
            <div class="text-3xl font-black font-mono tabular-nums text-pink-500">${cnt.subCounts[1].value}</div>
          </div>
        </div>
      `;
    } else if (cnt.type === 'multi' && cnt.subCounts) {
      centerDisplay = `
        <div class="flex flex-wrap gap-2 my-2 w-full justify-center">
          ${cnt.subCounts.map((sub, idx) => `
            <div class="bg-black/40 px-3 py-1 rounded border border-white/10 text-center min-w-[70px]">
              <div class="text-[10px] text-gray-400 truncate">${sub.name}</div>
              <div class="text-2xl font-black font-mono tabular-nums text-amber-400">${sub.value}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    const timeStr = cnt.lastUpdated ? new Date(cnt.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    return `
      <div class="counter-card relative bg-[#121212] border-2 rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 select-none group" style="${glowStyle}" data-id="${cnt.id}">
        <!-- Top Bar -->
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-center gap-2">
            <span class="text-xs px-2 py-0.5 rounded-full bg-black/60 border border-white/10 text-gray-300 font-medium">${cat.name}</span>
            <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${cat.color}; box-shadow: 0 0 8px ${cat.color};"></span>
          </div>
          <div class="flex items-center gap-2">
            ${cnt.type !== 'single' ? `<button class="arena-btn text-xs bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg text-cyan-300 font-medium transition" data-id="${cnt.id}" title="เปิดโหมด Arena">🎯 Arena</button>` : ''}
            <button class="edit-btn text-gray-400 hover:text-white p-1" data-id="${cnt.id}" title="แก้ไข">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </button>
          </div>
        </div>

        <!-- Title -->
        <div class="text-sm font-semibold text-gray-200 tracking-wide truncate">${cnt.name}</div>

        <!-- 70% Upper Click Zone -->
        <div class="cursor-pointer py-3 flex flex-col items-center justify-center flex-grow inc-zone" data-id="${cnt.id}">
          ${centerDisplay}
        </div>

        <!-- Bottom Area -->
        <div class="flex items-center justify-between pt-2 border-t border-white/10 mt-1">
          <span class="text-[11px] text-gray-500 font-mono">อัปเดต: ${timeStr || '-'}</span>
          <div class="flex items-center gap-2">
            ${cnt.type === 'single' ? `
              <button class="dec-btn w-9 h-9 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold flex items-center justify-center transition border border-red-500/20 active:scale-95" data-id="${cnt.id}" title="ลด -1">-</button>
              <button class="inc-btn px-4 h-9 rounded-lg font-bold text-black flex items-center justify-center transition active:scale-95 shadow-lg" style="background-color: ${cat.color};" data-id="${cnt.id}" title="บวก +1">+1</button>
            ` : `
              <button class="edit-btn text-xs bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 px-3 py-1.5 rounded-lg border border-cyan-500/20 transition" data-id="${cnt.id}">จัดการแต้ม</button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="min-h-screen bg-[#000000] text-white flex flex-col pb-24">
      <header class="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-pink-500 flex items-center justify-center font-black text-black text-lg shadow-lg shadow-cyan-500/20">N</div>
          <h1 class="text-xl font-black tracking-wider bg-gradient-to-r from-cyan-400 via-pink-500 to-green-400 bg-clip-text text-transparent">NEONTABS</h1>
        </div>
        <div class="flex items-center gap-3">
          <button id="nav-settings-btn" class="w-10 h-10 rounded-xl bg-[#121212] border border-white/10 hover:border-cyan-400 flex items-center justify-center text-gray-300 hover:text-cyan-400 transition shadow">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          </button>
        </div>
      </header>

      <main class="flex-grow p-4 max-w-4xl mx-auto w-full">
        ${appState.counters.length === 0 ? `
          <div class="flex flex-col items-center justify-center py-20 text-center">
            <div class="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-cyan-400 mb-4 text-2xl">✨</div>
            <h2 class="text-lg font-bold text-gray-300">ยังไม่มีตัวนับในระบบ</h2>
            <p class="text-sm text-gray-500 mt-1 mb-6">กดปุ่ม + ด้านล่างเพื่อสร้างตัวนับแรกของคุณ</p>
            <button id="empty-add-btn" class="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-pink-500 text-black font-bold shadow-lg shadow-cyan-500/20">สร้างตัวนับใหม่</button>
          </div>
        ` : `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            ${cardsHtml}
          </div>
        `}
      </main>

      <button id="fab-add" class="fixed right-6 bottom-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 to-pink-500 text-black font-bold text-3xl flex items-center justify-center shadow-2xl shadow-cyan-500/50 hover:scale-105 active:scale-95 transition">
        +
      </button>

      <div id="undo-snackbar" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e1e] border border-cyan-500/40 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-4 transition-all duration-300 translate-y-24 opacity-0 pointer-events-none">
        <span id="snackbar-msg" class="text-sm font-medium">อัปเดตแต้มแล้ว</span>
        <button id="snackbar-undo" class="bg-cyan-500 text-black text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-cyan-400 transition">เลิกทำ (Undo)</button>
      </div>
    </div>
  `;
}

function attachDashboardEvents() {
  document.getElementById('nav-settings-btn')?.addEventListener('click', () => {
    currentView = 'settings';
    render();
  });

  document.getElementById('fab-add')?.addEventListener('click', () => {
    editingCounterId = null;
    currentView = 'editor';
    render();
  });

  document.getElementById('empty-add-btn')?.addEventListener('click', () => {
    editingCounterId = null;
    currentView = 'editor';
    render();
  });

  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editingCounterId = btn.getAttribute('data-id');
      currentView = 'editor';
      render();
    });
  });

  document.querySelectorAll('.arena-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      arenaCounterId = btn.getAttribute('data-id');
      currentView = 'arena';
      render();
    });
  });

  document.querySelectorAll('.inc-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      updateCounterValue(id, 1);
    });
  });

  document.querySelectorAll('.dec-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      updateCounterValue(id, -1);
    });
  });

  document.querySelectorAll('.inc-zone').forEach(zone => {
    zone.addEventListener('click', () => {
      const id = zone.getAttribute('data-id');
      const cnt = appState.counters.find(c => c.id === id);
      if (cnt && cnt.type === 'single') {
        updateCounterValue(id, 1);
      }
    });
  });
}

function updateCounterValue(id, delta) {
  const cnt = appState.counters.find(c => c.id === id);
  if (!cnt) return;

  const prevValue = cnt.value;
  cnt.value = Math.max(0, cnt.value + delta);
  cnt.lastUpdated = new Date().toISOString();
  saveData();

  triggerHaptic(delta > 0 ? 'light' : 'medium');
  showUndoSnackbar(id, prevValue, delta > 0 ? `+${delta}` : `${delta}`);
  render();
}

function showUndoSnackbar(counterId, prevValue, msg) {
  const snackbar = document.getElementById('undo-snackbar');
  const msgEl = document.getElementById('snackbar-msg');
  const undoBtn = document.getElementById('snackbar-undo');
  if (!snackbar || !msgEl || !undoBtn) return;

  msgEl.textContent = `${msg} แต้ม`;
  snackbar.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
  snackbar.classList.add('translate-y-0', 'opacity-100');

  if (undoStack && undoStack.timer) {
    clearTimeout(undoStack.timer);
  }

  undoStack = {
    counterId,
    prevValue,
    timer: setTimeout(() => {
      hideUndoSnackbar();
    }, 4000)
  };

  undoBtn.onclick = () => {
    const cnt = appState.counters.find(c => c.id === undoStack.counterId);
    if (cnt) {
      cnt.value = undoStack.prevValue;
      cnt.lastUpdated = new Date().toISOString();
      saveData();
      render();
    }
    hideUndoSnackbar();
  };
}

function hideUndoSnackbar() {
  const snackbar = document.getElementById('undo-snackbar');
  if (snackbar) {
    snackbar.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
    snackbar.classList.remove('translate-y-0', 'opacity-100');
  }
  if (undoStack && undoStack.timer) {
    clearTimeout(undoStack.timer);
    undoStack = null;
  }
}

// 2. Counter Editor View
function renderEditor() {
  const isEditing = editingCounterId !== null;
  let cnt = isEditing ? appState.counters.find(c => c.id === editingCounterId) : {
    name: '',
    categoryId: appState.categories[0]?.id || '',
    type: 'single',
    value: 0,
    goal: '',
    limit: '',
    autoReset: 'none',
    subCounts: [{ name: 'ทีม A', value: 0 }, { name: 'ทีม B', value: 0 }]
  };

  const categoriesOptions = appState.categories.map(c => `
    <option value="${c.id}" ${cnt.categoryId === c.id ? 'selected' : ''}>${c.name}</option>
  `).join('');

  return `
    <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end flex-col animate-fade-in">
      <div class="bg-[#121212] border-t border-white/20 rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto w-full max-w-xl mx-auto shadow-2xl">
        <div class="flex items-center justify-between mb-6 pb-3 border-b border-white/10">
          <h2 class="text-xl font-black text-white">${isEditing ? 'แก้ไขตัวนับ' : 'สร้างตัวนับใหม่'}</h2>
          <button id="editor-close" class="text-gray-400 hover:text-white p-2 text-xl font-bold">✕</button>
        </div>

        <form id="counter-form" class="space-y-5">
          <div>
            <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">ชื่อรายการ</label>
            <input type="text" id="f-name" required value="${cnt.name || ''}" placeholder="เช่น ค่าน้ำมันรถ, ดื่มน้ำ" class="w-full bg-black border border-white/20 rounded-xl px-4 py-3 text-white focus:border-cyan-400 outline-none transition">
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">หมวดหมู่</label>
              <select id="f-category" class="w-full bg-black border border-white/20 rounded-xl px-4 py-3 text-white focus:border-cyan-400 outline-none transition">
                ${categoriesOptions}
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">รูปแบบการนับ</label>
              <select id="f-type" class="w-full bg-black border border-white/20 rounded-xl px-4 py-3 text-white focus:border-cyan-400 outline-none transition">
                <option value="single" ${cnt.type === 'single' ? 'selected' : ''}>Single Counter (นับเดี่ยว)</option>
                <option value="dual" ${cnt.type === 'dual' ? 'selected' : ''}>Dual Counter (นับคู่)</option>
                <option value="multi" ${cnt.type === 'multi' ? 'selected' : ''}>Dynamic Multi (นับกลุ่ม)</option>
              </select>
            </div>
          </div>

          <div id="subcounts-section" class="${cnt.type === 'single' ? 'hidden' : ''} space-y-3 bg-black/40 p-4 rounded-xl border border-white/10">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold text-cyan-400 uppercase tracking-wider">จัดการทีม / ฝั่ง</label>
              ${cnt.type === 'multi' ? '<button type="button" id="add-subcount-btn" class="text-xs bg-cyan-500/20 text-cyan-300 px-3 py-1 rounded-lg border border-cyan-500/45 hover:bg-cyan-500/30 transition">+ เพิ่มทีม</button>' : ''}
            </div>
            <div id="subcounts-list" class="space-y-2">
              ${(cnt.subCounts || [{name: 'ทีม A', value: 0}, {name: 'ทีม B', value: 0}]).map((sub, i) => `
                <div class="flex gap-2 items-center subcount-row">
                  <input type="text" value="${sub.name}" placeholder="ชื่อทีม ${i+1}" class="sub-name-input flex-grow bg-black border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400">
                  <input type="number" value="${sub.value || 0}" class="sub-val-input w-20 bg-black border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400">
                  ${cnt.type === 'multi' ? '<button type="button" class="del-sub-btn text-red-400 hover:text-red-300 px-2 py-1">🗑️</button>' : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">เป้าหมาย (Goal - เปลี่ยนเป็นเขียว)</label>
              <input type="number" id="f-goal" value="${cnt.goal !== undefined ? cnt.goal : ''}" placeholder="เช่น 10" class="w-full bg-black border border-white/20 rounded-xl px-4 py-3 text-white focus:border-cyan-400 outline-none transition">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">ขีดจำกัดสูงสุด (Limit - แจ้งเตือนแดง)</label>
              <input type="number" id="f-limit" value="${cnt.limit !== undefined ? cnt.limit : ''}" placeholder="เช่น 20" class="w-full bg-black border border-white/20 rounded-xl px-4 py-3 text-white focus:border-cyan-400 outline-none transition">
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">รอบการรีเซ็ตอัตโนมัติ (Auto-Reset)</label>
            <select id="f-autoreset" class="w-full bg-black border border-white/20 rounded-xl px-4 py-3 text-white focus:border-cyan-400 outline-none transition">
              <option value="none" ${cnt.autoReset === 'none' ? 'selected' : ''}>ไม่มี (Manual)</option>
              <option value="daily" ${cnt.autoReset === 'daily' ? 'selected' : ''}>ทุกวัน (Daily at 00:00)</option>
              <option value="weekly" ${cnt.autoReset === 'weekly' ? 'selected' : ''}>ทุกสัปดาห์ (Weekly)</option>
              <option value="monthly" ${cnt.autoReset === 'monthly' ? 'selected' : ''}>ทุกเดือน (Monthly)</option>
              <option value="yearly" ${cnt.autoReset === 'yearly' ? 'selected' : ''}>ทุกปี (Yearly)</option>
            </select>
          </div>

          <div class="pt-4 flex flex-col gap-3">
            <button type="submit" class="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-400 to-pink-500 text-black font-bold text-base shadow-lg shadow-cyan-500/20 hover:opacity-95 transition">บันทึกข้อมูล</button>
            ${isEditing ? '<button type="button" id="counter-delete" class="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-bold hover:bg-red-500/20 transition">ลบตัวนับนี้</button>' : ''}
          </div>
        </form>
      </div>
    </div>
  `;
}

function attachEditorEvents() {
  document.getElementById('editor-close')?.addEventListener('click', () => {
    currentView = 'dashboard';
    render();
  });

  const typeSelect = document.getElementById('f-type');
  const subcountsSection = document.getElementById('subcounts-section');
  typeSelect?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'single') {
      subcountsSection.classList.add('hidden');
    } else {
      subcountsSection.classList.remove('hidden');
    }
  });

  document.getElementById('add-subcount-btn')?.addEventListener('click', () => {
    const list = document.getElementById('subcounts-list');
    const idx = list.children.length + 1;
    const div = document.createElement('div');
    div.className = 'flex gap-2 items-center subcount-row';
    div.innerHTML = `
      <input type="text" value="ทีม ${idx}" placeholder="ชื่อทีม" class="sub-name-input flex-grow bg-black border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400">
      <input type="number" value="0" class="sub-val-input w-20 bg-black border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-400">
      <button type="button" class="del-sub-btn text-red-400 hover:text-red-300 px-2 py-1">🗑️</button>
    `;
    list.appendChild(div);
    div.querySelector('.del-sub-btn').addEventListener('click', () => div.remove());
  });

  document.querySelectorAll('.del-sub-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.subcount-row')?.remove();
    });
  });

  document.getElementById('counter-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('f-name').value.trim();
    const categoryId = document.getElementById('f-category').value;
    const type = document.getElementById('f-type').value;
    const goal = document.getElementById('f-goal').value ? Number(document.getElementById('f-goal').value) : '';
    const limit = document.getElementById('f-limit').value ? Number(document.getElementById('f-limit').value) : '';
    const autoReset = document.getElementById('f-autoreset').value;

    let subCounts = [];
    if (type !== 'single') {
      document.querySelectorAll('.subcount-row').forEach(row => {
        const subName = row.querySelector('.sub-name-input').value.trim() || 'ทีม';
        const subVal = Number(row.querySelector('.sub-val-input').value) || 0;
        subCounts.push({ name: subName, value: subVal });
      });
    }

    if (editingCounterId !== null) {
      const cnt = appState.counters.find(c => c.id === editingCounterId);
      if (cnt) {
        cnt.name = name;
        cnt.categoryId = categoryId;
        cnt.type = type;
        cnt.goal = goal;
        cnt.limit = limit;
        cnt.autoReset = autoReset;
        if (type !== 'single') {
          cnt.subCounts = subCounts;
        }
        cnt.lastUpdated = new Date().toISOString();
      }
    } else {
      const newCnt = {
        id: 'cnt-' + Date.now(),
        name,
        categoryId,
        type,
        value: 0,
        goal,
        limit,
        autoReset,
        subCounts: type !== 'single' ? subCounts : undefined,
        lastUpdated: new Date().toISOString(),
        lastResetDate: new Date().toDateString()
      };
      appState.counters.push(newCnt);
    }

    saveData();
    currentView = 'dashboard';
    render();
  });

  document.getElementById('counter-delete')?.addEventListener('click', () => {
    if (confirm('คุณต้องการลบตัวนับนี้ใช่หรือไม่?')) {
      appState.counters = appState.counters.filter(c => c.id !== editingCounterId);
      saveData();
      currentView = 'dashboard';
      render();
    }
  });
}

// 3. Focus / Arena Mode View
function renderArena() {
  const cnt = appState.counters.find(c => c.id === arenaCounterId);
  if (!cnt) {
    currentView = 'dashboard';
    return renderDashboard();
  }

  const subCounts = cnt.subCounts || [{ name: 'ทีม A', value: 0 }, { name: 'ทีม B', value: 0 }];
  const colors = ['#00e5ff', '#ff007f', '#00ff66', '#ffbc00'];

  return `
    <div class="fixed inset-0 z-50 bg-black text-white flex flex-col select-none overflow-hidden">
      <div class="absolute top-4 left-4 z-20">
        <button id="arena-exit" class="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl backdrop-blur font-bold border border-white/20 transition">✕ ออก</button>
      </div>
      <div class="absolute top-4 right-4 z-20 flex items-center gap-3">
        <button id="arena-reset" class="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded-xl backdrop-blur font-bold border border-red-500/40 transition">🔄 รีเซ็ต</button>
      </div>

      <div class="flex-grow grid grid-cols-1 ${subCounts.length === 2 ? 'sm:grid-cols-2' : 'grid-cols-2'} w-full h-full">
        ${subCounts.map((sub, idx) => {
          const col = colors[idx % colors.length];
          return `
            <div class="arena-side relative flex flex-col items-center justify-center p-6 border border-white/10 cursor-pointer transition active:brightness-125" style="background-color: ${col}15;" data-index="${idx}">
              <div class="text-xl sm:text-2xl font-black uppercase tracking-wider mb-4" style="color: ${col};">${sub.name}</div>
              <div class="text-8xl sm:text-9xl font-black font-mono tabular-nums tracking-widest my-4" style="color: ${col}; text-shadow: 0 0 30px ${col}66;">${sub.value}</div>
              <div class="absolute bottom-6 flex gap-4">
                <button class="arena-sub-btn w-12 h-12 rounded-full bg-black/60 border border-white/20 text-white font-bold text-xl flex items-center justify-center hover:bg-black transition" data-index="${idx}" data-delta="-1">-</button>
                <button class="arena-add-btn w-16 h-16 rounded-full font-black text-black text-2xl flex items-center justify-center shadow-lg transition active:scale-95" style="background-color: ${col};" data-index="${idx}" data-delta="1">+</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function attachArenaEvents() {
  document.getElementById('arena-exit')?.addEventListener('click', () => {
    currentView = 'dashboard';
    render();
  });

  document.getElementById('arena-reset')?.addEventListener('click', () => {
    if (confirm('ต้องการรีเซ็ตคะแนนทั้งหมดใน Arena นี้ใช่หรือไม่?')) {
      const cnt = appState.counters.find(c => c.id === arenaCounterId);
      if (cnt && cnt.subCounts) {
        cnt.subCounts.forEach(s => s.value = 0);
        cnt.lastUpdated = new Date().toISOString();
        saveData();
        render();
      }
    }
  });

  document.querySelectorAll('.arena-add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.getAttribute('data-index'));
      const delta = Number(btn.getAttribute('data-delta'));
      modifyArenaSubCount(idx, delta);
    });
  });

  document.querySelectorAll('.arena-sub-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.getAttribute('data-index'));
      const delta = Number(btn.getAttribute('data-delta'));
      modifyArenaSubCount(idx, delta);
    });
  });

  document.querySelectorAll('.arena-side').forEach(side => {
    side.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
      const idx = Number(side.getAttribute('data-index'));
      modifyArenaSubCount(idx, 1);
    });
  });
}

function modifyArenaSubCount(subIndex, delta) {
  const cnt = appState.counters.find(c => c.id === arenaCounterId);
  if (!cnt || !cnt.subCounts || !cnt.subCounts[subIndex]) return;

  cnt.subCounts[subIndex].value = Math.max(0, cnt.subCounts[subIndex].value + delta);
  cnt.lastUpdated = new Date().toISOString();
  saveData();
  triggerHaptic(delta > 0 ? 'light' : 'medium');
  render();
}

// 4. Settings & Data Center View
function renderSettings() {
  const categoriesHtml = appState.categories.map(c => `
    <div class="flex items-center justify-between bg-black/40 border border-white/10 p-3 rounded-xl">
      <div class="flex items-center gap-3">
        <span class="w-4 h-4 rounded-full" style="background-color: ${c.color}; box-shadow: 0 0 10px ${c.color};"></span>
        <span class="font-semibold text-white text-sm">${c.name}</span>
      </div>
      <button class="cat-edit-btn text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-cyan-300 transition" data-id="${c.id}">แก้ไข</button>
    </div>
  `).join('');

  return `
    <div class="min-h-screen bg-[#000000] text-white flex flex-col pb-16">
      <header class="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <button id="settings-back" class="w-9 h-9 rounded-xl bg-[#121212] border border-white/10 hover:border-cyan-400 flex items-center justify-center text-gray-300 transition">←</button>
          <h1 class="text-lg font-black tracking-wider">การตั้งค่าและจัดการระบบ</h1>
        </div>
      </header>

      <main class="flex-grow p-4 max-w-xl mx-auto w-full space-y-6">
        <section class="bg-[#121212] border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-cyan-400 uppercase tracking-wider">จัดการหมวดหมู่ (Categories)</h2>
            <button id="add-category-btn" class="text-xs bg-cyan-500/20 text-cyan-300 px-3 py-1.5 rounded-lg border border-cyan-500/40 hover:bg-cyan-500/30 transition">+ เพิ่มหมวดหมู่</button>
          </div>
          <div class="space-y-2">
            ${categoriesHtml}
          </div>
        </section>

        <section class="bg-[#121212] border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
          <h2 class="text-sm font-bold text-cyan-400 uppercase tracking-wider">ตั้งค่าระบบ (System Preferences)</h2>
          <div class="space-y-3">
            <div class="flex items-center justify-between py-2 border-b border-white/10">
              <div>
                <div class="font-medium text-sm">ระบบสั่น (Haptic Feedback)</div>
                <div class="text-xs text-gray-500">สั่นเตือนเมื่อกดปุ่มบวก/ลบ</div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="pref-haptic" class="sr-only peer" ${appState.settings.haptic ? 'checked' : ''}>
                <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-400"></div>
              </label>
            </div>
            <div class="flex items-center justify-between py-2">
              <div>
                <div class="font-medium text-sm">ป้องกันหน้าจอดับ (Wake Lock)</div>
                <div class="text-xs text-gray-500">เปิดหน้าจอค้างไว้ขณะใช้งาน</div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="pref-wakelock" class="sr-only peer" ${appState.settings.wakeLock ? 'checked' : ''}>
                <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-400"></div>
              </label>
            </div>
          </div>
        </section>

        <section class="bg-[#121212] border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
          <h2 class="text-sm font-bold text-cyan-400 uppercase tracking-wider">สำรองและกู้คืนข้อมูล (Data Center)</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button id="btn-export" class="w-full py-3 px-4 rounded-xl border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/10 font-bold text-sm transition flex items-center justify-center gap-2">📥 ส่งออก Backup (.json)</button>
            <label class="w-full py-3 px-4 rounded-xl border border-pink-500/40 text-pink-300 hover:bg-pink-500/10 font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer">
              📤 นำเข้าข้อมูล (Import)
              <input type="file" id="btn-import" accept=".json" class="hidden">
            </label>
          </div>
        </section>

        <section class="bg-[#121212] border border-red-500/30 rounded-2xl p-5 space-y-3 shadow-xl">
          <h2 class="text-sm font-bold text-red-400 uppercase tracking-wider">พื้นที่อันตราย (Danger Zone)</h2>
          <p class="text-xs text-gray-400">การล้างข้อมูลจะลบตัวนับและหมวดหมู่ทั้งหมดที่คุณสร้างขึ้นอย่างถาวร</p>
          <button id="btn-clear-all" class="w-full py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 font-bold text-sm transition">🗑️ ล้างข้อมูลทั้งหมดในระบบ</button>
        </section>
      </main>
    </div>
  `;
}

function attachSettingsEvents() {
  document.getElementById('settings-back')?.addEventListener('click', () => {
    currentView = 'dashboard';
    render();
  });

  document.getElementById('pref-haptic')?.addEventListener('change', (e) => {
    appState.settings.haptic = e.target.checked;
    saveData();
  });

  document.getElementById('pref-wakelock')?.addEventListener('change', async (e) => {
    await toggleWakeLock(e.target.checked);
  });

  document.getElementById('btn-export')?.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `neontabs_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  });

  document.getElementById('btn-import')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported.counters && imported.categories) {
          appState = imported;
          saveData();
          alert('นำเข้าข้อมูลสำเร็จ!');
          currentView = 'dashboard';
          render();
        } else {
          alert('ไฟล์สำรองไม่ถูกต้อง');
        }
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์ JSON');
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('btn-clear-all')?.addEventListener('click', () => {
    if (confirm('คำเตือน: คุณแน่ใจหรือไม่ที่จะล้างข้อมูลทั้งหมด? ข้อมูลจะไม่สามารถกู้คืนได้เว้นแต่คุณจะมีไฟล์ Backup')) {
      localStorage.removeItem(STORAGE_KEY);
      appState.counters = [];
      appState.categories = DEFAULT_CATEGORIES;
      saveData();
      alert('ล้างข้อมูลเรียบร้อยแล้ว');
      currentView = 'dashboard';
      render();
    }
  });

  document.getElementById('add-category-btn')?.addEventListener('click', () => {
    const name = prompt('กรอกชื่อหมวดหมู่ใหม่:');
    if (!name) return;
    const color = prompt('เลือกสีไฟนีออน (#hex เช่น #00ff66, #00e5ff, #ff007f, #ffbc00):', '#00ff66') || '#00ff66';
    const newCat = {
      id: 'cat-' + Date.now(),
      name,
      color
    };
    appState.categories.push(newCat);
    saveData();
    render();
  });

  document.querySelectorAll('.cat-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const catId = btn.getAttribute('data-id');
      const cat = appState.categories.find(c => c.id === catId);
      if (!cat) return;
      const newName = prompt('แก้ไขชื่อหมวดหมู่:', cat.name);
      if (newName === null) return;
      const newColor = prompt('แก้ไขสีนีออน (#hex):', cat.color);
      if (newColor === null) return;
      cat.name = newName.trim() || cat.name;
      cat.color = newColor.trim() || cat.color;
      saveData();
      render();
    });
  });
}

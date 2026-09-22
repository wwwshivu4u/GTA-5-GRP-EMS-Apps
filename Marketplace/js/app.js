/**
 * Main Application Controller for GTA V Grand RP Marketplace Assistant.
 */
window.MarketApp = window.MarketApp || {};

(function(App) {
  // Application State
  const state = {
    rawData: '',
    parsedItems: [],
    allBuyers: new Set(),
    searchQuery: '',
    selectedBuyer: 'ALL',
    selectedCategory: 'ALL',
    sortBy: 'priceDesc',
    useBonus: false,
    viewMode: 'grid', // 'grid' | 'table'
    cargo: [],
    priceDiffs: {},
    feedUrl: '',
    pollInterval: 0,
    activeSnapshot: null
  };

  /**
   * Initializes application from storage and default samples.
   */
  function init() {
    // 1. Load preferences
    state.feedUrl = App.Storage.getSavedData(App.Storage.KEYS.FEED_URL, '');
    state.pollInterval = parseInt(App.Storage.getSavedData(App.Storage.KEYS.POLL_INTERVAL, '0'), 10);
    state.viewMode = App.Storage.getSavedData(App.Storage.KEYS.VIEW_MODE, 'grid');
    state.useBonus = App.Storage.getSavedData(App.Storage.KEYS.USE_BONUS, false);
    state.cargo = App.Storage.getCargo();

    // 2. Load latest previous snapshot for price trend diffing
    state.activeSnapshot = App.Storage.getLatestPreviousSnapshot();

    // 3. Load stored raw data or fallback to sample
    const savedRaw = App.Storage.getSavedData(App.Storage.KEYS.RAW_DATA, null);
    const initialText = savedRaw || App.INITIAL_RAW_DATA;
    loadData(initialText, savedRaw ? 'Saved Local Data' : 'Initial Sample');

    // 4. Bind DOM events & shortcuts
    bindEvents();
    bindKeyboardShortcuts();
    setupRemoteFeedPolling();
    updateViewModeButtons();
  }

  /**
   * Parses and loads market text into state and triggers rendering.
   */
  function loadData(rawText, sourceLabel = 'manual') {
    if (!rawText || !rawText.trim()) return;

    const parsed = App.Parser.parseMarketData(rawText);
    state.rawData = rawText;
    state.parsedItems = parsed.items;
    state.allBuyers = new Set(parsed.buyers);

    // Save to storage
    App.Storage.setSavedData(App.Storage.KEYS.RAW_DATA, rawText);

    // Compute diffs against snapshot
    if (state.activeSnapshot) {
      state.priceDiffs = App.Storage.computePriceDiffs(state.parsedItems, state.activeSnapshot, state.useBonus);
    } else {
      state.priceDiffs = {};
    }

    // Refresh UI
    populateBuyerSelect();
    renderOverview();
    renderMainContent();
    renderCargoDrawer();

    // Update modal raw text & status label
    const rawInput = document.getElementById('rawTextInput');
    const parseStats = document.getElementById('parseStats');
    const lastSyncLabel = document.getElementById('lastSyncLabel');
    if (rawInput) rawInput.value = rawText;
    if (parseStats) parseStats.textContent = `Parsed ${parsed.items.length} items across ${parsed.buyers.length} buyers successfully.`;
    if (lastSyncLabel) lastSyncLabel.textContent = `Last synced (${sourceLabel}): ${new Date().toLocaleTimeString()}`;
  }

  function renderOverview() {
    const strip = document.getElementById('quickStatsStrip');
    App.Components.renderOverviewStats(strip, state.parsedItems, state.allBuyers, state.useBonus);
  }

  function renderMainContent() {
    const gridContainer = document.getElementById('resultsGrid');
    const emptyState = document.getElementById('emptyState');
    const countLabel = document.getElementById('itemCount');
    const searchNotice = document.getElementById('searchNotice');

    const filtered = App.Search.filterAndSortItems(state.parsedItems, {
      selectedBuyer: state.selectedBuyer,
      selectedCategory: state.selectedCategory,
      searchQuery: state.searchQuery,
      sortBy: state.sortBy,
      useBonus: state.useBonus
    });

    if (countLabel) countLabel.textContent = filtered.length;

    if (state.searchQuery.trim() && searchNotice) {
      const tokens = state.searchQuery.split(/[,;]+/).map(t => `"${t.trim()}"`).filter(t => t.length > 1);
      searchNotice.textContent = `Matching: ${tokens.join(' OR ')}`;
    } else if (searchNotice) {
      searchNotice.textContent = '';
    }

    if (filtered.length === 0) {
      if (gridContainer) gridContainer.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    if (state.viewMode === 'table') {
      // Switch grid container to full-width block for table
      gridContainer.className = 'w-full';
      App.Components.renderTableView(gridContainer, filtered, state.useBonus, state.priceDiffs);
    } else {
      gridContainer.className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4';
      App.Components.renderGridCards(gridContainer, filtered, state.useBonus, state.priceDiffs);
    }

    // Attach "+ Cargo" event listeners
    document.querySelectorAll('.add-cargo-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        addToCargo(id, name);
      });
    });
  }

  function populateBuyerSelect() {
    const select = document.getElementById('buyerFilter');
    if (!select) return;
    const current = state.selectedBuyer;
    select.innerHTML = '<option value="ALL">All Buyers</option>';
    Array.from(state.allBuyers).sort().forEach(buyer => {
      const opt = document.createElement('option');
      opt.value = buyer;
      opt.textContent = buyer;
      if (buyer === current) opt.selected = true;
      select.appendChild(opt);
    });
  }

  /**
   * Cargo drawer management
   */
  function addToCargo(id, name, qty = 10) {
    const existing = state.cargo.find(c => c.id === id || c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.quantity = (existing.quantity || 1) + qty;
    } else {
      state.cargo.push({ id, name, quantity: qty });
    }
    App.Storage.saveCargo(state.cargo);
    renderCargoDrawer();
    openCargoDrawer();
    App.Notifications.success(`Added ${qty}x ${name} to Cargo`, 2000);
  }

  function renderCargoDrawer() {
    const container = document.getElementById('cargoDrawerContent');
    const badge = document.getElementById('cargoBadgeCount');
    if (badge) {
      const totalUnits = state.cargo.reduce((sum, i) => sum + (i.quantity || 1), 0);
      badge.textContent = totalUnits;
      badge.classList.toggle('hidden', state.cargo.length === 0);
    }

    App.Components.renderCargoDrawer(container, state.cargo, state.parsedItems, state.useBonus);

    // Bind cargo drawer events
    const closeBtn = document.getElementById('closeCargoDrawerBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeCargoDrawer);

    // Quantity modifiers
    document.querySelectorAll('.cargo-inc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (state.cargo[idx]) {
          state.cargo[idx].quantity = (state.cargo[idx].quantity || 1) + 5;
          App.Storage.saveCargo(state.cargo);
          renderCargoDrawer();
        }
      });
    });

    document.querySelectorAll('.cargo-dec-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (state.cargo[idx]) {
          state.cargo[idx].quantity = Math.max(1, (state.cargo[idx].quantity || 1) - 5);
          App.Storage.saveCargo(state.cargo);
          renderCargoDrawer();
        }
      });
    });

    document.querySelectorAll('.cargo-qty-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(input.dataset.index, 10);
        const val = Math.max(1, parseInt(e.target.value, 10) || 1);
        if (state.cargo[idx]) {
          state.cargo[idx].quantity = val;
          App.Storage.saveCargo(state.cargo);
          renderCargoDrawer();
        }
      });
    });

    document.querySelectorAll('.cargo-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        state.cargo.splice(idx, 1);
        App.Storage.saveCargo(state.cargo);
        renderCargoDrawer();
      });
    });

    const clearBtn = document.getElementById('clearCargoBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        state.cargo = [];
        App.Storage.saveCargo(state.cargo);
        renderCargoDrawer();
        App.Notifications.info('Cargo inventory cleared.');
      });
    }

    const copyRouteBtn = document.getElementById('copyRouteBtn');
    if (copyRouteBtn) {
      copyRouteBtn.addEventListener('click', () => {
        const route = App.Calculator.optimizeSellingRoute(state.cargo, state.parsedItems, state.useBonus);
        if (route.optimalStops.length === 0) return;

        let directions = `🚗 **Optimal Selling Route** (Total: $${route.optimalStops.length > 0 ? route.optimalTotal.toLocaleString() : 0})\n`;
        route.optimalStops.forEach((stop, i) => {
          directions += `${i + 1}. ${stop.buyer} -> $${stop.totalPayout.toLocaleString()}\n`;
          stop.items.forEach(it => {
            directions += `   • ${it.name} x${it.quantity}\n`;
          });
        });

        navigator.clipboard.writeText(directions).then(() => {
          App.Notifications.success('Route directions copied to clipboard!');
        });
      });
    }
  }

  function openCargoDrawer() {
    const drawer = document.getElementById('cargoDrawer');
    if (drawer) drawer.classList.remove('hidden');
  }

  function closeCargoDrawer() {
    const drawer = document.getElementById('cargoDrawer');
    if (drawer) drawer.classList.add('hidden');
  }

  function toggleCargoDrawer() {
    const drawer = document.getElementById('cargoDrawer');
    if (drawer && drawer.classList.contains('hidden')) {
      openCargoDrawer();
    } else {
      closeCargoDrawer();
    }
  }

  function updateViewModeButtons() {
    const gridBtn = document.getElementById('viewGridBtn');
    const tableBtn = document.getElementById('viewTableBtn');
    if (gridBtn && tableBtn) {
      if (state.viewMode === 'grid') {
        gridBtn.className = 'p-1.5 rounded-lg bg-gray-800 text-emerald-400 border border-emerald-500/40';
        tableBtn.className = 'p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800';
      } else {
        tableBtn.className = 'p-1.5 rounded-lg bg-gray-800 text-emerald-400 border border-emerald-500/40';
        gridBtn.className = 'p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800';
      }
    }
  }

  function setupRemoteFeedPolling() {
    const badge = document.getElementById('syncStatusBadge');
    if (state.pollInterval > 0 && state.feedUrl) {
      App.Feed.startPolling(
        state.feedUrl,
        state.pollInterval,
        (data) => {
          loadData(data, 'Remote Auto-Feed');
          App.Notifications.info('Live market feed refreshed automatically.');
        },
        (err) => {
          console.warn('Poll error:', err);
        }
      );
      if (badge) badge.classList.remove('hidden');
    } else {
      App.Feed.stopPolling();
      if (badge) badge.classList.add('hidden');
    }
  }

  /**
   * Setup Event Listeners
   */
  function bindEvents() {
    // Search input with debounce
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    let debounceTimer;

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          state.searchQuery = e.target.value;
          if (clearSearchBtn) {
            clearSearchBtn.classList.toggle('hidden', !state.searchQuery);
          }
          renderMainContent();
        }, 100);
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        state.searchQuery = '';
        clearSearchBtn.classList.add('hidden');
        renderMainContent();
      });
    }

    // Quick query tags
    document.querySelectorAll('.quick-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const q = tag.getAttribute('data-query');
        if (searchInput) searchInput.value = q;
        state.searchQuery = q;
        if (clearSearchBtn) clearSearchBtn.classList.remove('hidden');
        renderMainContent();
      });
    });

    // Filters
    const buyerFilter = document.getElementById('buyerFilter');
    if (buyerFilter) {
      buyerFilter.addEventListener('change', (e) => {
        state.selectedBuyer = e.target.value;
        renderMainContent();
      });
    }

    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        state.selectedCategory = e.target.value;
        renderMainContent();
      });
    }

    const sortBy = document.getElementById('sortBy');
    if (sortBy) {
      sortBy.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        renderMainContent();
      });
    }

    // Bonus Price Toggle
    const toggleBonusBtn = document.getElementById('toggleBonusBtn');
    const bonusModeLabel = document.getElementById('bonusModeLabel');
    if (toggleBonusBtn) {
      toggleBonusBtn.addEventListener('click', () => {
        state.useBonus = !state.useBonus;
        App.Storage.setSavedData(App.Storage.KEYS.USE_BONUS, state.useBonus);
        if (bonusModeLabel) {
          bonusModeLabel.textContent = state.useBonus ? 'Bonus Prices (ON)' : 'Base Prices';
        }
        toggleBonusBtn.classList.toggle('bg-emerald-950/60', state.useBonus);
        toggleBonusBtn.classList.toggle('border-emerald-500/50', state.useBonus);

        // Recalculate price diffs
        if (state.activeSnapshot) {
          state.priceDiffs = App.Storage.computePriceDiffs(state.parsedItems, state.activeSnapshot, state.useBonus);
        }

        renderOverview();
        renderMainContent();
        renderCargoDrawer();
      });
    }

    // View mode toggles
    const viewGridBtn = document.getElementById('viewGridBtn');
    const viewTableBtn = document.getElementById('viewTableBtn');
    if (viewGridBtn) {
      viewGridBtn.addEventListener('click', () => {
        state.viewMode = 'grid';
        App.Storage.setSavedData(App.Storage.KEYS.VIEW_MODE, 'grid');
        updateViewModeButtons();
        renderMainContent();
      });
    }
    if (viewTableBtn) {
      viewTableBtn.addEventListener('click', () => {
        state.viewMode = 'table';
        App.Storage.setSavedData(App.Storage.KEYS.VIEW_MODE, 'table');
        updateViewModeButtons();
        renderMainContent();
      });
    }

    // Cargo Drawer trigger
    const toggleCargoDrawerBtn = document.getElementById('toggleCargoDrawerBtn');
    if (toggleCargoDrawerBtn) {
      toggleCargoDrawerBtn.addEventListener('click', toggleCargoDrawer);
    }
    const closeCargoDrawerBackdrop = document.getElementById('cargoDrawerBackdrop');
    if (closeCargoDrawerBackdrop) {
      closeCargoDrawerBackdrop.addEventListener('click', closeCargoDrawer);
    }

    // Clipboard Sync Button
    const syncClipboardBtn = document.getElementById('syncClipboardBtn');
    if (syncClipboardBtn) {
      syncClipboardBtn.addEventListener('click', async () => {
        try {
          const text = await App.Feed.readClipboardText();
          if (text && (text.includes('$') || text.toLowerCase().includes('buyer'))) {
            loadData(text, 'Clipboard');
            App.Notifications.success('Market prices synced from clipboard!');
          } else {
            App.Notifications.warning('No valid price list detected on clipboard. Copy Discord text first.');
          }
        } catch (e) {
          // Open modal manual input as fallback
          openModal();
          switchModalTab('manual');
          App.Notifications.info('Clipboard access restricted. Paste directly into text box.');
        }
      });
    }

    // Modal Triggers
    const openModalBtn = document.getElementById('openModalBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const applyDataBtn = document.getElementById('applyDataBtn');
    const loadDefaultSampleBtn = document.getElementById('loadDefaultSampleBtn');
    const rawTextInput = document.getElementById('rawTextInput');

    if (openModalBtn) openModalBtn.addEventListener('click', openModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

    if (loadDefaultSampleBtn) {
      loadDefaultSampleBtn.addEventListener('click', () => {
        if (rawTextInput) rawTextInput.value = App.INITIAL_RAW_DATA;
        const parseStats = document.getElementById('parseStats');
        if (parseStats) parseStats.textContent = 'Original sample restored. Click "Apply & Update" to load.';
      });
    }

    if (applyDataBtn) {
      applyDataBtn.addEventListener('click', () => {
        const text = rawTextInput ? rawTextInput.value.trim() : '';
        if (text) {
          loadData(text, 'Manual Paste');
          closeModal();
          App.Notifications.success('Market prices updated successfully!');
        }
      });
    }

    // Modal Tabs Navigation
    const tabManualBtn = document.getElementById('tabManualBtn');
    const tabAutoBtn = document.getElementById('tabAutoBtn');
    const tabBotCodeBtn = document.getElementById('tabBotCodeBtn');
    const tabSnapshotsBtn = document.getElementById('tabSnapshotsBtn');

    if (tabManualBtn) tabManualBtn.addEventListener('click', () => switchModalTab('manual'));
    if (tabAutoBtn) tabAutoBtn.addEventListener('click', () => switchModalTab('auto'));
    if (tabBotCodeBtn) tabBotCodeBtn.addEventListener('click', () => switchModalTab('bot'));
    if (tabSnapshotsBtn) tabSnapshotsBtn.addEventListener('click', () => switchModalTab('snapshots'));

    // Feed controls in modal
    const testFeedBtn = document.getElementById('testFeedBtn');
    const feedUrlInput = document.getElementById('feedUrlInput');
    const pollIntervalSelect = document.getElementById('pollIntervalSelect');
    const feedSyncStatus = document.getElementById('feedSyncStatus');

    if (feedUrlInput && state.feedUrl) feedUrlInput.value = state.feedUrl;
    if (pollIntervalSelect && state.pollInterval) pollIntervalSelect.value = state.pollInterval.toString();

    if (testFeedBtn) {
      testFeedBtn.addEventListener('click', async () => {
        const url = feedUrlInput.value.trim();
        state.feedUrl = url;
        App.Storage.setSavedData(App.Storage.KEYS.FEED_URL, url);

        if (!url) {
          if (feedSyncStatus) feedSyncStatus.textContent = 'Status: Please enter a valid URL.';
          return;
        }

        try {
          if (feedSyncStatus) feedSyncStatus.textContent = 'Fetching feed...';
          const text = await App.Feed.fetchRemoteFeed(url);
          loadData(text, 'Remote Feed');
          if (feedSyncStatus) feedSyncStatus.innerHTML = `<span class="text-emerald-400">Success! Synced at ${new Date().toLocaleTimeString()}</span>`;
          App.Notifications.success('Remote feed fetched!');
        } catch (err) {
          if (feedSyncStatus) feedSyncStatus.innerHTML = `<span class="text-red-400">Error: ${err.message}</span>`;
          App.Notifications.error(`Feed Error: ${err.message}`);
        }
      });
    }

    if (pollIntervalSelect) {
      pollIntervalSelect.addEventListener('change', (e) => {
        state.pollInterval = parseInt(e.target.value, 10);
        state.feedUrl = feedUrlInput ? feedUrlInput.value.trim() : '';
        App.Storage.setSavedData(App.Storage.KEYS.POLL_INTERVAL, state.pollInterval);
        App.Storage.setSavedData(App.Storage.KEYS.FEED_URL, state.feedUrl);
        setupRemoteFeedPolling();
      });
    }

    // Save Price Snapshot Button
    const saveSnapshotBtn = document.getElementById('saveSnapshotBtn');
    if (saveSnapshotBtn) {
      saveSnapshotBtn.addEventListener('click', () => {
        const label = prompt('Enter a label for this price snapshot (e.g. "Morning Drop"):', `Snapshot ${new Date().toLocaleTimeString()}`);
        if (label) {
          const snap = App.Storage.saveSnapshot(label, state.parsedItems, state.rawData);
          state.activeSnapshot = snap;
          state.priceDiffs = App.Storage.computePriceDiffs(state.parsedItems, snap, state.useBonus);
          renderMainContent();
          renderSnapshotsList();
          App.Notifications.success(`Snapshot "${label}" saved! Current prices will compare against it.`);
        }
      });
    }

    // Export Discord Report
    const exportDiscordBtn = document.getElementById('exportDiscordBtn');
    if (exportDiscordBtn) {
      exportDiscordBtn.addEventListener('click', () => {
        const md = App.Feed.generateDiscordReport(state.parsedItems, state.useBonus);
        navigator.clipboard.writeText(md).then(() => {
          App.Notifications.success('Discord price report copied to clipboard!');
        });
      });
    }

    // Export CSV
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => {
        const csv = App.Feed.generateCsvExport(state.parsedItems, state.useBonus);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `grp_prices_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        App.Notifications.success('CSV downloaded!');
      });
    }
  }

  function openModal() {
    const modal = document.getElementById('inputModal');
    if (modal) modal.classList.remove('hidden');
    renderSnapshotsList();
  }

  function closeModal() {
    const modal = document.getElementById('inputModal');
    if (modal) modal.classList.add('hidden');
  }

  function switchModalTab(tabKey) {
    const tabs = {
      manual: { btn: document.getElementById('tabManualBtn'), content: document.getElementById('tabManualContent') },
      auto: { btn: document.getElementById('tabAutoBtn'), content: document.getElementById('tabAutoContent') },
      bot: { btn: document.getElementById('tabBotCodeBtn'), content: document.getElementById('tabBotCodeContent') },
      snapshots: { btn: document.getElementById('tabSnapshotsBtn'), content: document.getElementById('tabSnapshotsContent') }
    };

    Object.values(tabs).forEach(t => {
      if (t.btn) t.btn.className = 'px-3 py-1.5 text-xs font-medium rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/60 transition';
      if (t.content) t.content.classList.add('hidden');
    });

    if (tabs[tabKey]) {
      if (tabs[tabKey].btn) tabs[tabKey].btn.className = 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 text-white border border-gray-700';
      if (tabs[tabKey].content) tabs[tabKey].content.classList.remove('hidden');
    }

    if (tabKey === 'snapshots') {
      renderSnapshotsList();
    }
  }

  function renderSnapshotsList() {
    const container = document.getElementById('snapshotsListContainer');
    if (!container) return;

    const snapshots = App.Storage.getSnapshots();
    if (snapshots.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8 text-gray-500 text-xs">
          No snapshots saved yet. Click "Save Snapshot" to record today's prices and track trends over time.
        </div>
      `;
      return;
    }

    container.innerHTML = snapshots.map(s => {
      const isCurrentActive = state.activeSnapshot && state.activeSnapshot.id === s.id;
      const dateStr = new Date(s.timestamp).toLocaleString();
      return `
        <div class="flex items-center justify-between p-3 rounded-xl bg-gray-950/70 border border-gray-800 hover:border-gray-700">
          <div>
            <div class="text-xs font-bold text-white flex items-center gap-2">
              <span>${s.label}</span>
              ${isCurrentActive ? '<span class="text-[10px] text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-700/50">Active Baseline</span>' : ''}
            </div>
            <div class="text-[11px] text-gray-400 font-mono mt-0.5">${dateStr} • ${s.items.length} items</div>
          </div>
          <div class="flex items-center gap-2">
            <button class="restore-snapshot-btn px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-700/50 hover:bg-emerald-900/60 text-xs font-medium" data-id="${s.id}">
              Compare Diff
            </button>
            <button class="load-snapshot-data-btn px-2.5 py-1 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 text-xs font-medium" data-id="${s.id}">
              Load Raw
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Bind snapshot buttons
    container.querySelectorAll('.restore-snapshot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const snap = snapshots.find(s => s.id === id);
        if (snap) {
          state.activeSnapshot = snap;
          state.priceDiffs = App.Storage.computePriceDiffs(state.parsedItems, snap, state.useBonus);
          renderMainContent();
          renderSnapshotsList();
          App.Notifications.success(`Comparing live prices against baseline: "${snap.label}"`);
        }
      });
    });

    container.querySelectorAll('.load-snapshot-data-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const snap = snapshots.find(s => s.id === id);
        if (snap && snap.rawData) {
          loadData(snap.rawData, `Snapshot: ${snap.label}`);
          closeModal();
          App.Notifications.info(`Loaded raw price list from "${snap.label}".`);
        }
      });
    });
  }

  /**
   * Keyboard shortcuts
   */
  function bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      // Press '/' to search
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }

      // Press 'Escape' to close modal or drawer
      if (e.key === 'Escape') {
        closeModal();
        closeCargoDrawer();
      }

      // Press 'b' to toggle bonus prices
      if ((e.key === 'b' || e.key === 'B') && !isInput) {
        const toggleBonusBtn = document.getElementById('toggleBonusBtn');
        if (toggleBonusBtn) toggleBonusBtn.click();
      }

      // Press 'c' to toggle cargo drawer
      if ((e.key === 'c' || e.key === 'C') && !isInput) {
        toggleCargoDrawer();
      }
    });

    // Paste handler anywhere on document to sync clipboard
    window.addEventListener('paste', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'textarea' || activeTag === 'input') return;

      const pastedText = (e.clipboardData || window.clipboardData).getData('text');
      if (pastedText && (pastedText.includes('$') || pastedText.toLowerCase().includes('buyer'))) {
        e.preventDefault();
        loadData(pastedText, 'Pasted Text');
        App.Notifications.success('Pasted new market price sheet!');
      }
    });
  }

  // Auto initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  App.init = init;
})(window.MarketApp);

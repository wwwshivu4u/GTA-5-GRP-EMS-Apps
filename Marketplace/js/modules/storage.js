/**
 * Storage and Snapshot History Manager for GTA V Grand RP Assistant.
 */
window.MarketApp = window.MarketApp || {};

(function(exports) {
  const KEYS = {
    RAW_DATA: 'grp_market_raw_data',
    FEED_URL: 'grp_market_feed_url',
    POLL_INTERVAL: 'grp_market_poll_interval',
    CARGO: 'grp_market_cargo_items',
    VIEW_MODE: 'grp_market_view_mode',
    USE_BONUS: 'grp_market_use_bonus',
    SNAPSHOTS: 'grp_market_price_snapshots',
    ACTIVE_SNAPSHOT_ID: 'grp_market_active_snapshot_id'
  };

  function getSavedData(key, fallback = null) {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function setSavedData(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }

  // Snapshots management
  function getSnapshots() {
    return getSavedData(KEYS.SNAPSHOTS, []);
  }

  function saveSnapshot(label, items, rawData, source = 'manual', diffSummary = null) {
    const snapshots = getSnapshots();
    const newSnapshot = {
      id: 'snap_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      label: label || `Snapshot ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      timestamp: new Date().toISOString(),
      source: source || 'manual',
      items: (items || []).map(i => ({
        name: i.name,
        bestBasePrice: i.bestBasePrice,
        bestBonusPrice: i.bestBonusPrice,
        category: i.category
      })),
      rawData,
      diffSummary: diffSummary || null
    };

    // Keep up to 30 latest snapshots in chronological history
    snapshots.unshift(newSnapshot);
    if (snapshots.length > 30) snapshots.pop();

    setSavedData(KEYS.SNAPSHOTS, snapshots);
    return newSnapshot;
  }

  function deleteSnapshot(id) {
    let snapshots = getSnapshots();
    snapshots = snapshots.filter(s => s.id !== id);
    setSavedData(KEYS.SNAPSHOTS, snapshots);
    return snapshots;
  }

  function clearSnapshots() {
    setSavedData(KEYS.SNAPSHOTS, []);
  }

  function getLatestPreviousSnapshot() {
    const snapshots = getSnapshots();
    return snapshots.length > 0 ? snapshots[0] : null;
  }

  /**
   * Helper to summarize price diff trends.
   */
  function getDiffSummary(diffs) {
    if (!diffs) return { up: 0, down: 0, same: 0, total: 0 };
    let up = 0, down = 0, same = 0;
    Object.values(diffs).forEach(d => {
      if (d.isHigher) up++;
      else if (d.isLower) down++;
      else same++;
    });
    return { up, down, same, total: up + down + same };
  }

  /**
   * Compares current items with a previous snapshot to compute price diffs.
   */
  function computePriceDiffs(currentItems, snapshot, useBonus = false) {
    if (!snapshot || !snapshot.items) return {};

    const snapMap = {};
    snapshot.items.forEach(item => {
      snapMap[item.name.toLowerCase()] = item;
    });

    const diffs = {};
    currentItems.forEach(item => {
      const prev = snapMap[item.name.toLowerCase()];
      if (prev) {
        const curPrice = useBonus ? item.bestBonusPrice : item.bestBasePrice;
        const prevPrice = useBonus ? prev.bestBonusPrice : prev.bestBasePrice;
        const diff = curPrice - prevPrice;
        diffs[item.name.toLowerCase()] = {
          prevPrice,
          curPrice,
          diff,
          isHigher: diff > 0,
          isLower: diff < 0,
          isSame: diff === 0
        };
      }
    });

    return diffs;
  }

  // Cargo Inventory management
  function getCargo() {
    return getSavedData(KEYS.CARGO, [
      { id: 'salmon', name: 'Salmon', quantity: 20 },
      { id: 'emerald', name: 'Emerald', quantity: 50 },
      { id: 'copper', name: 'Copper', quantity: 100 }
    ]);
  }

  function saveCargo(cargoList) {
    setSavedData(KEYS.CARGO, cargoList);
  }

  exports.Storage = {
    KEYS,
    getSavedData,
    setSavedData,
    getSnapshots,
    saveSnapshot,
    deleteSnapshot,
    clearSnapshots,
    getLatestPreviousSnapshot,
    getDiffSummary,
    computePriceDiffs,
    getCargo,
    saveCargo
  };
})(window.MarketApp);

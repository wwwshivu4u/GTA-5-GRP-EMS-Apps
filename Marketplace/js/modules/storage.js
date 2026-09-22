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
    SNAPSHOTS: 'grp_market_price_snapshots'
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

  function saveSnapshot(label, items, rawData) {
    const snapshots = getSnapshots();
    const newSnapshot = {
      id: 'snap_' + Date.now(),
      label: label || `Snapshot ${new Date().toLocaleTimeString()}`,
      timestamp: new Date().toISOString(),
      items: items.map(i => ({
        name: i.name,
        bestBasePrice: i.bestBasePrice,
        bestBonusPrice: i.bestBonusPrice,
        category: i.category
      })),
      rawData
    };

    // Keep up to 10 latest snapshots
    snapshots.unshift(newSnapshot);
    if (snapshots.length > 10) snapshots.pop();

    setSavedData(KEYS.SNAPSHOTS, snapshots);
    return newSnapshot;
  }

  function getLatestPreviousSnapshot() {
    const snapshots = getSnapshots();
    return snapshots.length > 0 ? snapshots[0] : null;
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
    getLatestPreviousSnapshot,
    computePriceDiffs,
    getCargo,
    saveCargo
  };
})(window.MarketApp);

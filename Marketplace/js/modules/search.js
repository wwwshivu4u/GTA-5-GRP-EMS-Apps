/**
 * Search, fuzzy matching, filtering, and sorting engine.
 */
window.MarketApp = window.MarketApp || {};

(function(exports) {
  function levenshteinDistance(s1, s2) {
    if (s1 === s2) return 0;
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  function tokenMatchesItem(token, item) {
    if (!token) return true;
    token = token.trim().toLowerCase();
    if (!token) return true;

    const itemName = item.name.toLowerCase();
    const category = item.category.toLowerCase();

    // 1. Direct substring match
    if (itemName.includes(token) || category.includes(token)) {
      return true;
    }

    // 2. Individual words check (e.g. "whale" matches "Humpback whale")
    const words = itemName.split(/\s+/);
    for (const word of words) {
      if (word.startsWith(token) || token.startsWith(word)) {
        return true;
      }
      // 3. Typo fuzzy match (e.g. "cooper" vs "copper", "dimond" vs "diamond")
      const dist = levenshteinDistance(word, token);
      const maxLen = Math.max(word.length, token.length);
      if ((maxLen >= 4 && dist <= 1) || (maxLen >= 7 && dist <= 2)) {
        return true;
      }
    }

    // Check whole phrase distance if query is 4+ chars
    if (token.length >= 4) {
      const fullDist = levenshteinDistance(itemName, token);
      if (fullDist <= 2) return true;
    }

    return false;
  }

  function evaluateMultiSearch(query, item) {
    if (!query || !query.trim()) return true;

    // Split terms by comma or semicolon
    const tokens = query
      .split(/[,;]+/)
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (tokens.length === 0) return true;

    // Item matches if it satisfies ANY of the tokens (OR search)
    return tokens.some(t => tokenMatchesItem(t, item));
  }

  function filterAndSortItems(items, options) {
    const {
      selectedBuyer = 'ALL',
      selectedCategory = 'ALL',
      searchQuery = '',
      sortBy = 'priceDesc',
      useBonus = false
    } = options;

    let filtered = items.filter(item => {
      // Buyer filter
      if (selectedBuyer !== 'ALL') {
        const hasBuyer = item.offers.some(o => o.buyer === selectedBuyer);
        if (!hasBuyer) return false;
      }

      // Category filter
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }

      // Search query
      if (searchQuery && !evaluateMultiSearch(searchQuery, item)) {
        return false;
      }

      return true;
    });

    // Sort items
    filtered.sort((a, b) => {
      const priceA = useBonus ? a.bestBonusPrice : a.bestBasePrice;
      const priceB = useBonus ? b.bestBonusPrice : b.bestBasePrice;
      const spreadA = useBonus ? a.bonusSpread : a.baseSpread;
      const spreadB = useBonus ? b.bonusSpread : b.baseSpread;
      const spreadPctA = useBonus ? a.bonusSpreadPct : a.baseSpreadPct;
      const spreadPctB = useBonus ? b.bonusSpreadPct : b.baseSpreadPct;

      switch (sortBy) {
        case 'priceDesc': return priceB - priceA;
        case 'priceAsc': return priceA - priceB;
        case 'marginDesc': return spreadB - spreadA;
        case 'marginPctDesc': return spreadPctB - spreadPctA;
        case 'nameAsc': return a.name.localeCompare(b.name);
        case 'buyersCountDesc': return b.offers.length - a.offers.length;
        default: return 0;
      }
    });

    return filtered;
  }

  exports.Search = {
    levenshteinDistance,
    tokenMatchesItem,
    evaluateMultiSearch,
    filterAndSortItems
  };
})(window.MarketApp);

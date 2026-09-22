/**
 * Category classification, metadata, and visual styling for GTA V Grand RP items.
 */
window.MarketApp = window.MarketApp || {};

(function(exports) {
  const CATEGORIES = {
    Minerals: {
      label: 'Ores & Minerals',
      icon: '💎',
      badgeClass: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
      tagColor: 'amber',
      keywords: ['copper', 'emerald', 'ruby', 'diamond', 'pearls', 'gold', 'silver', 'iron', 'ore', 'stone']
    },
    Marine: {
      label: 'Fish & Marine',
      icon: '🐟',
      badgeClass: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60',
      tagColor: 'cyan',
      keywords: ['perch', 'carp', 'trout', 'salmon', 'ray', 'orca', 'megalodon', 'whale', 'humpback', 'crab', 'shark', 'cod', 'tuna']
    },
    Fuel: {
      label: 'Fuel & Energy',
      icon: '⚡',
      badgeClass: 'bg-orange-950/60 text-orange-300 border-orange-800/60',
      tagColor: 'orange',
      keywords: ['gasoline', 'solar', 'kerosene', 'fuel', 'oil', 'battery', 'diesel', 'petrol']
    },
    Hunting: {
      label: 'Hunting & Skins',
      icon: '🏹',
      badgeClass: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
      tagColor: 'emerald',
      keywords: ['animal skin', 'skin', 'meat', 'leather', 'antlers', 'horn', 'fur', 'pelt']
    },
    Illicit: {
      label: 'Illicit & Stolen',
      icon: '💰',
      badgeClass: 'bg-red-950/60 text-red-300 border-red-800/60',
      tagColor: 'red',
      keywords: ['counterfeit money', 'counterfeit', 'tv', 'furniture', 'box of things', 'stolen', 'drugs', 'weed', 'cocaine', 'weapon']
    },
    Food: {
      label: 'Food & Produce',
      icon: '🥕',
      badgeClass: 'bg-lime-950/60 text-lime-300 border-lime-800/60',
      tagColor: 'lime',
      keywords: ['cabbage', 'pumpkin', 'tangerines', 'pineapples', 'apple', 'wheat', 'corn', 'grape', 'produce']
    },
    Other: {
      label: 'Other & Crypto',
      icon: '📦',
      badgeClass: 'bg-purple-950/60 text-purple-300 border-purple-800/60',
      tagColor: 'purple',
      keywords: ['cryptocurrency', 'crypto', 'bitcoin', 'ethereum', 'chip', 'voucher', 'ticket']
    }
  };

  function detectCategory(itemName) {
    if (!itemName) return 'Other';
    const name = itemName.toLowerCase();

    for (const [categoryName, info] of Object.entries(CATEGORIES)) {
      if (categoryName === 'Other') continue;
      if (info.keywords.some(k => name.includes(k))) {
        return categoryName;
      }
    }
    return 'Other';
  }

  function getCategoryInfo(categoryName) {
    return CATEGORIES[categoryName] || CATEGORIES.Other;
  }

  exports.Categories = {
    DEFINITIONS: CATEGORIES,
    detectCategory,
    getCategoryInfo
  };
})(window.MarketApp);

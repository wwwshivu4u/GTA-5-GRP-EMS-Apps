/**
 * Parser for Discord raw markdown price broadcasts in GTA V Grand RP.
 */
window.MarketApp = window.MarketApp || {};

(function(exports) {
  function cleanBuyerName(rawHeader) {
    return rawHeader
      .replace(/[*_#:`]/g, '')
      .replace(/^:\w+:\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseMarketData(text) {
    if (!text || typeof text !== 'string') {
      return { items: [], buyers: [], stats: { itemsCount: 0, buyersCount: 0, linesParsed: 0 } };
    }

    const lines = text.split('\n');
    let currentBuyer = 'General Market';
    const itemsMap = {}; // itemKey -> { name, category, offers: [{ buyer, basePrice, bonusPrice }] }
    const buyerSet = new Set();
    let linesParsed = 0;
    let itemsFound = 0;

    for (let rawLine of lines) {
      linesParsed++;
      let line = rawLine.trim();
      if (!line) continue;

      // Ignore codeblock openers/closers
      if (line.startsWith('```') || line === '```') {
        continue;
      }

      // Check for Buyer Header:
      // Examples:
      // :small_blue_diamond:_**Raw material buyer №1**_
      // **Food Buyer**
      // ## Raw Material Buyer #2
      // Seller of stolen goods
      const headerMatch = line.match(/(?:_*\*\*|#+ )?([^:*`\n]+?(?:buyer|seller|pawn|dealer|goods|other)[^\n*`]*)/i);
      if (headerMatch && !line.startsWith('-') && !line.startsWith('*')) {
        const candidate = cleanBuyerName(headerMatch[0]);
        // Must be reasonably descriptive, not just "Changes in prices for buyers"
        if (candidate.length > 2 && !candidate.toLowerCase().includes('changes in prices')) {
          currentBuyer = candidate;
          buyerSet.add(candidate);
          continue;
        }
      }

      // Check for Item line:
      // - Item Name: $123 ($456)
      // - Item Name: $123
      // Item Name: 123 (456)
      const itemMatch = line.match(/^[-*•]?\s*([a-zA-Z0-9\s'.-]+?):\s*\$?\s*([0-9,.]+)(?:\s*\(\$?([0-9,.]+)\))?/);
      if (itemMatch) {
        const itemName = itemMatch[1].trim();
        // Disregard false matches that are not items (e.g. "Status: OK")
        if (itemName.length < 2) continue;

        const basePrice = parseFloat(itemMatch[2].replace(/,/g, '')) || 0;
        const bonusPrice = itemMatch[3] ? parseFloat(itemMatch[3].replace(/,/g, '')) : basePrice;

        buyerSet.add(currentBuyer);
        itemsFound++;

        const itemKey = itemName.toLowerCase();
        if (!itemsMap[itemKey]) {
          const category = exports.Categories 
            ? exports.Categories.detectCategory(itemName) 
            : 'Other';

          itemsMap[itemKey] = {
            id: itemKey,
            name: itemName,
            category: category,
            offers: []
          };
        }

        // Add or update offer from this buyer
        const existingIdx = itemsMap[itemKey].offers.findIndex(o => o.buyer.toLowerCase() === currentBuyer.toLowerCase());
        const offerObj = { buyer: currentBuyer, basePrice, bonusPrice };
        if (existingIdx >= 0) {
          itemsMap[itemKey].offers[existingIdx] = offerObj;
        } else {
          itemsMap[itemKey].offers.push(offerObj);
        }
      }
    }

    // Convert map to enriched items array with calculated analytics
    const itemsArray = Object.values(itemsMap).map(item => {
      let maxBase = -1;
      let maxBonus = -1;
      let minBase = Infinity;
      let minBonus = Infinity;

      item.offers.forEach(o => {
        if (o.basePrice > maxBase) maxBase = o.basePrice;
        if (o.bonusPrice > maxBonus) maxBonus = o.bonusPrice;
        if (o.basePrice < minBase) minBase = o.basePrice;
        if (o.bonusPrice < minBonus) minBonus = o.bonusPrice;
      });

      if (minBase === Infinity) minBase = maxBase;
      if (minBonus === Infinity) minBonus = maxBonus;

      const baseSpread = Math.max(0, maxBase - minBase);
      const bonusSpread = Math.max(0, maxBonus - minBonus);

      const baseSpreadPct = minBase > 0 ? Math.round((baseSpread / minBase) * 100) : 0;
      const bonusSpreadPct = minBonus > 0 ? Math.round((bonusSpread / minBonus) * 100) : 0;

      return {
        ...item,
        bestBasePrice: maxBase,
        bestBonusPrice: maxBonus,
        minBasePrice: minBase,
        minBonusPrice: minBonus,
        baseSpread,
        bonusSpread,
        baseSpreadPct,
        bonusSpreadPct,
        bestBaseBuyers: item.offers.filter(o => o.basePrice === maxBase).map(o => o.buyer),
        bestBonusBuyers: item.offers.filter(o => o.bonusPrice === maxBonus).map(o => o.buyer)
      };
    });

    return {
      items: itemsArray,
      buyers: Array.from(buyerSet),
      stats: {
        itemsCount: itemsArray.length,
        buyersCount: buyerSet.size,
        linesParsed
      }
    };
  }

  exports.Parser = {
    cleanBuyerName,
    parseMarketData
  };
})(window.MarketApp);

/**
 * Cargo Haul Calculator and Multi-Stop Route Optimizer.
 */
window.MarketApp = window.MarketApp || {};

(function(exports) {
  /**
   * Calculates the best selling route for a given cargo list.
   * @param {Array<{id: string, name: string, quantity: number}>} cargoItems 
   * @param {Array<Object>} marketItems 
   * @param {boolean} useBonus 
   */
  function optimizeSellingRoute(cargoItems, marketItems, useBonus = false) {
    if (!cargoItems || cargoItems.length === 0) {
      return {
        optimalStops: [],
        optimalTotal: 0,
        singleBuyerOptions: [],
        bestSingleBuyer: null,
        extraProfitFromRoute: 0,
        profitBoostPct: 0
      };
    }

    const marketMap = {};
    marketItems.forEach(item => {
      marketMap[item.id || item.name.toLowerCase()] = item;
    });

    // 1. Group items by their best paying buyer
    const stopsByBuyer = {};
    let optimalTotal = 0;

    cargoItems.forEach(cargo => {
      const item = marketMap[cargo.id] || marketMap[cargo.name.toLowerCase()];
      if (!item || item.offers.length === 0) return;

      const bestPrice = useBonus ? item.bestBonusPrice : item.bestBasePrice;
      const bestBuyers = useBonus ? item.bestBonusBuyers : item.bestBaseBuyers;
      const chosenBuyer = bestBuyers[0] || 'Unknown Buyer';

      const totalItemPayout = bestPrice * (cargo.quantity || 1);
      optimalTotal += totalItemPayout;

      if (!stopsByBuyer[chosenBuyer]) {
        stopsByBuyer[chosenBuyer] = {
          buyer: chosenBuyer,
          totalPayout: 0,
          items: []
        };
      }

      stopsByBuyer[chosenBuyer].totalPayout += totalItemPayout;
      stopsByBuyer[chosenBuyer].items.push({
        name: item.name,
        quantity: cargo.quantity || 1,
        unitPrice: bestPrice,
        totalPayout: totalItemPayout,
        category: item.category
      });
    });

    // Convert stops map to sorted array (highest payout stop first)
    const optimalStops = Object.values(stopsByBuyer).sort((a, b) => b.totalPayout - a.totalPayout);

    // 2. Calculate single-buyer options
    // Find all distinct buyers across the items
    const allBuyers = new Set();
    marketItems.forEach(i => i.offers.forEach(o => allBuyers.add(o.buyer)));

    const singleBuyerOptions = [];
    allBuyers.forEach(buyer => {
      let buyerTotal = 0;
      let itemsPurchasedCount = 0;
      const itemsList = [];

      cargoItems.forEach(cargo => {
        const item = marketMap[cargo.id] || marketMap[cargo.name.toLowerCase()];
        if (!item) return;

        const offer = item.offers.find(o => o.buyer.toLowerCase() === buyer.toLowerCase());
        if (offer) {
          const price = useBonus ? offer.bonusPrice : offer.basePrice;
          const payout = price * (cargo.quantity || 1);
          buyerTotal += payout;
          itemsPurchasedCount++;
          itemsList.push({
            name: item.name,
            quantity: cargo.quantity || 1,
            unitPrice: price,
            totalPayout: payout
          });
        }
      });

      if (buyerTotal > 0) {
        singleBuyerOptions.push({
          buyer,
          totalPayout: buyerTotal,
          itemsPurchasedCount,
          totalCargoCount: cargoItems.length,
          itemsList
        });
      }
    });

    singleBuyerOptions.sort((a, b) => b.totalPayout - a.totalPayout);
    const bestSingleBuyer = singleBuyerOptions[0] || null;

    const extraProfitFromRoute = bestSingleBuyer ? Math.max(0, optimalTotal - bestSingleBuyer.totalPayout) : 0;
    const profitBoostPct = (bestSingleBuyer && bestSingleBuyer.totalPayout > 0)
      ? Math.round((extraProfitFromRoute / bestSingleBuyer.totalPayout) * 100)
      : 0;

    return {
      optimalStops,
      optimalTotal,
      singleBuyerOptions,
      bestSingleBuyer,
      extraProfitFromRoute,
      profitBoostPct
    };
  }

  exports.Calculator = {
    optimizeSellingRoute
  };
})(window.MarketApp);

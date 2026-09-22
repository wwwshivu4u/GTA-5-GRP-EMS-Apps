/**
 * UI Component Renderers for GTA V Grand RP Marketplace Assistant.
 */
window.MarketApp = window.MarketApp || {};

(function(exports) {
  /**
   * Render overview metric cards at the top of the page.
   */
  function renderOverviewStats(container, items, allBuyers, useBonus) {
    if (!container) return;
    if (!items || items.length === 0) {
      container.innerHTML = '';
      return;
    }

    const buyerBestCounts = {};
    items.forEach(item => {
      const bestBuyers = useBonus ? item.bestBonusBuyers : item.bestBaseBuyers;
      bestBuyers.forEach(b => {
        buyerBestCounts[b] = (buyerBestCounts[b] || 0) + 1;
      });
    });

    let topBuyer = 'N/A';
    let maxCount = -1;
    for (const [b, count] of Object.entries(buyerBestCounts)) {
      if (count > maxCount) {
        maxCount = count;
        topBuyer = b;
      }
    }

    const highestItem = [...items].sort((a, b) => {
      const valB = useBonus ? b.bestBonusPrice : b.bestBasePrice;
      const valA = useBonus ? a.bestBonusPrice : a.bestBasePrice;
      return valB - valA;
    })[0];

    const highestSpread = [...items].sort((a, b) => {
      const valB = useBonus ? b.bonusSpread : b.baseSpread;
      const valA = useBonus ? a.bonusSpread : a.baseSpread;
      return valB - valA;
    })[0];

    container.innerHTML = `
      <div class="glass-card p-4 rounded-2xl flex items-center gap-3.5">
        <div class="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 badge-emerald-glow">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Most #1 Prices</div>
          <div class="text-sm font-bold text-white truncate max-w-[170px]" title="${topBuyer}">${topBuyer}</div>
          <div class="text-[11px] text-emerald-400 font-mono mt-0.5">${maxCount > 0 ? maxCount : 0} top offers</div>
        </div>
      </div>

      <div class="glass-card p-4 rounded-2xl flex items-center gap-3.5">
        <div class="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 badge-cyan-glow">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Top Single Catch</div>
          <div class="text-sm font-bold text-white truncate max-w-[170px]">${highestItem ? highestItem.name : '-'}</div>
          <div class="text-[11px] text-cyan-400 font-mono mt-0.5">$${(useBonus ? highestItem?.bestBonusPrice : highestItem?.bestBasePrice || 0).toLocaleString()}</div>
        </div>
      </div>

      <div class="glass-card p-4 rounded-2xl flex items-center gap-3.5">
        <div class="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 badge-amber-glow">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Max Spread Arbitrage</div>
          <div class="text-sm font-bold text-white truncate max-w-[170px]">${highestSpread ? highestSpread.name : '-'}</div>
          <div class="text-[11px] text-amber-400 font-mono mt-0.5">+$${(useBonus ? highestSpread?.bonusSpread : highestSpread?.baseSpread || 0).toLocaleString()} spread</div>
        </div>
      </div>

      <div class="glass-card p-4 rounded-2xl flex items-center gap-3.5">
        <div class="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
        </div>
        <div class="min-w-0">
          <div class="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Active Market</div>
          <div class="text-sm font-bold text-white">${items.length} Items Listed</div>
          <div class="text-[11px] text-purple-400 font-mono mt-0.5">${allBuyers.size} Distinct Buyers</div>
        </div>
      </div>
    `;
  }

  /**
   * Helper to format price diff badge.
   */
  function formatDiffBadge(diffObj) {
    if (!diffObj) return '';
    if (diffObj.isHigher) {
      return `<span class="inline-flex items-center text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-700/60" title="Increased from $${diffObj.prevPrice}">▲ +$${diffObj.diff.toLocaleString()}</span>`;
    } else if (diffObj.isLower) {
      return `<span class="inline-flex items-center text-[10px] font-mono text-red-400 bg-red-950/80 px-1.5 py-0.5 rounded border border-red-700/60" title="Dropped from $${diffObj.prevPrice}">▼ -$${Math.abs(diffObj.diff).toLocaleString()}</span>`;
    } else {
      return `<span class="inline-flex items-center text-[10px] font-mono text-gray-400 bg-gray-800/80 px-1.5 py-0.5 rounded" title="Unchanged price">= $0</span>`;
    }
  }

  /**
   * Render item cards in Grid view mode.
   */
  function renderGridCards(container, items, useBonus, priceDiffs = {}) {
    if (!container) return;

    const html = items.map(item => {
      const bestPrice = useBonus ? item.bestBonusPrice : item.bestBasePrice;
      const bestBuyers = useBonus ? item.bestBonusBuyers : item.bestBaseBuyers;
      const spread = useBonus ? item.bonusSpread : item.baseSpread;
      const spreadPct = useBonus ? item.bonusSpreadPct : item.baseSpreadPct;

      const catInfo = exports.Categories ? exports.Categories.getCategoryInfo(item.category) : { badgeClass: '', icon: '' };
      const diffObj = priceDiffs[item.name.toLowerCase()];

      const sortedOffers = [...item.offers].sort((a, b) => {
        const valA = useBonus ? a.bonusPrice : a.basePrice;
        const valB = useBonus ? b.bonusPrice : b.basePrice;
        return valB - valA;
      });

      return `
        <div class="glass-card rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden group">
          
          <div>
            <!-- Header: Category & Actions -->
            <div class="flex items-start justify-between gap-2 mb-3">
              <div>
                <span class="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-md border ${catInfo.badgeClass} mb-1">
                  <span>${catInfo.icon || '📦'}</span>
                  <span>${item.category}</span>
                </span>
                <h3 class="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                  ${item.name}
                </h3>
              </div>

              <!-- Price Callout -->
              <div class="text-right flex flex-col items-end">
                <div class="text-xl font-black text-emerald-400 font-mono tracking-tight">
                  $${bestPrice.toLocaleString()}
                </div>
                <div class="flex items-center gap-1.5 mt-0.5">
                  ${diffObj ? formatDiffBadge(diffObj) : ''}
                  <span class="text-[10px] text-gray-400">
                    (${useBonus ? 'Bonus' : 'Base'})
                  </span>
                </div>
              </div>
            </div>

            <!-- Best Buyer Banner -->
            <div class="mb-3 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span class="text-xs font-semibold text-emerald-300">Sell at:</span>
              </div>
              <span class="text-xs font-bold text-white font-mono bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-700/50 truncate max-w-[200px]" title="${bestBuyers.join(', ')}">
                ${bestBuyers.join(', ')}
              </span>
            </div>

            <!-- Spread Notice -->
            ${spread > 0 ? `
              <div class="mb-3 text-[11px] text-amber-400/90 flex items-center justify-between px-1">
                <span>Spread Advantage:</span>
                <span class="font-mono font-semibold">+$${spread.toLocaleString()} (${spreadPct}% more)</span>
              </div>
            ` : ''}

            <!-- All Buyer Offers -->
            <div class="space-y-1.5 pt-2 border-t border-gray-800/80">
              <div class="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1 flex justify-between items-center">
                <span>Buyer Breakdown</span>
                <span class="text-gray-500">${item.offers.length} buyer${item.offers.length > 1 ? 's' : ''}</span>
              </div>
              ${sortedOffers.map((offer, idx) => {
                const offerPrice = useBonus ? offer.bonusPrice : offer.basePrice;
                const isTop = offerPrice === bestPrice;
                return `
                  <div class="flex items-center justify-between text-xs py-1 px-2 rounded-lg ${isTop ? 'bg-emerald-950/40 text-white font-medium border border-emerald-800/40' : 'text-gray-400 hover:bg-gray-800/40'}">
                    <span class="truncate max-w-[170px] flex items-center gap-1.5">
                      ${isTop ? '<span class="text-amber-400 text-[10px]">👑</span>' : '<span class="text-gray-600 text-[10px]">•</span>'}
                      ${offer.buyer}
                    </span>
                    <span class="font-mono ${isTop ? 'text-emerald-400 font-bold' : 'text-gray-400'}">$${offerPrice.toLocaleString()}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Bottom Card Action Button -->
          <div class="mt-4 pt-3 border-t border-gray-800/60 flex items-center justify-between">
            <span class="text-[11px] text-gray-500">Add to inventory calc:</span>
            <button 
              class="add-cargo-btn flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-emerald-600 hover:text-white text-gray-300 text-xs font-medium transition"
              data-id="${item.id}"
              data-name="${item.name}"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
              <span>+ Cargo</span>
            </button>
          </div>

        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  /**
   * Render items in dense Table View mode.
   */
  function renderTableView(container, items, useBonus, priceDiffs = {}) {
    if (!container) return;

    let html = `
      <div class="overflow-x-auto rounded-2xl border border-gray-800 glass-panel">
        <table class="w-full text-left table-compact">
          <thead>
            <tr class="bg-gray-950/60">
              <th>Item</th>
              <th>Category</th>
              <th>Best Price (${useBonus ? 'Bonus' : 'Base'})</th>
              <th>Trend</th>
              <th>Best Buyer</th>
              <th>Spread ($)</th>
              <th>Offers</th>
              <th class="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
    `;

    items.forEach(item => {
      const bestPrice = useBonus ? item.bestBonusPrice : item.bestBasePrice;
      const bestBuyers = useBonus ? item.bestBonusBuyers : item.bestBaseBuyers;
      const spread = useBonus ? item.bonusSpread : item.baseSpread;
      const spreadPct = useBonus ? item.bonusSpreadPct : item.baseSpreadPct;
      const catInfo = exports.Categories ? exports.Categories.getCategoryInfo(item.category) : { badgeClass: '', icon: '' };
      const diffObj = priceDiffs[item.name.toLowerCase()];

      html += `
        <tr class="transition-colors">
          <td class="font-bold text-white">
            <span class="mr-1.5">${catInfo.icon || '📦'}</span>
            ${item.name}
          </td>
          <td>
            <span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${catInfo.badgeClass}">
              ${item.category}
            </span>
          </td>
          <td class="font-mono font-bold text-emerald-400">
            $${bestPrice.toLocaleString()}
          </td>
          <td>
            ${diffObj ? formatDiffBadge(diffObj) : '<span class="text-gray-600">-</span>'}
          </td>
          <td class="text-gray-200 font-mono text-xs">
            <span class="bg-emerald-950/40 border border-emerald-700/40 px-2 py-0.5 rounded text-emerald-300 font-semibold truncate max-w-[180px] inline-block">
              ${bestBuyers.join(', ')}
            </span>
          </td>
          <td class="font-mono text-xs text-amber-400">
            ${spread > 0 ? `+$${spread.toLocaleString()} (${spreadPct}%)` : '<span class="text-gray-600">$0</span>'}
          </td>
          <td class="text-gray-400 text-xs">
            ${item.offers.length} buyer${item.offers.length > 1 ? 's' : ''}
          </td>
          <td class="text-right">
            <button 
              class="add-cargo-btn px-2.5 py-1 rounded bg-gray-800 hover:bg-emerald-600 hover:text-white text-gray-300 text-xs font-medium transition inline-flex items-center gap-1"
              data-id="${item.id}"
              data-name="${item.name}"
            >
              + Cargo
            </button>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;
  }

  /**
   * Render Cargo Drawer & Route Optimizer details.
   */
  function renderCargoDrawer(container, cargoItems, marketItems, useBonus) {
    if (!container) return;

    const routeResult = exports.Calculator 
      ? exports.Calculator.optimizeSellingRoute(cargoItems, marketItems, useBonus)
      : { optimalStops: [], optimalTotal: 0, extraProfitFromRoute: 0, profitBoostPct: 0 };

    const cargoHtml = cargoItems.length === 0 
      ? `
        <div class="text-center py-10 text-gray-500">
          <p class="text-sm">Your cargo haul is currently empty.</p>
          <p class="text-xs mt-1">Click "+ Cargo" on any item card to build your haul and optimize your selling route.</p>
        </div>
      `
      : `
        <div class="space-y-2 mb-6">
          <div class="flex items-center justify-between text-xs text-gray-400 pb-1 border-b border-gray-800">
            <span>Item & Quantity</span>
            <span>Est. Payout</span>
          </div>
          ${cargoItems.map((c, idx) => {
            const mItem = marketItems.find(i => (i.id === c.id || i.name.toLowerCase() === c.name.toLowerCase()));
            const unitPrice = mItem ? (useBonus ? mItem.bestBonusPrice : mItem.bestBasePrice) : 0;
            const subtotal = unitPrice * (c.quantity || 1);

            return `
              <div class="flex items-center justify-between bg-gray-950/60 p-2.5 rounded-xl border border-gray-800/80">
                <div class="flex-1 min-w-0 pr-2">
                  <div class="text-xs font-semibold text-white truncate">${c.name}</div>
                  <div class="text-[11px] text-gray-400 font-mono">$${unitPrice.toLocaleString()} each</div>
                </div>

                <div class="flex items-center space-x-2">
                  <div class="flex items-center border border-gray-700 rounded-lg bg-gray-900">
                    <button class="cargo-dec-btn px-2 py-0.5 text-xs text-gray-300 hover:text-white" data-index="${idx}">-</button>
                    <input 
                      type="number" 
                      min="1" 
                      value="${c.quantity || 1}" 
                      class="cargo-qty-input w-12 text-center bg-transparent text-xs text-white font-mono border-x border-gray-700 focus:outline-none" 
                      data-index="${idx}"
                    >
                    <button class="cargo-inc-btn px-2 py-0.5 text-xs text-gray-300 hover:text-white" data-index="${idx}">+</button>
                  </div>

                  <div class="w-20 text-right font-mono text-xs font-bold text-emerald-400">
                    $${subtotal.toLocaleString()}
                  </div>

                  <button class="cargo-remove-btn text-gray-500 hover:text-red-400 p-1" data-index="${idx}" title="Remove item">
                    &times;
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

    // Stops summary
    const stopsHtml = routeResult.optimalStops.length === 0
      ? ''
      : `
        <div class="space-y-3 pt-4 border-t border-gray-800">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span>🚗</span> Optimal Selling Route (${routeResult.optimalStops.length} Stop${routeResult.optimalStops.length > 1 ? 's' : ''})
            </h4>
            <span class="text-xs font-mono font-bold text-emerald-400">Total: $${routeResult.optimalTotal.toLocaleString()}</span>
          </div>

          ${routeResult.extraProfitFromRoute > 0 ? `
            <div class="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-300 flex items-center justify-between">
              <div>
                <span class="font-bold">Multi-Stop Route Advantage:</span>
                <div class="text-[11px] text-emerald-400">Earn +$${routeResult.extraProfitFromRoute.toLocaleString()} more than selling all at one buyer!</div>
              </div>
              <span class="px-2 py-1 rounded bg-emerald-900/60 font-mono font-bold text-white text-[11px]">
                +${routeResult.profitBoostPct}%
              </span>
            </div>
          ` : ''}

          <div class="space-y-2">
            ${routeResult.optimalStops.map((stop, sIdx) => `
              <div class="bg-gray-950/80 p-3 rounded-xl border border-gray-800 flex flex-col space-y-1.5">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-2">
                    <span class="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-bold border border-emerald-500/40 font-mono">${sIdx + 1}</span>
                    <span class="text-xs font-bold text-white">${stop.buyer}</span>
                  </div>
                  <span class="text-xs font-mono font-bold text-emerald-400">$${stop.totalPayout.toLocaleString()}</span>
                </div>
                <div class="text-[11px] text-gray-400 pl-7 space-y-0.5">
                  ${stop.items.map(it => `
                    <div>• ${it.name} (x${it.quantity}) → $${it.totalPayout.toLocaleString()}</div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>

          <div class="pt-2 flex gap-2">
            <button id="copyRouteBtn" class="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-600/20">
              Copy Route Directions
            </button>
            <button id="clearCargoBtn" class="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium transition">
              Clear All
            </button>
          </div>
        </div>
      `;

    container.innerHTML = `
      <div class="flex flex-col h-full">
        <div class="flex items-center justify-between pb-3 border-b border-gray-800">
          <div class="flex items-center space-x-2">
            <span class="text-lg">📦</span>
            <h3 class="text-sm font-bold text-white">Cargo Haul & Route Optimizer</h3>
          </div>
          <button id="closeCargoDrawerBtn" class="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800">&times;</button>
        </div>

        <div class="flex-1 overflow-y-auto py-4 space-y-4">
          ${cargoHtml}
          ${stopsHtml}
        </div>
      </div>
    `;
  }

  exports.Components = {
    renderOverviewStats,
    renderGridCards,
    renderTableView,
    renderCargoDrawer
  };
})(window.MarketApp);

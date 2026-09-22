/**
 * Remote Feed, Webhook integration, Clipboard Sync & Discord Exporter.
 */
window.MarketApp = window.MarketApp || {};

(function(exports) {
  let pollTimer = null;

  async function fetchRemoteFeed(feedUrl) {
    if (!feedUrl) {
      throw new Error('Feed URL is required');
    }

    const response = await fetch(feedUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Remote server returned HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    let textData = '';

    if (contentType.includes('application/json')) {
      const json = await response.json();
      textData = json.raw_markdown || json.text || json.content || json.record?.raw_markdown || JSON.stringify(json);
    } else {
      textData = await response.text();
    }

    return textData;
  }

  function startPolling(feedUrl, intervalMs, onData, onError) {
    stopPolling();
    if (!feedUrl || intervalMs <= 0) return;

    pollTimer = setInterval(async () => {
      try {
        const text = await fetchRemoteFeed(feedUrl);
        if (text && onData) onData(text);
      } catch (err) {
        if (onError) onError(err);
      }
    }, intervalMs);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function readClipboardText() {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      throw new Error('Clipboard API not supported or permitted in this context.');
    }
    return await navigator.clipboard.readText();
  }

  /**
   * Generates a Discord-formatted markdown report of current top prices.
   */
  function generateDiscordReport(items, useBonus = false) {
    const dateStr = new Date().toLocaleDateString();
    const timeStr = new Date().toLocaleTimeString();

    let md = `📢 **GTA V Grand RP - Top Buyer Price Sheet** (${dateStr} ${timeStr})\n`;
    md += `*Mode: ${useBonus ? 'Bonus Prices' : 'Base Prices'}*\n\n`;

    // Group items by category
    const byCat = {};
    items.forEach(item => {
      if (!byCat[item.category]) byCat[item.category] = [];
      byCat[item.category].push(item);
    });

    for (const [catName, catItems] of Object.entries(byCat)) {
      md += `**${catName.toUpperCase()}**\n\`\`\`md\n`;
      catItems.forEach(item => {
        const price = useBonus ? item.bestBonusPrice : item.bestBasePrice;
        const buyer = (useBonus ? item.bestBonusBuyers : item.bestBaseBuyers).join(', ');
        md += `- ${item.name}: $${price.toLocaleString()} (Sell at: ${buyer})\n`;
      });
      md += `\`\`\`\n`;
    }

    md += `*Generated via GRP Marketplace Assistant Live Radar*`;
    return md;
  }

  /**
   * Generates a CSV export of current items and buyer offers.
   */
  function generateCsvExport(items, useBonus = false) {
    let csv = 'Item Name,Category,Best Price,Mode,Best Buyer(s),Price Spread,Spread %\n';
    items.forEach(item => {
      const price = useBonus ? item.bestBonusPrice : item.bestBasePrice;
      const buyers = (useBonus ? item.bestBonusBuyers : item.bestBaseBuyers).join(' / ');
      const spread = useBonus ? item.bonusSpread : item.baseSpread;
      const spreadPct = useBonus ? item.bonusSpreadPct : item.baseSpreadPct;
      csv += `"${item.name}","${item.category}",${price},"${useBonus ? 'Bonus' : 'Base'}","${buyers}",${spread},"${spreadPct}%"\n`;
    });
    return csv;
  }

  exports.Feed = {
    fetchRemoteFeed,
    startPolling,
    stopPolling,
    readClipboardText,
    generateDiscordReport,
    generateCsvExport
  };
})(window.MarketApp);

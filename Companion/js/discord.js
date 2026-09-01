/**
 * EMS Companion - Discord Integration & Deep Linking
 */

import { stateManager } from './state.js';
import { sound } from './audio.js';

export class DiscordService {
    static openChannel(serverId, channelId) {
        if (!serverId || !channelId) {
            alert('Discord Server ID or Channel ID is missing in Settings!');
            return;
        }

        const appUrl = `discord://-/channels/${serverId}/${channelId}`;
        const webUrl = `https://discord.com/channels/${serverId}/${channelId}`;

        const startTime = Date.now();
        window.location.href = appUrl;

        // Fallback to web Discord if desktop client doesn't capture within 700ms
        setTimeout(() => {
            const endTime = Date.now();
            if (!document.hidden && endTime - startTime < 700) {
                window.open(webUrl, '_blank');
            }
        }, 500);
    }

    static testChannel(channelKey) {
        const state = stateManager.state;
        const serverId = state.discordServerId;
        const channelId = state.discordChannels[channelKey];

        if (!serverId || !channelId) {
            alert(`Please configure the Server ID and Channel ID for #${channelKey.toUpperCase()} in Settings!`);
            return;
        }

        this.openChannel(serverId, channelId);
    }

    static async executeAction(key, textToCopy = '', skipRedirect = false) {
        const state = stateManager.state;
        const serverId = state.discordServerId;
        const channelId = state.discordChannels[key];

        if (!serverId || !channelId) {
            alert(`Please configure the Discord Server ID and Channel ID for #${key.toUpperCase()} in Settings!`);
            return;
        }

        if (textToCopy) {
            try {
                await navigator.clipboard.writeText(textToCopy);
                sound.playCopySound();
            } catch (err) {
                console.warn('Clipboard write failed:', err);
            }
        }

        if (!skipRedirect) {
            this.openChannel(serverId, channelId);
        }
    }

    static generateAction(type, checkboxId = null) {
        const state = stateManager.state;
        let text = '';

        const now = new Date();
        const edinTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
        const edinH = String(edinTime.getHours()).padStart(2, '0');
        const edinM = String(edinTime.getMinutes()).padStart(2, '0');
        const edinD = String(edinTime.getDate()).padStart(2, '0');
        const edinMo = String(edinTime.getMonth() + 1).padStart(2, '0');
        const edinY = edinTime.getFullYear();

        if (type === 'bodycam') {
            const status = document.getElementById('bc-status')?.value || state.bcStatus || 'On duty';
            text = `${status} : ${edinH}:${edinM}`;
        } else if (type === 'codea') {
            const loc = document.getElementById('ca-loc')?.value || '[Location]';
            const status = document.getElementById('ca-status')?.value || 'flying back';
            const tags = document.getElementById('ca-tags')?.value || '@Employee @HighCommand';
            text = `Code A at ${loc} ${status} ${tags}`;
        } else if (type === 'break') {
            text = document.getElementById('br-action')?.value || 'Going 10-9 (Break)';
        } else if (type === 'supplies') {
            const status = document.getElementById('ms-status')?.value || 'before';
            text = status === 'before' ? 'Before captchas' : 'After XX captchas completed';
        } else if (type === 'rota') {
            const cap = document.getElementById('lr-cap')?.value || '0';
            const del = document.getElementById('lr-del')?.value || '0';
            text = `Date: ${edinD}/${edinMo}/${edinY}\nCaptchas Completed: ${cap}\nDeliveries Made: ${del}`;
        }

        const cb = checkboxId ? document.getElementById(checkboxId) : null;
        const skipRedirect = cb ? !cb.checked : false;

        this.executeAction(type, text, skipRedirect);

        if (type === 'bodycam') {
            const status = document.getElementById('bc-status')?.value || '';
            if (status.includes('On duty')) {
                if (window.startDutyTimer) window.startDutyTimer();
            } else if (status.includes('Off duty')) {
                if (window.stopDutyTimer) window.stopDutyTimer();
            }
        }
    }
}

/**
 * EMS Companion - Complete Modular Application Controller
 * Optimized to run natively on both local file:// protocol and web servers.
 */

(function () {
    'use strict';

    // -----------------------------------------------------
    // 1. DATA & CONSTANTS
    // -----------------------------------------------------
    const DEFAULT_DISCORD_SERVER_ID = '1035903890996080811';

    const DEFAULT_DISCORD_CHANNELS = {
        bodycam: '1035903894049542188',
        codea: '1035903894049542185',
        break: '1035903894049542184',
        supplies: '1035903894049542186',
        rota: '1081157781530357771',
        captcha: '1151594608460038245',
        deliveries: '1035903894049542187',
        radiocodes: '1035903894552850452',
        replacementlogs: '1035903893772710037'
    };

    const DEFAULT_SHIFT_RATES = {
        nightPH: 25000,
        nightSH: 40000,
        nightCalls: 20000,
        dayPH: 10000,
        daySH: 30000,
        dayCalls: 15000,
        labCaptcha: 5000,
        labMedicine: 10000
    };

    const ALL_DUTY_STEPS = [
        'od1', 'od2', 'od3',
        'ref1', 'ref2',
        'sav1', 'sav2',
        'off1', 'off2', 'off3',
        'sw1_1', 'sw1_2', 'sw1_3', 'sw1_4', 'sw1_5',
        'sw2_1', 'sw2_2', 'sw2_3', 'sw2_4', 'sw2_5',
        'sw3_1', 'sw3_2', 'sw3_3', 'sw3_4', 'sw3_5'
    ];

    const STEP_DEPENDENCIES = [
        ['od1', 'od2'], ['od2', 'od3'],
        ['ref1', 'ref2'],
        ['sav1', 'sav2'],
        ['off1', 'off2'], ['off2', 'off3'],
        ['sw1_1', 'sw1_2'], ['sw1_2', 'sw1_3'], ['sw1_3', 'sw1_4'], ['sw1_4', 'sw1_5'],
        ['sw2_1', 'sw2_2'], ['sw2_2', 'sw2_3'], ['sw2_3', 'sw2_4'], ['sw2_4', 'sw2_5'],
        ['sw3_1', 'sw3_2'], ['sw3_2', 'sw3_3'], ['sw3_3', 'sw3_4'], ['sw3_4', 'sw3_5']
    ];

    const BOTTOM_NAV_SERVICES = [
        { id: 'hs', icon: '<span class="material-symbols-outlined icon-gradient-emerald">local_hospital</span>', text: 'HOSPITAL<br>SERVICES', smallText: 'HOSPITAL<br>SERVICES', modal: 'modal-hs' },
        { id: 'gs', icon: '<span class="material-symbols-outlined icon-gradient-cyan">medical_services</span>', text: 'GROUND<br>SERVICES', smallText: 'GROUND<br>SERVICES', modal: 'modal-gs' },
        { id: 'labtech', icon: '<span class="material-symbols-outlined icon-gradient-purple">science</span>', text: 'LABTECH', smallText: 'LABTECH', modal: 'modal-discord' }
    ];

    // -----------------------------------------------------
    // 2. AUDIO SYNTHESIZER (Web Audio API)
    // -----------------------------------------------------
    class SoundSystem {
        constructor() {
            this.ctx = null;
        }

        init() {
            if (!this.ctx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) this.ctx = new AudioContext();
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }

        playDutyChime() {
            this.init();
            if (!this.ctx) return;

            const now = this.ctx.currentTime;
            const notes = [523.25, 659.25, 783.99, 1046.50];

            notes.forEach((freq, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.12);

                gain.gain.setValueAtTime(0, now + i * 0.12);
                gain.gain.linearRampToValueAtTime(0.18, now + i * 0.12 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.6);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(now + i * 0.12);
                osc.stop(now + i * 0.12 + 0.65);
            });
        }

        playCopySound() {
            this.init();
            if (!this.ctx) return;

            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.15);
        }
    }

    const sound = new SoundSystem();

    // -----------------------------------------------------
    // 3. STATE MANAGER
    // -----------------------------------------------------
    class StateManager {
        constructor() {
            this.STORAGE_KEY = 'emsSettings';
            this.state = this.getDefaultState();
        }

        getDefaultState() {
            const dutySteps = {};
            ALL_DUTY_STEPS.forEach(step => {
                dutySteps[step] = false;
            });

            return {
                discordServerId: DEFAULT_DISCORD_SERVER_ID,
                discordChannels: { ...DEFAULT_DISCORD_CHANNELS },
                name: '',
                id: '',
                dutySteps,
                dutyStartTime: null,
                rotaLocation: 'PH Front',
                rotaCap: 0,
                rotaDel: 0,
                customCommands: {},
                userAddedCommands: [],
                userDefaults: {},
                deletedCommands: [],
                customTitles: {},
                lastProfileVerifyDate: null,
                selectedSubDept: 'HS',
                mainNavService: 'hs',
                shiftRates: { ...DEFAULT_SHIFT_RATES },
                showBootScreen: true,
                bcStatus: 'Off duty',
                discordToggles: {}
            };
        }

        load() {
            try {
                const saved = localStorage.getItem(this.STORAGE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    this.state = {
                        ...this.getDefaultState(),
                        ...parsed,
                        discordChannels: {
                            ...DEFAULT_DISCORD_CHANNELS,
                            ...(parsed.discordChannels || {})
                        },
                        shiftRates: {
                            ...DEFAULT_SHIFT_RATES,
                            ...(parsed.shiftRates || {})
                        },
                        dutySteps: {
                            ...this.getDefaultState().dutySteps,
                            ...(parsed.dutySteps || {})
                        }
                    };
                }
            } catch (err) {
                console.error('Failed to load state:', err);
                this.state = this.getDefaultState();
            }
            return this.state;
        }

        save() {
            try {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
            } catch (err) {
                console.error('Failed to save state:', err);
            }
        }

        get(key) {
            return this.state[key];
        }

        set(key, value) {
            this.state[key] = value;
            this.save();
        }

        getTemplateVars() {
            const name = this.state.name?.trim() || '[Name]';
            const id = this.state.id?.trim() || '[ID]';

            const rotaLocSelect = document.getElementById('rota-location');
            const locInputCustom = document.getElementById('locInputCustom');
            const repInput = document.getElementById('repInput');

            let loc = rotaLocSelect ? rotaLocSelect.value : (this.state.rotaLocation || 'PH Front');
            if (loc === 'Other...' || loc === 'Custom') {
                loc = locInputCustom?.value?.trim() || '[Location]';
            }
            if (!loc) loc = '[Location]';

            let rep = repInput?.value?.trim() || '[Replacement Name]';
            if (!rep) rep = '[Replacement Name]';

            return { name, id, loc, rep };
        }

        interpolate(templateStr) {
            if (!templateStr) return '';
            const { name, id, loc, rep } = this.getTemplateVars();
            return templateStr
                .replace(/{NAME}/g, name)
                .replace(/{ID}/g, id)
                .replace(/{LOC}/g, loc)
                .replace(/{REP}/g, rep);
        }

        extractTemplate(text) {
            if (!text) return '';
            const { name, id, loc, rep } = this.getTemplateVars();
            let result = text;
            if (loc && loc !== '[Location]') result = result.split(loc).join('{LOC}');
            if (rep && rep !== '[Replacement Name]') result = result.split(rep).join('{REP}');
            if (name && name !== '[Name]') result = result.split(name).join('{NAME}');
            if (id && id !== '[ID]') result = result.split(id).join('{ID}');
            return result;
        }

        exportDb() {
            const dataStr = JSON.stringify(this.state, null, 2);
            const blob = new Blob([dataStr], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `EMS_Companion_Backup_${new Date().toISOString().slice(0, 10)}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        importDb(file, onSuccess, onError) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    this.state = {
                        ...this.getDefaultState(),
                        ...imported,
                        discordChannels: {
                            ...DEFAULT_DISCORD_CHANNELS,
                            ...(imported.discordChannels || {})
                        },
                        shiftRates: {
                            ...DEFAULT_SHIFT_RATES,
                            ...(imported.shiftRates || {})
                        }
                    };
                    this.save();
                    if (onSuccess) onSuccess();
                } catch (err) {
                    console.error('Import error:', err);
                    if (onError) onError(err);
                }
            };
            reader.readAsText(file);
        }

        resetDefaults() {
            this.state.customCommands = {};
            this.state.userAddedCommands = [];
            this.state.userDefaults = {};
            this.state.deletedCommands = [];
            this.state.customTitles = {};
            this.save();
        }

        saveCurrentAsDefault() {
            this.state.userDefaults = { ...this.state.customCommands };
            this.save();
        }
    }

    const stateManager = new StateManager();

    // -----------------------------------------------------
    // 4. DISCORD SERVICE
    // -----------------------------------------------------
    class DiscordService {
        static openChannel(serverId, channelId) {
            if (!serverId || !channelId) {
                alert('Discord Server ID or Channel ID is missing in Settings!');
                return;
            }

            const appUrl = `discord://-/channels/${serverId}/${channelId}`;
            const webUrl = `https://discord.com/channels/${serverId}/${channelId}`;

            const startTime = Date.now();
            window.location.href = appUrl;

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
                    timerEngine.startDutyTimer();
                } else if (status.includes('Off duty')) {
                    timerEngine.stopDutyTimer();
                }
            }
        }
    }

    // -----------------------------------------------------
    // 5. TIMER ENGINE
    // -----------------------------------------------------
    class TimerEngine {
        constructor() {
            this.rotaTimerInterval = null;
            this.dtFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Europe/London',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
        }

        initClocks() {
            const updateClocks = () => {
                const userTime = new Date();
                const icStr = this.dtFormatter.format(userTime);
                const [datePart, timePart] = icStr.split(', ');
                const [edinMo, edinD, edinY] = datePart.split('/');
                let [edinH, edinM, edinS] = timePart.split(':');
                if (edinH === '24') edinH = '00';

                const userH = String(userTime.getHours()).padStart(2, '0');
                const userM = String(userTime.getMinutes()).padStart(2, '0');
                const userS = String(userTime.getSeconds()).padStart(2, '0');
                const userD = String(userTime.getDate()).padStart(2, '0');
                const userMo = String(userTime.getMonth() + 1).padStart(2, '0');
                const userY = userTime.getFullYear();

                const bigClockEl = document.getElementById('big-live-clock');
                if (bigClockEl) {
                    bigClockEl.innerHTML = `
                        <span class="ic-time">${edinH}:${edinM}:${edinS} <small style="font-size:0.65em; opacity:0.8;">(IC)</small></span>
                        <span class="local-time" style="font-size: 0.8rem; color: var(--text-muted);">${userH}:${userM}:${userS} <small>(Local)</small></span>
                    `;
                }

                const bcLiveTimeEl = document.getElementById('bc-live-time');
                if (bcLiveTimeEl) {
                    bcLiveTimeEl.textContent = `${edinH}:${edinM} (IC) | ${userH}:${userM} (Local)`;
                }

                const lrLiveDateEl = document.getElementById('lr-live-date');
                if (lrLiveDateEl) {
                    lrLiveDateEl.textContent = `${edinD}/${edinMo}/${edinY} (IC) | ${userD}/${userMo}/${userY} (Local)`;
                }

                this.checkNightShiftUI();
            };

            updateClocks();
            setInterval(updateClocks, 1000);
        }

        startDutyTimer() {
            const defaultView = document.getElementById('tb-default-view');
            const setupView = document.getElementById('tb-setup-view');
            const compactView = document.getElementById('tb-compact-view');
            const confirmView = document.getElementById('tb-confirm-view');

            if (defaultView) defaultView.classList.add('hidden');
            if (compactView) compactView.classList.add('hidden');
            if (confirmView) confirmView.classList.add('hidden');
            if (setupView) setupView.classList.remove('hidden');

            const startBtn = document.getElementById('btn-rota-start');
            if (startBtn) startBtn.disabled = false;
        }

        stopDutyTimer() {
            if (this.rotaTimerInterval) clearInterval(this.rotaTimerInterval);
            stateManager.set('dutyStartTime', null);

            const defaultView = document.getElementById('tb-default-view');
            const setupView = document.getElementById('tb-setup-view');
            const compactView = document.getElementById('tb-compact-view');
            const confirmView = document.getElementById('tb-confirm-view');

            if (setupView) setupView.classList.add('hidden');
            if (compactView) compactView.classList.add('hidden');
            if (confirmView) confirmView.classList.add('hidden');
            if (defaultView) defaultView.classList.remove('hidden');

            const outlineRect = document.getElementById('progress-outline-rect');
            if (outlineRect) outlineRect.style.strokeDashoffset = 1000;
        }

        startShift(location) {
            const state = stateManager.state;
            state.dutyStartTime = Date.now();
            state.rotaLocation = location;
            stateManager.save();

            const setupView = document.getElementById('tb-setup-view');
            const compactView = document.getElementById('tb-compact-view');
            if (setupView) setupView.classList.add('hidden');
            if (compactView) compactView.classList.remove('hidden');

            this.startRotaTimer();
        }

        startRotaTimer() {
            const display = document.getElementById('compact-main-timer');
            const outlineRect = document.getElementById('progress-outline-rect');
            if (!display) return;

            if (this.rotaTimerInterval) clearInterval(this.rotaTimerInterval);

            const updateDisplay = () => {
                const dutyStartTime = stateManager.get('dutyStartTime');
                if (!dutyStartTime) return;

                const timerSeconds = Math.floor((Date.now() - dutyStartTime) / 1000);
                const h = Math.floor(timerSeconds / 3600);
                const m = Math.floor((timerSeconds % 3600) / 60);
                const s = timerSeconds % 60;
                const mm = String(m).padStart(2, '0');
                const ss = String(s).padStart(2, '0');

                display.textContent = `${h} hr ${mm}:${ss}`;

                if (outlineRect) {
                    const currentHourSeconds = timerSeconds % 3600;
                    let percent = currentHourSeconds / 3600;
                    if (percent > 1) percent = 1;
                    const offset = 1000 - 1000 * percent;
                    outlineRect.style.strokeDashoffset = offset;
                }
            };

            updateDisplay();
            this.rotaTimerInterval = setInterval(() => {
                const dutyStartTime = stateManager.get('dutyStartTime');
                if (!dutyStartTime) {
                    clearInterval(this.rotaTimerInterval);
                    return;
                }

                const timerSeconds = Math.floor((Date.now() - dutyStartTime) / 1000);
                updateDisplay();
                this.checkNightShiftUI();

                if (timerSeconds > 0 && timerSeconds % 3600 === 0) {
                    const loc = stateManager.get('rotaLocation');
                    if (loc !== 'Labs') {
                        const hours = timerSeconds / 3600;
                        this.notifyHourlyBonus(hours);
                    }
                }
            }, 1000);
        }

        getShiftRate(loc, startHour) {
            const rates = stateManager.get('shiftRates') || {};
            const isNight = startHour >= 0 && startHour < 6;

            if (isNight) {
                if (loc.includes('PH')) return rates.nightPH || 25000;
                if (loc.includes('SH')) return rates.nightSH || 40000;
                if (loc.includes('Calls')) return rates.nightCalls || 20000;
            } else {
                if (loc.includes('PH')) return rates.dayPH || 10000;
                if (loc.includes('SH')) return rates.daySH || 30000;
                if (loc.includes('Calls')) return rates.dayCalls || 15000;
            }
            return 0;
        }

        checkNightShiftUI() {
            const nsIndicatorEl = document.getElementById('night-shift-indicator');
            const nsTimerEl = document.getElementById('compact-main-timer');
            const state = stateManager.state;

            const now = new Date();
            const edinHour = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' })).getHours();
            const isNightShift = edinHour >= 0 && edinHour < 6;

            let bonus = 0;
            if (state.dutyStartTime) {
                if (state.rotaLocation === 'Labs') {
                    const capRate = state.shiftRates?.labCaptcha || 5000;
                    const delRate = state.shiftRates?.labMedicine || 10000;
                    bonus = (state.rotaCap || 0) * capRate + (state.rotaDel || 0) * delRate;
                } else {
                    const timerSeconds = Math.floor((now.getTime() - state.dutyStartTime) / 1000);
                    const hours = Math.floor(timerSeconds / 3600);
                    const startHour = new Date(new Date(state.dutyStartTime).toLocaleString('en-US', { timeZone: 'Europe/London' })).getHours();
                    const rate = this.getShiftRate(state.rotaLocation || 'PH Front', startHour);
                    bonus = rate * hours;
                }
            }

            if (nsIndicatorEl) {
                if (isNightShift) {
                    nsIndicatorEl.classList.remove('hidden');
                    nsIndicatorEl.style.color = '#f1c40f';
                    nsIndicatorEl.innerHTML = `
                        <div style="line-height: 1; margin-bottom: 2px;"><span class="material-symbols-outlined icon-gradient-amber" style="font-size:1.3rem;">dark_mode</span></div>
                        <div style="font-size: 0.85rem; font-weight: bold;">$${bonus.toLocaleString()}</div>
                    `;
                    if (nsTimerEl) {
                        nsTimerEl.style.color = '#f1c40f';
                        nsTimerEl.style.textShadow = '0 0 10px rgba(241,196,15,0.4)';
                    }
                } else {
                    if (bonus > 0 && state.dutyStartTime) {
                        nsIndicatorEl.classList.remove('hidden');
                        nsIndicatorEl.style.color = '#10b981';
                        nsIndicatorEl.innerHTML = `
                            <div style="line-height: 1; margin-bottom: 2px;"><span class="material-symbols-outlined icon-gradient-emerald" style="font-size:1.3rem;">light_mode</span></div>
                            <div style="font-size: 0.85rem; font-weight: bold;">$${bonus.toLocaleString()}</div>
                        `;
                    } else {
                        nsIndicatorEl.classList.add('hidden');
                    }
                    if (nsTimerEl) {
                        nsTimerEl.style.color = '#f8fafc';
                        nsTimerEl.style.textShadow = '';
                    }
                }
            }
        }

        notifyHourlyBonus(hoursCompleted) {
            sound.playDutyChime();
            const state = stateManager.state;
            const startTime = new Date(state.dutyStartTime).toLocaleString('en-US', { timeZone: 'Europe/London' });
            const startHour = new Date(startTime).getHours();
            const loc = state.rotaLocation || 'PH Front';
            const rate = this.getShiftRate(loc, startHour);
            const bonus = rate * hoursCompleted;

            const toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed;
                top: 100px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #10b981, #059669);
                color: #fff;
                padding: 1rem 2rem;
                border-radius: 12px;
                font-weight: 700;
                z-index: 99999;
                box-shadow: 0 10px 25px rgba(16, 185, 129, 0.5);
                text-align: center;
                animation: popIn 0.3s ease;
            `;
            toast.innerHTML = `<span class="material-symbols-outlined icon-gradient-amber" style="font-size:1.4rem; vertical-align:middle; margin-right:4px;">celebration</span> Completed ${hoursCompleted} hr(s) on ${loc}!<br><span style="font-size:1.15rem; color:#fef08a;">Earned so far: $${bonus.toLocaleString()}</span>`;
            document.body.appendChild(toast);

            setTimeout(() => toast.remove(), 5000);
        }

        confirmShiftEnd() {
            const state = stateManager.state;
            if (this.rotaTimerInterval) clearInterval(this.rotaTimerInterval);

            if (state.rotaLocation === 'Labs') {
                state.dutyStartTime = null;
                stateManager.save();

                const setupView = document.getElementById('tb-setup-view');
                const confirmView = document.getElementById('tb-confirm-view');
                if (confirmView) confirmView.classList.add('hidden');
                if (setupView) setupView.classList.remove('hidden');

                modalManager.openSubModal('sub-rota');
                return;
            }

            const now = new Date();
            const offTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
            const offH = String(offTime.getHours()).padStart(2, '0');
            const offM = String(offTime.getMinutes()).padStart(2, '0');

            const onTime = new Date(new Date(state.dutyStartTime).toLocaleString('en-US', { timeZone: 'Europe/London' }));
            const onH = String(onTime.getHours()).padStart(2, '0');
            const onM = String(onTime.getMinutes()).padStart(2, '0');

            const loc = state.rotaLocation || 'PH Front';
            const template = `On duty ${loc} : ${onH}:${onM}\nOff duty ${loc} : ${offH}:${offM}`;

            const timerSeconds = Math.floor((now.getTime() - state.dutyStartTime) / 1000);
            const hoursCompleted = Math.floor(timerSeconds / 3600);
            const m = Math.floor((timerSeconds % 3600) / 60);

            const startHour = onTime.getHours();
            const rate = this.getShiftRate(loc, startHour);
            const bonus = rate * hoursCompleted;
            const durationStr = `${hoursCompleted} hr ${m} min`;
            const bonusStr = hoursCompleted > 0 ? `Bonus Earned: $${bonus.toLocaleString()}` : 'No full hour completed (No bonus)';

            navigator.clipboard.writeText(template).then(() => {
                sound.playCopySound();
                this.showShiftEndModal(template, durationStr, bonusStr);
            }).catch(() => {
                alert('Failed to copy shift log to clipboard.');
            });

            state.dutyStartTime = null;
            stateManager.save();

            setTimeout(() => {
                const setupView = document.getElementById('tb-setup-view');
                const confirmView = document.getElementById('tb-confirm-view');
                if (confirmView) confirmView.classList.add('hidden');
                if (setupView) setupView.classList.remove('hidden');
            }, 3500);
        }

        showShiftEndModal(template, durationStr, bonusStr) {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                inset: 0;
                z-index: 99998;
                background: rgba(0,0,0,0.6);
                backdrop-filter: blur(8px);
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.3s ease;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: 16px;
                padding: 2rem;
                max-width: 480px;
                width: 90%;
                text-align: center;
                box-shadow: 0 20px 50px rgba(0,0,0,0.8);
                animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                color: var(--text-main);
            `;

            modal.innerHTML = `
                <div style="margin-bottom: 0.5rem;"><span class="material-symbols-outlined icon-gradient-amber" style="font-size: 3rem;">celebration</span></div>
                <h2 style="font-size: 1.4rem; font-weight: 700; color: var(--success); margin-bottom: 0.5rem;">Shift Completed & Log Copied!</h2>
                <div style="font-family: monospace; background: rgba(0,0,0,0.4); border: 1px solid var(--card-border); padding: 1rem; border-radius: 8px; margin: 1rem 0; text-align: left; font-size: 0.95rem; color: #38bdf8;">
                    ${template.replace(/\n/g, '<br>')}
                </div>
                <div style="font-size: 0.95rem; color: var(--text-muted); margin-bottom: 0.25rem;">Shift Duration: <strong style="color: var(--text-main);">${durationStr}</strong></div>
                <div style="font-size: 1rem; font-weight: 700; color: #f1c40f; margin-bottom: 1.5rem;">${bonusStr}</div>
                <button class="btn btn-success" style="width: 100%; padding: 0.8rem; font-size: 1rem; font-weight: bold;">Close</button>
            `;

            modal.querySelector('button').onclick = () => overlay.remove();
            overlay.onclick = (e) => {
                if (e.target === overlay) overlay.remove();
            };

            overlay.appendChild(modal);
            document.body.appendChild(overlay);
        }
    }

    const timerEngine = new TimerEngine();

    // -----------------------------------------------------
    // 6. MODAL MANAGER
    // -----------------------------------------------------
    class ModalManager {
        constructor() {
            this.overlay = null;
        }

        init() {
            this.overlay = document.getElementById('modalOverlay');
            if (!this.overlay) return;

            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) this.closeAll();
            });

            document.addEventListener('contextmenu', (e) => {
                if (this.overlay && this.overlay.classList.contains('active')) {
                    e.preventDefault();
                    this.closeAll();
                }
            });

            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (btn.disabled || btn.classList.contains('disabled')) return;

                    const tabGroup = btn.closest('.tabs-header');
                    if (tabGroup) {
                        tabGroup.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    }

                    const tabsBody = btn.closest('.modal-content')?.querySelector('.tabs-body');
                    if (tabsBody) {
                        tabsBody.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                    }

                    btn.classList.add('active');
                    const tabId = btn.getAttribute('data-tab');
                    const targetContent = document.getElementById(tabId);
                    if (targetContent) targetContent.classList.add('active');
                });
            });
        }

        open(modalId) {
            this.closeAll();
            if (!this.overlay) this.overlay = document.getElementById('modalOverlay');
            if (this.overlay) this.overlay.classList.add('active');

            const modal = document.getElementById(modalId);
            if (modal) modal.classList.add('active');

            if (modalId === 'modal-discord-bodycam') {
                const bcStatus = document.getElementById('bc-status');
                if (bcStatus) bcStatus.value = stateManager.state.bcStatus || 'On duty';
            }
        }

        openSubModal(subModalId) {
            document.querySelectorAll('.modal-content:not(.sub-modal)').forEach(m => m.classList.remove('active'));
            const sm = document.getElementById(subModalId);
            if (sm) sm.classList.add('active');
        }

        closeSubModal() {
            document.querySelectorAll('.sub-modal').forEach(sm => sm.classList.remove('active'));
            const dm = document.getElementById('modal-discord');
            if (dm) dm.classList.add('active');
        }

        closeAll() {
            if (this.overlay) this.overlay.classList.remove('active');
            document.querySelectorAll('.modal-content').forEach(m => m.classList.remove('active'));
        }

        switchRadioTab(tabId) {
            const modal = document.getElementById('modal-radio');
            if (!modal) return;
            const tabsBody = modal.querySelector('.tabs-body');
            if (tabsBody) {
                tabsBody.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            }
            const targetContent = document.getElementById(tabId);
            if (targetContent) targetContent.classList.add('active');
        }

        glowModal(modalId, color = 'rgba(255, 255, 255, 0.5)') {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.style.setProperty('--glow-color', color);
                modal.classList.remove('modal-glow-anim');
                void modal.offsetWidth;
                modal.classList.add('modal-glow-anim');
            }
        }
    }

    const modalManager = new ModalManager();

    // -----------------------------------------------------
    // 7. DEPT COMMANDS SERVICE
    // -----------------------------------------------------
    class DeptCommandsService {
        static switchDeptTab(tabId) {
            document.querySelectorAll('.dept-chip').forEach(chip => {
                if (chip.getAttribute('data-dept-tab') === tabId) {
                    chip.classList.add('active');
                } else {
                    chip.classList.remove('active');
                }
            });

            document.querySelectorAll('.dept-tab-content').forEach(content => {
                if (content.id === tabId) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });

            this.filterCommands();
        }

        static filterCommands() {
            const searchInput = document.getElementById('filter-search');
            if (!searchInput) return;

            const searchVal = searchInput.value.toLowerCase().trim();

            document.querySelectorAll('.dept-tab-content').forEach(tabContent => {
                let hasVisibleInTab = false;
                const blocks = tabContent.querySelectorAll('.copy-block');

                blocks.forEach(b => {
                    const text = b.querySelector('.copy-content')?.textContent.toLowerCase() || '';
                    const title = b.querySelector('.copy-header span')?.textContent.toLowerCase() || '';

                    const matchesSearch = searchVal === '' || text.includes(searchVal) || title.includes(searchVal);

                    if (matchesSearch) {
                        b.classList.remove('filtered-out');
                        b.style.display = '';
                        hasVisibleInTab = true;
                    } else {
                        b.classList.add('filtered-out');
                        b.style.display = 'none';
                    }
                });

                const chip = document.querySelector(`.dept-chip[data-dept-tab="${tabContent.id}"]`);
                if (chip) {
                    if (hasVisibleInTab || searchVal === '') {
                        chip.style.opacity = '1';
                        chip.style.pointerEvents = 'auto';
                    } else {
                        chip.style.opacity = '0.35';
                    }
                }
            });
        }
    }

    // -----------------------------------------------------
    // 8. TUTORIAL SERVICE
    // -----------------------------------------------------
    class TutorialService {
        constructor() {
            this.currentStep = 0;
            this.steps = [
                {
                    targetSelector: ".nav-item[onclick*='modal-bodycam']",
                    text: "Step 1: Start your shift by doing your On Duty Bodycam logs. Click this button to open the Bodycam menu.",
                    action: () => { modalManager.closeAll(); }
                },
                {
                    targetSelector: "#btn-tab-onduty",
                    text: "Use these copy blocks to fill out your On Duty bodycam logs in sequence.",
                    action: () => {
                        modalManager.open('modal-bodycam');
                        document.getElementById('btn-tab-onduty')?.click();
                    }
                },
                {
                    targetSelector: "#tb-setup-view",
                    text: "Step 2: Shift Start. Select your station location and click the ▶ (Start) button to begin duty time tracking.",
                    action: () => { modalManager.closeAll(); }
                },
                {
                    targetSelector: "#tb-compact-view",
                    text: "Step 3: Shift End. When your shift is over, click the ⏹ (End) button here to generate your shift report and copy it automatically.",
                    action: () => {
                        document.getElementById('tb-default-view')?.classList.add('hidden');
                        document.getElementById('tb-setup-view')?.classList.add('hidden');
                        document.getElementById('tb-compact-view')?.classList.remove('hidden');
                    }
                },
                {
                    targetSelector: "#lr-bonus-display",
                    text: "Step 4: Bonus Tracker! You can log your captchas and deliveries in Labtech Rota to automatically calculate your bonus.",
                    action: () => {
                        document.getElementById('tb-compact-view')?.classList.add('hidden');
                        if (stateManager.get('dutyStartTime')) {
                            document.getElementById('tb-compact-view')?.classList.remove('hidden');
                        } else {
                            document.getElementById('tb-setup-view')?.classList.remove('hidden');
                        }
                        modalManager.open('modal-discord');
                        modalManager.openSubModal('sub-rota');
                    }
                },
                {
                    targetSelector: "#btn-tab-offduty",
                    text: "Step 5: Going Off Duty. Before closing the companion, open Bodycam logs, click 'Off Duty', and log off.",
                    action: () => {
                        modalManager.closeSubModal();
                        modalManager.open('modal-bodycam');
                        document.getElementById('btn-tab-offduty')?.click();
                    }
                }
            ];
        }

        start() {
            this.currentStep = 0;
            document.getElementById('tutorial-overlay')?.classList.remove('hidden');
            this.renderStep();
        }

        end() {
            document.getElementById('tutorial-overlay')?.classList.add('hidden');
            modalManager.closeAll();
            modalManager.closeSubModal();
            timerEngine.stopDutyTimer();
            stateManager.set('rotaCap', 0);
            stateManager.set('rotaDel', 0);
            location.reload();
        }

        next() {
            this.currentStep++;
            if (this.currentStep >= this.steps.length) {
                this.end();
            } else {
                this.renderStep();
            }
        }

        renderStep() {
            const step = this.steps[this.currentStep];
            if (step.action) step.action();

            setTimeout(() => {
                const target = document.querySelector(step.targetSelector);
                if (target) {
                    const highlightBox = document.getElementById('tutorial-highlight-box');
                    const rect = target.getBoundingClientRect();

                    if (highlightBox) {
                        highlightBox.style.top = rect.top + 'px';
                        highlightBox.style.left = rect.left + 'px';
                        highlightBox.style.width = rect.width + 'px';
                        highlightBox.style.height = rect.height + 'px';
                    }

                    const box = document.getElementById('tutorial-box');
                    if (box) {
                        let top = rect.bottom + 15;
                        let left = rect.left + rect.width / 2 - 175;

                        if (top + 150 > window.innerHeight) {
                            top = Math.max(10, rect.top - 150);
                        }
                        if (left < 10) left = 10;
                        if (left + 350 > window.innerWidth) left = window.innerWidth - 360;

                        box.style.top = top + 'px';
                        box.style.left = left + 'px';
                    }

                    const tutText = document.getElementById('tutorial-text');
                    const tutNext = document.getElementById('tutorial-next');
                    if (tutText) tutText.innerText = step.text;
                    if (tutNext) tutNext.innerText = this.currentStep === this.steps.length - 1 ? 'Finish' : 'Next >';
                }
            }, 300);
        }
    }

    const tutorialService = new TutorialService();

    // -----------------------------------------------------
    // 9. MAIN APP CONTROLLER
    // -----------------------------------------------------
    class App {
        constructor() {
            this.init();
        }

        init() {
            stateManager.load();
            this.initLowHeightMode();
            this.initSplashScreen();
            this.bindGlobalHooks();

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    this.bindDOM();
                    this.renderAll();
                });
            } else {
                this.bindDOM();
                this.renderAll();
            }
        }

        initLowHeightMode() {
            const checkMode = () => {
                const h = window.innerHeight;
                const w = window.innerWidth;
                const isLowHeight = h < 650 || (w / h >= 1.3 && h < 750);

                if (isLowHeight) {
                    document.body.classList.add('low-height-mode');
                } else {
                    document.body.classList.remove('low-height-mode');
                }
            };

            checkMode();
            window.addEventListener('resize', checkMode);
            window.addEventListener('orientationchange', checkMode);
        }

        initSplashScreen() {
            const splashScreen = document.getElementById('ai-splash-screen');
            if (!splashScreen) return;

            const showBoot = stateManager.get('showBootScreen');
            if (showBoot === false) {
                splashScreen.remove();
                return;
            }

            const statusText = document.getElementById('splash-status-text');
            const progressFill = document.getElementById('splash-progress-fill');
            const splashLogs = document.getElementById('splash-logs');

            setTimeout(() => {
                if (statusText) statusText.innerText = 'LOADING MEMORY MODULES...';
                if (progressFill) progressFill.style.width = '30%';
            }, 800);

            setTimeout(() => {
                if (statusText) statusText.innerText = 'ESTABLISHING NETWORK UPLINK...';
                if (progressFill) progressFill.style.width = '60%';
            }, 1800);

            setTimeout(() => {
                if (statusText) statusText.innerText = 'INTEGRATING CORE COMPONENTS...';
                if (progressFill) progressFill.style.width = '90%';
                if (splashLogs) {
                    const newLog = document.createElement('div');
                    newLog.className = 'log-glitch';
                    newLog.innerText = '> AI PROTOCOLS: [ ENGAGED ]';
                    splashLogs.appendChild(newLog);
                }
            }, 2800);

            setTimeout(() => {
                if (statusText) statusText.innerText = 'SYSTEM READY';
                if (progressFill) progressFill.style.width = '100%';
            }, 3600);

            setTimeout(() => {
                splashScreen.classList.add('fade-out');
                setTimeout(() => splashScreen.remove(), 500);
            }, 4200);
        }

        bindGlobalHooks() {
            window.stateManager = stateManager;
            window.openModal = (id) => modalManager.open(id);
            window.closeModals = () => modalManager.closeAll();
            window.openSubModal = (id) => modalManager.openSubModal(id);
            window.closeSubModal = () => modalManager.closeSubModal();
            window.switchRadioTab = (id) => modalManager.switchRadioTab(id);

            window.startRotaShift = () => {
                const locSelect = document.getElementById('rota-location');
                const locCustom = document.getElementById('locInputCustom');
                let loc = locSelect ? locSelect.value : 'PH Front';
                if (loc === 'Other...' || loc === 'Custom') {
                    loc = locCustom?.value?.trim() || 'Custom';
                }
                timerEngine.startShift(loc);
            };

            window.showConfirmRotaEnd = () => {
                document.getElementById('tb-compact-view')?.classList.add('hidden');
                document.getElementById('tb-confirm-view')?.classList.remove('hidden');
            };

            window.cancelConfirmRotaEnd = () => {
                document.getElementById('tb-confirm-view')?.classList.add('hidden');
                document.getElementById('tb-compact-view')?.classList.remove('hidden');
            };

            window.confirmRotaEnd = () => timerEngine.confirmShiftEnd();

            window.startDutyTimer = () => timerEngine.startDutyTimer();
            window.stopDutyTimer = () => timerEngine.stopDutyTimer();

            window.testDiscordChannel = (key) => DiscordService.testChannel(key);
            window.executeDiscordAction = (key, skipCopy, text, skipRedirect) => DiscordService.executeAction(key, text, skipRedirect);
            window.generateDiscordAction = (type, cbId) => DiscordService.generateAction(type, cbId);

            window.copySimple = (text) => {
                navigator.clipboard.writeText(text).then(() => {
                    sound.playCopySound();
                    let color = 'rgba(255, 255, 255, 0.5)';
                    if (text.includes('10-4')) color = 'rgba(46, 204, 113, 0.9)';
                    else if (text.includes('10-2')) color = 'rgba(231, 76, 60, 0.9)';
                    else if (text.includes('10-20')) color = 'rgba(52, 152, 219, 0.9)';
                    else if (text.includes('10-6')) color = 'rgba(241, 196, 15, 0.9)';
                    else if (text.includes('10-17')) color = 'rgba(155, 89, 182, 0.9)';
                    modalManager.glowModal('modal-radio', color);
                });
            };

            window.showFloatingSaveBtn = () => {
                document.getElementById('floating-save-settings')?.classList.remove('hidden');
            };

            window.hideFloatingSaveBtn = () => {
                document.getElementById('floating-save-settings')?.classList.add('hidden');
            };

            window.toggleSectionCollapse = (titleEl) => {
                const section = titleEl.closest('.glass-section.collapsible');
                if (section) {
                    section.classList.toggle('collapsed');
                }
            };

            window.toggleEditSection = (e, sectionId) => {
                e.stopPropagation();
                const container = document.getElementById(sectionId);
                const btn = e.currentTarget;
                if (!container) return;

                const parentSection = container.closest('.glass-section.collapsible');
                if (parentSection && parentSection.classList.contains('collapsed')) {
                    parentSection.classList.remove('collapsed');
                }

                const inputs = container.querySelectorAll('input');
                const isCurrentlyReadonly = inputs[0]?.hasAttribute('readonly') ?? true;

                if (isCurrentlyReadonly) {
                    inputs.forEach(inp => inp.removeAttribute('readonly'));
                    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:0.95rem; vertical-align:middle; margin-right:3px;">lock</span> Done';
                    btn.classList.add('btn-primary');
                    btn.classList.remove('btn-secondary');
                    inputs[0]?.focus();
                } else {
                    inputs.forEach(inp => inp.setAttribute('readonly', 'true'));
                    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:0.95rem; vertical-align:middle; margin-right:3px;">edit</span> Edit';
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-secondary');
                }
            };

            window.saveSettings = () => {
                const nameInput = document.getElementById('myName');
                if (nameInput) stateManager.set('name', nameInput.value.trim());

                const idInput = document.getElementById('myId');
                if (idInput) stateManager.set('id', idInput.value.trim());

                const rateMap = {
                    rateNightPH: 'nightPH', rateNightSH: 'nightSH', rateNightCalls: 'nightCalls',
                    rateDayPH: 'dayPH', rateDaySH: 'daySH', rateDayCalls: 'dayCalls',
                    rateLabCaptcha: 'labCaptcha', rateLabMedicine: 'labMedicine'
                };

                if (!stateManager.state.shiftRates) stateManager.state.shiftRates = {};
                for (const [inputId, rateKey] of Object.entries(rateMap)) {
                    const input = document.getElementById(inputId);
                    if (input) {
                        stateManager.state.shiftRates[rateKey] = parseInt(input.value, 10) || 0;
                        input.setAttribute('readonly', 'true');
                    }
                }

                const serverIdInput = document.getElementById('discord-server-id');
                if (serverIdInput) {
                    stateManager.set('discordServerId', serverIdInput.value.trim());
                    serverIdInput.setAttribute('readonly', 'true');
                }

                if (!stateManager.state.discordChannels) stateManager.state.discordChannels = {};
                document.querySelectorAll('.discord-channel-id').forEach(input => {
                    const key = input.getAttribute('data-key');
                    if (key) {
                        stateManager.state.discordChannels[key] = input.value.trim();
                    }
                    input.setAttribute('readonly', 'true');
                });

                document.querySelectorAll('.edit-section-btn').forEach(btn => {
                    btn.innerHTML = '✏️ Edit';
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-secondary');
                });

                const bootScreenToggle = document.getElementById('settingShowBootScreen');
                if (bootScreenToggle) {
                    stateManager.set('showBootScreen', bootScreenToggle.checked);
                }

                stateManager.save();
                this.updatePreviews();
                window.hideFloatingSaveBtn();

                sound.playSuccessSound?.() || sound.playCopySound();
                alert('Settings Saved Successfully!');
            };

            window.exportDb = () => stateManager.exportDb();

            window.resetToDefaultCommands = () => {
                if (confirm('Are you sure you want to reset all commands to defaults?')) {
                    stateManager.resetDefaults();
                    location.reload();
                }
            };

            window.saveCurrentAsDefault = () => {
                if (confirm('Set current text of all commands as the new default?')) {
                    stateManager.saveCurrentAsDefault();
                    alert('Current text set as new defaults!');
                }
            };

            window.switchDeptTab = (tabId) => DeptCommandsService.switchDeptTab(tabId);
            window.filterDeptCommands = () => DeptCommandsService.filterCommands();

            window.startTutorial = () => tutorialService.start();
            window.endTutorial = () => tutorialService.end();
            window.nextTutorialStep = () => tutorialService.next();

            window.updateRotaVal = (id, delta) => {
                const el = document.getElementById(id);
                if (el) {
                    let val = (parseInt(el.value, 10) || 0) + delta;
                    if (val < 0) val = 0;
                    el.value = val;
                    this.saveRotaState();
                }
            };

            window.saveRotaState = () => this.saveRotaState();

            window.openAddCommandModal = (secId) => this.openAddCommandModal(secId);
            window.closeAddCommandModal = () => {
                document.getElementById('modal-add-command')?.classList.remove('active');
                const radioModal = document.getElementById('modal-radio');
                if (radioModal) {
                    radioModal.classList.add('active');
                    if (modalManager.overlay) modalManager.overlay.classList.add('active');
                }
            };
            window.saveNewCommandFromForm = () => this.saveNewCommandFromForm();

            window.openAddDeptModal = () => this.openAddDeptModal();
            window.closeAddDeptModal = () => this.closeAddDeptModal();
            window.saveNewDeptCategory = () => this.saveNewDeptCategory();

            window.toggleDropdown = (e) => {
                e.stopPropagation();
                document.getElementById('service-dropdown')?.classList.toggle('active');
            };
        }

        bindDOM() {
            modalManager.init();
            timerEngine.initClocks();

            const nameInput = document.getElementById('myName');
            const idInput = document.getElementById('myId');
            if (nameInput) {
                nameInput.value = stateManager.get('name') || '';
                nameInput.addEventListener('input', () => {
                    this.updatePreviews();
                    window.showFloatingSaveBtn();
                });
            }
            if (idInput) {
                idInput.value = stateManager.get('id') || '';
                idInput.addEventListener('input', () => {
                    this.updatePreviews();
                    window.showFloatingSaveBtn();
                });
            }

            const bootToggle = document.getElementById('settingShowBootScreen');
            if (bootToggle) {
                bootToggle.checked = stateManager.get('showBootScreen') !== false;
                bootToggle.addEventListener('change', () => window.showFloatingSaveBtn());
            }

            const rateMap = {
                rateNightPH: 'nightPH', rateNightSH: 'nightSH', rateNightCalls: 'nightCalls',
                rateDayPH: 'dayPH', rateDaySH: 'daySH', rateDayCalls: 'dayCalls',
                rateLabCaptcha: 'labCaptcha', rateLabMedicine: 'labMedicine'
            };

            for (const [inputId, rateKey] of Object.entries(rateMap)) {
                const input = document.getElementById(inputId);
                if (input) {
                    input.value = stateManager.get('shiftRates')?.[rateKey] ?? '';
                    input.addEventListener('input', () => window.showFloatingSaveBtn());
                }
            }

            const discordServerInput = document.getElementById('discord-server-id');
            if (discordServerInput) {
                discordServerInput.value = stateManager.get('discordServerId') || '1035903890996080811';
                discordServerInput.addEventListener('input', () => window.showFloatingSaveBtn());
            }

            document.querySelectorAll('.discord-channel-id').forEach(input => {
                const key = input.getAttribute('data-key');
                if (key && stateManager.state.discordChannels?.[key]) {
                    input.value = stateManager.state.discordChannels[key];
                }
                input.addEventListener('input', () => window.showFloatingSaveBtn());
            });

            const rotaLocSelect = document.getElementById('rota-location');
            const locInputCustom = document.getElementById('locInputCustom');
            const repInput = document.getElementById('repInput');

            if (rotaLocSelect) {
                rotaLocSelect.value = stateManager.get('rotaLocation') || 'PH Front';
                rotaLocSelect.addEventListener('change', () => {
                    stateManager.set('rotaLocation', rotaLocSelect.value);
                    if (locInputCustom) {
                        locInputCustom.style.display = (rotaLocSelect.value === 'Other...' || rotaLocSelect.value === 'Custom') ? 'block' : 'none';
                    }
                    if (rotaLocSelect.value === 'Labs') {
                        modalManager.openSubModal('sub-rota');
                    }
                    this.updatePreviews();
                });
            }

            if (locInputCustom) locInputCustom.addEventListener('input', () => this.updatePreviews());
            if (repInput) repInput.addEventListener('input', () => this.updatePreviews());

            const importInput = document.getElementById('import-db-file');
            if (importInput) {
                importInput.addEventListener('change', (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        stateManager.importDb(file, () => {
                            alert('Backup database imported successfully!');
                            location.reload();
                        }, () => {
                            alert('Invalid db.txt file format.');
                        });
                    }
                });
            }

            document.querySelectorAll('.discord-toggle-checkbox').forEach(cb => {
                const id = cb.id;
                if (id && stateManager.state.discordToggles?.[id] !== undefined) {
                    cb.checked = stateManager.state.discordToggles[id];
                }
                cb.addEventListener('change', (e) => {
                    if (id) {
                        if (!stateManager.state.discordToggles) stateManager.state.discordToggles = {};
                        stateManager.state.discordToggles[id] = e.target.checked;
                        stateManager.save();
                    }
                });
            });

            document.addEventListener('click', () => {
                document.getElementById('service-dropdown')?.classList.remove('active');
            });

            this.setupCopyBlocks();
            this.updatePreviews();
        }

        setupCopyBlocks() {
            this.renderUserAddedDeptTabs();

            // Render user-added dynamic commands if present
            if (stateManager.state.userAddedCommands && Array.isArray(stateManager.state.userAddedCommands)) {
                stateManager.state.userAddedCommands.forEach(c => {
                    const sec = document.getElementById(c.secIndex || c.secId);
                    if (sec) {
                        const grid = sec.querySelector('.copy-blocks-grid');
                        if (grid && !document.getElementById(c.id)) {
                            const newBlock = document.createElement('div');
                            newBlock.className = 'copy-block';
                            newBlock.innerHTML = `
                                <div class="copy-header"><span contenteditable="true" style="outline:none; border-bottom: 1px dashed rgba(255,255,255,0.3);">${c.title || 'Custom Command'}</span><button class="btn copy-btn" data-target="${c.id}"><span class="material-symbols-outlined" style="font-size:0.95rem;">content_copy</span></button></div>
                                <div class="copy-content" id="${c.id}" contenteditable="true">${c.template}</div>
                            `;
                            const addCard = grid.querySelector('.add-command-card');
                            if (addCard) {
                                grid.insertBefore(newBlock, addCard);
                            } else {
                                grid.appendChild(newBlock);
                            }
                        }
                    }
                });
            }

            // Prune obsolete commands from state that no longer exist in index.html DOM
            if (stateManager.state.customCommands) {
                Object.keys(stateManager.state.customCommands).forEach(key => {
                    if (key.startsWith('cmd-') && !document.getElementById(key)) {
                        delete stateManager.state.customCommands[key];
                    }
                });
            }
            if (stateManager.state.customTitles) {
                Object.keys(stateManager.state.customTitles).forEach(key => {
                    if (key.startsWith('cmd-') && !document.getElementById(key)) {
                        delete stateManager.state.customTitles[key];
                    }
                });
            }
            if (stateManager.state.userDefaults) {
                Object.keys(stateManager.state.userDefaults).forEach(key => {
                    if (key.startsWith('cmd-') && !document.getElementById(key)) {
                        delete stateManager.state.userDefaults[key];
                    }
                });
            }

            document.querySelectorAll('.copy-block').forEach(block => {
                const copyBtn = block.querySelector('.copy-btn');
                const targetId = copyBtn?.getAttribute('data-target');
                const content = block.querySelector('.copy-content');

                if (content) {
                    const originalText = content.innerText.trim();
                    content.dataset.originalTemplate = originalText;

                    if (!stateManager.state.customCommands[content.id]) {
                        stateManager.state.customCommands[content.id] = originalText;
                    }
                    content.dataset.template = stateManager.state.customCommands[content.id];
                    this.attachBlurEvent(content);
                }

                if (copyBtn && !block.querySelector('.btn-delete')) {
                    const btnContainer = document.createElement('div');
                    btnContainer.style.display = 'flex';
                    btnContainer.style.alignItems = 'center';
                    btnContainer.style.gap = '0.25rem';
                    copyBtn.parentNode.insertBefore(btnContainer, copyBtn);
                    btnContainer.appendChild(copyBtn);

                    if (!block.closest('#modal-bodycam') && !block.closest('#modal-discord-bodycam')) {
                        const deleteBtn = document.createElement('button');
                        deleteBtn.className = 'btn btn-delete';
                        deleteBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:0.95rem; color:#ef4444;">close</span>';
                        deleteBtn.setAttribute('data-target', targetId);
                        deleteBtn.title = 'Hold for 3 seconds to delete';
                        btnContainer.appendChild(deleteBtn);
                        this.attachDeleteEvent(deleteBtn);
                    }

                    this.attachCopyEvent(copyBtn);
                }

                const titleSpan = block.querySelector('.copy-header span');
                if (titleSpan && targetId && !block.closest('#modal-bodycam')) {
                    titleSpan.setAttribute('contenteditable', 'true');
                    titleSpan.style.outline = 'none';
                    titleSpan.style.borderBottom = '1px dashed rgba(255,255,255,0.3)';
                    if (stateManager.state.customTitles?.[targetId]) {
                        titleSpan.innerText = stateManager.state.customTitles[targetId];
                    }
                    this.attachTitleBlurEvent(titleSpan, targetId);
                }
            });

            stateManager.save();
        }

        attachCopyEvent(btn) {
            btn.addEventListener('click', async () => {
                const targetId = btn.getAttribute('data-target');
                const targetEl = document.getElementById(targetId);
                if (!targetEl) return;

                const textToCopy = targetEl.innerText;
                const newTemplate = stateManager.extractTemplate(textToCopy);

                stateManager.state.customCommands[targetId] = newTemplate;
                targetEl.dataset.template = newTemplate;
                stateManager.save();

                try {
                    await navigator.clipboard.writeText(textToCopy);
                    sound.playCopySound();

                    const originalHTML = btn.innerHTML;
                    btn.innerHTML = '✅';
                    btn.classList.add('success');
                    setTimeout(() => {
                        btn.innerHTML = originalHTML;
                        btn.classList.remove('success');
                    }, 1500);

                    if (targetId === 'od3') {
                        timerEngine.startDutyTimer();
                        setTimeout(() => {
                            modalManager.open('modal-discord-bodycam');
                        }, 400);
                    } else if (targetId === 'off3') {
                        timerEngine.stopDutyTimer();
                        setTimeout(() => {
                            modalManager.open('modal-discord-bodycam');
                        }, 400);
                    }

                    if (stateManager.state.dutySteps?.hasOwnProperty(targetId)) {
                        stateManager.state.dutySteps[targetId] = true;
                        stateManager.save();
                        this.checkDutyState();
                    }

                    if (targetId === 'rc107b') {
                        setTimeout(() => {
                            modalManager.open('modal-bodycam');
                            document.getElementById('btn-tab-offduty')?.click();
                        }, 400);
                    }

                    const discordKey = btn.getAttribute('data-discord-key');
                    if (discordKey) {
                        const block = btn.closest('.copy-block') || btn.parentElement;
                        const cb = block.querySelector('input[type="checkbox"]');
                        const shouldOpen = cb ? cb.checked : true;
                        if (shouldOpen) {
                            DiscordService.openChannel(stateManager.state.discordServerId, stateManager.state.discordChannels[discordKey]);
                        }
                    }
                } catch (err) {
                    console.warn('Copy failed:', err);
                }
            });
        }

        attachBlurEvent(el) {
            el.addEventListener('blur', () => {
                const targetId = el.id;
                const newTemplate = stateManager.extractTemplate(el.innerText);
                stateManager.state.customCommands[targetId] = newTemplate;
                el.dataset.template = newTemplate;
                stateManager.save();

                el.style.backgroundColor = 'rgba(46, 204, 113, 0.2)';
                setTimeout(() => { el.style.backgroundColor = ''; }, 300);
            });
        }

        attachTitleBlurEvent(span, targetId) {
            span.addEventListener('blur', () => {
                if (!stateManager.state.customTitles) stateManager.state.customTitles = {};
                stateManager.state.customTitles[targetId] = span.innerText;
                stateManager.save();

                span.style.backgroundColor = 'rgba(46, 204, 113, 0.2)';
                setTimeout(() => { span.style.backgroundColor = ''; }, 300);
            });
        }

        attachDeleteEvent(btn) {
            let pressTimer;

            const startDelete = () => {
                btn.classList.add('holding');
                pressTimer = window.setTimeout(() => {
                    const targetId = btn.getAttribute('data-target');
                    if (stateManager.state.userAddedCommands) {
                        stateManager.state.userAddedCommands = stateManager.state.userAddedCommands.filter(c => c.id !== targetId);
                    }
                    if (!stateManager.state.deletedCommands) stateManager.state.deletedCommands = [];
                    if (!stateManager.state.deletedCommands.includes(targetId)) {
                        stateManager.state.deletedCommands.push(targetId);
                    }
                    stateManager.save();

                    const block = document.getElementById(targetId)?.closest('.copy-block');
                    if (block) block.remove();
                }, 3000);
            };

            const cancelDelete = () => {
                btn.classList.remove('holding');
                clearTimeout(pressTimer);
            };

            btn.addEventListener('mousedown', startDelete);
            btn.addEventListener('touchstart', startDelete, { passive: true });
            btn.addEventListener('mouseup', cancelDelete);
            btn.addEventListener('mouseleave', cancelDelete);
            btn.addEventListener('touchend', cancelDelete);
            btn.addEventListener('touchcancel', cancelDelete);
        }

        checkDutyState() {
            const steps = stateManager.state.dutySteps || {};

            STEP_DEPENDENCIES.forEach(([prev, next]) => {
                const btn = document.querySelector(`[data-target="${next}"]`);
                if (steps[prev] && btn) {
                    btn.disabled = false;
                    btn.classList.remove('disabled');
                }
            });

            const onDutyDone = steps.od1 && steps.od2 && steps.od3;
            const offDutyDone = steps.off1 && steps.off2 && steps.off3;

            const btnRefresh = document.getElementById('btn-tab-refresh');
            const btnSave = document.getElementById('btn-tab-save');
            const btnOffDuty = document.getElementById('btn-tab-offduty');
            const btnOnDuty = document.getElementById('btn-tab-onduty');

            if (onDutyDone) {
                if (btnRefresh) { btnRefresh.disabled = false; btnRefresh.classList.remove('disabled'); }
                if (btnSave) { btnSave.disabled = false; btnSave.classList.remove('disabled'); }
                if (btnOffDuty) { btnOffDuty.disabled = false; btnOffDuty.classList.remove('disabled'); }

                if (!offDutyDone && btnOnDuty) {
                    btnOnDuty.disabled = true;
                    btnOnDuty.classList.add('disabled');
                    if (btnOnDuty.classList.contains('active')) {
                        btnOffDuty?.click();
                    }
                }
            }

            if (offDutyDone) {
                ALL_DUTY_STEPS.forEach(step => { steps[step] = false; });
                stateManager.set('rotaCap', 0);
                stateManager.set('rotaDel', 0);
                stateManager.save();

                const lrCap = document.getElementById('lr-cap');
                const lrDel = document.getElementById('lr-del');
                if (lrCap) lrCap.value = 0;
                if (lrDel) lrDel.value = 0;

                if (btnOnDuty) { btnOnDuty.disabled = false; btnOnDuty.classList.remove('disabled'); }
                if (btnRefresh) { btnRefresh.disabled = true; btnRefresh.classList.add('disabled'); }
                if (btnSave) { btnSave.disabled = true; btnSave.classList.add('disabled'); }
                if (btnOffDuty) { btnOffDuty.disabled = true; btnOffDuty.classList.add('disabled'); }

                STEP_DEPENDENCIES.forEach(([_, next]) => {
                    const b = document.querySelector(`[data-target="${next}"]`);
                    if (b) { b.disabled = true; b.classList.add('disabled'); }
                });

                btnOnDuty?.click();
            }
        }

        saveRotaState() {
            const lrCap = document.getElementById('lr-cap');
            const lrDel = document.getElementById('lr-del');
            const cap = parseInt(lrCap?.value, 10) || 0;
            const del = parseInt(lrDel?.value, 10) || 0;

            stateManager.set('rotaCap', cap);
            stateManager.set('rotaDel', del);

            const bonusDisplay = document.getElementById('lr-bonus-display');
            if (bonusDisplay) {
                const capRate = stateManager.get('shiftRates')?.labCaptcha || 5000;
                const delRate = stateManager.get('shiftRates')?.labMedicine || 10000;
                const total = cap * capRate + del * delRate;
                bonusDisplay.textContent = `Bonus Earned: $${total.toLocaleString()}`;
            }
        }

        updatePreviews() {
            document.querySelectorAll('.copy-content').forEach(el => {
                const template = el.dataset.template || el.dataset.originalTemplate || el.innerText;
                el.innerText = stateManager.interpolate(template);
            });

            const caLoc = document.getElementById('ca-loc');
            if (caLoc) {
                const { loc } = stateManager.getTemplateVars();
                caLoc.value = loc !== '[Location]' ? loc : '';
            }
        }

        renderBottomNav() {
            const currentMainId = stateManager.get('mainNavService') || 'hs';
            const mainService = BOTTOM_NAV_SERVICES.find(s => s.id === currentMainId) || BOTTOM_NAV_SERVICES[0];

            const mainIcon = document.getElementById('main-icon');
            const mainText = document.getElementById('main-text');
            const mainCard = document.getElementById('main-service-card');

            if (mainIcon) mainIcon.innerHTML = mainService.icon;
            if (mainText) mainText.innerHTML = mainService.text;
            if (mainCard) {
                mainCard.onclick = (e) => {
                    if (e.target.closest('.nav-dropdown-btn') || e.target.closest('.nav-dropdown-menu')) return;
                    modalManager.open(mainService.modal);
                };
            }

            const dropdown = document.getElementById('service-dropdown');
            if (dropdown) {
                dropdown.innerHTML = '';
                BOTTOM_NAV_SERVICES.forEach(s => {
                    if (s.id !== currentMainId) {
                        const item = document.createElement('div');
                        item.className = 'nav-dropdown-item';
                        item.innerHTML = `<span>${s.icon}</span> <span>${s.text.replace('<br>', ' ')}</span>`;
                        item.onclick = (e) => {
                            e.stopPropagation();
                            stateManager.set('mainNavService', s.id);
                            dropdown.classList.remove('active');
                            this.renderBottomNav();
                        };
                        dropdown.appendChild(item);
                    }
                });
            }

            const secondaryGrid = document.getElementById('secondary-grid');
            if (secondaryGrid) {
                secondaryGrid.innerHTML = '';
                const otherServices = BOTTOM_NAV_SERVICES.filter(s => s.id !== currentMainId);
                const gridItems = [
                    ...otherServices,
                    { id: 'settings', icon: '<span class="material-symbols-outlined icon-gradient-slate">settings</span>', smallText: 'SETTINGS', modal: 'modal-settings' },
                    { id: 'loggen', icon: '<span class="material-symbols-outlined icon-gradient-rose">badge</span>', smallText: 'LOG GEN', modal: 'modal-discord-bodycam' }
                ];

                gridItems.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'small-nav-item';
                    div.onclick = () => modalManager.open(item.modal);
                    div.innerHTML = `
                        <div class="nav-icon-small">${item.icon}</div>
                        <div class="nav-text-small">${item.smallText}</div>
                    `;
                    secondaryGrid.appendChild(div);
                });
            }
        }

        renderAll() {
            const serverId = document.getElementById('discord-server-id');
            if (serverId) serverId.value = stateManager.get('discordServerId') || '';

            document.querySelectorAll('.discord-channel-id').forEach(input => {
                const key = input.getAttribute('data-key');
                if (key && stateManager.state.discordChannels?.[key]) {
                    input.value = stateManager.state.discordChannels[key];
                }
            });

            const bootToggle = document.getElementById('settingShowBootScreen');
            if (bootToggle) {
                bootToggle.checked = stateManager.get('showBootScreen') !== false;
                bootToggle.onchange = (e) => stateManager.set('showBootScreen', e.target.checked);
            }

            if (stateManager.state.deletedCommands) {
                stateManager.state.deletedCommands.forEach(id => {
                    document.getElementById(id)?.closest('.copy-block')?.remove();
                });
            }

            this.renderBottomNav();
            this.updatePreviews();
            this.checkDutyState();
            this.saveRotaState();

            if (stateManager.get('dutyStartTime')) {
                document.getElementById('tb-default-view')?.classList.add('hidden');
                document.getElementById('tb-setup-view')?.classList.add('hidden');
                document.getElementById('tb-compact-view')?.classList.remove('hidden');
                timerEngine.startRotaTimer();
            }
        }

        openAddCommandModal(secId) {
            const selectEl = document.getElementById('new-cmd-section');
            if (selectEl && secId) {
                selectEl.value = secId;
            }
            const titleInput = document.getElementById('new-cmd-title');
            const templateInput = document.getElementById('new-cmd-template');
            if (titleInput) titleInput.value = '';
            if (templateInput) templateInput.value = '';

            document.querySelectorAll('.modal-content:not(.sub-modal)').forEach(m => m.classList.remove('active'));
            const sm = document.getElementById('modal-add-command');
            if (sm) sm.classList.add('active');
            if (modalManager.overlay) modalManager.overlay.classList.add('active');
        }

        saveNewCommandFromForm() {
            const secId = document.getElementById('new-cmd-section')?.value || 'dept-tab-bgc';
            const title = document.getElementById('new-cmd-title')?.value.trim() || 'Custom Command';
            const template = document.getElementById('new-cmd-template')?.value.trim();

            if (!template) {
                alert('Please enter a command template text.');
                return;
            }

            const newId = 'custom-cmd-' + Date.now();
            if (!stateManager.state.userAddedCommands) stateManager.state.userAddedCommands = [];
            stateManager.state.userAddedCommands.push({ secIndex: secId, id: newId, title, template });
            if (!stateManager.state.customCommands) stateManager.state.customCommands = {};
            stateManager.state.customCommands[newId] = template;
            if (!stateManager.state.userDefaults) stateManager.state.userDefaults = {};
            stateManager.state.userDefaults[newId] = template;
            if (!stateManager.state.customTitles) stateManager.state.customTitles = {};
            stateManager.state.customTitles[newId] = title;
            stateManager.save();

            const secEl = document.getElementById(secId);
            if (secEl) {
                const grid = secEl.querySelector('.copy-blocks-grid');
                if (grid) {
                    const newBlock = document.createElement('div');
                    newBlock.className = 'copy-block';
                    newBlock.innerHTML = `
                        <div class="copy-header"><span contenteditable="true" style="outline:none; border-bottom: 1px dashed rgba(255,255,255,0.3);">${title}</span><button class="btn copy-btn" data-target="${newId}"><span class="material-symbols-outlined" style="font-size:0.95rem;">content_copy</span></button></div>
                        <div class="copy-content" id="${newId}" contenteditable="true">${template}</div>
                    `;
                    const addCard = grid.querySelector('.add-command-card');
                    if (addCard) {
                        grid.insertBefore(newBlock, addCard);
                    } else {
                        grid.appendChild(newBlock);
                    }
                    this.setupCopyBlocks();
                    this.updatePreviews();
                }
            }

            document.getElementById('modal-add-command')?.classList.remove('active');
            const radioModal = document.getElementById('modal-radio');
            if (radioModal) {
                radioModal.classList.add('active');
                if (modalManager.overlay) modalManager.overlay.classList.add('active');
            }
            DeptCommandsService.switchDeptTab(secId);
        }

        renderUserAddedDeptTabs() {
            if (!stateManager.state.userAddedDeptTabs || !Array.isArray(stateManager.state.userAddedDeptTabs)) {
                stateManager.state.userAddedDeptTabs = [];
                return;
            }

            const chipsBar = document.getElementById('dept-chips-bar');
            const tabsBody = document.getElementById('dept-tabs-body-container');
            const addDeptBtn = chipsBar?.querySelector('.add-dept-chip-btn');
            const sectionSelect = document.getElementById('new-cmd-section');

            stateManager.state.userAddedDeptTabs.forEach(dept => {
                // 1. Chip
                if (chipsBar && !chipsBar.querySelector(`[data-dept-tab="${dept.id}"]`)) {
                    const chip = document.createElement('button');
                    chip.className = 'dept-chip';
                    chip.setAttribute('data-dept-tab', dept.id);
                    chip.innerHTML = `<span class="material-symbols-outlined chip-icon">${dept.icon || 'folder'}</span> ${dept.name} <span class="delete-dept-chip" style="margin-left:6px; opacity:0.6; font-size:0.75rem;" title="Hold to delete"><span class="material-symbols-outlined" style="font-size:0.85rem; vertical-align:middle;">close</span></span>`;
                    chip.onclick = (e) => {
                        if (e.target.classList.contains('delete-dept-chip')) return;
                        DeptCommandsService.switchDeptTab(dept.id);
                    };

                    const delSpan = chip.querySelector('.delete-dept-chip');
                    if (delSpan) {
                        let pressTimer;
                        const startDel = (e) => {
                            e.stopPropagation();
                            delSpan.style.color = '#ef4444';
                            delSpan.style.opacity = '1';
                            pressTimer = setTimeout(() => {
                                if (confirm(`Delete category "${dept.name}" and all its commands?`)) {
                                    this.deleteUserDeptCategory(dept.id);
                                }
                            }, 1000);
                        };
                        const cancelDel = () => {
                            delSpan.style.color = '';
                            delSpan.style.opacity = '0.6';
                            clearTimeout(pressTimer);
                        };
                        delSpan.addEventListener('mousedown', startDel);
                        delSpan.addEventListener('touchstart', startDel, { passive: true });
                        delSpan.addEventListener('mouseup', cancelDel);
                        delSpan.addEventListener('mouseleave', cancelDel);
                        delSpan.addEventListener('touchend', cancelDel);
                    }

                    if (addDeptBtn) {
                        chipsBar.insertBefore(chip, addDeptBtn);
                    } else {
                        chipsBar.appendChild(chip);
                    }
                }

                // 2. Tab Content
                if (tabsBody && !document.getElementById(dept.id)) {
                    const tabContent = document.createElement('div');
                    tabContent.id = dept.id;
                    tabContent.className = 'dept-tab-content';
                    tabContent.innerHTML = `
                        <div class="copy-blocks-grid">
                            <div class="copy-block add-command-card" onclick="openAddCommandModal('${dept.id}')"><div class="add-command-icon"><span class="material-symbols-outlined" style="font-size:1.8rem; color:#38bdf8;">add_circle</span></div><div class="add-command-text">Add Command</div></div>
                        </div>
                    `;
                    tabsBody.appendChild(tabContent);
                }

                // 3. Section Select
                if (sectionSelect && !sectionSelect.querySelector(`option[value="${dept.id}"]`)) {
                    const opt = document.createElement('option');
                    opt.value = dept.id;
                    opt.textContent = dept.name;
                    sectionSelect.appendChild(opt);
                }
            });
        }

        deleteUserDeptCategory(tabId) {
            stateManager.state.userAddedDeptTabs = (stateManager.state.userAddedDeptTabs || []).filter(d => d.id !== tabId);
            if (stateManager.state.userAddedCommands) {
                stateManager.state.userAddedCommands = stateManager.state.userAddedCommands.filter(c => c.secIndex !== tabId && c.secId !== tabId);
            }
            stateManager.save();

            document.querySelector(`.dept-chip[data-dept-tab="${tabId}"]`)?.remove();
            document.getElementById(tabId)?.remove();
            document.querySelector(`#new-cmd-section option[value="${tabId}"]`)?.remove();

            DeptCommandsService.switchDeptTab('dept-tab-bgc');
        }

        openAddDeptModal() {
            const nameInput = document.getElementById('new-dept-name');
            const iconInput = document.getElementById('new-dept-icon');
            if (nameInput) nameInput.value = '';
            if (iconInput) iconInput.value = 'folder';

            document.querySelectorAll('.modal-content:not(.sub-modal)').forEach(m => m.classList.remove('active'));
            const sm = document.getElementById('modal-add-dept');
            if (sm) sm.classList.add('active');
            if (modalManager.overlay) modalManager.overlay.classList.add('active');
        }

        closeAddDeptModal() {
            document.getElementById('modal-add-dept')?.classList.remove('active');
            const radioModal = document.getElementById('modal-radio');
            if (radioModal) {
                radioModal.classList.add('active');
                if (modalManager.overlay) modalManager.overlay.classList.add('active');
            }
        }

        saveNewDeptCategory() {
            const icon = document.getElementById('new-dept-icon')?.value.trim() || 'folder';
            const name = document.getElementById('new-dept-name')?.value.trim();

            if (!name) {
                alert('Please enter a category name.');
                return;
            }

            const tabId = 'dept-tab-' + name.toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + Date.now();
            if (!stateManager.state.userAddedDeptTabs) stateManager.state.userAddedDeptTabs = [];
            stateManager.state.userAddedDeptTabs.push({ id: tabId, name, icon });
            stateManager.save();

            this.renderUserAddedDeptTabs();

            document.getElementById('modal-add-dept')?.classList.remove('active');
            const radioModal = document.getElementById('modal-radio');
            if (radioModal) {
                radioModal.classList.add('active');
                if (modalManager.overlay) modalManager.overlay.classList.add('active');
            }
            DeptCommandsService.switchDeptTab(tabId);
        }
    }

    // Start App
    new App();
})();

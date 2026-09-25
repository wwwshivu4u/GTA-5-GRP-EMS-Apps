/**
 * SAHP Companion - Core Application Controller
 * Optimized for local file:// and web server execution.
 * Full state persistence mirroring EMS Companion.
 */

(function () {
    'use strict';

    // -----------------------------------------------------
    // 1. CONSTANTS & DEFAULTS
    // -----------------------------------------------------
    const DEFAULT_DISCORD_SERVER_ID = '1035906370102370364';

    const DEFAULT_DISCORD_CHANNELS = {
        finelog: '1256874088140378154',        // #【🎟】fine-log
        arrestlogs: '1126042574168260679',     // #【👮⛓】arrest-logs
        confiscation: '1056669110211182612',   // #【⛔】confiscations-logs
        towing: '1052029071929909368',         // #【🚥】towing-logs
        radiocodes: '1255991443378409688',     // #【📝】radio-codes
        codea: '1154377770168754218',          // #【❌】code-a
        radarlogs: '1266676923514486874',      // #【🚔】radar-logs
        bodycam: '1357931144435466341',        // #bodycam / pov-logs
        interview: '1269769031460851794',      // #📝︱interview-logs
        hiring: '1372874164716699660',         // #📝︱hiring-proofs
        contracts: '1269769097529397299',      // #📃︱contract-logs
        bonus: '1169404214049509396'           // #【💲】bonus-system
    };

    const DEFAULT_SHIFT_RATES = {
        nightPatrol: 35000,
        nightHighway: 40000,
        nightDetective: 30000,
        dayPatrol: 20000,
        dayHighway: 25000,
        dayDetective: 15000,
        towingBounty: 5000,
        arrestBounty: 10000
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

    // -----------------------------------------------------
    // 2. STATE MANAGER (EMS Companion Pattern)
    // -----------------------------------------------------
    const STORAGE_KEY = 'sahp_companion_state_v1';
    const FALLBACK_STORAGE_KEY = 'sahpSettings';
    const LEGACY_STORAGE_KEY = 'lspd_companion_state_v1';
    const DEFAULTS_STORAGE_KEY = 'sahp_companion_user_defaults_v1';

    class StateManager {
        constructor() {
            this.state = this.getDefaultState();
        }

        getDefaultState() {
            const dutySteps = {};
            ALL_DUTY_STEPS.forEach(step => {
                dutySteps[step] = false;
            });

            return {
                showBootScreen: true,
                soundEnabled: true,
                officerName: '',
                badgeNum: '',
                discordServerId: DEFAULT_DISCORD_SERVER_ID,
                discordChannels: { ...DEFAULT_DISCORD_CHANNELS },
                shiftRates: { ...DEFAULT_SHIFT_RATES },
                dutySteps,
                dutyStartTime: null,
                selectedLocation: 'Patrol (Highway / Paleto)',
                quickNotes: '',
                selectedCharges: [],
                arrestsLogged: 0,
                towsLogged: 0,
                customCommands: {},
                userDefaults: {}
            };
        }

        load() {
            try {
                let saved = localStorage.getItem(STORAGE_KEY);
                if (!saved) {
                    saved = localStorage.getItem(FALLBACK_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || localStorage.getItem('lspdSettings');
                }

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
                console.error('Failed to load state from localStorage:', err);
                this.state = this.getDefaultState();
            }
            return this.state;
        }

        save() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
                const statusEl = document.getElementById('notes-auto-save-status');
                if (statusEl) {
                    statusEl.innerHTML = '<span class="material-symbols-outlined" style="font-size:0.95rem;">cloud_done</span> Auto-saved';
                }
            } catch (err) {
                console.error('Failed to save state to localStorage:', err);
            }
        }

        get(key) {
            return this.state[key];
        }

        set(key, value) {
            this.state[key] = value;
            this.save();
        }
    }

    const stateManager = new StateManager();
    let state = stateManager.load();

    // -----------------------------------------------------
    // 3. UI STATE SYNC & INPUT BINDINGS
    // -----------------------------------------------------
    function syncStateToUI() {
        // Officer Profile
        const nameInput = document.getElementById('settingOfficerName');
        if (nameInput) nameInput.value = state.officerName || '';

        const badgeInput = document.getElementById('settingBadgeNum');
        if (badgeInput) badgeInput.value = state.badgeNum || '';

        updateOfficerTopBarBadge();

        // Boot Screen Toggle
        const bootToggle = document.getElementById('settingShowBootScreen');
        if (bootToggle) {
            bootToggle.checked = state.showBootScreen !== false;
        }

        // Sound FX Toggle
        const soundToggle = document.getElementById('settingSoundFX');
        if (soundToggle) {
            soundToggle.checked = state.soundEnabled !== false;
        }
        updateAudioDockIcon();

        // Discord Channel Inputs
        const srvInput = document.getElementById('settingDiscordServer');
        if (srvInput) srvInput.value = state.discordServerId || DEFAULT_DISCORD_SERVER_ID;

        const chanFine = document.getElementById('settingChanFineLog');
        if (chanFine) chanFine.value = state.discordChannels.finelog || DEFAULT_DISCORD_CHANNELS.finelog || '';

        const chanArr = document.getElementById('settingChanArrest');
        if (chanArr) chanArr.value = state.discordChannels.arrestlogs || DEFAULT_DISCORD_CHANNELS.arrestlogs || '';

        const chanConf = document.getElementById('settingChanConfiscation');
        if (chanConf) chanConf.value = state.discordChannels.confiscation || DEFAULT_DISCORD_CHANNELS.confiscation || '';

        const chanTow = document.getElementById('settingChanTowing');
        if (chanTow) chanTow.value = state.discordChannels.towing || DEFAULT_DISCORD_CHANNELS.towing || '';

        const chanBc = document.getElementById('settingChanBodycam');
        if (chanBc) chanBc.value = state.discordChannels.bodycam || DEFAULT_DISCORD_CHANNELS.bodycam || '';

        const chanRadar = document.getElementById('settingChanRadar');
        if (chanRadar) chanRadar.value = state.discordChannels.radarlogs || DEFAULT_DISCORD_CHANNELS.radarlogs || '';

        const chanRadio = document.getElementById('settingChanRadio');
        if (chanRadio) chanRadio.value = state.discordChannels.radiocodes || DEFAULT_DISCORD_CHANNELS.radiocodes || '';

        // Update Discord button visibility based on whether channel IDs are configured
        updateDiscordButtonsVisibility();

        // Quick Notes
        const notesTextarea = document.getElementById('quick-notes-textarea');
        if (notesTextarea) {
            notesTextarea.value = state.quickNotes || '';
            updateNotepadCounts();
        }

        // Duty Status
        const isOnDuty = Boolean(state.dutyStartTime);
        setDutyStatusUI(isOnDuty);

        // Bodycam step progression
        checkInitialStepStates();
    }

    function updateDiscordButtonsVisibility() {
        const channels = state.discordChannels || {};
        document.querySelectorAll('.discord-jump-btn').forEach(btn => {
            const channelKey = btn.getAttribute('data-discord-channel');
            const channelId = channelKey && channels[channelKey] ? String(channels[channelKey]).trim() : '';
            if (!channelId || channelId === '') {
                btn.style.display = 'none';
            } else {
                btn.style.display = '';
            }
        });
    }

    function updateOfficerTopBarBadge() {
        const topbarName = document.getElementById('topbar-officer-name');
        if (!topbarName) return;

        const name = (state.officerName || '').trim();
        const badge = (state.badgeNum || '').trim();

        if (name && badge) {
            topbarName.textContent = `${name.toUpperCase()} [${badge}]`;
        } else if (name) {
            topbarName.textContent = name.toUpperCase();
        } else if (badge) {
            topbarName.textContent = `OFFICER [${badge}]`;
        } else {
            topbarName.textContent = 'OFFICER [UNASSIGNED]';
        }
    }

    function bindSettingsEvents() {
        // Officer profile bindings
        const nameInput = document.getElementById('settingOfficerName');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                state.officerName = e.target.value.trim();
                stateManager.save();
                updateOfficerTopBarBadge();
            });
        }

        const badgeInput = document.getElementById('settingBadgeNum');
        if (badgeInput) {
            badgeInput.addEventListener('input', (e) => {
                state.badgeNum = e.target.value.trim();
                stateManager.save();
                updateOfficerTopBarBadge();
            });
        }

        // Boot screen toggle binding
        const bootToggle = document.getElementById('settingShowBootScreen');
        if (bootToggle) {
            bootToggle.addEventListener('change', (e) => {
                stateManager.set('showBootScreen', e.target.checked);
            });
        }

        // Sound FX toggle binding
        const soundToggle = document.getElementById('settingSoundFX');
        if (soundToggle) {
            soundToggle.addEventListener('change', (e) => {
                stateManager.set('soundEnabled', e.target.checked);
                updateAudioDockIcon();
            });
        }

        // Discord Server & Channel bindings
        const bindInputToState = (elemId, key, isChannel = false) => {
            const el = document.getElementById(elemId);
            if (el) {
                el.addEventListener('input', (e) => {
                    if (isChannel) {
                        state.discordChannels[key] = e.target.value.trim();
                        updateDiscordButtonsVisibility();
                    } else {
                        state[key] = e.target.value.trim();
                    }
                    stateManager.save();
                });
            }
        };

        bindInputToState('settingDiscordServer', 'discordServerId');
        bindInputToState('settingChanFineLog', 'finelog', true);
        bindInputToState('settingChanArrest', 'arrestlogs', true);
        bindInputToState('settingChanConfiscation', 'confiscation', true);
        bindInputToState('settingChanTowing', 'towing', true);
        bindInputToState('settingChanBodycam', 'bodycam', true);
        bindInputToState('settingChanRadar', 'radarlogs', true);
        bindInputToState('settingChanRadio', 'radiocodes', true);
    }

    // -----------------------------------------------------
    // 4. SOUND HELPER (With Mute Check)
    // -----------------------------------------------------
    function playSound(methodName) {
        if (state.soundEnabled === false) return;
        if (window.soundSystem && typeof window.soundSystem[methodName] === 'function') {
            try {
                window.soundSystem[methodName]();
            } catch (e) {
                console.warn('Audio play error:', e);
            }
        }
    }

    function toggleAudio() {
        const current = state.soundEnabled !== false;
        stateManager.set('soundEnabled', !current);
        const soundToggle = document.getElementById('settingSoundFX');
        if (soundToggle) soundToggle.checked = !current;
        updateAudioDockIcon();
        if (!current) playSound('playRadioClick');
    }

    function updateAudioDockIcon() {
        const icon = document.getElementById('dock-audio-icon');
        const isEnabled = state.soundEnabled !== false;
        if (icon) {
            icon.textContent = isEnabled ? 'volume_up' : 'volume_off';
            icon.style.color = isEnabled ? '#38bdf8' : '#94a3b8';
        }
    }

    // -----------------------------------------------------
    // 5. CLOCKS & SHIFT ENGINE
    // -----------------------------------------------------
    function getICTime() {
        const now = new Date();
        const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
        const icTotalMinutes = (utcMinutes + 120) % 1440; // UTC+2 In-Character Time
        const icHours = Math.floor(icTotalMinutes / 60);
        const icMins = Math.floor(icTotalMinutes % 60);
        const icSecs = now.getUTCSeconds();
        return {
            hours: icHours,
            minutes: icMins,
            seconds: icSecs,
            formattedTime: `${String(icHours).padStart(2, '0')}:${String(icMins).padStart(2, '0')}`,
            formattedFull: `${String(icHours).padStart(2, '0')}:${String(icMins).padStart(2, '0')}:${String(icSecs).padStart(2, '0')}`
        };
    }

    function getLocalTime() {
        const now = new Date();
        return {
            hours: now.getHours(),
            minutes: now.getMinutes(),
            seconds: now.getSeconds(),
            formattedTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
            formattedFull: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
        };
    }

    function updateLiveClocks() {
        const ic = getICTime();
        const local = getLocalTime();

        const bigClockEl = document.getElementById('big-live-clock');
        if (bigClockEl) {
            bigClockEl.innerHTML = `
                <div class="hud-clock-group">
                    <div class="hud-clock-card ic-card" title="In-City Time (UTC+2)">
                        <div class="hud-clock-badge"><span class="material-symbols-outlined" style="font-size:0.85rem;">schedule</span> IC TIME</div>
                        <div class="hud-clock-digits ic-digits">${ic.formattedFull}</div>
                    </div>
                    <div class="hud-clock-card local-card" title="Local System Time">
                        <div class="hud-clock-badge"><span class="material-symbols-outlined" style="font-size:0.85rem;">public</span> LOCAL TIME</div>
                        <div class="hud-clock-digits local-digits">${local.formattedFull}</div>
                    </div>
                </div>
            `;
        }

        const bcLiveTime = document.getElementById('bc-live-time');
        if (bcLiveTime) bcLiveTime.textContent = `${ic.formattedTime} (IC) | ${local.formattedTime} (Local)`;

        if (state.dutyStartTime) {
            updateShiftTimerDisplay();
        }
    }

    function calculateShiftBonus(elapsedHours, isNight) {
        const loc = state.selectedLocation || 'Patrol (Mission Row)';
        const rates = state.shiftRates;
        let baseRate = rates.dayPatrol;

        if (loc.includes('Highway') || loc.includes('SAHP')) {
            baseRate = isNight ? rates.nightHighway : rates.dayHighway;
        } else if (loc.includes('Detective')) {
            baseRate = isNight ? rates.nightDetective : rates.dayDetective;
        } else {
            baseRate = isNight ? rates.nightPatrol : rates.dayPatrol;
        }

        const hourlyPay = Math.round(elapsedHours * baseRate);
        const arrestBonus = (state.arrestsLogged || 0) * (rates.arrestBounty || 10000);
        const towBonus = (state.towsLogged || 0) * (rates.towingBounty || 5000);
        return hourlyPay + arrestBonus + towBonus;
    }

    function updateShiftTimerDisplay() {
        if (!state.dutyStartTime) return;
        const elapsedMs = Date.now() - state.dutyStartTime;
        const totalSecs = Math.floor(elapsedMs / 1000);
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;

        const mainTimerEl = document.getElementById('compact-main-timer');
        if (mainTimerEl) {
            mainTimerEl.textContent = `${hrs} hr ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }

        const ic = getICTime();
        const isNight = ic.hours >= 0 && ic.hours < 6;
        const nightIcon = document.getElementById('compact-night-icon');
        if (nightIcon) {
            nightIcon.classList.toggle('hidden', !isNight);
        }

        const elapsedHours = elapsedMs / (1000 * 60 * 60);
        const totalBonus = calculateShiftBonus(elapsedHours, isNight);

        const bonusValEl = document.getElementById('compact-bonus-val');
        if (bonusValEl) {
            bonusValEl.textContent = `$${totalBonus.toLocaleString()}`;
        }

        const rect = document.getElementById('progress-outline-rect');
        if (rect) {
            const offset = 1000 - Math.min(1000, (totalSecs % 3600) / 3.6);
            rect.style.strokeDashoffset = offset;
        }
    }

    function setDutyStatusUI(isOnDuty) {
        const dutyPill = document.getElementById('modal-duty-status-pill');
        const topDutyPill = document.getElementById('topbar-duty-status-pill');
        const topDutyText = document.getElementById('topbar-duty-status-text');

        if (dutyPill) {
            dutyPill.className = `duty-pill ${isOnDuty ? 'on-duty' : 'off-duty'}`;
            dutyPill.innerHTML = `<span class="pulse-dot"></span> <span class="duty-pill-text">${isOnDuty ? 'ON DUTY' : 'OFF DUTY'}</span>`;
        }

        if (topDutyPill) {
            topDutyPill.className = `topbar-duty-pill ${isOnDuty ? 'on-duty' : 'off-duty'}`;
        }
        if (topDutyText) {
            topDutyText.textContent = isOnDuty ? 'ON DUTY' : 'OFF DUTY';
        }
    }

    function toggleDutyStatus() {
        const isCurrentlyOnDuty = Boolean(state.dutyStartTime);
        if (isCurrentlyOnDuty) {
            if (confirm('End your active patrol shift and switch to OFF DUTY?')) {
                state.dutyStartTime = null;
                stateManager.save();
                playSound('playDutyChime');
                setDutyStatusUI(false);
            }
        } else {
            state.dutyStartTime = Date.now();
            stateManager.save();
            playSound('playDutyChime');
            setDutyStatusUI(true);
        }
    }

    function startShift(locName) {
        state.selectedLocation = locName || document.getElementById('rota-location')?.value || 'Patrol (Mission Row)';
        state.dutyStartTime = Date.now();
        stateManager.save();
        playSound('playDutyChime');
        setDutyStatusUI(true);
        updateShiftTimerDisplay();
    }

    function confirmEndShift() {
        state.dutyStartTime = null;
        stateManager.save();
        playSound('playDutyChime');
        setDutyStatusUI(false);
    }

    function showConfirmEndShift() {
        const compactView = document.getElementById('tb-compact-view');
        const confirmView = document.getElementById('tb-confirm-view');
        if (compactView) compactView.classList.add('hidden');
        if (confirmView) confirmView.classList.remove('hidden');
    }

    function cancelConfirmEndShift() {
        const compactView = document.getElementById('tb-compact-view');
        const confirmView = document.getElementById('tb-confirm-view');
        if (confirmView) confirmView.classList.add('hidden');
        if (compactView) compactView.classList.remove('hidden');
    }

    // -----------------------------------------------------
    // 6. ARREST 25-MINUTE TIMER SYSTEM
    // -----------------------------------------------------
    const ARREST_TOTAL_SECONDS = 25 * 60; // 1500 seconds
    let arrestTimerState = {
        secondsLeft: ARREST_TOTAL_SECONDS,
        isRunning: false,
        isPaused: false,
        interval: null,
        suspectName: ''
    };

    let lawyerSubtimers = {
        private: { secondsLeft: 15 * 60, interval: null, isRunning: false },
        stateCall: { secondsLeft: 2 * 60, interval: null, isRunning: false },
        bodycam: { secondsLeft: 10 * 60, interval: null, isRunning: false }
    };

    function startArrestTimer() {
        if (arrestTimerState.isRunning && !arrestTimerState.isPaused) return;

        playSound('playDutyChime');
        arrestTimerState.isRunning = true;
        arrestTimerState.isPaused = false;

        clearInterval(arrestTimerState.interval);
        arrestTimerState.interval = setInterval(() => {
            if (arrestTimerState.secondsLeft > 0) {
                arrestTimerState.secondsLeft--;
                updateArrestTimerUI();

                if (arrestTimerState.secondsLeft === 300) {
                    playSound('playTimerWarning');
                }
                if (arrestTimerState.secondsLeft === 60) {
                    playSound('playEmergencyAlert');
                }
            } else {
                clearInterval(arrestTimerState.interval);
                arrestTimerState.isRunning = false;
                playSound('playEmergencyAlert');
                alert('🚨 ARREST TIMER EXPIRED! 25-Minute custody limit reached.');
                updateArrestTimerUI();
            }
        }, 1000);

        updateArrestTimerUI();
    }

    function pauseArrestTimerForLawyer() {
        if (!arrestTimerState.isRunning) return;
        arrestTimerState.isPaused = true;
        clearInterval(arrestTimerState.interval);
        playSound('playRadioClick');
        updateArrestTimerUI();
    }

    function resetArrestTimer() {
        clearInterval(arrestTimerState.interval);
        arrestTimerState.secondsLeft = ARREST_TOTAL_SECONDS;
        arrestTimerState.isRunning = false;
        arrestTimerState.isPaused = false;
        playSound('playRadioClick');
        updateArrestTimerUI();
    }

    function updateArrestTimerUI() {
        const mins = Math.floor(arrestTimerState.secondsLeft / 60);
        const secs = arrestTimerState.secondsLeft % 60;
        const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        // Top bar compact arrest pill (if present)
        const pillVal = document.getElementById('compact-arrest-val');
        if (pillVal) pillVal.textContent = formatted;

        // Floating Tactical Dock badge
        const dockBadge = document.getElementById('dock-arrest-val');
        if (dockBadge) {
            dockBadge.textContent = formatted;
            if (arrestTimerState.isRunning || arrestTimerState.isPaused) {
                dockBadge.classList.remove('hidden');
                dockBadge.style.background = arrestTimerState.isPaused ? '#f59e0b' : (arrestTimerState.secondsLeft <= 300 ? '#ef4444' : '#10b981');
            } else {
                dockBadge.classList.add('hidden');
            }
        }

        // Modal countdown display
        const modalCountdown = document.getElementById('arrest-modal-countdown');
        if (modalCountdown) {
            modalCountdown.textContent = formatted;
            if (arrestTimerState.secondsLeft <= 300) {
                modalCountdown.style.color = '#ef4444';
            } else if (arrestTimerState.isPaused) {
                modalCountdown.style.color = '#f59e0b';
            } else {
                modalCountdown.style.color = '#f8fafc';
            }
        }

        // Status text
        const statusText = document.getElementById('arrest-timer-status-text');
        if (statusText) {
            if (arrestTimerState.isPaused) {
                statusText.innerHTML = '<span style="color:#f59e0b;">⏸ PAUSED (LAWYER REQUESTED)</span>';
            } else if (arrestTimerState.isRunning) {
                statusText.innerHTML = '<span style="color:#10b981;">▶ DETENTION TIMER ACTIVE</span>';
            } else {
                statusText.innerHTML = '<span style="color:var(--text-muted);">STANDBY (25 MINUTE LIMIT)</span>';
            }
        }

        // SVG progress circle
        const progressCircle = document.getElementById('timer-progress-circle');
        if (progressCircle) {
            const circumference = 2 * Math.PI * 75; // r=75 -> ~471
            const offset = circumference - (arrestTimerState.secondsLeft / ARREST_TOTAL_SECONDS) * circumference;
            progressCircle.style.strokeDashoffset = offset;
            if (arrestTimerState.secondsLeft <= 300) {
                progressCircle.style.stroke = '#ef4444';
            } else if (arrestTimerState.isPaused) {
                progressCircle.style.stroke = '#f59e0b';
            } else {
                progressCircle.style.stroke = '#38bdf8';
            }
        }
    }

    function startSubTimer(key, totalSecs, elementId) {
        clearInterval(lawyerSubtimers[key].interval);
        lawyerSubtimers[key].secondsLeft = totalSecs;
        lawyerSubtimers[key].isRunning = true;
        playSound('playRadioClick');

        lawyerSubtimers[key].interval = setInterval(() => {
            if (lawyerSubtimers[key].secondsLeft > 0) {
                lawyerSubtimers[key].secondsLeft--;
                const m = Math.floor(lawyerSubtimers[key].secondsLeft / 60);
                const s = lawyerSubtimers[key].secondsLeft % 60;
                const el = document.getElementById(elementId);
                if (el) el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            } else {
                clearInterval(lawyerSubtimers[key].interval);
                lawyerSubtimers[key].isRunning = false;
                playSound('playTimerWarning');
                const el = document.getElementById(elementId);
                if (el) el.textContent = '00:00 EXPIRED';
            }
        }, 1000);
    }

    // -----------------------------------------------------
    // 7. BODYCAM LOGS & STEP PROGRESSION
    // -----------------------------------------------------
    function copyTextToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return Promise.resolve();
    }

    function handleBodycamStepClick(btn) {
        const targetId = btn.getAttribute('data-target');
        const contentEl = document.getElementById(targetId);
        if (!contentEl) return;

        let textToCopy = contentEl.innerText.trim();

        copyTextToClipboard(textToCopy).then(() => {
            playSound('playCopyBeep');
            btn.classList.add('btn-success');
            setTimeout(() => btn.classList.remove('btn-success'), 1200);

            // Mark step as completed in state
            state.dutySteps[targetId] = true;
            stateManager.save();

            // Unlock next dependent step
            unlockNextStep(targetId);

            // If Discord action linked
            const discordKey = btn.getAttribute('data-discord-key');
            if (discordKey) {
                const cb = document.getElementById(`cb-${targetId}`);
                const useApp = cb ? cb.checked : true;
                openDiscordChannel(discordKey, useApp);
            }

            // Auto-set duty status when completing step 3
            if (targetId === 'od3') {
                state.dutyStartTime = Date.now();
                stateManager.save();
                setDutyStatusUI(true);
            }
            if (targetId === 'off3') {
                state.dutyStartTime = null;
                stateManager.save();
                setDutyStatusUI(false);
            }
        });
    }

    function unlockNextStep(completedStepId) {
        STEP_DEPENDENCIES.forEach(([prereq, next]) => {
            if (prereq === completedStepId) {
                const nextBtn = document.querySelector(`.copy-btn[data-target="${next}"]`);
                if (nextBtn) {
                    nextBtn.removeAttribute('disabled');
                    nextBtn.classList.add('pulse-unlock');
                    setTimeout(() => nextBtn.classList.remove('pulse-unlock'), 2000);
                }
            }
        });
    }

    function checkInitialStepStates() {
        STEP_DEPENDENCIES.forEach(([prereq, next]) => {
            const nextBtn = document.querySelector(`.copy-btn[data-target="${next}"]`);
            if (nextBtn) {
                if (state.dutySteps[prereq]) {
                    nextBtn.removeAttribute('disabled');
                } else {
                    nextBtn.setAttribute('disabled', 'true');
                }
            }
        });
    }

    // -----------------------------------------------------
    // 8. PENAL CODE MDT ENGINE & CHARGE CALCULATOR
    // -----------------------------------------------------
    let currentCategoryFilter = 'ALL';
    let searchQuery = '';

    function renderPenalCodes() {
        const container = document.getElementById('penal-table-body');
        const dataObj = window.SAHP_DATA || window.LSPD_DATA;
        if (!container || !dataObj || !dataObj.penalCodes) return;

        const codes = dataObj.penalCodes;
        const filtered = codes.filter(item => {
            const matchesCat = currentCategoryFilter === 'ALL' || item.category === currentCategoryFilter;
            const q = searchQuery.toLowerCase();
            const matchesQuery = !searchQuery ||
                item.code.toLowerCase().includes(q) ||
                item.title.toLowerCase().includes(q) ||
                item.remarks.toLowerCase().includes(q);
            return matchesCat && matchesQuery;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="padding: 2.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
                    <span class="material-symbols-outlined" style="font-size: 2.5rem; margin-bottom: 0.5rem; opacity: 0.5;">search_off</span><br>
                    No penal codes found matching "${searchQuery}"
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(item => {
            const isSelected = state.selectedCharges.some(c => c.code === item.code);
            return `
                <div class="penal-row ${isSelected ? 'selected' : ''}" onclick="window.app.toggleSelectCharge('${item.code}')">
                    <span class="penal-badge-code">${item.code}</span>
                    <span style="font-weight:600; color:var(--text-main);">${item.title}</span>
                    <span style="color:#34d399; font-weight:700;">${item.fine}</span>
                    <span style="color:#38bdf8;">${item.sentence}</span>
                    <span class="penal-badge-stars">${item.stars}</span>
                    <span>${item.noBail ? '<span class="penal-badge-bail-no">NO BAIL</span>' : '<span class="penal-badge-bail-yes">BAIL OK</span>'}</span>
                    <span>
                        <input type="checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); window.app.toggleSelectCharge('${item.code}')" style="cursor:pointer; accent-color:var(--secondary);">
                    </span>
                </div>
            `;
        }).join('');
    }

    function toggleSelectCharge(codeStr) {
        const dataObj = window.SAHP_DATA || window.LSPD_DATA;
        if (!dataObj || !dataObj.penalCodes) return;
        const codeObj = dataObj.penalCodes.find(c => c.code === codeStr);
        if (!codeObj) return;

        const idx = state.selectedCharges.findIndex(c => c.code === codeStr);
        if (idx !== -1) {
            state.selectedCharges.splice(idx, 1);
        } else {
            state.selectedCharges.push(codeObj);
        }

        stateManager.save();
        playSound('playRadioClick');
        renderPenalCodes();
        updateCitationSummary();
    }

    function clearSelectedCharges() {
        state.selectedCharges = [];
        stateManager.save();
        playSound('playRadioClick');
        renderPenalCodes();
        updateCitationSummary();
    }

    function updateCitationSummary() {
        const count = state.selectedCharges.length;
        let totalFine = 0;
        let totalMonths = 0;
        let maxStars = 0;
        let hasNoBail = false;
        let pdaTextList = [];

        state.selectedCharges.forEach(c => {
            totalFine += (c.fineAmount || 0);
            totalMonths += (c.sentenceMonths || 0);
            if ((c.starCount || 0) > maxStars) maxStars = c.starCount;
            if (c.noBail) hasNoBail = true;
            pdaTextList.push(`${c.code} ${c.title}`);
        });

        const fineEl = document.getElementById('stat-total-fine');
        if (fineEl) fineEl.textContent = `$${totalFine.toLocaleString()}`;

        const sentenceEl = document.getElementById('stat-total-sentence');
        if (sentenceEl) sentenceEl.textContent = totalMonths > 0 ? `${totalMonths} mo` : '-';

        const starsEl = document.getElementById('stat-max-stars');
        if (starsEl) starsEl.textContent = maxStars > 0 ? '⭐'.repeat(maxStars) : '-';

        const bailEl = document.getElementById('stat-bail-status');
        if (bailEl) {
            if (count === 0) {
                bailEl.textContent = '-';
                bailEl.className = 'citation-stat-val';
            } else if (hasNoBail) {
                bailEl.textContent = 'NO BAIL';
                bailEl.className = 'citation-stat-val nobail';
            } else {
                bailEl.textContent = 'ELIGIBLE';
                bailEl.className = 'citation-stat-val money';
            }
        }

        const pdaBox = document.getElementById('citation-pda-text');
        if (pdaBox) {
            pdaBox.textContent = pdaTextList.length > 0 ? pdaTextList.join(' | ') : 'Select one or more penal codes above to generate PDA citation charges...';
        }
    }

    function copyPdaCitation() {
        const pdaBox = document.getElementById('citation-pda-text');
        if (!pdaBox || state.selectedCharges.length === 0) {
            alert('Please select at least one charge from the Penal Code list first.');
            return;
        }

        copyTextToClipboard(pdaBox.textContent).then(() => {
            playSound('playCopyBeep');
            const btn = document.getElementById('btn-copy-pda');
            if (btn) {
                btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:0.95rem;">done</span> Copied to PDA!';
                setTimeout(() => {
                    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:0.95rem;">content_copy</span> Copy for PDA (J)';
                }, 1500);
            }
        });
    }

    // -----------------------------------------------------
    // 9. TRAFFIC CODES & IMPOUND MATRIX
    // -----------------------------------------------------
    function renderTrafficCodes() {
        const container = document.getElementById('traffic-table-body');
        const dataObj = window.SAHP_DATA || window.LSPD_DATA;
        if (!container || !dataObj || !dataObj.trafficCodes) return;

        const codes = dataObj.trafficCodes;
        container.innerHTML = codes.map(item => `
            <div class="penal-row" style="grid-template-columns: 110px 1fr 100px 80px 1fr;">
                <span class="penal-badge-code">${item.code}</span>
                <span style="font-weight:600; color:var(--text-main);">${item.title}</span>
                <span style="color:#34d399; font-weight:700;">${item.fine}</span>
                <span style="color:#38bdf8;">${item.sentence}</span>
                <span style="font-size:0.75rem; color:var(--text-muted);">${item.remarks || '-'}</span>
            </div>
        `).join('');
    }

    function calculateImpoundFee(val) {
        const numeric = parseFloat(String(val).replace(/[^\d.]/g, '')) || 0;
        const fee = Math.round(numeric * 0.10); // 10% fee matrix
        const out = document.getElementById('impound-fee-result');
        if (out) {
            out.textContent = `$${fee.toLocaleString()}`;
        }
    }

    // -----------------------------------------------------
    // 10. ARTICLE 7 PARKING REGULATIONS
    // -----------------------------------------------------
    function renderArticle7() {
        const container = document.getElementById('article7-cards-container');
        const dataObj = window.SAHP_DATA || window.LSPD_DATA;
        if (!container || !dataObj || !dataObj.article7) return;

        const locs = dataObj.article7.locations;
        container.innerHTML = locs.map(loc => `
            <div class="glass-section" style="padding: 0.9rem;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.4rem;">
                    <span style="font-weight:700; color:var(--secondary); font-family:'JetBrains Mono',monospace;">${loc.code}</span>
                    <span style="font-size:0.75rem; background:rgba(56,189,248,0.12); padding:2px 8px; border-radius:6px; color:#94a3b8;">${loc.area}</span>
                </div>
                <div style="font-size:0.95rem; font-weight:700; color:var(--text-main); margin-bottom:0.4rem;">${loc.name}</div>
                <div style="font-size:0.82rem; color:var(--text-muted); line-height:1.45;">${loc.rules}</div>
            </div>
        `).join('');
    }

    // -----------------------------------------------------
    // 11. DISCORD ACTIONS
    // -----------------------------------------------------
    function openDiscordChannel(channelKey, useApp = true) {
        const serverId = state.discordServerId || DEFAULT_DISCORD_SERVER_ID;
        const channelId = (state.discordChannels && state.discordChannels[channelKey] !== undefined)
            ? String(state.discordChannels[channelKey]).trim()
            : (DEFAULT_DISCORD_CHANNELS[channelKey] || '');

        if (!channelId) {
            alert(`Discord Channel ID for #${channelKey.toUpperCase()} is not configured in Settings.`);
            return;
        }

        if (useApp) {
            window.location.href = `discord://discord.com/channels/${serverId}/${channelId}`;
            setTimeout(() => {
                window.open(`https://discord.com/channels/${serverId}/${channelId}`, '_blank');
            }, 1200);
        } else {
            window.open(`https://discord.com/channels/${serverId}/${channelId}`, '_blank');
        }
    }

    // -----------------------------------------------------
    // 12. QUICK NOTEPAD AUTO-SAVE
    // -----------------------------------------------------
    function initNotepad() {
        const textarea = document.getElementById('quick-notes-textarea');
        if (!textarea) return;

        textarea.value = state.quickNotes || '';
        updateNotepadCounts();

        textarea.addEventListener('input', () => {
            state.quickNotes = textarea.value;
            stateManager.save();
            updateNotepadCounts();
        });
    }

    function updateNotepadCounts() {
        const textarea = document.getElementById('quick-notes-textarea');
        const countEl = document.getElementById('notes-char-count');
        if (!textarea || !countEl) return;

        const val = textarea.value;
        const chars = val.length;
        const lines = val ? val.split('\n').length : 0;
        countEl.textContent = `${chars} characters | ${lines} lines`;
    }

    function copyQuickNotes() {
        const textarea = document.getElementById('quick-notes-textarea');
        if (!textarea || !textarea.value) return;

        copyTextToClipboard(textarea.value).then(() => {
            playSound('playCopyBeep');
            alert('Notepad content copied to clipboard!');
        });
    }

    function clearQuickNotes() {
        if (!confirm('Are you sure you want to clear your Quick Notepad?')) return;
        const textarea = document.getElementById('quick-notes-textarea');
        if (textarea) textarea.value = '';
        state.quickNotes = '';
        stateManager.save();
        updateNotepadCounts();
    }

    // -----------------------------------------------------
    // 13. CONFIG BACKUP, EXPORT & IMPORT (EMS Format)
    // -----------------------------------------------------
    function exportDb() {
        const filename = (document.getElementById('export-filename-input')?.value.trim() || 'SAHP_Config') + '.txt';
        const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
        const a = document.createElement('a');
        a.href = dataStr;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        playSound('playDutyChime');
    }

    function handleImportDbFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const imported = JSON.parse(e.target.result);
                state = {
                    ...stateManager.getDefaultState(),
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
                stateManager.state = state;
                stateManager.save();
                playSound('playDutyChime');
                alert('Configuration successfully imported! Reloading...');
                location.reload();
            } catch (err) {
                alert('Invalid configuration file. Please verify JSON formatting.');
            }
        };
        reader.readAsText(file);
    }

    function saveCurrentAsDefault() {
        localStorage.setItem(DEFAULTS_STORAGE_KEY, JSON.stringify(state));
        playSound('playDutyChime');
        alert('Current configuration saved as your custom baseline defaults.');
        updateDefaultsBadge();
    }

    function resetToSavedDefaults() {
        const saved = localStorage.getItem(DEFAULTS_STORAGE_KEY);
        if (!saved) {
            alert('No saved baseline defaults found. Save your baseline first.');
            return;
        }
        if (!confirm('Restore your saved baseline defaults?')) return;
        state = JSON.parse(saved);
        stateManager.state = state;
        stateManager.save();
        alert('Restored baseline defaults!');
        location.reload();
    }

    function resetToFactoryDefaults() {
        if (!confirm('WARNING: Factory reset will wipe all custom configurations and return to default SAHP settings. Continue?')) return;
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(FALLBACK_STORAGE_KEY);
        localStorage.removeItem(DEFAULTS_STORAGE_KEY);
        alert('Factory reset complete.');
        location.reload();
    }

    function updateDefaultsBadge() {
        const badge = document.getElementById('user-defaults-status-badge');
        if (!badge) return;
        const hasSaved = !!localStorage.getItem(DEFAULTS_STORAGE_KEY);
        badge.textContent = hasSaved ? 'Custom Baseline Set' : 'No Baseline Set';
        badge.style.color = hasSaved ? '#34d399' : '#fbbf24';
    }

    // -----------------------------------------------------
    // 14. BOOT ANIMATION & INITIALIZATION
    // -----------------------------------------------------
    function initBootScreen() {
        const splash = document.getElementById('ai-splash-screen');
        if (!splash) return;

        // Skip boot screen check
        if (state.showBootScreen === false) {
            splash.style.display = 'none';
            splash.remove();
            return;
        }

        const fill = document.getElementById('splash-progress-fill');
        const text = document.getElementById('splash-status-text');
        const logs = document.getElementById('splash-logs');

        const steps = [
            { pct: 20, text: 'LOADING SAHP CAD / MDT DATABASE...', log: '> HIGHWAY PATROL CAD DATABASE: [ MOUNTED ]' },
            { pct: 50, text: 'FETCHING PENAL & TRAFFIC CODES...', log: '> EN3 PATROLMAN GUIDE: [ VERIFIED ]' },
            { pct: 80, text: 'INITIALIZING 25-MIN ARREST ENGINE...', log: '> DETENTION PROTOCOLS: [ ARMED ]' },
            { pct: 100, text: 'SYSTEM READY. WELCOME TROOPER.', log: '> DISPATCH LINK: [ ONLINE ]' }
        ];

        let i = 0;
        const interval = setInterval(() => {
            if (i < steps.length) {
                if (fill) fill.style.width = `${steps[i].pct}%`;
                if (text) text.textContent = steps[i].text;
                if (logs) {
                    const div = document.createElement('div');
                    div.textContent = steps[i].log;
                    logs.appendChild(div);
                }
                i++;
            } else {
                clearInterval(interval);
                setTimeout(() => {
                    splash.classList.add('fade-out');
                    playSound('playDutyChime');
                }, 350);
            }
        }, 300);
    }

    // -----------------------------------------------------
    // 15. GLOBAL EXPOSURE & EVENT BINDINGS
    // -----------------------------------------------------
    window.app = {
        state,
        stateManager,
        toggleDutyStatus,
        toggleAudio,
        startShift,
        confirmEndShift,
        showConfirmEndShift,
        cancelConfirmEndShift,
        handleBodycamStepClick,
        startArrestTimer,
        pauseArrestTimerForLawyer,
        resetArrestTimer,
        startSubTimer,
        toggleSelectCharge,
        clearSelectedCharges,
        copyPdaCitation,
        calculateImpoundFee,
        openDiscordChannel,
        copyQuickNotes,
        clearQuickNotes,
        exportDb,
        handleImportDbFile,
        saveCurrentAsDefault,
        resetToSavedDefaults,
        resetToFactoryDefaults
    };

    document.addEventListener('DOMContentLoaded', () => {
        initBootScreen();
        syncStateToUI();
        bindSettingsEvents();
        initNotepad();
        renderPenalCodes();
        renderTrafficCodes();
        renderArticle7();
        updateCitationSummary();
        updateDefaultsBadge();

        // Update live clocks every 500ms
        setInterval(updateLiveClocks, 500);
        updateLiveClocks();

        // Setup import file listener
        const importInput = document.getElementById('import-db-file');
        if (importInput) {
            importInput.addEventListener('change', handleImportDbFile);
        }

        // Search penal codes listener
        const searchInput = document.getElementById('penal-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.trim();
                renderPenalCodes();
            });
        }
    });

})();

// -----------------------------------------------------
// 16. MODAL HELPERS & GLOBAL UI EVENT WRAPPERS
// -----------------------------------------------------
function openModal(modalId) {
    const overlay = document.getElementById('modalOverlay');
    const modal = document.getElementById(modalId);
    if (!overlay || !modal) return;

    if (window.soundSystem && (!window.app || window.app.state.soundEnabled !== false)) {
        window.soundSystem.playRadioClick();
    }
    overlay.classList.add('active');
    modal.classList.add('active');
}

function closeModals() {
    const overlay = document.getElementById('modalOverlay');
    if (!overlay) return;

    if (window.soundSystem && (!window.app || window.app.state.soundEnabled !== false)) {
        window.soundSystem.playRadioClick();
    }
    overlay.classList.remove('active');
    document.querySelectorAll('.modal-content').forEach(m => m.classList.remove('active'));
}

function switchTab(btn, tabId) {
    const parentHeader = btn.parentElement;
    parentHeader.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const modalBody = parentHeader.nextElementSibling;
    modalBody.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.add('active');
    if (window.soundSystem && (!window.app || window.app.state.soundEnabled !== false)) {
        window.soundSystem.playRadioClick();
    }
}

function switchRadioTab(tabId) {
    document.querySelectorAll('#modal-radio .tab-content').forEach(c => c.classList.remove('active'));
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');
    if (window.soundSystem && (!window.app || window.app.state.soundEnabled !== false)) {
        window.soundSystem.playRadioClick();
    }
}

function switchDeptTab(tabId) {
    document.querySelectorAll('.dept-chip').forEach(c => c.classList.remove('active'));
    const chip = document.querySelector(`.dept-chip[data-dept-tab="${tabId}"]`);
    if (chip) chip.classList.add('active');

    document.querySelectorAll('.dept-tab-content').forEach(c => c.classList.remove('active'));
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');
    if (window.soundSystem && (!window.app || window.app.state.soundEnabled !== false)) {
        window.soundSystem.playRadioClick();
    }
}

function filterPenalCategory(chip, categoryName) {
    document.querySelectorAll('.penal-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    const container = document.getElementById('penal-table-body');
    const dataObj = window.SAHP_DATA || window.LSPD_DATA;
    if (!container || !dataObj || !dataObj.penalCodes) return;

    const codes = dataObj.penalCodes;
    const q = (document.getElementById('penal-search-input')?.value || '').toLowerCase().trim();
    const filtered = codes.filter(item => {
        const matchesCat = categoryName === 'ALL' || item.category === categoryName;
        const matchesQuery = !q ||
            item.code.toLowerCase().includes(q) ||
            item.title.toLowerCase().includes(q) ||
            item.remarks.toLowerCase().includes(q);
        return matchesCat && matchesQuery;
    });

    container.innerHTML = filtered.map(item => {
        const isSelected = window.app && window.app.state.selectedCharges.some(c => c.code === item.code);
        return `
            <div class="penal-row ${isSelected ? 'selected' : ''}" onclick="window.app.toggleSelectCharge('${item.code}')">
                <span class="penal-badge-code">${item.code}</span>
                <span style="font-weight:600; color:var(--text-main);">${item.title}</span>
                <span style="color:#34d399; font-weight:700;">${item.fine}</span>
                <span style="color:#38bdf8;">${item.sentence}</span>
                <span class="penal-badge-stars">${item.stars}</span>
                <span>${item.noBail ? '<span class="penal-badge-bail-no">NO BAIL</span>' : '<span class="penal-badge-bail-yes">BAIL OK</span>'}</span>
                <span>
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); window.app.toggleSelectCharge('${item.code}')" style="cursor:pointer; accent-color:var(--secondary);">
                </span>
            </div>
        `;
    }).join('');

    if (window.soundSystem && (!window.app || window.app.state.soundEnabled !== false)) {
        window.soundSystem.playRadioClick();
    }
}

function filterDresscodes(btn, category) {
    document.querySelectorAll('.dresscode-rank-chip').forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const cards = document.querySelectorAll('.dresscode-card');
    cards.forEach(card => {
        const tier = card.getAttribute('data-tier') || '';
        if (category === 'ALL' || tier === category) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
    if (window.soundSystem && (!window.app || window.app.state.soundEnabled !== false)) {
        window.soundSystem.playRadioClick();
    }
}

function searchDresscodes(query) {
    const q = (query || '').toLowerCase().trim();
    const cards = document.querySelectorAll('.dresscode-card');
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        if (!q || text.includes(q)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

function copySimple(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
    }
    if (window.soundSystem && (!window.app || window.app.state.soundEnabled !== false)) {
        window.soundSystem.playCopyBeep();
    }
}

function openAboutTeam() {
    const page = document.getElementById('about-team-page');
    if (page) {
        page.classList.remove('hidden');
        if (window.soundSystem && (!window.app || window.app.state.soundEnabled !== false)) {
            window.soundSystem.playDutyChime();
        }
    }
}

function closeAboutTeam() {
    const page = document.getElementById('about-team-page');
    if (page) {
        page.classList.add('hidden');
        if (window.soundSystem && (!window.app || window.app.state.soundEnabled !== false)) {
            window.soundSystem.playRadioClick();
        }
    }
}

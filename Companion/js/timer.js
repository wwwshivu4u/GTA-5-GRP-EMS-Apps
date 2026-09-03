/**
 * EMS Companion - Shift & Duty Timer Engine
 */

import { stateManager } from './state.js';
import { sound } from './audio.js';

export class TimerEngine {
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
        this.initClocks();
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

            // Big Clock
            const bigClockEl = document.getElementById('big-live-clock');
            if (bigClockEl) {
                bigClockEl.innerHTML = `
                    <span class="ic-time">${edinH}:${edinM}:${edinS} <small style="font-size:0.65em; opacity:0.8;">(IC)</small></span>
                    <span class="local-time" style="font-size: 0.8rem; color: var(--text-muted);">${userH}:${userM}:${userS} <small>(Local)</small></span>
                `;
            }

            // Bodycam Modal Live Time
            const bcLiveTimeEl = document.getElementById('bc-live-time');
            if (bcLiveTimeEl) {
                bcLiveTimeEl.textContent = `${edinH}:${edinM} (IC) | ${userH}:${userM} (Local)`;
            }

            // Step 4 Live Times (Bodycam On & Off Duty)
            const od4ClockEl = document.getElementById('od4-clock-time');
            if (od4ClockEl) od4ClockEl.textContent = `${edinH}:${edinM}`;
            const off4ClockEl = document.getElementById('off4-clock-time');
            if (off4ClockEl) off4ClockEl.textContent = `${edinH}:${edinM}`;

            const od4Content = document.getElementById('od4');
            if (od4Content && !od4Content.dataset.customEdited && document.activeElement !== od4Content) {
                od4Content.innerText = `On duty : ${edinH}:${edinM}`;
            }
            const off4Content = document.getElementById('off4');
            if (off4Content && !off4Content.dataset.customEdited && document.activeElement !== off4Content) {
                off4Content.innerText = `Off duty : ${edinH}:${edinM}`;
            }

            // Labtech Rota Live Date
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

            // Hourly reminder chime
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
                    <div style="font-size: 1.3rem; line-height: 1; margin-bottom: 2px;">🌙</div>
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
                        <div style="font-size: 1.3rem; line-height: 1; margin-bottom: 2px;">☀️</div>
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
        toast.className = 'hourly-bonus-toast';
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
        toast.innerHTML = `🎉 Completed ${hoursCompleted} hr(s) on ${loc}!<br><span style="font-size:1.15rem; color:#fef08a;">Earned so far: $${bonus.toLocaleString()}</span>`;
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

            window.openModal?.('sub-rota');
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
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
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

export const timerEngine = new TimerEngine();

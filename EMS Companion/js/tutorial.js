/**
 * EMS Companion - Interactive Tutorial Walkthrough
 */

import { modalManager } from './modals.js';
import { stateManager } from './state.js';
import { timerEngine } from './timer.js';

export class TutorialService {
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

export const tutorialService = new TutorialService();

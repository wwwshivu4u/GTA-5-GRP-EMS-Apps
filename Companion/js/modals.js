/**
 * EMS Companion - Modal & Tab Manager
 */

export class ModalManager {
    constructor() {
        this.overlay = null;
        this.activeModal = null;
        this.init();
    }

    init() {
        this.overlay = document.getElementById('modalOverlay');
        if (!this.overlay) return;

        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.closeAll();
            }
        });

        document.addEventListener('contextmenu', (e) => {
            if (this.overlay && this.overlay.classList.contains('active')) {
                e.preventDefault();
                this.closeAll();
            }
        });

        // Tab button click listeners
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
        if (modal) {
            modal.classList.add('active');
            this.activeModal = modal;
        }

        if (modalId === 'modal-discord-bodycam') {
            const bcStatus = document.getElementById('bc-status');
            if (bcStatus && window.stateManager) {
                bcStatus.value = window.stateManager.state.bcStatus || 'On duty';
            }
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
        this.activeModal = null;
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
            void modal.offsetWidth; // Force reflow
            modal.classList.add('modal-glow-anim');
        }
    }
}

export const modalManager = new ModalManager();

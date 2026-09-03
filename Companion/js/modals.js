/**
 * EMS Companion - Modal & Tab Manager
 */

export class ModalManager {
    constructor() {
        this.overlay = null;
        this.activeModal = null;
        this.modalBehindNotes = null;
        this.closeTimeout = null;
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
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay && this.overlay.classList.contains('active')) {
                this.closeAll();
            }
        });
    }

    open(modalId) {
        if (this.closeTimeout) {
            clearTimeout(this.closeTimeout);
            this.closeTimeout = null;
        }

        if (!this.overlay) this.overlay = document.getElementById('modalOverlay');
        if (this.overlay) {
            this.overlay.classList.remove('closing');
            this.overlay.classList.add('active');
        }

        if (modalId === 'modal-notes') {
            const currentActive = (this.activeModal && this.activeModal.id !== 'modal-notes')
                ? this.activeModal
                : document.querySelector('.modal-content.active:not(#modal-notes)');
            if (currentActive) {
                this.modalBehindNotes = currentActive;
                currentActive.classList.add('in-background');
            }
            document.querySelectorAll('.modal-content').forEach(m => {
                if (m.id !== modalId && m !== this.modalBehindNotes) {
                    m.classList.remove('active', 'closing', 'in-background');
                }
            });
        } else {
            if (this.modalBehindNotes) {
                this.modalBehindNotes.classList.remove('in-background');
                this.modalBehindNotes = null;
            }
            document.querySelectorAll('.modal-content').forEach(m => {
                if (m.id !== modalId) {
                    m.classList.remove('active', 'closing', 'in-background');
                }
            });
        }

        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('closing', 'in-background');
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
        document.querySelectorAll('.modal-content:not(.sub-modal)').forEach(m => m.classList.remove('active', 'closing'));
        const sm = document.getElementById(subModalId);
        if (sm) {
            sm.classList.remove('closing');
            sm.classList.add('active');
        }
    }

    closeSubModal() {
        const activeSubs = document.querySelectorAll('.sub-modal.active');
        activeSubs.forEach(sm => sm.classList.add('closing'));

        setTimeout(() => {
            activeSubs.forEach(sm => sm.classList.remove('active', 'closing'));
            const dm = document.getElementById('modal-discord');
            if (dm) {
                dm.classList.remove('closing');
                dm.classList.add('active');
            }
        }, 220);
    }

    closeAll() {
        if (!this.overlay) this.overlay = document.getElementById('modalOverlay');
        if (!this.overlay || !this.overlay.classList.contains('active')) return;

        // If Quick Notes is open above a background modal, close only Quick Notes and restore background modal
        const notesModal = document.getElementById('modal-notes');
        if (notesModal && notesModal.classList.contains('active') && this.modalBehindNotes) {
            notesModal.classList.add('closing');
            const bgModal = this.modalBehindNotes;
            this.modalBehindNotes = null;

            setTimeout(() => {
                notesModal.classList.remove('active', 'closing');
                if (bgModal) {
                    bgModal.classList.remove('in-background');
                    this.activeModal = bgModal;
                }
            }, 200);
            return;
        }

        const activeModals = document.querySelectorAll('.modal-content.active, .sub-modal.active');
        if (activeModals.length === 0) {
            this.overlay.classList.remove('active', 'closing');
            return;
        }

        this.overlay.classList.add('closing');
        activeModals.forEach(m => m.classList.add('closing'));

        if (this.closeTimeout) clearTimeout(this.closeTimeout);
        this.closeTimeout = setTimeout(() => {
            if (this.overlay) {
                this.overlay.classList.remove('active', 'closing');
            }
            activeModals.forEach(m => m.classList.remove('active', 'closing', 'in-background'));
            this.activeModal = null;
            this.modalBehindNotes = null;
            this.closeTimeout = null;
        }, 230);
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

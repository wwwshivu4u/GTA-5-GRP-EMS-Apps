document.addEventListener('DOMContentLoaded', () => {

    // ==========================================================================
    // CLOCK & DATE
    // ==========================================================================
    function updateClock() {
        const now = new Date();
        const timeEl = document.getElementById('clock-time');
        const dateEl = document.getElementById('clock-date');
        
        if(timeEl) {
            timeEl.textContent = now.toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
        
        if(dateEl) {
            dateEl.textContent = now.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            }).toUpperCase();
        }
    }
    
    setInterval(updateClock, 1000);
    updateClock();

    // ==========================================================================
    // STATE MANAGEMENT
    // ==========================================================================
    let state = {
        name: '',
        id: '',
        plate: '',
        location: '',
        replacement: ''
    };

    function saveState() {
        localStorage.setItem('shiftGuideState', JSON.stringify(state));
    }

    function loadState() {
        const saved = localStorage.getItem('shiftGuideState');
        if (saved) {
            try {
                state = { ...state, ...JSON.parse(saved) };
            } catch(e) { console.error(e); }
        }
        updatePreviews();
    }

    // ==========================================================================
    // DYNAMIC VARIABLES & COPY SYSTEM
    // ==========================================================================
    const inputs = {
        name: document.getElementById('start-name'),
        id: document.getElementById('start-id'),
        plate: document.getElementById('start-vehicle-plate'),
        location: document.getElementById('top-location-select'),
        replacement: document.getElementById('replacement-input')
    };

    // Store templates
    document.querySelectorAll('.copy-content').forEach(el => {
        if(!el.dataset.template) {
            el.dataset.template = el.innerText;
        }
    });

    function updatePreviews() {
        // Sync inputs with state
        if(inputs.name && inputs.name.value !== state.name) inputs.name.value = state.name;
        if(inputs.id && inputs.id.value !== state.id) inputs.id.value = state.id;
        if(inputs.plate && inputs.plate.value !== state.plate) inputs.plate.value = state.plate;
        if(inputs.location && inputs.location.value !== state.location) inputs.location.value = state.location;
        if(inputs.replacement && inputs.replacement.value !== state.replacement) inputs.replacement.value = state.replacement;

        const name = state.name || '[Name]';
        const id = state.id || '[ID]';
        const plate = state.plate || '[Plate]';
        const loc = state.location || '[Location]';
        const rep = state.replacement || '[Replacement]';

        document.querySelectorAll('.copy-content').forEach(el => {
            let text = el.dataset.template;
            text = text.replace(/{NAME}/g, name);
            text = text.replace(/{ID}/g, id);
            text = text.replace(/{PLATE}/g, plate);
            text = text.replace(/{LOC}/g, loc);
            text = text.replace(/{REP}/g, rep);
            el.innerText = text;
        });
    }

    // Listeners for inputs
    Object.keys(inputs).forEach(key => {
        if(inputs[key]) {
            inputs[key].addEventListener('input', (e) => {
                state[key] = e.target.value;
                saveState();
                updatePreviews();
            });
        }
    });

    // Copy Buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                const text = targetEl.innerText;
                navigator.clipboard.writeText(text).then(() => {
                    const originalText = btn.innerText;
                    btn.innerText = 'COPIED!';
                    btn.classList.add('copied');
                    setTimeout(() => {
                        btn.innerText = originalText;
                        btn.classList.remove('copied');
                    }, 2000);
                });
            }
        });
    });

    // ==========================================================================
    // WIZARD NAVIGATION
    // ==========================================================================
    function setupWizard(prefix, maxSteps) {
        let currentStepIndex = 1;
        const wizardContainer = document.getElementById(`${prefix}-day-wizard`);

        function updateSlider() {
            if(wizardContainer) {
                const translatePercentage = -(currentStepIndex - 1) * 100;
                wizardContainer.style.transform = `translateX(${translatePercentage}%)`;
            }
        }

        for(let i=1; i<=maxSteps; i++) {
            const currentStep = document.querySelector(`#${prefix}-day-wizard .wizard-step[data-step="${i}"]`);
            if(!currentStep) continue;
            
            const nextBtn = currentStep.querySelector('.step-next-btn') || currentStep.querySelector('.btn-primary');
            if(nextBtn) {
                nextBtn.addEventListener('click', () => {
                    currentStep.classList.remove('active');
                    currentStep.classList.add('completed');
                    
                    if(i < maxSteps) {
                        currentStepIndex++;
                        updateSlider();
                        const nextStep = document.querySelector(`#${prefix}-day-wizard .wizard-step[data-step="${currentStepIndex}"]`);
                        if(nextStep) {
                            nextStep.classList.remove('locked');
                            nextStep.classList.add('active');
                        }
                    } else {
                        if (prefix === 'start') {
                            alert("Shift Started successfully!");
                        } else if (prefix === 'end') {
                            alert("Shift Ended successfully!");
                        }
                    }
                });
            }
            
            const prevBtn = currentStep.querySelector('.step-prev-btn');
            if(prevBtn) {
                prevBtn.addEventListener('click', () => {
                    if(currentStepIndex > 1) {
                        currentStepIndex--;
                        updateSlider();
                    }
                });
            }
        }
    }

    setupWizard('start', 5);
    setupWizard('end', 4);

    // ==========================================================================
    // TABS LOGIC
    // ==========================================================================
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const parent = btn.closest('.glass-card') || document;
            
            parent.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
            parent.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const target = document.getElementById(targetId);
            if(target) target.classList.add('active');
        });
    });

    // ==========================================================================
    // ACCORDION
    // ==========================================================================
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const box = header.parentElement;
            box.classList.toggle('active');
        });
    });

    // ==========================================================================
    // MODALS
    // ==========================================================================
    window.openModal = function(id) {
        const modal = document.getElementById(id);
        const overlay = document.getElementById('modalOverlay');
        if(modal && overlay) {
            overlay.classList.add('active');
            modal.classList.add('active');
        }
    }

    window.closeModal = function() {
        const overlay = document.getElementById('modalOverlay');
        if(overlay) overlay.classList.remove('active');
        document.querySelectorAll('.modal-content').forEach(m => m.classList.remove('active'));
    }
    
    const overlay = document.getElementById('modalOverlay');
    if(overlay) {
        overlay.addEventListener('click', (e) => {
            if(e.target === overlay) {
                closeModal();
            }
        });
    }

    // Initialize
    loadState();
});

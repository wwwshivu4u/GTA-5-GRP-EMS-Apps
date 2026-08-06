document.addEventListener('DOMContentLoaded', () => {
    // -----------------------------------------------------
    // MODAL LOGIC
    // -----------------------------------------------------
    const overlay = document.getElementById('modalOverlay');
    const modals = document.querySelectorAll('.modal-content:not(.sub-modal)');
    const subModals = document.querySelectorAll('.sub-modal');

    window.openModal = (modalId) => {
        closeModals(); 
        overlay.classList.add('active');
        const m = document.getElementById(modalId);
        if (m) m.classList.add('active');

        if (modalId === 'modal-discord-bodycam' && window.fillBodycamDiscordForm) {
            // Default, overridden immediately in the setTimeout calls
            window.fillBodycamDiscordForm('Off duty');
        }
    };

    window.closeModals = () => {
        overlay.classList.remove('active');
        modals.forEach(m => m.classList.remove('active'));
        subModals.forEach(m => m.classList.remove('active'));
    };

    window.openSubModal = (subModalId) => {
        modals.forEach(m => m.classList.remove('active'));
        const sm = document.getElementById(subModalId);
        if (sm) sm.classList.add('active');
    };

    window.closeSubModal = () => {
        subModals.forEach(m => m.classList.remove('active'));
        const dm = document.getElementById('modal-discord');
        if (dm) dm.classList.add('active');
    };

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModals();
    });

    document.addEventListener('contextmenu', (e) => {
        if (overlay.classList.contains('active')) {
            e.preventDefault(); 
            closeModals();
        }
    });

    // -----------------------------------------------------
    // TABS LOGIC
    // -----------------------------------------------------
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            // Remove active from all tab buttons
            const tabGroup = btn.closest('.tabs-header');
            if (tabGroup) {
                tabGroup.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            }
            // Remove active from all tab contents
            const tabsBody = btn.closest('.modal-content').querySelector('.tabs-body');
            if (tabsBody) {
                tabsBody.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            }
            
            // Add active to clicked tab
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            const targetContent = document.getElementById(tabId);
            if(targetContent) targetContent.classList.add('active');
        });
    });

    // -----------------------------------------------------
    // STATE MANAGEMENT (Settings & Tasks)
    // -----------------------------------------------------
    let state = {
        discordServerId: '1035903890996080811',
        discordChannels: {
            bodycam: '1035903894049542188',
            codea: '1035903894049542185',
            break: '1035903894049542184',
            supplies: '1035903894049542186',
            rota: '1081157781530357771',
            captcha: '1151594608460038245',
            deliveries: '1035903894049542187',
            radiocodes: '1035903894552850452',
            replacementlogs: '1035903893772710037'
        },
        name: '',
        id: '',
        dutySteps: { od1: false, od2: false, od3: false, ref1: false, ref2: false, sav1: false, sav2: false, off1: false, off2: false, off3: false, sw1_1: false, sw1_2: false, sw1_3: false, sw1_4: false, sw1_5: false, sw1_6: false, sw1_7: false, sw2_1: false, sw2_2: false, sw2_3: false, sw2_4: false, sw2_5: false, sw3_1: false, sw3_2: false, sw3_3: false, sw3_4: false, sw3_5: false },
        dutyStartTime: null,
        rotaCap: 0,
        rotaDel: 0,
        customCommands: {},
        userAddedCommands: [],
        userDefaults: {},
        deletedCommands: [],
        customTitles: {},
        lastProfileVerifyDate: null,
        selectedSubDept: 'HS'
    };

    function saveState() {
        localStorage.setItem('emsSettings', JSON.stringify(state));
    }

    // Load state from localStorage
    function loadState() {
        const saved = localStorage.getItem('emsSettings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const mergedDiscordChannels = { ...state.discordChannels, ...(parsed.discordChannels || {}) };
                state = { ...state, ...parsed };
                state.discordChannels = mergedDiscordChannels;
                
                if (!state.dutySteps) state.dutySteps = {};
                ['od1','od2','od3','ref1','ref2','sav1','sav2','off1','off2','off3', 'sw1_1','sw1_2','sw1_3','sw1_4','sw1_5','sw2_1','sw2_2','sw2_3','sw2_4','sw2_5', 'sw3_1','sw3_2','sw3_3','sw3_4','sw3_5'].forEach(step => {
                    if (typeof state.dutySteps[step] === 'undefined') state.dutySteps[step] = false;
                });
                if (!state.customCommands) state.customCommands = {};
            } catch(e) { console.error('Failed to parse settings'); }
        }
        
        if (state.userDefaults) {
            document.querySelectorAll('.copy-content').forEach(el => {
                const targetId = el.id;
                if (state.userDefaults[targetId]) {
                    el.dataset.originalTemplate = state.userDefaults[targetId];
                    el.dataset.template = state.userDefaults[targetId];
                }
            });
        }

        if (state.userAddedCommands && state.userAddedCommands.length > 0) {
            state.userAddedCommands.forEach(cmd => {
                const body = document.querySelector(`.section-body[data-sec-index="${cmd.secIndex}"]`);
                if (body && !document.getElementById(cmd.id)) {
                    const newBlock = document.createElement('div');
                    newBlock.className = 'copy-block';
                    const titleText = state.customTitles && state.customTitles[cmd.id] ? state.customTitles[cmd.id] : (cmd.title || 'Custom Command');
                    newBlock.innerHTML = `
                        <div class="copy-header"><span contenteditable="true" style="outline: none; border-bottom: 1px dashed rgba(255, 255, 255, 0.3);">${titleText}</span><div style="display: flex; gap: 0.25rem;"><button class="btn copy-btn" data-target="${cmd.id}">📋</button><button class="btn btn-delete" data-target="${cmd.id}" title="Hold for 3 seconds to delete">❌</button></div></div>
                        <div class="copy-content" id="${cmd.id}" contenteditable="true">${cmd.template}</div>
                    `;
                    const addBtnContainer = body.querySelector('.btn-add-cmd-container');
                    if (addBtnContainer) addBtnContainer.before(newBlock);
                    else body.appendChild(newBlock);
                    
                    const editable = newBlock.querySelector('.copy-content');
                    editable.dataset.originalTemplate = state.userDefaults && state.userDefaults[cmd.id] ? state.userDefaults[cmd.id] : cmd.template;
                    editable.dataset.template = state.userDefaults && state.userDefaults[cmd.id] ? state.userDefaults[cmd.id] : cmd.template;
                    
                    if (window.attachBlurEvent) window.attachBlurEvent(editable);
                    if (window.attachCopyEvent) window.attachCopyEvent(newBlock.querySelector('.copy-btn'));
                    if (window.attachDeleteEvent) window.attachDeleteEvent(newBlock.querySelector('.btn-delete'));
                    if (window.attachTitleBlurEvent) window.attachTitleBlurEvent(newBlock.querySelector('span'), cmd.id);
                }
            });
        }

        // Restore custom commands templates
        if (state.customCommands) {
            document.querySelectorAll('.copy-content').forEach(el => {
                const targetId = el.id;
                if (state.customCommands[targetId]) {
                    el.dataset.template = state.customCommands[targetId];
                }
            });
        }
        
        // Apply deletedCommands
        if (state.deletedCommands && state.deletedCommands.length > 0) {
            state.deletedCommands.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    const block = el.closest('.copy-block');
                    if (block) block.remove();
                }
            });
        }
        
        // Apply customTitles
        if (state.customTitles) {
            Object.keys(state.customTitles).forEach(id => {
                const contentEl = document.getElementById(id);
                if (contentEl) {
                    const block = contentEl.closest('.copy-block');
                    if (block) {
                        const titleSpan = block.querySelector('.copy-header span');
                        if (titleSpan) titleSpan.innerText = state.customTitles[id];
                    }
                }
            });
        }

        // Populate Rota
        const lrCap = document.getElementById('lr-cap');
        const lrDel = document.getElementById('lr-del');
        if (lrCap) lrCap.value = state.rotaCap || 0;
        if (lrDel) lrDel.value = state.rotaDel || 0;

        renderSettings();
        updatePreviews();
        checkDutyState();
        if (state.dutyStartTime) {
            window.startDutyTimer(true);
        }

    }

    window.saveRotaState = () => {
        const lrCap = document.getElementById('lr-cap');
        const lrDel = document.getElementById('lr-del');
        if (lrCap) state.rotaCap = parseInt(lrCap.value) || 0;
        if (lrDel) state.rotaDel = parseInt(lrDel.value) || 0;
        saveState();
    };

    window.updateRotaVal = (id, delta) => {
        const el = document.getElementById(id);
        if (el) {
            let val = parseInt(el.value) || 0;
            val += delta;
            if (val < 0) val = 0;
            el.value = val;
            window.saveRotaState();
        }
    };

    window.testDiscordChannel = (key) => {
        const serverId = document.getElementById('discord-server-id').value.trim() || state.discordServerId;
        const inputEl = document.querySelector(`.discord-channel-id[data-key="${key}"]`);
        const channelId = (inputEl ? inputEl.value.trim() : null) || state.discordChannels[key];

        if (!serverId || !channelId) {
            alert("Server ID or Channel ID is missing.");
            return;
        }

        const webUrl = `https://discord.com/channels/${serverId}/${channelId}`;
        window.open(webUrl, '_blank');
    };

    window.saveSettings = () => {
        // Grab values from inputs
        state.discordServerId = document.getElementById('discord-server-id').value.trim();
        document.querySelectorAll('.discord-channel-id').forEach(input => {
            const key = input.getAttribute('data-key');
            state.discordChannels[key] = input.value.trim();
        });
        saveState();
        alert('Settings Saved!');
        closeModals();
    };

    // -----------------------------------------------------
    // SETTINGS MODAL RENDERER
    // -----------------------------------------------------
    function renderSettings() {
        document.getElementById('discord-server-id').value = state.discordServerId;
        document.querySelectorAll('.discord-channel-id').forEach(input => {
            const key = input.getAttribute('data-key');
            input.value = state.discordChannels[key] || '';
        });
    }

    // -----------------------------------------------------
    // EXPORT / IMPORT DB.TXT
    // -----------------------------------------------------
    window.exportDb = () => {
        const dataStr = JSON.stringify(state, null, 2);
        const blob = new Blob([dataStr], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "db.txt";
        a.click();
        URL.revokeObjectURL(url);
    };

    document.getElementById('import-db-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const importedState = JSON.parse(ev.target.result);
                state = { ...state, ...importedState };
                
                if (state.customCommands) {
                    document.querySelectorAll('.copy-content').forEach(el => {
                        const targetId = el.id;
                        if (state.customCommands[targetId]) {
                            el.dataset.template = state.customCommands[targetId];
                        }
                    });
                }
                
                saveState();
                renderSettings();
                updatePreviews(); // update my info
                alert('Database imported successfully!');
            } catch(err) {
                alert('Invalid db.txt file format.');
            }
        };
        reader.readAsText(file);
    });

    // -----------------------------------------------------
    // DYNAMIC VARIABLES & COPY SYSTEM
    // -----------------------------------------------------
    const nameInput = document.getElementById('myName');
    const idInput = document.getElementById('myId');
    const locSelect = document.getElementById('locSelect');
    const locInputCustom = document.getElementById('locInputCustom');
    const repInput = document.getElementById('repInput');

    nameInput.addEventListener('input', () => {
        state.name = nameInput.value;
        saveState();
        updatePreviews();
    });
    idInput.addEventListener('input', () => {
        state.id = idInput.value;
        saveState();
        updatePreviews();
    });

    if(locSelect) {
        locSelect.addEventListener('change', () => {
            if (locSelect.value === 'Other...') locInputCustom.style.display = 'block';
            else locInputCustom.style.display = 'none';
            updatePreviews();
        });
    }
    if(locInputCustom) locInputCustom.addEventListener('input', updatePreviews);
    if(repInput) repInput.addEventListener('input', updatePreviews);

    window.attachDeleteEvent = (btn) => {
        let pressTimer;
        
        const startDelete = (e) => {
            // Prevent default context menu or scrolling if it's touch
            btn.classList.add('holding');
            pressTimer = window.setTimeout(() => {
                const targetId = btn.getAttribute('data-target');
                if (state.userAddedCommands && state.userAddedCommands.find(c => c.id === targetId)) {
                    state.userAddedCommands = state.userAddedCommands.filter(c => c.id !== targetId);
                } else {
                    if (!state.deletedCommands) state.deletedCommands = [];
                    if (!state.deletedCommands.includes(targetId)) state.deletedCommands.push(targetId);
                }
                saveState();
                
                const block = document.getElementById(targetId);
                if (block) {
                    const cb = block.closest('.copy-block');
                    if (cb) cb.remove();
                }
            }, 3000);
        };

        const cancelDelete = () => {
            btn.classList.remove('holding');
            clearTimeout(pressTimer);
        };

        btn.addEventListener('mousedown', startDelete);
        btn.addEventListener('touchstart', startDelete, {passive: true});
        btn.addEventListener('mouseup', cancelDelete);
        btn.addEventListener('mouseleave', cancelDelete);
        btn.addEventListener('touchend', cancelDelete);
        btn.addEventListener('touchcancel', cancelDelete);
    };

    window.attachTitleBlurEvent = (span, targetId) => {
        span.addEventListener('blur', () => {
            if (!state.customTitles) state.customTitles = {};
            state.customTitles[targetId] = span.innerText;
            
            if (state.userAddedCommands) {
                const added = state.userAddedCommands.find(c => c.id === targetId);
                if (added) {
                    added.title = span.innerText;
                }
            }
            saveState();
            
            const originalBg = span.style.backgroundColor;
            span.style.backgroundColor = 'rgba(46, 204, 113, 0.2)';
            setTimeout(() => { span.style.backgroundColor = originalBg; }, 300);
        });
    };

    window.attachBlurEvent = (el) => {
        el.addEventListener('blur', () => {
            const targetId = el.id;
            let newTemplate = el.innerText;
            
            const name = state.name || '[Name]';
            const id = state.id || '[ID]';
            const locSelect = document.getElementById('locSelect');
            const locInputCustom = document.getElementById('locInputCustom');
            const repInput = document.getElementById('repInput');
            
            let loc = locSelect ? locSelect.value : '';
            if (loc === 'Other...') loc = locInputCustom ? locInputCustom.value : '';
            if (!loc) loc = '[Location]';
            let rep = repInput ? repInput.value : '';
            if (!rep) rep = '[Replacement Name]';
            
            if (loc && loc !== '[Location]') newTemplate = newTemplate.split(loc).join('{LOC}');
            if (rep && rep !== '[Replacement Name]') newTemplate = newTemplate.split(rep).join('{REP}');
            if (name && name !== '[Name]') newTemplate = newTemplate.split(name).join('{NAME}');
            if (id && id !== '[ID]') newTemplate = newTemplate.split(id).join('{ID}');
            
            state.customCommands[targetId] = newTemplate;
            el.dataset.template = newTemplate;
            saveState();

            if (state.userAddedCommands) {
                const added = state.userAddedCommands.find(c => c.id === targetId);
                if (added) {
                    added.template = newTemplate;
                    saveState();
                }
            }
            
            // visual feedback
            const originalBg = el.style.backgroundColor;
            el.style.backgroundColor = 'rgba(46, 204, 113, 0.2)';
            setTimeout(() => { el.style.backgroundColor = originalBg; }, 300);
        });
    };

    document.querySelectorAll('.copy-content').forEach(el => {
        el.dataset.originalTemplate = el.innerText;
        el.dataset.template = el.innerText;
        if (el.getAttribute('contenteditable') === 'true') {
            attachBlurEvent(el);
        }
    });

    function updatePreviews() {
        nameInput.value = state.name || '';
        idInput.value = state.id || '';

        const name = state.name || '[Name]';
        const id = state.id || '[ID]';
        
        let loc = locSelect ? locSelect.value : '';
        if (loc === 'Other...') loc = locInputCustom.value;
        if (!loc) loc = '[Location]';

        let rep = repInput ? repInput.value : '';
        if (!rep) rep = '[Replacement Name]';

        document.querySelectorAll('.copy-content').forEach(el => {
            let text = el.dataset.template;
            text = text.replace(/{NAME}/g, name);
            text = text.replace(/{ID}/g, id);
            text = text.replace(/{LOC}/g, loc);
            text = text.replace(/{REP}/g, rep);
            el.innerText = text;
        });

        const caLoc = document.getElementById('ca-loc');
        if (caLoc) {
            caLoc.value = loc !== '[Location]' ? loc : '';
        }
    }

    function checkDutyState() {
        const btns = {
            od2: document.querySelector('[data-target="od2"]'),
            od3: document.querySelector('[data-target="od3"]'),
            ref2: document.querySelector('[data-target="ref2"]'),
            sav2: document.querySelector('[data-target="sav2"]'),
            off2: document.querySelector('[data-target="off2"]'),
            off3: document.querySelector('[data-target="off3"]')
        };
        ['sw1_2','sw1_3','sw1_4','sw1_5','sw1_6','sw1_7','sw2_2','sw2_3','sw2_4','sw2_5','sw3_2','sw3_3','sw3_4','sw3_5'].forEach(id => {
            btns[id] = document.querySelector(`[data-target="${id}"]`);
        });

        if (state.dutySteps.od1 && btns.od2) { btns.od2.disabled = false; btns.od2.classList.remove('disabled'); }
        if (state.dutySteps.od2 && btns.od3) { btns.od3.disabled = false; btns.od3.classList.remove('disabled'); }
        if (state.dutySteps.ref1 && btns.ref2) { btns.ref2.disabled = false; btns.ref2.classList.remove('disabled'); }
        if (state.dutySteps.sav1 && btns.sav2) { btns.sav2.disabled = false; btns.sav2.classList.remove('disabled'); }
        if (state.dutySteps.off1 && btns.off2) { btns.off2.disabled = false; btns.off2.classList.remove('disabled'); }
        if (state.dutySteps.off2 && btns.off3) { btns.off3.disabled = false; btns.off3.classList.remove('disabled'); }
        
        if (state.dutySteps.sw1_1 && btns.sw1_2) { btns.sw1_2.disabled = false; btns.sw1_2.classList.remove('disabled'); }
        if (state.dutySteps.sw1_2 && btns.sw1_3) { btns.sw1_3.disabled = false; btns.sw1_3.classList.remove('disabled'); }
        if (state.dutySteps.sw1_3 && btns.sw1_4) { btns.sw1_4.disabled = false; btns.sw1_4.classList.remove('disabled'); }
        if (state.dutySteps.sw1_4 && btns.sw1_5) { btns.sw1_5.disabled = false; btns.sw1_5.classList.remove('disabled'); }
        if (state.dutySteps.sw1_5 && btns.sw1_6) { btns.sw1_6.disabled = false; btns.sw1_6.classList.remove('disabled'); }
        if (state.dutySteps.sw1_6 && btns.sw1_7) { btns.sw1_7.disabled = false; btns.sw1_7.classList.remove('disabled'); }

        if (state.dutySteps.sw2_1 && btns.sw2_2) { btns.sw2_2.disabled = false; btns.sw2_2.classList.remove('disabled'); }
        if (state.dutySteps.sw2_2 && btns.sw2_3) { btns.sw2_3.disabled = false; btns.sw2_3.classList.remove('disabled'); }
        if (state.dutySteps.sw2_3 && btns.sw2_4) { btns.sw2_4.disabled = false; btns.sw2_4.classList.remove('disabled'); }
        if (state.dutySteps.sw2_4 && btns.sw2_5) { btns.sw2_5.disabled = false; btns.sw2_5.classList.remove('disabled'); }

        if (state.dutySteps.sw3_1 && btns.sw3_2) { btns.sw3_2.disabled = false; btns.sw3_2.classList.remove('disabled'); }
        if (state.dutySteps.sw3_2 && btns.sw3_3) { btns.sw3_3.disabled = false; btns.sw3_3.classList.remove('disabled'); }
        if (state.dutySteps.sw3_3 && btns.sw3_4) { btns.sw3_4.disabled = false; btns.sw3_4.classList.remove('disabled'); }
        if (state.dutySteps.sw3_4 && btns.sw3_5) { btns.sw3_5.disabled = false; btns.sw3_5.classList.remove('disabled'); }

        const onDutyDone = state.dutySteps.od1 && state.dutySteps.od2 && state.dutySteps.od3;
        const offDutyDone = state.dutySteps.off1 && state.dutySteps.off2 && state.dutySteps.off3;

        const btnRefresh = document.getElementById('btn-tab-refresh');
        const btnSave = document.getElementById('btn-tab-save');
        const btnOffDuty = document.getElementById('btn-tab-offduty');
        const btnOnDuty = document.getElementById('btn-tab-onduty');

        if (!btnRefresh || !btnSave || !btnOffDuty || !btnOnDuty) return;

        if (onDutyDone) {
            btnRefresh.disabled = false;
            btnRefresh.classList.remove('disabled');
            btnSave.disabled = false;
            btnSave.classList.remove('disabled');
            btnOffDuty.disabled = false;
            btnOffDuty.classList.remove('disabled');
            
            const btnStateWave = document.getElementById('btn-tab-state-wave');
            if (btnStateWave) {
                btnStateWave.disabled = false;
                btnStateWave.classList.remove('disabled');
            }
            
            if (!offDutyDone) {
                btnOnDuty.disabled = true;
                btnOnDuty.classList.add('disabled');
                
                if (btnOnDuty.classList.contains('active')) {
                    btnOffDuty.click();
                }
            }
        }

        if (offDutyDone) {
            state.dutySteps = {};
            ['od1','od2','od3','ref1','ref2','sav1','sav2','off1','off2','off3', 'sw1_1','sw1_2','sw1_3','sw1_4','sw1_5','sw1_6','sw1_7', 'sw2_1','sw2_2','sw2_3','sw2_4','sw2_5', 'sw3_1','sw3_2','sw3_3','sw3_4','sw3_5'].forEach(step => state.dutySteps[step] = false);
            state.rotaCap = 0;
            state.rotaDel = 0;
            saveState();

            const lrCap = document.getElementById('lr-cap');
            const lrDel = document.getElementById('lr-del');
            if (lrCap) lrCap.value = 0;
            if (lrDel) lrDel.value = 0;
            
            btnOnDuty.disabled = false;
            btnOnDuty.classList.remove('disabled');
            
            btnRefresh.disabled = true;
            btnRefresh.classList.add('disabled');
            btnSave.disabled = true;
            btnSave.classList.add('disabled');
            btnOffDuty.disabled = true;
            btnOffDuty.classList.add('disabled');
            
            const btnStateWave = document.getElementById('btn-tab-state-wave');
            if (btnStateWave) {
                btnStateWave.disabled = true;
                btnStateWave.classList.add('disabled');
            }

            // Reset bodycam step buttons
            ['od2', 'od3', 'ref2', 'sav2', 'off2', 'off3', 'sw1_2','sw1_3','sw1_4','sw1_5','sw1_6','sw1_7', 'sw2_2','sw2_3','sw2_4','sw2_5', 'sw3_2','sw3_3','sw3_4','sw3_5'].forEach(id => {
                const b = document.querySelector(`[data-target="${id}"]`);
                if(b) { b.disabled = true; b.classList.add('disabled'); }
            });

            btnOnDuty.click();
        }
    }

    window.fillBodycamDiscordForm = (statusText) => {
        const bcStatus = document.getElementById('bc-status');
        if (bcStatus) bcStatus.value = statusText;
    };

    window.attachCopyEvent = (btn) => {
        btn.addEventListener('click', async () => {
            const targetId = btn.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);
            if (!targetEl) return;
            
            const textToCopy = targetEl.innerText;
            
            // Save modified radio command
            if (!state.customCommands) state.customCommands = {};
            let newTemplate = textToCopy;
            const name = state.name || '[Name]';
            const id = state.id || '[ID]';
            let loc = locSelect ? locSelect.value : '';
            if (loc === 'Other...') loc = locInputCustom ? locInputCustom.value : '';
            if (!loc) loc = '[Location]';
            let rep = repInput ? repInput.value : '';
            if (!rep) rep = '[Replacement Name]';
            
            if (loc && loc !== '[Location]') newTemplate = newTemplate.split(loc).join('{LOC}');
            if (rep && rep !== '[Replacement Name]') newTemplate = newTemplate.split(rep).join('{REP}');
            if (name && name !== '[Name]') newTemplate = newTemplate.split(name).join('{NAME}');
            if (id && id !== '[ID]') newTemplate = newTemplate.split(id).join('{ID}');
            
            state.customCommands[targetId] = newTemplate;
            targetEl.dataset.template = newTemplate;
            saveState();

            try {
                await navigator.clipboard.writeText(textToCopy);
                const originalText = btn.innerHTML;
                btn.innerHTML = '✅'; 
                btn.classList.add('success');
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.classList.remove('success');
                }, 1500);

                if (targetId === 'od3') {
                    if (window.startDutyTimer) window.startDutyTimer();
                    window.pendingOnDutyFlow = true;
                    setTimeout(() => { window.openModal('modal-discord-bodycam'); window.fillBodycamDiscordForm('On duty'); }, 500);
                    
                } else if (targetId === 'off3') {
                    if (window.stopDutyTimer) window.stopDutyTimer();
                    setTimeout(() => {
                        window.openModal('modal-discord-bodycam');
                        window.fillBodycamDiscordForm('Off duty');
                    }, 500);
                }

                if (state.dutySteps.hasOwnProperty(targetId)) {
                    state.dutySteps[targetId] = true;
                    saveState();
                    checkDutyState();
                }

                if (window.pendingOnDutyFlow && targetId.startsWith('rc')) {
                    window.pendingOnDutyFlow = false;
                    setTimeout(() => {
                        window.openModal('modal-discord-bodycam');
                        window.fillBodycamDiscordForm('On duty');
                    }, 500);
                }

                if (targetId === 'rc107b') { // Off Duty radio code
                    setTimeout(() => {
                        window.openModal('modal-bodycam');
                        const btnOffDuty = document.getElementById('btn-tab-offduty');
                        if (btnOffDuty && !btnOffDuty.disabled) btnOffDuty.click();
                    }, 500);
                }

                const discordKey = btn.getAttribute('data-discord-key');
                if (discordKey) {
                    const cb = btn.parentElement.querySelector('input[type="checkbox"]');
                    const shouldOpen = cb ? cb.checked : true;
                    if (shouldOpen) {
                        const serverId = state.discordServerId;
                        const channelId = state.discordChannels[discordKey];
                        if (serverId && channelId) {
                            const webUrl = `https://discord.com/channels/${serverId}/${channelId}`;
                            window.open(webUrl, '_blank');
                        } else {
                            alert("Discord Server ID or Channel ID is missing in Settings.");
                        }
                    }
                }
            } catch (err) { alert('Failed to copy to clipboard.'); }
        });
    };

    document.querySelectorAll('.copy-btn').forEach(btn => {
        attachCopyEvent(btn);
    });

    window.copySimple = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            const modal = document.getElementById('modal-radio');
            if (modal) {
                let color = 'rgba(255, 255, 255, 0.5)';
                if (text.includes('10-4')) color = 'rgba(46, 204, 113, 0.8)';
                else if (text.includes('10-2 ')) color = 'rgba(231, 76, 60, 0.8)';
                else if (text.includes('10-20')) color = 'rgba(52, 152, 219, 0.8)';
                else if (text.includes('10-6')) color = 'rgba(241, 196, 15, 0.8)';
                else if (text.includes('10-17')) color = 'rgba(155, 89, 182, 0.8)';
                else if (text.includes('Code A')) color = 'rgba(231, 76, 60, 1)';

                modal.style.setProperty('--glow-color', color);
                modal.classList.remove('modal-glow-anim');
                void modal.offsetWidth; // trigger reflow
                modal.classList.add('modal-glow-anim');
            }
        });
    };

    // -----------------------------------------------------
    // DISCORD AUTOMATION
    // -----------------------------------------------------
    window.executeDiscordAction = async (key, skipCopy = true, textToCopy = "", skipRedirect = false) => {
        const serverId = state.discordServerId;
        const channelId = state.discordChannels[key];
        
        if (!serverId || !channelId) {
            alert("Please configure the Server ID and Channel ID for this log in Settings first!");
            return;
        }

        const appUrl = `discord://-/channels/${serverId}/${channelId}`;
        
        if (!skipCopy && textToCopy) {
            try {
                await navigator.clipboard.writeText(textToCopy);
                // alert("Text copied to clipboard!\n\nWhen Discord opens, press Win+V (Clipboard History) or Ctrl+V to paste your message and add your screenshot.");
            } catch (err) {
                alert("Failed to copy text, please check permissions.");
            }
        }

        if (!skipRedirect) {
            window.location.href = appUrl;
        }
        // closeModals();
    };

    window.generateDiscordAction = (type, cbId = null) => {
        let text = "";
        const name = state.name || "[Name]";
        const id = state.id || "[ID]";

        if (type === 'bodycam') {
            const status = document.getElementById('bc-status') ? document.getElementById('bc-status').value : '';
            
            const now = new Date();
            const edinTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/London"}));
            const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
            
            const edinH = String(edinTime.getHours()).padStart(2, '0');
            const edinM = String(edinTime.getMinutes()).padStart(2, '0');
            
            // const istH = String(istTime.getHours()).padStart(2, '0');
            // const istM = String(istTime.getMinutes()).padStart(2, '0');
            
            text = `${status} : ${edinH}:${edinM}`;
        }
        else if (type === 'codea') {
            const loc = document.getElementById('ca-loc').value || "[Location]";
            const status = document.getElementById('ca-status').value;
            const tags = document.getElementById('ca-tags').value;
            text = `Code A at ${loc} ${status} ${tags}`;
        }
        else if (type === 'break') {
            const action = document.getElementById('br-action').value;
            text = action;
        }
        else if (type === 'supplies') {
            const status = document.getElementById('ms-status').value;
            text = status==="before" ? `Before captachas` : `After XX captachas completed`;
        }
        else if (type === 'rota') {
            const now = new Date();
            const edinTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/London"}));
            
            const edinD = String(edinTime.getDate()).padStart(2, '0');
            const edinM = String(edinTime.getMonth() + 1).padStart(2, '0');
            const edinY = edinTime.getFullYear();
        
            const date = `${edinD}/${edinM}/${edinY}`;
            const cap = document.getElementById('lr-cap') ? document.getElementById('lr-cap').value : "0";
            const del = document.getElementById('lr-del') ? document.getElementById('lr-del').value : "0";
            text = `Date: ${date}\nCaptchas Completed: ${cap}\nDeliveries Made: ${del}`;
        }

        const cb = cbId ? document.getElementById(cbId) : null;
        const skipRedirect = cb ? !cb.checked : false;

        executeDiscordAction(type, false, text, skipRedirect);
    };

    // -----------------------------------------------------
    // TIMER LOGIC
    // -----------------------------------------------------
    let timerInterval = null;
    let timerSeconds = 0;
    
    window.startDutyTimer = (resume = false) => {
        const display = document.getElementById('main-timer');
        if(!display) return;
        
        if (timerInterval) clearInterval(timerInterval);
        
        if (!resume) {
            state.dutyStartTime = Date.now();
            saveState();
            timerSeconds = 0;
        } else {
            if (state.dutyStartTime) {
                timerSeconds = Math.floor((Date.now() - state.dutyStartTime) / 1000);
            } else {
                timerSeconds = 0;
            }
        }
        
        const updateDisplay = () => {
            const h = Math.floor(timerSeconds / 3600);
            const m = Math.floor((timerSeconds % 3600) / 60);
            const s = timerSeconds % 60;
            const mm = String(m).padStart(2, '0');
            const ss = String(s).padStart(2, '0');
            
            const hourText = h === 1 ? "1 hour" : `${h} hours`;
            display.textContent = `Total: ${hourText} + 00:${mm}:${ss}`;
            
            const fill = document.getElementById('timer-fill');
            if (fill) {
                const goal = 3600; // 1 hour
                let percent = (timerSeconds / goal) * 100;
                if (percent > 100) percent = 100;
                fill.style.width = `${percent}%`;
                
                if (percent >= 100) {
                    fill.style.background = 'var(--primary)';
                    display.style.color = 'var(--primary)';
                } else {
                    fill.style.background = 'var(--secondary)';
                    display.style.color = 'var(--secondary)';
                }
            }
        };
        
        updateDisplay();
        timerInterval = setInterval(() => {
            timerSeconds++;
            updateDisplay();
            if (timerSeconds > 0 && timerSeconds % 1800 === 0) { // Every 30 minutes
                window.playDutyChime();
            }
        }, 1000);
    };

    window.stopDutyTimer = () => {
        if (timerInterval) clearInterval(timerInterval);
        state.dutyStartTime = null;
        saveState();
        
        const display = document.getElementById('main-timer');
        if (display) {
            display.textContent = 'Total: 0 hour + 00:00:00';
            display.style.color = 'var(--secondary)';
        }
        const fill = document.getElementById('timer-fill');
        if (fill) {
            fill.style.width = '0%';
            fill.style.background = 'var(--secondary)';
        }
    };
    // -----------------------------------------------------
    // LIVE CLOCK (BODYCAM LOGS)
    // -----------------------------------------------------
    setInterval(() => {
        const now = new Date();
        const edinTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/London"}));
        const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
        
        const edinH = String(edinTime.getHours()).padStart(2, '0');
        const edinM = String(edinTime.getMinutes()).padStart(2, '0');
        const edinS = String(edinTime.getSeconds()).padStart(2, '0');
        
        const istH = String(istTime.getHours()).padStart(2, '0');
        const istM = String(istTime.getMinutes()).padStart(2, '0');
        const istS = String(istTime.getSeconds()).padStart(2, '0');
        
        const liveTimeEl = document.getElementById('bc-live-time');
        if (liveTimeEl) {
            liveTimeEl.textContent = `${edinH}:${edinM} (Edinburgh) | ${istH}:${istM} (IST)`;
        }
        
        const bigClockEl = document.getElementById('big-live-clock');
        if (bigClockEl) {
            bigClockEl.textContent = `${edinH}:${edinM}:${edinS} (Edinburgh) | ${istH}:${istM}:${istS} (IST)`;
        }
        
        const liveDateEl = document.getElementById('lr-live-date');
        if (liveDateEl) {
            const edinD = String(edinTime.getDate()).padStart(2, '0');
            const edinM = String(edinTime.getMonth() + 1).padStart(2, '0');
            const edinY = edinTime.getFullYear();
            
            const istD = String(istTime.getDate()).padStart(2, '0');
            const istMo = String(istTime.getMonth() + 1).padStart(2, '0');
            const istY = istTime.getFullYear();
            
            liveDateEl.textContent = `${edinD}/${edinM}/${edinY} (Edinburgh) | ${istD}/${istMo}/${istY} (IST)`;
        }
    }, 1000);

    // Inject Delete Button and Editable Titles for existing headers
    document.querySelectorAll('.copy-header').forEach(header => {
        const copyBtn = header.querySelector('.copy-btn');
        if (copyBtn && !header.querySelector('.btn-delete')) {
            const targetId = copyBtn.getAttribute('data-target');
            
            const btnContainer = document.createElement('div');
            btnContainer.style.display = 'flex';
            btnContainer.style.gap = '0.25rem';
            copyBtn.parentNode.insertBefore(btnContainer, copyBtn);
            btnContainer.appendChild(copyBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-delete';
            deleteBtn.innerHTML = '❌';
            deleteBtn.setAttribute('data-target', targetId);
            deleteBtn.title = "Hold for 3 seconds to delete";
            btnContainer.appendChild(deleteBtn);
            
            if (window.attachDeleteEvent) window.attachDeleteEvent(deleteBtn);

            const titleSpan = header.querySelector('span');
            if (titleSpan) {
                titleSpan.setAttribute('contenteditable', 'true');
                titleSpan.style.outline = 'none';
                titleSpan.style.borderBottom = '1px dashed rgba(255,255,255,0.3)';
                if (window.attachTitleBlurEvent) window.attachTitleBlurEvent(titleSpan, targetId);
            }
        }
    });
    // Add custom command buttons to sections (conditionally)
    let secIndex = 0;
    document.querySelectorAll('.modal-content .glass-section .section-body, #modal-radio .tabs-body .tab-content').forEach(body => {
        body.dataset.secIndex = secIndex++;
        if (body.querySelector('.copy-block')) {
            const addBtnContainer = document.createElement('div');
            addBtnContainer.className = 'btn-add-cmd-container';
            addBtnContainer.style.marginTop = '0.5rem';
            addBtnContainer.innerHTML = `<button class="btn btn-primary btn-add-cmd" onclick="addCustomCommand(this, '${body.dataset.secIndex}')" style="font-size: 0.8rem; padding: 0.3rem 0.6rem;">+ Add Command</button>`;
            body.appendChild(addBtnContainer);
        }
    });

    window.addCustomCommand = (btn, secIndex) => {
        const uniqueId = 'custom-cmd-' + Date.now() + Math.floor(Math.random() * 1000);
        const newBlock = document.createElement('div');
        newBlock.className = 'copy-block';
        newBlock.innerHTML = `
            <div class="copy-header"><span contenteditable="true" style="outline: none; border-bottom: 1px dashed rgba(255, 255, 255, 0.3);">Custom Command</span><div style="display: flex; gap: 0.25rem;"><button class="btn copy-btn" data-target="${uniqueId}">📋</button><button class="btn btn-delete" data-target="${uniqueId}" title="Hold for 3 seconds to delete">❌</button></div></div>
            <div class="copy-content" id="${uniqueId}" contenteditable="true">Edit this text...</div>
        `;
        btn.parentElement.before(newBlock);
        
        const editable = newBlock.querySelector('.copy-content');
        editable.dataset.originalTemplate = editable.innerText;
        editable.dataset.template = editable.innerText;
        attachBlurEvent(editable);
        attachCopyEvent(newBlock.querySelector('.copy-btn'));
        if (window.attachDeleteEvent) window.attachDeleteEvent(newBlock.querySelector('.btn-delete'));
        if (window.attachTitleBlurEvent) window.attachTitleBlurEvent(newBlock.querySelector('span'), uniqueId);

        if(!state.userAddedCommands) state.userAddedCommands = [];
        state.userAddedCommands.push({ secIndex, id: uniqueId, template: editable.innerText, title: 'Custom Command' });
        saveState();
    };

    window.resetToDefaultCommands = () => {
        if (!confirm("Are you sure you want to reset all commands to defaults?")) return;
        state.customCommands = {};
        state.userAddedCommands = [];
        state.userDefaults = {};
        state.deletedCommands = [];
        state.customTitles = {};
        saveState();
        location.reload();
    };

    window.saveCurrentAsDefault = () => {
        if (!confirm("Set current text of all commands as the new default?")) return;
        state.userDefaults = {};
        document.querySelectorAll('.copy-content').forEach(el => {
            state.userDefaults[el.id] = el.dataset.template;
        });
        saveState();
        alert("Saved as default!");
    };

    // Initialize

    window.openAddCommandModal = () => {
        const select = document.getElementById('new-cmd-category');
        select.innerHTML = '';
        
        document.querySelectorAll('.modal-content .glass-section .section-body, #modal-radio .tabs-body .tab-content').forEach(body => {
            if (body.closest('#modal-radio')) {
                let name = 'General Section';
                if (body.classList.contains('tab-content')) {
                    const tabBtn = document.querySelector(`.tab-btn[data-tab="${body.id}"]`);
                    if (tabBtn) name = tabBtn.innerText;
                } else {
                    const glass = body.closest('.glass-section');
                    const title = glass.querySelector('.section-title');
                    if (title) name = title.innerText;
                }
                
                const option = document.createElement('option');
                option.value = body.dataset.secIndex;
                option.innerText = name.replace(/[^a-zA-Z0-9 -&#;]/g, '').trim(); 
                select.appendChild(option);
            }
        });

        document.getElementById('modal-add-command').classList.add('active');
        document.getElementById('modalOverlay').classList.add('active');
    };

    window.closeAddCommandModal = () => {
        document.getElementById('modal-add-command').classList.remove('active');
    };

    window.saveNewCommandFromForm = () => {
        const secIndex = document.getElementById('new-cmd-category').value;
        const title = document.getElementById('new-cmd-title').value.trim() || 'Custom Command';
        const template = document.getElementById('new-cmd-template').value.trim() || 'Edit this text...';
        
        if (!secIndex) return;

        const uniqueId = 'custom-cmd-' + Date.now() + Math.floor(Math.random() * 1000);
        const newBlock = document.createElement('div');
        newBlock.className = 'copy-block';
        newBlock.innerHTML = `
            <div class="copy-header"><span contenteditable="true" style="outline: none; border-bottom: 1px dashed rgba(255, 255, 255, 0.3);">${title}</span><div style="display: flex; gap: 0.25rem;"><button class="btn copy-btn" data-target="${uniqueId}">📋</button><button class="btn btn-delete" data-target="${uniqueId}" title="Hold for 3 seconds to delete">❌</button></div></div>
            <div class="copy-content" id="${uniqueId}" contenteditable="true">${template}</div>
        `;
        
        const targetBody = document.querySelector(`[data-sec-index="${secIndex}"]`);
        if (targetBody) {
            const addBtnContainer = targetBody.querySelector('.btn-add-cmd-container');
            if (addBtnContainer) {
                addBtnContainer.before(newBlock);
            } else {
                targetBody.appendChild(newBlock);
            }
        }
        
        const editable = newBlock.querySelector('.copy-content');
        if (window.attachBlurEvent) window.attachBlurEvent(editable);
        if (window.attachCopyEvent) window.attachCopyEvent(newBlock.querySelector('.copy-btn'));
        if (window.attachDeleteEvent) window.attachDeleteEvent(newBlock.querySelector('.btn-delete'));
        if (window.attachTitleBlurEvent) window.attachTitleBlurEvent(newBlock.querySelector('span'), uniqueId);

        if(!state.userAddedCommands) state.userAddedCommands = [];
        state.userAddedCommands.push({ secIndex, id: uniqueId, template: template, title: title });
        
        if (!state.customTitles) state.customTitles = {};
        state.customTitles[uniqueId] = title;
        
        saveState();
        
        document.getElementById('new-cmd-title').value = '';
        document.getElementById('new-cmd-template').value = '';
        closeAddCommandModal();
    };

    loadState();
});

// Dept Commands Logic
window.toggleSection = (element) => {
    element.parentElement.classList.toggle('collapsed');
};

window.toggleAccordion = (element) => {
    element.parentElement.classList.toggle('active');
};

window.jumpToSection = (secId) => {
    const sec = document.getElementById(secId);
    if (sec) {
        sec.classList.remove('collapsed');
        setTimeout(() => {
            sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    }
};

window.toggleAllSections = () => {
    const sections = document.querySelectorAll('#tab-rc-dept .glass-section.collapsible');
    let anyCollapsed = false;
    sections.forEach(sec => {
        if(sec.classList.contains('collapsed')) anyCollapsed = true;
    });
    
    sections.forEach(sec => {
        if(anyCollapsed) {
            sec.classList.remove('collapsed');
        } else {
            sec.classList.add('collapsed');
        }
    });
};

window.filterDeptCommands = () => {
    const searchVal = document.getElementById('filter-search').value.toLowerCase();
    let loc2 = document.getElementById('filter-loc2').value;

    const sections = document.querySelectorAll('#tab-rc-dept .glass-section.collapsible');
    
    sections.forEach(sec => {
        let hasVisibleBlock = false;
        const blocks = sec.querySelectorAll('.copy-block');
        
        blocks.forEach(b => {
            const bLoc2 = b.getAttribute('data-loc2');
            const text = b.querySelector('.copy-content').textContent.toLowerCase();
            let match1 = searchVal === '' || text.includes(searchVal);
            let match2 = loc2 === 'ALL' || loc2 === bLoc2 || bLoc2 === 'ALL'; 
            // Note: bLoc2 === 'ALL' means the command itself is meant for ALL receivers, so it should always show up if matched by search string.
            // But wait, the original logic was: let match2 = loc2 === 'ALL' || loc2 === bLoc2;
            
            // Re-evaluating original logic:
            // let match2 = loc2 === 'ALL' || loc2 === bLoc2;
            let match2Original = loc2 === 'ALL' || loc2 === bLoc2;
            
            if (match1 && match2Original) {
                b.classList.remove('filtered-out');
                b.style.display = '';
                hasVisibleBlock = true;
            } else {
                b.classList.add('filtered-out');
                b.style.display = 'none';
            }
        });
        
        if (loc2 === 'ALL') {
            sec.classList.remove('collapsed');
        } else if (hasVisibleBlock) {
            sec.classList.remove('collapsed');
        } else {
            sec.classList.add('collapsed');
        }
    });
};

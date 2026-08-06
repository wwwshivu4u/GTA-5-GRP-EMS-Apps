/* ================= STATE ================= */
        let appState = {
            currentTab: "dashboard",
            currentHourlyWeek: "Week 1",
            bufferTimeMinutes: 10,
            
            discordServerId: '1035903890996080811',
            discordChannels: [
                { key: 'traineerota', name: '#trainee-rota', id: '1081157781530357772', category: 'Duty Rota', active: true },
                { key: 'hsrota', name: '#hs-rota', id: '1081157781530357773', category: 'Duty Rota', active: true },
                { key: 'gsrota', name: '#gs-rota', id: '1081157781530357774', category: 'Duty Rota', active: true },
                { key: 'labrota', name: '#lab-rota', id: '1151594608460038245', category: 'Lab Work', active: true },
                { key: 'arorota', name: '#aro-rota', id: '1081157781530357776', category: 'Duty Rota', active: true },
                { key: 'ftorota', name: '#fto-rota', id: '1081157781530357777', category: 'Duty Rota', active: true },
                { key: 'labtechrota', name: '#labtech-rota', id: '1081157781530357778', category: 'Lab Work', active: true }
            ],

            bonusRates: {
                night: { ph: 25000, sh: 40000, calls: 20000 },
                day: { ph: 10000, sh: 30000, calls: 15000 },
                lab: { captcha: 5000, medicineDelivery: 10000 },
                fto: { day1: 45000, day2: 35000 }
            },

            flaggedLogs: [],
            discordLogs: [],
            roster: [],
            hourlyData: {},
            hcBonusData: [],
            payouts: {}
        };
        const ENCRYPTION_KEY = 'ems_local_app_key_2026';
        const firebaseConfig = {
            apiKey: "AIzaSyBVqUi_sDrON93CYohOSUP5V7O8mii7ZIs",
            authDomain: "ems-hub-gtav-grp.firebaseapp.com",
            projectId: "ems-hub-gtav-grp",
            storageBucket: "ems-hub-gtav-grp.firebasestorage.app",
            messagingSenderId: "923647951571",
            appId: "1:923647951571:web:fa30b89512cdee56ad0a26",
            measurementId: "G-Q1E9TR8BSE"
            };
        
        let db;
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.firestore();
        } catch (e) {
            console.error("Firebase init error (likely missing config)", e);
        }

        let editLockSessionId = 'session_' + Math.random().toString(36).substr(2, 9);
        let isEditMode = false;
        let lockUnsubscribe = null;

        async function saveDiscordLogs() {
            if (!isEditMode || !db) return;
            try {
                // Group by week
                const logsByWeek = {};
                appState.discordLogs.forEach(l => {
                    const w = l.week || 'Unknown';
                    if(!logsByWeek[w]) logsByWeek[w] = [];
                    logsByWeek[w].push(l);
                });

                const batch = db.batch();
                Object.keys(logsByWeek).forEach(week => {
                    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(logsByWeek[week]), ENCRYPTION_KEY).toString();
                    const docRef = db.collection('discord_logs').doc(week);
                    batch.set(docRef, { data: encrypted, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                });
                await batch.commit();
            } catch (e) {
                console.error("Save Discord Logs error:", e);
                showToast("Failed to save logs to cloud", "error");
            }
        }

        async function saveFlaggedLogs() {
            if (!isEditMode || !db) return;
            try {
                const encrypted = CryptoJS.AES.encrypt(JSON.stringify(appState.flaggedLogs), ENCRYPTION_KEY).toString();
                await db.collection('flagged_logs').doc('pending').set({
                    data: encrypted,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (e) {
                console.error("Save Flagged Logs error:", e);
                showToast("Failed to save flagged logs to cloud", "error");
            }
        }

        async function saveData() {
            if (!isEditMode) return; // Only save if we hold the lock
            if (!db) { showToast('Firestore not initialized', 'error'); return; }
            try {
                // Exclude discordLogs and flaggedLogs from master state
                const { discordLogs, flaggedLogs, ...coreState } = appState;
                const encrypted = CryptoJS.AES.encrypt(JSON.stringify(coreState), ENCRYPTION_KEY).toString();
                await db.collection('app_state').doc('master_state').set({
                    data: encrypted,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (e) {
                console.error("Encryption/Save error:", e);
                showToast("Failed to save core data to cloud", "error");
            }
        }

        async function loadData() {
            if (!db) { showToast("Cannot connect to cloud database.", "error"); return; }
            
            try {
                const masterDocPromise = db.collection('app_state').doc('master_state').get();
                const discordLogsPromise = db.collection('discord_logs').get();
                const flaggedLogsPromise = db.collection('flagged_logs').doc('pending').get();

                const [masterDoc, discordLogsSnap, flaggedLogsDoc] = await Promise.all([masterDocPromise, discordLogsPromise, flaggedLogsPromise]);
                let needsMigration = false;

                if (masterDoc.exists) {
                    const encrypted = masterDoc.data().data;
                    const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
                    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
                    
                    if (!decrypted) throw new Error("Invalid decryption");
                    const loaded = JSON.parse(decrypted);
                    
                    if (loaded.discordLogs || loaded.flaggedLogs) {
                        needsMigration = true;
                    }

                    appState = { ...appState, ...loaded };
                    if(!appState.payouts) appState.payouts = {};
                    
                } else {
                    // MIGRATION: Load from localStorage
                    const saved = localStorage.getItem('ems_hrms_data');
                    if (saved) {
                        const bytes = CryptoJS.AES.decrypt(saved, ENCRYPTION_KEY);
                        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
                        if (decrypted) {
                            const loaded = JSON.parse(decrypted);
                            appState = { ...appState, ...loaded };
                            if(!appState.payouts) appState.payouts = {};
                            needsMigration = true;
                        }
                    }
                }

                if (!needsMigration) {
                    let allDiscordLogs = [];
                    discordLogsSnap.forEach(doc => {
                        const encrypted = doc.data().data;
                        if(encrypted) {
                            const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
                            const decrypted = bytes.toString(CryptoJS.enc.Utf8);
                            if(decrypted) allDiscordLogs = allDiscordLogs.concat(JSON.parse(decrypted));
                        }
                    });
                    if(allDiscordLogs.length > 0) appState.discordLogs = allDiscordLogs;

                    if (flaggedLogsDoc.exists) {
                        const encrypted = flaggedLogsDoc.data().data;
                        if(encrypted) {
                            const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
                            const decrypted = bytes.toString(CryptoJS.enc.Utf8);
                            if(decrypted) appState.flaggedLogs = JSON.parse(decrypted);
                        }
                    }
                }

                if (needsMigration) {
                    const tempMode = isEditMode;
                    isEditMode = true;
                    await saveDiscordLogs();
                    await saveFlaggedLogs();
                    await saveData();
                    isEditMode = tempMode;
                    showToast("Migrated database to optimized structure.", "success");
                }

                // Retroactively extract dates for any old logs that didn't save them
                if(appState.discordLogs) {
                    appState.discordLogs.forEach(l => {
                        if(!l.date && l.raw) {
                            const lines = l.raw.split('\n');
                            const header = lines[0] || '';
                            const dashIndex = Math.max(header.lastIndexOf('—'), header.lastIndexOf('--'));
                            if (dashIndex !== -1) {
                                let dMatch = header.substring(dashIndex + 1).trim();
                                lines.forEach(line => {
                                    if(line.toLowerCase().includes('date:')) {
                                        dMatch = line.split(':')[1].trim();
                                    }
                                });
                                l.date = parseDateToYYYYMMDD(dMatch);
                            } else {
                                l.date = "Unknown";
                            }
                        } else if (l.date && l.date !== "Unknown") {
                            l.date = parseDateToYYYYMMDD(l.date);
                        }
                    });
                }
            } catch(e) {
                console.error("Cloud load error.", e);
                showToast("Error loading cloud data.", "error");
            }
            
            setupLockListener();
        }

        function setUIEditMode(enabled) {
            isEditMode = enabled;
            const btn = document.getElementById('btn-edit-mode');
            const icon = document.getElementById('icon-edit-mode');
            const text = document.getElementById('text-edit-mode');
            if(!btn) return;
            
            if (enabled) {
                btn.className = "flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 rounded px-3 py-1.5 text-sm text-white transition-colors font-medium";
                icon.className = "fa-solid fa-lock-open";
                text.innerText = "Edit Mode Active";
                
                const styleEl = document.getElementById('read-only-style');
                if (styleEl) styleEl.remove();
                
            } else {
                btn.className = "flex items-center gap-2 bg-slate-700 hover:bg-slate-600 rounded px-3 py-1.5 text-sm text-white transition-colors font-medium border border-slate-600";
                icon.className = "fa-solid fa-lock";
                text.innerText = "Enable Edit Mode";
                
                let styleEl = document.getElementById('read-only-style');
                if (!styleEl) {
                    styleEl = document.createElement('style');
                    styleEl.id = 'read-only-style';
                    styleEl.innerHTML = `
                        button[onclick*="delete"], 
                        button[onclick*="edit"], 
                        button[onclick*="resetAppData"], 
                        button[onclick*="togglePaymentStatus"], 
                        button[onclick*="approve"], 
                        button[onclick*="openFlaggedModal"],
                        button[onclick*="openModal('modal-roster')"],
                        #nav-roster, 
                        #nav-hcbonus, 
                        #nav-payouts,
                        #ingest-container { display: none !important; }
                    `;
                    document.head.appendChild(styleEl);
                }
            }
        }
        
        async function toggleEditMode() {
            if (!db) return;
            const lockRef = db.collection('app_state').doc('lock');
            
            if (isEditMode) {
                await lockRef.set({ lockedBy: null, lockedAt: null });
                setUIEditMode(false);
                showToast("Edit Mode disabled. Lock released.", "info");
            } else {
                try {
                    const doc = await lockRef.get();
                    const now = Date.now();
                    
                    // Secret URL parameter to force acquire lock
                    const urlParams = new URLSearchParams(window.location.search);
                    const forceOverride = urlParams.has('forceEdit');
                    
                    if (doc.exists) {
                        const data = doc.data();
                        if (data.lockedBy && data.lockedBy !== editLockSessionId) {
                            const lockedTime = data.lockedAt ? data.lockedAt.toMillis() : 0;
                            if (now - lockedTime < 1800000 && !forceOverride) {
                                showToast("Another officer is currently editing. Please wait.", "warning");
                                return;
                            }
                        }
                    }
                    
                    await lockRef.set({
                        lockedBy: editLockSessionId,
                        lockedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    setUIEditMode(true);
                    if (forceOverride) {
                        showToast("Edit Mode acquired (Force Override).", "success");
                    } else {
                        showToast("Edit Mode acquired.", "success");
                    }
                    
                } catch (e) {
                    console.error("Lock error", e);
                    showToast("Failed to acquire edit lock.", "error");
                }
            }
        }
        
        function setupLockListener() {
            if (!db) return;
            if (lockUnsubscribe) lockUnsubscribe();
            
            lockUnsubscribe = db.collection('app_state').doc('lock').onSnapshot(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    if (data.lockedBy && data.lockedBy !== editLockSessionId) {
                        if (isEditMode) {
                            showToast("Your edit lock was claimed by another session.", "error");
                            setUIEditMode(false);
                        }
                    }
                }
                
                if (!isEditMode) {
                    setUIEditMode(false);
                }
            });
            
            window.addEventListener('beforeunload', () => {
                if (isEditMode && db) {
                    db.collection('app_state').doc('lock').update({ lockedBy: null, lockedAt: null }).catch(()=>{});
                }
            });
        }

        async function resetAppData() {
            if(confirm('Are you sure you want to reset ALL data? This cannot be undone.')) {
                if(db) {
                    await db.collection('app_state').doc('master_state').delete().catch(()=>{});
                    await db.collection('app_state').doc('lock').delete().catch(()=>{});
                }
                localStorage.removeItem('ems_hrms_data');
                location.reload();
            }
        }

        /* ================= UTILS ================= */
        function showToast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `toast flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border glass-panel w-80 text-sm font-medium ${type === 'success' ? 'border-emerald-500/50 text-emerald-400' : type === 'error' ? 'border-rose-500/50 text-rose-400' : type === 'warning' ? 'border-amber-500/50 text-amber-400' : 'border-indigo-500/50 text-indigo-400'}`;
            
            const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-circle-xmark' : type === 'warning' ? 'fa-triangle-exclamation' : 'fa-info-circle';
            
            toast.innerHTML = `<i class="fa-solid ${icon} text-lg"></i> <span>${message}</span>`;
            
            container.appendChild(toast);
            
            setTimeout(() => {
                toast.classList.add('hide');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        function parseDateToYYYYMMDD(dateStr) {
            if (!dateStr) return new Date().toISOString().split('T')[0];
            let ds = String(dateStr).toLowerCase().trim();
            
            ds = ds.split(' at ')[0].trim();
            ds = ds.replace(/\s+\d{1,2}:\d{2}\s*(AM|PM|am|pm)?/i, '').trim();
            
            // If already YYYY-MM-DD (regex match), just return
            if (/^\d{4}-\d{2}-\d{2}$/.test(ds)) return ds;
            
            let d = new Date();
            if (ds === 'yesterday') {
                d.setDate(d.getDate() - 1);
            } else if (ds === 'today') {
                // leave as today
            } else {
                let p = new Date(ds);
                if (!isNaN(p.getTime())) {
                    d = p;
                } else {
                    const parts = ds.split(/[\/\-]/);
                    if (parts.length === 3) {
                        d = new Date(parts[2], parts[1]-1, parts[0]);
                    }
                }
            }
            
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        /* ================= NAVIGATION & MODALS ================= */
        function switchTab(tabId) {
            appState.currentTab = tabId;
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.nav-btn').forEach(el => {
                el.classList.remove('bg-indigo-600/10', 'text-indigo-400', 'border-indigo-500/20');
                el.classList.add('text-slate-300', 'border-transparent');
            });
            document.getElementById(`tab-${tabId}`).classList.add('active');
            const activeBtn = document.getElementById(`nav-${tabId}`);
            if(activeBtn) {
                activeBtn.classList.remove('text-slate-300', 'border-transparent');
                activeBtn.classList.add('bg-indigo-600/10', 'text-indigo-400', 'border-indigo-500/20');
            }
            renderCurrentTab();
        }

        function toggleAIAnalyst(enabled) {
            const btn = document.getElementById('nav-ai-analyst');
            if (enabled) {
                btn.classList.remove('hidden');
                showToast('AI Analyst Enabled (Mockup)', 'info');
            } else {
                btn.classList.add('hidden');
                if (appState.currentTab === 'ai-analyst') switchTab('dashboard');
                showToast('AI Analyst Disabled', 'info');
            }
        }

        function openModal(modalId) {
            document.getElementById(modalId).classList.remove('hidden');
        }
        function closeModal(modalId) {
            document.getElementById(modalId).classList.add('hidden');
        }
        function openBonusRatesModal() { openModal('modal-bonus'); }
        function openHCModal() { openModal('modal-hcbonus'); }
        function openFlaggedModal() { renderFlaggedLogs(); openModal('modal-flagged'); }
        function openRosterModal(id = null) {
            if (id) {
                const emp = appState.roster.find(r => r.id === id);
                if(emp) {
                    document.getElementById('roster-modal-title').innerHTML = `<i class="fa-solid fa-user-pen text-emerald-400 mr-2"></i> Edit Paramedic`;
                    document.getElementById('roster-id').value = emp.id;
                    document.getElementById('roster-badge').value = emp.badge;
                    document.getElementById('roster-name').value = emp.name;
                    document.getElementById('roster-rank').value = emp.rank;
                    document.getElementById('roster-discord').value = emp.discord;
                    document.getElementById('roster-multiplier').value = emp.multiplier;
                    document.getElementById('roster-status').value = emp.status;
                }
            } else {
                document.getElementById('roster-modal-title').innerHTML = `<i class="fa-solid fa-user-plus text-emerald-400 mr-2"></i> Add Paramedic`;
                document.getElementById('roster-id').value = '';
                document.getElementById('roster-badge').value = '';
                document.getElementById('roster-name').value = '';
                document.getElementById('roster-rank').value = '';
                document.getElementById('roster-discord').value = '';
                document.getElementById('roster-multiplier').value = '1.0';
                document.getElementById('roster-status').value = 'Active';
            }
            openModal('modal-roster');
        }

        /* ================= CORE LOGIC ================= */
        // Calculate duration between On and Off times handling midnight crossings
        function calculateDurationMinutes(onTimeStr, offTimeStr) {
            if(!onTimeStr || !offTimeStr) return null;
            const parseTime = (timeStr) => {
                const [h, m] = timeStr.trim().split(':').map(Number);
                if(isNaN(h) || isNaN(m)) return null;
                return h * 60 + m;
            };
            const onMins = parseTime(onTimeStr);
            const offMins = parseTime(offTimeStr);
            if(onMins === null || offMins === null) return null;

            let duration = offMins - onMins;
            if(duration < 0) duration += 24 * 60; // Midnight crossing
            return duration + appState.bufferTimeMinutes;
        }

        // Determine if shift is mostly night or day based on Start time for simplicity, or we can split it. 
        // For simplicity based on prompt: Night Shift (00:00 to 06:00). We check if OnDuty starts in that range.
        function isNightShift(onTimeStr) {
            if(!onTimeStr) return false;
            const h = parseInt(onTimeStr.split(':')[0], 10);
            return h >= 0 && h < 6;
        }

        function generateHashId(name) {
            let hash = 0;
            for (let i = 0; i < name.length; i++) {
                hash = name.charCodeAt(i) + ((hash << 5) - hash);
            }
            return Math.abs(hash).toString().substring(0, 6).padStart(6, '0');
        }

        // Parser
        function ingestLogs() {
            const rawText = document.getElementById('ingest-textarea').value;
            if(!rawText.trim()) { showToast('No text to ingest', 'warning'); return; }
            
            // Intelligent Block Splitting
            const lines = rawText.trim().split('\n').map(l => l.trim()).filter(l => l);
            const blocks = [];
            let currentBlock = [];
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // A header line typically contains a dash separator and isn't a duty/task line
                const lowerLine = line.toLowerCase();
                const isDutyOrTask = lowerLine.startsWith('on duty') || 
                                     lowerLine.startsWith('off duty') || 
                                     lowerLine.startsWith('date:') || 
                                     lowerLine.startsWith('captchas') || 
                                     lowerLine.startsWith('deliveries');
                                     
                const hasDash = line.includes('—') || line.includes('--');
                
                if (hasDash && !isDutyOrTask) {
                    if (currentBlock.length > 0) {
                        blocks.push(currentBlock.join('\n'));
                    }
                    currentBlock = [line];
                } else {
                    currentBlock.push(line);
                }
            }
            if (currentBlock.length > 0) {
                blocks.push(currentBlock.join('\n'));
            }

            let parsedCount = 0;
            let successCount = 0;
            let flaggedCount = 0;
            let duplicateCount = 0;
            let totalHoursAdded = 0;
            
            const channelId = document.getElementById('ingest-channel')?.value;

            blocks.forEach(block => {
                parsedCount++;
                
                if (appState.discordLogs.some(l => l.raw === block)) {
                    duplicateCount++;
                    return;
                }

                const result = ingestSingleLog(block, false, channelId);
                if (result.success) {
                    successCount++;
                    totalHoursAdded += result.hrs;
                } else {
                    flaggedCount++;
                }
            });

            document.getElementById('summary-parsed').innerText = parsedCount;
            document.getElementById('summary-success').innerText = successCount;
            document.getElementById('summary-flagged').innerText = flaggedCount;
            document.getElementById('summary-hours').innerText = totalHoursAdded.toFixed(1);
            
            let dupEl = document.getElementById('summary-duplicate');
            if (dupEl) dupEl.innerText = duplicateCount;

            document.getElementById('ingest-textarea').value = '';
            showToast(`Ingested ${successCount} logs successfully. Skipped ${duplicateCount} duplicates.`, 'success');
            
            recalculateEverything();
            saveDiscordLogs();
            saveFlaggedLogs();
            saveData();
        }

        function ingestSingleLog(block, isManual = false, channelId = null) {
            const lines = block.split('\n').map(l => l.trim()).filter(l => l);
            if(lines.length < 2) {
                if(!isManual) appState.flaggedLogs.push({ id: Date.now()+Math.random(), raw: block, reason: "Incomplete log entry (less than 2 lines)", status: 'pending', channelId });
                return { success: false, reason: "Incomplete log entry" };
            }

            const header = lines[0];
            const dashIndex = Math.max(header.lastIndexOf('—'), header.lastIndexOf('--'));
            if(dashIndex === -1 && !header.includes('fix this')) {
                if(!isManual) appState.flaggedLogs.push({ id: Date.now()+Math.random(), raw: block, reason: "Malformed header (no dash separator)", status: 'pending', channelId });
                return { success: false, reason: "Malformed header" };
            }

            if(header.includes('fix this') || header.includes('edited')) {
                return { success: false, reason: "Ignored noise" };
            }

            const prefixPart = header.substring(0, dashIndex).trim();
            const timePart = header.substring(dashIndex + 1).trim();

            let cleanedPrefix = prefixPart.replace(/\[.*?\]/g, '').replace(/,/g, '').trim();
            const parts = cleanedPrefix.split('|').map(s => s.trim());
            
            let rank = "Paramedic", name = "Unknown", badge = "";
            if(parts.length === 3) {
                [rank, name, badge] = parts;
            } else if(parts.length === 2) {
                name = parts[0]; badge = parts[1];
            } else {
                name = parts[0];
            }
            if(!badge || isNaN(parseInt(badge))) badge = generateHashId(name);

            let emp = appState.roster.find(r => r.badge === badge);
            if(!emp) {
                emp = { id: badge, badge, name, rank, discord: '', multiplier: 1.0, status: 'Active' };
                appState.roster.push(emp);
            }

            let onDutyMatch = null, offDutyMatch = null;
            let captchasMatch = null, deliveriesMatch = null;
            let dateMatch = timePart;

            lines.forEach(line => {
                const l = line.toLowerCase();
                if(l.includes('on duty') || l.includes('onduty')) onDutyMatch = line;
                if(l.includes('off duty') || l.includes('offduty')) offDutyMatch = line;
                if(l.includes('captcha')) captchasMatch = line;
                if(l.includes('deliver')) deliveriesMatch = line;
                if(l.includes('date:')) dateMatch = line.split(':')[1].trim();
            });

            // Handle Counts format (Captchas / Deliveries)
            if (captchasMatch || deliveriesMatch) {
                if (channelId && channelId !== '1081157781530357778' && channelId !== '1151594608460038245') {
                    if(!isManual) appState.flaggedLogs.push({ id: Date.now()+Math.random(), raw: block, reason: "Captchas/Deliveries only allowed in Lab channels", status: 'pending', channelId });
                    return { success: false, reason: "Invalid channel for counts" };
                }
                
                let captchasCount = 0;
                let deliveriesCount = 0;
                if (captchasMatch) {
                    const match = captchasMatch.match(/\d+/);
                    if (match) captchasCount = parseInt(match[0], 10);
                }
                if (deliveriesMatch) {
                    const match = deliveriesMatch.match(/\d+/);
                    if (match) deliveriesCount = parseInt(match[0], 10);
                }

                appState.discordLogs.push({
                    id: Date.now() + Math.random(),
                    empId: emp.id,
                    raw: block,
                    date: parseDateToYYYYMMDD(dateMatch),
                    type: 'counts',
                    captchas: captchasCount,
                    deliveries: deliveriesCount,
                    week: appState.currentHourlyWeek
                });
                return { success: true, hrs: 0 };
            }

            if(!onDutyMatch || !offDutyMatch) {
                if(!isManual) appState.flaggedLogs.push({ id: Date.now()+Math.random(), raw: block, reason: "Missing On or Off Duty timestamps", status: 'pending', channelId });
                return { success: false, reason: "Missing timestamps" };
            }

            const extractTime = (str) => {
                const match = str.match(/\b(\d{1,2}:\d{2})\s*(AM|PM|am|pm)?\b/i);
                if (!match) return null;
                let [_, time, ampm] = match;
                let [h, m] = time.split(':').map(Number);
                if (ampm) {
                    ampm = ampm.toLowerCase();
                    if (h === 12 && ampm === 'am') h = 0;
                    else if (h < 12 && ampm === 'pm') h += 12;
                }
                return h * 60 + m;
            };
            
            let onMins = extractTime(onDutyMatch);
            let offMins = extractTime(offDutyMatch);
            let headerMins = extractTime(timePart);

            if(onMins === null || offMins === null) {
                if(!isManual) appState.flaggedLogs.push({ id: Date.now()+Math.random(), raw: block, reason: "Malformed time format", status: 'pending' });
                return { success: false, reason: "Malformed time format" };
            }

            // Midnight Crossing & Missing PM check using Header Timestamp (IST)
            if (offMins < onMins) {
                let missingPM = (offMins + 12 * 60) - onMins;
                if (headerMins !== null && missingPM > 0 && missingPM < 16 * 60 && (offMins + 12 * 60) <= headerMins + 120) {
                    offMins += 12 * 60; // Correct the missing PM
                }
            }

            let durationMins = offMins - onMins;
            if (durationMins < 0) durationMins += 24 * 60; // True midnight crossing

            // Buffer Time Logic (Cap at 60 mins)
            if (durationMins < 60) {
                durationMins += appState.bufferTimeMinutes;
                if (durationMins > 60) durationMins = 60;
            }
            const hrs = durationMins / 60;

            // Lazy Category Detection
            const matchCategory = (str) => {
                const s = str.toLowerCase();
                if (s.includes('ph') && s.includes('back')) return 'PH back';
                if (s.includes('ph') || s.includes('front')) return 'PH front';
                if (s.includes('sh') || s.includes('second')) return 'SH';
                if (s.includes('lab') || s.includes('captcha')) return 'Labs';
                if (s.includes('call') || s.includes('gs')) return 'Calls';
                
                if (s.includes('fto') && (s.includes('day 1') || s.includes('day1'))) return 'FTO Day 1';
                if (s.includes('fto') && (s.includes('day 2') || s.includes('day2'))) return 'FTO Day 2';
                if (s.includes('fto') && s.includes('exam')) return 'FTO Exams';
                if (s.includes('fto')) return 'FTO Day 1';
                
                return null;
            };

            let category = matchCategory(onDutyMatch) || matchCategory(offDutyMatch);
            if (!category) {
                if(!isManual) appState.flaggedLogs.push({ id: Date.now()+Math.random(), raw: block, reason: "Could not detect valid category/location", status: 'pending', channelId });
                return { success: false, reason: "Invalid category" };
            }
            
            if (channelId) {
                const c = category.toLowerCase();
                const isLabChannel = (channelId === '1081157781530357778' || channelId === '1151594608460038245');
                if (isLabChannel && c !== 'labs') {
                    if(!isManual) appState.flaggedLogs.push({ id: Date.now()+Math.random(), raw: block, reason: "Only Labs allowed in this channel", status: 'pending', channelId });
                    return { success: false, reason: "Invalid category for lab channel" };
                }
                if (!isLabChannel && c === 'labs') {
                    if(!isManual) appState.flaggedLogs.push({ id: Date.now()+Math.random(), raw: block, reason: "Labs category not allowed in duty rota channels", status: 'pending', channelId });
                    return { success: false, reason: "Invalid category for duty channel" };
                }
            }

            // IST to BST Conversion for Night Shift
            const toBST = (mins) => {
                let bst = mins - 270;
                if (bst < 0) bst += 24 * 60;
                return bst;
            };
            const bstOnMins = toBST(onMins);
            const isNight = (bstOnMins >= 0 && bstOnMins < 6 * 60);

            appState.discordLogs.push({
                id: Date.now() + Math.random(),
                empId: emp.id,
                raw: block,
                date: parseDateToYYYYMMDD(dateMatch),
                type: 'duty',
                onTime: `${Math.floor(onMins/60).toString().padStart(2,'0')}:${(onMins%60).toString().padStart(2,'0')}`,
                offTime: `${Math.floor(offMins/60).toString().padStart(2,'0')}:${(offMins%60).toString().padStart(2,'0')}`,
                durationHrs: hrs,
                category,
                isNight,
                week: appState.currentHourlyWeek
            });
            
            return { success: true, hrs };
        }

        function loadSampleBatch() {
            const sampleText = `Trainee | Tryyyyy Barnes |138693 — Yesterday at 12:23 AM\nOn Duty SH: 19:48\nOff Duty SH: 20:10\n\nMD | Ashley Allyson | 174267 — Yesterday at 3:23 AM\nOn Duty SH : 22:54\nOff Duty SH : 01:07\n\nHR | Dheeraj Reddy | 178077 — 1:22 AM\nDate: 03/08/2026\nCaptchas Completed: 11\nDeliveries Made: 5\n\nTrainee | Patel Cartel |181707 — Yesterday at 7:13 AM\nOn Duty PH Front: 2:43\nOff Duty PH Front : 4:00\n\nHOD | Arata kanzaki | 64531 — Yesterday at 7:15 AM\nfix this\n\nIntern | Gurinayat Deol | 181640 [GRND],  — Yesterday at 8:44 AM\nOn Duty GS Calls: 04:11\nOff Duty GS Calls: 05:49\n\nMS | AliNawaz KingSlayer — Yesterday at 9:06 AM\nOn Duty PH Front: 4:31\nOff Duty PH Front :05:56\n\nIntern | Gurinayat Deol | 181640 [GRND],  — Yesterday at 10:27 AM\nOn Duty PH Front : 05:57\nOff Duty PH Front : 06:22\n\nTrainee | Tryyyyy Barnes |138693 — Yesterday at 11:11 AM\nOn Duty SH: 6:41\nOff Duty SH: 8:12\n\nIntern | Gurinayat Deol | 181640 [GRND],  — Yesterday at 11:57 AM\nOn Duty GS Calls: 07:27\nOff Duty GS Calls: 08:20\n\nTrainee | Austin Slime | 181811 — Yesterday at 11:57 AM\nOn Duty SH: 07:26\nOff Duty SH: 07:54\n\nKushwant.Plays — Yesterday at 2:17 PM\nOn Duty PH Front : 09:46\nOff Duty PH Front : 11:07\n\nTrainee | Patel Cartel |181707 — Yesterday at 3:38 PM\nOn Duty PH Front: 11:08\nOff Duty PH Front : 13:36\n\nMD | Ashley Allyson | 174267 — Yesterday at 3:49 PM\nOn Duty SH : 11:18\nOff Duty SH : 12:37\n\nTrainee | Austin Slime | 181811 — Yesterday at 5:09 PM\nOn Duty SH: 12:38\nOff Duty SH: 15:00\n\nTrainee | Tryyyyy Barnes |138693 — Yesterday at 6:07 PM\nOn Duty PH Front: 13:37\nOff Duty PH Front :\n\nTrainee | Patel Cartel |181707 — Yesterday at 10:45 PM\nOn Duty SH: 18:14\nOff Duty SH:\n\nTrainee | rayan vortex | 181726 [GRND],  — 12:58 AM\nOn Duty LABS : 16:46\nOff Duty LABS  : 20:27\n\nFR | Bablu Badmosh | 174062 — 2:17 AM\nOn Duty PH Front: 16:41\nOff Duty PH Front : 21:09`;
            document.getElementById('ingest-textarea').value = sampleText;
            showToast('Sample batch loaded. Click Ingest All Logs.', 'info');
        }
        function clearIngest() { document.getElementById('ingest-textarea').value = ''; }

        // Recalculation Engine
        function recalculateEverything() {
            // Rebuild hourlyData based on current logs and buffer
            appState.hourlyData = {};
            
            // Loop through all logs, filtered by global dates
            const fromDate = globalDateFrom ? new Date(globalDateFrom) : null;
            const toDate = globalDateTo ? new Date(globalDateTo) : null;

            appState.discordLogs.forEach(log => {
                if(log.date && fromDate && toDate) {
                    const logDate = new Date(log.date);
                    if(logDate < fromDate || logDate > toDate) {
                        return; // Skip logs outside the selected global date range
                    }
                }

                // Group strictly by employee ID instead of week
                const key = log.empId;
                if(!appState.hourlyData[key]) {
                    appState.hourlyData[key] = {
                        empId: log.empId, shifts: 0, dutyHrs: 0, 
                        nightBonus: 0, dayBonus: 0, labFtoBonus: 0, tierBonus: 0, totalPayout: 0
                    };
                }
                
                const rec = appState.hourlyData[key];
                rec.shifts++;
                
                if (log.type === 'counts') {
                    rec.labFtoBonus += (log.captchas || 0) * appState.bonusRates.lab.captcha;
                    rec.labFtoBonus += (log.deliveries || 0) * appState.bonusRates.lab.medicineDelivery;
                    return; // Skip shift duration logic
                }

                // Recalculate duration dynamically based on current global buffer
                const durationMins = calculateDurationMinutes(log.onTime, log.offTime);
                const hrs = durationMins ? durationMins / 60 : 0;
                rec.dutyHrs += hrs;

                // Calculate Shift Bonus
                let shiftBonus = 0;
                if(log.category === 'PH Front') shiftBonus = log.isNight ? appState.bonusRates.night.ph : appState.bonusRates.day.ph;
                else if(log.category === 'SH') shiftBonus = log.isNight ? appState.bonusRates.night.sh : appState.bonusRates.day.sh;
                else if(log.category === 'Calls') shiftBonus = log.isNight ? appState.bonusRates.night.calls : appState.bonusRates.day.calls;
                
                shiftBonus = shiftBonus * hrs;

                if(log.category === 'Labs') {
                    // Placeholder for lab unit based calculations (Assuming 1 hr log = 1 unit for simplicity in MVP without extra fields)
                    rec.labFtoBonus += appState.bonusRates.lab.captcha; 
                } else if(log.category.startsWith('FTO')) {
                    if (log.category === 'FTO Day 2') rec.labFtoBonus += appState.bonusRates.fto.day2;
                    else rec.labFtoBonus += appState.bonusRates.fto.day1;
                } else {
                    if(log.isNight) rec.nightBonus += shiftBonus;
                    else rec.dayBonus += shiftBonus;
                }
            });

            // Calculate Tier Bonuses & Total Payouts
            Object.values(appState.hourlyData).forEach(rec => {
                if(rec.dutyHrs < 20) rec.tierBonus = 10000;
                else if(rec.dutyHrs < 35) rec.tierBonus = 15000;
                else rec.tierBonus = 25000;

                const emp = appState.roster.find(r => r.id === rec.empId);
                const multiplier = emp ? emp.multiplier : 1.0;
                const baseWage = rec.dutyHrs * 1300;
                const totalBonuses = rec.nightBonus + rec.dayBonus + rec.labFtoBonus + rec.tierBonus;
                
                rec.totalPayout = (baseWage + totalBonuses) * multiplier;
            });

            updateFlaggedBadge();
            renderCurrentTab();
        }

        /* ================= RENDERING ================= */
        let chartsInstance = { timeline: null, distribution: null };

        function renderCurrentTab() {
            if(appState.currentTab === 'dashboard') renderDashboard();
            else if(appState.currentTab === 'discord-hub') renderIngestionHub();
            else if(appState.currentTab === 'roster') renderRoster();
            else if(appState.currentTab === 'hcbonus') renderHCBonus();
            else if(appState.currentTab === 'payouts') renderPayouts();
            else if(appState.currentTab === 'reports') renderReportsTab();
            saveData();
        }

        function getFilteredLogs() {
            const fromDate = globalDateFrom ? new Date(globalDateFrom) : null;
            const toDate = globalDateTo ? new Date(globalDateTo) : null;
            return appState.discordLogs.filter(log => {
                if(log.date && fromDate && toDate) {
                    const logDate = new Date(log.date);
                    if(logDate < fromDate || logDate > toDate) return false;
                }
                return true;
            });
        }

        function renderDashboard() {
            const termLogs = getFilteredLogs();
            const termHourlyData = Object.values(appState.hourlyData);
            let totalPayout = 0, totalHours = 0;
            termHourlyData.forEach(d => { totalPayout += d.totalPayout; totalHours += d.dutyHrs; });
            
            const activePersonnel = new Set(termLogs.map(l => l.empId)).size;
            const hcBonusTotal = appState.hcBonusData.filter(b => b.status === 'Approved').reduce((acc, curr) => acc + curr.amount, 0);

            document.getElementById('kpi-payout').innerText = totalPayout.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
            document.getElementById('kpi-hours').innerText = totalHours.toFixed(1) + ' hrs';
            document.getElementById('kpi-buffer-label').innerText = `+${appState.bufferTimeMinutes}m buff`;
            document.getElementById('kpi-personnel').innerText = activePersonnel;
            document.getElementById('kpi-hcbonus').innerText = hcBonusTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

            // Render Charts
            renderCharts(termLogs);

            // Leaderboard
            const leaderboard = [...termHourlyData].sort((a,b) => b.totalPayout - a.totalPayout).slice(0, 10);
            const leaderboardList = document.getElementById('dashboard-leaderboard');
            if(leaderboard.length === 0) {
                leaderboardList.innerHTML = '<li class="text-slate-500 italic text-center py-4">No data available</li>';
            } else {
                leaderboardList.innerHTML = leaderboard.map((d, index) => {
                    const emp = appState.roster.find(r => r.id === d.empId);
                    return `<li class="flex justify-between items-center bg-slate-800/40 p-2 rounded border border-slate-700/50">
                                <span><span class="text-slate-500 mr-2">#${index+1}</span> <span class="font-bold text-white">${emp ? emp.name : 'Unknown'}</span></span>
                                <span class="text-emerald-400 font-mono">${d.totalPayout.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</span>
                            </li>`;
                }).join('');
            }

            // Recent Feed
            const feedList = document.getElementById('dashboard-feed');
            const recentLogs = [...termLogs].reverse().slice(0, 10);
            if(recentLogs.length === 0) {
                feedList.innerHTML = '<li class="text-slate-500 italic text-center py-4">No recent activity</li>';
            } else {
                feedList.innerHTML = recentLogs.map(l => {
                    const emp = appState.roster.find(r => r.id === l.empId);
                    return `<li class="flex flex-col bg-slate-800/40 p-2 rounded border border-slate-700/50">
                                <div class="flex justify-between">
                                    <span class="font-bold text-indigo-300">${emp ? emp.name : 'Unknown'}</span>
                                    <span class="text-xs text-slate-500">${l.date}</span>
                                </div>
                                <div class="text-xs text-slate-400 mt-1 flex justify-between">
                                    <span>${l.category} (${l.durationHrs.toFixed(1)}h)</span>
                                    <span>${l.onTime} - ${l.offTime}</span>
                                </div>
                            </li>`;
                }).join('');
            }
        }

        function renderCharts(termLogs) {
            // Destroy existing
            if(chartsInstance.timeline) chartsInstance.timeline.destroy();
            if(chartsInstance.distribution) chartsInstance.distribution.destroy();

            if(termLogs.length === 0) return;

            // Distribution
            const catCounts = {};
            termLogs.forEach(l => { catCounts[l.category] = (catCounts[l.category] || 0) + l.durationHrs; });
            
            const distCtx = document.getElementById('chart-distribution').getContext('2d');
            chartsInstance.distribution = new Chart(distCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(catCounts),
                    datasets: [{
                        data: Object.values(catCounts),
                        backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'],
                        borderColor: '#1e293b',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1' } } }
                }
            });

            // Timeline Mock (Binning by date string for MVP)
            const dateBins = {};
            termLogs.forEach(l => {
                dateBins[l.date] = (dateBins[l.date] || 0) + l.durationHrs;
            });

            const timelineCtx = document.getElementById('chart-timeline').getContext('2d');
            chartsInstance.timeline = new Chart(timelineCtx, {
                type: 'line',
                data: {
                    labels: Object.keys(dateBins),
                    datasets: [{
                        label: 'Duty Hours',
                        data: Object.values(dateBins),
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.2)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { grid: { color: '#334155' }, ticks: { color: '#cbd5e1' } },
                        x: { grid: { display: false }, ticks: { color: '#cbd5e1' } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }

        function renderIngestionHub() {
            const select = document.getElementById('ingest-channel');
            select.innerHTML = appState.discordChannels.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            
            const list = document.getElementById('channel-list');
            list.innerHTML = appState.discordChannels.map(c => `
                <li class="flex justify-between items-center bg-slate-800/30 p-2 rounded">
                    <span><i class="fa-solid fa-hashtag text-slate-500 mr-2"></i>${c.name}</span>
                    <span class="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">${c.category}</span>
                </li>
            `).join('');

            updateFlaggedBadge();
            saveData();
        }

        function updateFlaggedBadge() {
            const count = appState.flaggedLogs.length;
            const badge = document.getElementById('flagged-badge');
            const banner = document.getElementById('flagged-banner');
            document.getElementById('flagged-count').innerText = count;

            if(count > 0) {
                badge.innerText = count;
                badge.classList.remove('hidden');
                banner.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
                banner.classList.add('hidden');
            }
        }

        function renderFlaggedLogs() {
            const container = document.getElementById('flagged-logs-container');
            if(appState.flaggedLogs.length === 0) {
                container.innerHTML = '<p class="text-slate-400 text-center py-8">No flagged logs in queue.</p>';
                return;
            }

            container.innerHTML = appState.flaggedLogs.map(f => `
                <div class="bg-slate-900 border border-slate-700 rounded-lg p-4 flex flex-col gap-3">
                    <div class="flex justify-between items-center">
                        <span class="text-rose-400 font-bold text-sm"><i class="fa-solid fa-bug mr-2"></i> ${f.reason}</span>
                        <div class="flex gap-2">
                            <button onclick="includeFlagged('${f.id}')" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded transition-colors font-medium">Include</button>
                            <button onclick="dismissFlagged('${f.id}')" class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded transition-colors">Discard</button>
                        </div>
                    </div>
                    <textarea id="flagged-raw-${f.id}" class="w-full h-24 bg-black/50 border border-slate-700 rounded p-3 text-xs text-slate-300 font-mono resize-y focus:outline-none focus:border-indigo-500">${f.raw}</textarea>
                </div>
            `).join('');
        }

        function includeFlagged(id) {
            const textarea = document.getElementById(`flagged-raw-${id}`);
            if (!textarea) return;
            const newRaw = textarea.value.trim();
            const result = ingestSingleLog(newRaw, true);
            
            if (result.success) {
                appState.flaggedLogs = appState.flaggedLogs.filter(f => f.id.toString() !== id.toString());
                renderFlaggedLogs();
                updateFlaggedBadge();
                recalculateEverything();
                saveDiscordLogs();
                saveFlaggedLogs();
                saveData();
                showToast('Log successfully included!', 'success');
            } else {
                showToast(`Still invalid: ${result.reason}`, 'error');
            }
        }

        function dismissFlagged(id) {
            appState.flaggedLogs = appState.flaggedLogs.filter(f => f.id.toString() !== id.toString());
            renderFlaggedLogs();
            updateFlaggedBadge();
            saveFlaggedLogs();
        }

        function renderRoster() {
            const tbody = document.getElementById('roster-table-body');
            const search = document.getElementById('roster-search').value.toLowerCase();
            
            const filtered = appState.roster.filter(r => r.name.toLowerCase().includes(search) || r.badge.includes(search));
            
            tbody.innerHTML = filtered.map(r => `
                <tr class="hover:bg-slate-800/30 transition-colors">
                    <td class="px-4 py-3 font-mono text-indigo-300">${r.badge}</td>
                    <td class="px-4 py-3 font-bold text-white">${r.name}</td>
                    <td class="px-4 py-3"><span class="bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-300">${r.rank}</span></td>
                    <td class="px-4 py-3 text-slate-400">${r.discord}</td>
                    <td class="px-4 py-3 text-center text-amber-400 font-mono">${r.multiplier}x</td>
                    <td class="px-4 py-3 text-center">
                        <span class="px-2 py-0.5 rounded text-xs font-bold ${r.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-400'}">${r.status}</span>
                    </td>
                    <td class="px-4 py-3 text-right">
                        <button onclick="openEmployeeRecordsModal('${r.id}')" class="text-indigo-400 hover:text-indigo-300 mx-1" title="View Records"><i class="fa-solid fa-eye"></i></button>
                        <button onclick="openRosterModal('${r.id}')" class="text-indigo-400 hover:text-indigo-300 mx-1" title="Edit Employee"><i class="fa-solid fa-pen-to-square"></i></button>
                    </td>
                </tr>
            `).join('');
        }

        function saveRoster() {
            const id = document.getElementById('roster-id').value;
            const badge = document.getElementById('roster-badge').value;
            const name = document.getElementById('roster-name').value;
            const rank = document.getElementById('roster-rank').value;
            const discord = document.getElementById('roster-discord').value;
            const multiplier = parseFloat(document.getElementById('roster-multiplier').value) || 1.0;
            const status = document.getElementById('roster-status').value;

            if(!badge || !name) { showToast('Badge and Name are required', 'error'); return; }

            if(id) {
                const emp = appState.roster.find(r => r.id === id);
                if(emp) {
                    emp.badge = badge; emp.name = name; emp.rank = rank; emp.discord = discord; emp.multiplier = multiplier; emp.status = status;
                }
            } else {
                appState.roster.push({ id: badge, badge, name, rank, discord, multiplier, status });
            }

            closeModal('modal-roster');
            showToast('Paramedic saved successfully', 'success');
            recalculateEverything();
            saveData();
        }

        document.getElementById('roster-search').addEventListener('input', renderRoster);



        function renderHCBonus() {
            const tbody = document.getElementById('hc-table-body');
            if(appState.hcBonusData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-slate-500 italic">No HC Bonus evaluations submitted.</td></tr>';
                return;
            }

            tbody.innerHTML = appState.hcBonusData.map(b => `
                <tr class="hover:bg-slate-800/30 transition-colors">
                    <td class="px-4 py-3 font-mono text-slate-500">${b.supervisorId}</td>
                    <td class="px-4 py-3 font-bold text-white">${b.name}</td>
                    <td class="px-4 py-3 text-slate-400">${b.role}</td>
                    <td class="px-4 py-3 text-center text-slate-300">${b.week}</td>
                    <td class="px-4 py-3 text-center font-bold text-indigo-400">${b.score}/10</td>
                    <td class="px-4 py-3 text-right font-mono text-emerald-400 font-bold">${b.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</td>
                    <td class="px-4 py-3 text-center">
                        <span class="px-2 py-0.5 rounded text-xs font-bold ${b.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}">${b.status}</span>
                    </td>
                    <td class="px-4 py-3 text-right">
                        ${b.status === 'Pending' ? `<button onclick="approveHCBonus(${b.id})" class="text-emerald-400 hover:text-emerald-300 mr-2"><i class="fa-solid fa-check"></i></button>` : ''}
                        <button onclick="deleteHCBonus(${b.id})" class="text-rose-400 hover:text-rose-300"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');

            const select = document.getElementById('hc-supervisor-select');
            select.innerHTML = appState.roster.map(r => `<option value="${r.id}">${r.name} (${r.badge})</option>`).join('');
        }

        // Simple Score based bonus
        document.getElementById('hc-score').addEventListener('input', (e) => {
            const val = parseInt(e.target.value) || 0;
            document.getElementById('hc-amount').value = val * 50000;
        });

        function submitHCBonus() {
            const supervisorId = document.getElementById('hc-supervisor-select').value;
            const week = document.getElementById('hc-week-select').value;
            const score = parseInt(document.getElementById('hc-score').value) || 0;
            const amount = score * 50000;

            const emp = appState.roster.find(r => r.id === supervisorId);
            if(!emp) return;

            appState.hcBonusData.push({
                id: Date.now(),
                supervisorId: emp.badge,
                name: emp.name,
                role: emp.rank,
                week, score, amount, status: 'Pending'
            });

            closeModal('modal-hcbonus');
            showToast('HC Bonus evaluation submitted for approval.', 'success');
            renderHCBonus();
            saveData();
        }

        function approveHCBonus(id) {
            const bonus = appState.hcBonusData.find(b => b.id === id);
            if(bonus) {
                bonus.status = 'Approved';
                showToast(`Bonus for ${bonus.name} approved!`, 'success');
                renderHCBonus();
                if(appState.currentTab === 'dashboard') renderDashboard();
                saveData();
            }
        }
        function deleteHCBonus(id) {
            appState.hcBonusData = appState.hcBonusData.filter(b => b.id !== id);
            showToast('Bonus entry deleted.', 'info');
            renderHCBonus();
            saveData();
        }

        function saveBonusRates() {
            appState.bonusRates.night.ph = parseInt(document.getElementById('rate-night-ph').value) || 0;
            appState.bonusRates.night.sh = parseInt(document.getElementById('rate-night-sh').value) || 0;
            appState.bonusRates.night.calls = parseInt(document.getElementById('rate-night-calls').value) || 0;
            
            appState.bonusRates.day.ph = parseInt(document.getElementById('rate-day-ph').value) || 0;
            appState.bonusRates.day.sh = parseInt(document.getElementById('rate-day-sh').value) || 0;
            appState.bonusRates.day.calls = parseInt(document.getElementById('rate-day-calls').value) || 0;
            
            appState.bonusRates.lab.captcha = parseInt(document.getElementById('rate-lab-captcha').value) || 0;
            appState.bonusRates.lab.delivery = parseInt(document.getElementById('rate-lab-delivery').value) || 0;
            
            appState.bonusRates.fto.day1 = parseInt(document.getElementById('rate-fto-day1').value) || 0;
            appState.bonusRates.fto.day2 = parseInt(document.getElementById('rate-fto-day2').value) || 0;

            closeModal('modal-bonus');
            showToast('Bonus rates updated.', 'success');
            recalculateEverything();
            saveData();
        }

        /* ================= CSV & AI ================= */
        function allowDrop(e) { e.preventDefault(); document.getElementById('drop-zone').classList.add('border-indigo-500'); }
        function handleDrop(e) {
            e.preventDefault();
            document.getElementById('drop-zone').classList.remove('border-indigo-500');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                showToast('CSV uploaded (Mock). Parsing...', 'success');
            }
        }
        function handleFileUpload(e) {
            if(e.target.files.length > 0) showToast('CSV uploaded (Mock). Parsing...', 'success');
        }


        function sendAiMessage() {
            const input = document.getElementById('ai-input');
            const msg = input.value.trim();
            if(!msg) return;
            
            appendAiLog(msg, true);
            input.value = '';
            
            setTimeout(() => {
                appendAiLog("As a mockup, I am currently not connected to the real Gemini endpoint. But I can confirm your request: '" + msg + "'.");
            }, 800);
        }

        function mockAiResponse(prompt) {
            appendAiLog(prompt, true);
            setTimeout(() => {
                if(prompt.includes('Audit')) appendAiLog("I found 2 flagged logs. They appear to be missing Off-Duty timestamps. Shall I auto-fill them based on 10-minute average response times?");
                else if(prompt.includes('Summarize')) appendAiLog("The current Term Top Earner is Patel Cartel with $320,000 across 35 hours. Total Term Payout currently stands at $1,420,000.");
                else if(prompt.includes('Draft')) appendAiLog("Here is a draft:\n\n**EMS Weekly Update!**\nMassive shoutout to Patel Cartel and Ashley Allyson for leading the duty hours this week! Keep up the great work saving lives.");
            }, 1000);
        }

        function appendAiLog(msg, isUser=false) {
            const log = document.getElementById('chat-log');
            if(isUser) {
                log.innerHTML += `
                    <div class="flex gap-3 flex-row-reverse">
                        <div class="w-8 h-8 rounded bg-slate-700 flex items-center justify-center shrink-0 border border-slate-600 text-slate-300"><i class="fa-solid fa-user"></i></div>
                        <div class="bg-indigo-600/80 p-3 rounded-lg rounded-tr-none border border-indigo-500/50 text-sm text-white max-w-[80%]">${msg}</div>
                    </div>`;
            } else {
                log.innerHTML += `
                    <div class="flex gap-3">
                        <div class="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center shrink-0 border border-purple-500/30 text-purple-400"><i class="fa-solid fa-robot"></i></div>
                        <div class="bg-slate-800/80 p-3 rounded-lg rounded-tl-none border border-slate-700 text-sm text-slate-300 max-w-[80%] whitespace-pre-wrap">${msg}</div>
                    </div>`;
            }
            log.scrollTop = log.scrollHeight;
        }

        /* ================= CHANNELS MODAL ================= */
        function openChannelsModal() {
            renderChannelsTable();
            // Reset form
            document.getElementById('channel-original-key').value = '';
            document.getElementById('channel-key').value = '';
            document.getElementById('channel-name').value = '';
            document.getElementById('channel-id').value = '';
            document.getElementById('channel-category').value = 'Duty Rota';
            document.getElementById('channel-modal-title').innerHTML = `<i class="fa-solid fa-plus mr-2"></i> Add Channel`;
            openModal('modal-channels');
        }

        function renderChannelsTable() {
            const tbody = document.getElementById('channels-table-body');
            tbody.innerHTML = appState.discordChannels.map(c => `
                <tr class="hover:bg-slate-800/30 transition-colors">
                    <td class="px-4 py-3 font-medium text-white">${c.name}</td>
                    <td class="px-4 py-3 font-mono text-xs text-slate-400">${c.id}</td>
                    <td class="px-4 py-3"><span class="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded text-xs">${c.category}</span></td>
                    <td class="px-4 py-3 text-center">
                        <button onclick="toggleChannelStatus('${c.key}')" class="text-xs px-2 py-1 rounded border ${c.active ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-700/50 border-slate-600 text-slate-400'}">
                            ${c.active ? 'Active' : 'Inactive'}
                        </button>
                    </td>
                    <td class="px-4 py-3 text-right">
                        <button onclick="editChannel('${c.key}')" class="text-slate-400 hover:text-indigo-400 transition-colors mr-3" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="deleteChannel('${c.key}')" class="text-slate-400 hover:text-rose-400 transition-colors" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        }

        function editChannel(key) {
            const ch = appState.discordChannels.find(c => c.key === key);
            if(!ch) return;
            document.getElementById('channel-original-key').value = ch.key;
            document.getElementById('channel-key').value = ch.key;
            document.getElementById('channel-name').value = ch.name;
            document.getElementById('channel-id').value = ch.id;
            document.getElementById('channel-category').value = ch.category;
            document.getElementById('channel-modal-title').innerHTML = `<i class="fa-solid fa-pen mr-2"></i> Edit Channel`;
        }

        function saveChannel() {
            const origKey = document.getElementById('channel-original-key').value;
            const key = document.getElementById('channel-key').value.trim();
            const name = document.getElementById('channel-name').value.trim();
            const id = document.getElementById('channel-id').value.trim();
            const category = document.getElementById('channel-category').value;

            if(!key || !name || !id) {
                showToast('Please fill all fields', 'error');
                return;
            }

            if(origKey) {
                const ch = appState.discordChannels.find(c => c.key === origKey);
                if(ch) {
                    ch.key = key;
                    ch.name = name;
                    ch.id = id;
                    ch.category = category;
                    showToast('Channel updated successfully.', 'success');
                }
            } else {
                if(appState.discordChannels.find(c => c.key === key)) {
                    showToast('Channel key already exists', 'error');
                    return;
                }
                appState.discordChannels.push({ key, name, id, category, active: true });
                showToast('Channel added successfully.', 'success');
            }
            
            renderChannelsTable();
            if(appState.currentTab === 'discord-hub') renderIngestionHub();
            
            // Reset form
            document.getElementById('channel-original-key').value = '';
            document.getElementById('channel-key').value = '';
            document.getElementById('channel-name').value = '';
            document.getElementById('channel-id').value = '';
            document.getElementById('channel-category').value = 'Duty Rota';
            document.getElementById('channel-modal-title').innerHTML = `<i class="fa-solid fa-plus mr-2"></i> Add Channel`;
        }

        function deleteChannel(key) {
            appState.discordChannels = appState.discordChannels.filter(c => c.key !== key);
            showToast('Channel deleted.', 'info');
            renderChannelsTable();
            if(appState.currentTab === 'discord-hub') renderIngestionHub();
            saveData();
        }

        function toggleChannelStatus(key) {
            const ch = appState.discordChannels.find(c => c.key === key);
            if(ch) {
                ch.active = !ch.active;
                renderChannelsTable();
                saveData();
            }
        }

        /* ================= PAYOUTS ================= */
        function renderPayouts() {
            const tbody = document.getElementById('payouts-table-body');
            const empPayouts = {};
            
            Object.values(appState.hourlyData).forEach(d => {
                const emp = appState.roster.find(r => r.id === d.empId);
                const badge = emp ? emp.badge : d.empId;
                const name = emp ? emp.name : 'Unknown';
                
                if(!empPayouts[badge]) {
                    empPayouts[badge] = { name: name, badge: badge, totalHours: 0, totalPayout: 0 };
                }
                empPayouts[badge].totalHours += d.dutyHrs;
                empPayouts[badge].totalPayout += d.totalPayout;
            });


            let html = '';
            let grandTotal = 0;
            const sorted = Object.values(empPayouts).sort((a,b) => b.totalPayout - a.totalPayout);
            
            sorted.forEach(emp => {
                grandTotal += emp.totalPayout;
                const payoutKey = `${globalDateFrom}_${globalDateTo}_${emp.badge}`;
                const isPaid = !!appState.payouts[payoutKey];


                html += `
                    <tr class="hover:bg-slate-800/30 transition-colors">
                        <td class="px-4 py-3 font-mono text-indigo-300">${emp.badge}</td>
                        <td class="px-4 py-3 font-bold text-white">${emp.name}</td>
                        <td class="px-4 py-3 text-right text-slate-300">${emp.totalHours.toFixed(1)}h</td>
                        <td class="px-4 py-3 text-right font-mono text-emerald-400 font-bold">${emp.totalPayout.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</td>
                        <td class="px-4 py-3 text-center">
                            <span class="px-2 py-1 rounded text-xs border ${isPaid ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-amber-500/20 text-amber-400 border-amber-500/50'}">
                                ${isPaid ? '<i class="fa-solid fa-check mr-1"></i> Paid' : '<i class="fa-solid fa-clock mr-1"></i> Unpaid'}
                            </span>
                        </td>
                        <td class="px-4 py-3 text-right">
                            <button onclick="togglePaymentStatus('${payoutKey}')" class="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded transition-colors">
                                ${isPaid ? 'Mark Unpaid' : 'Mark Paid'}
                            </button>
                        </td>
                    </tr>
                `;
            });

            if(sorted.length === 0) {
                html = '<tr><td colspan="6" class="text-center text-slate-500 py-8">No payout data available for this term.</td></tr>';
            }

            tbody.innerHTML = html;
            document.getElementById('payouts-total-term').innerText = grandTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
        }

        function togglePaymentStatus(key) {
            appState.payouts[key] = !appState.payouts[key];
            saveData();
            renderPayouts();
        }

        // Reports Tab Rendering
        let reportCharts = { location: null, shift: null };

        let globalDateFrom = null;
        let globalDateTo = null;
        let currentReportView = 'aggregated';
        let currentReportSort = { col: 'totalHours', desc: true };

        function updateGlobalDateSelects() {
            const fromSelect = document.getElementById('global-date-from');
            const toSelect = document.getElementById('global-date-to');
            if(fromSelect && globalDateFrom) fromSelect.value = globalDateFrom;
            if(toSelect && globalDateTo) toSelect.value = globalDateTo;
        }

        function getGlobalDates() {
            if(!globalDateFrom) {
                const today = parseDateToYYYYMMDD('today');
                globalDateFrom = today;
                globalDateTo = today;
            }
            updateGlobalDateSelects();
            return { from: globalDateFrom, to: globalDateTo };
        }

        function triggerDateChange() {
            updateGlobalDateSelects();
            recalculateEverything();
            renderCurrentTab();
            if(!window.isSnapshotMode) saveData();
        }

        function navigateGlobalDate(dir) {
            if (!globalDateTo) getGlobalDates();
            const d = new Date(globalDateTo);
            d.setDate(d.getDate() + dir);
            const newDate = d.toISOString().split('T')[0];
            globalDateFrom = newDate;
            globalDateTo = newDate;
            triggerDateChange();
        }

        function setGlobalDateToday() {
            const today = parseDateToYYYYMMDD('today');
            globalDateFrom = today;
            globalDateTo = today;
            triggerDateChange();
        }

        function onGlobalDateChange() {
            globalDateFrom = document.getElementById('global-date-from').value;
            globalDateTo = document.getElementById('global-date-to').value;
            if(new Date(globalDateFrom) > new Date(globalDateTo)) {
                globalDateFrom = globalDateTo;
            }
            triggerDateChange();
        }

        function switchReportView(viewName) {
            currentReportView = viewName;
            
            const btnAgg = document.getElementById('btn-view-aggregated');
            const btnRaw = document.getElementById('btn-view-raw');
            const viewAgg = document.getElementById('report-view-aggregated');
            const viewRaw = document.getElementById('report-view-raw');
            
            if (viewName === 'aggregated') {
                btnAgg.className = "px-4 py-1.5 text-sm font-medium rounded-md bg-indigo-600 text-white transition-colors";
                btnRaw.className = "px-4 py-1.5 text-sm font-medium rounded-md text-slate-400 hover:text-white transition-colors";
                viewAgg.classList.remove('hidden');
                viewRaw.classList.add('hidden');
            } else {
                btnRaw.className = "px-4 py-1.5 text-sm font-medium rounded-md bg-indigo-600 text-white transition-colors";
                btnAgg.className = "px-4 py-1.5 text-sm font-medium rounded-md text-slate-400 hover:text-white transition-colors";
                viewRaw.classList.remove('hidden');
                viewAgg.classList.add('hidden');
            }
            
            renderReportsTab();
        }

        function setReportSort(col) {
            if(currentReportSort.col === col) {
                currentReportSort.desc = !currentReportSort.desc;
            } else {
                currentReportSort.col = col;
                currentReportSort.desc = true;
            }
            renderReportsTab();
        }

        function renderReportsTab() {
            const { from, to } = getGlobalDates();
            
            const minDate = from < to ? from : to;
            const maxDate = from > to ? from : to;

            const dailyLogs = appState.discordLogs.filter(l => {
                if (!l.date) return false;
                return l.date >= minDate && l.date <= maxDate;
            });
            
            const agg = {};
            
            dailyLogs.forEach(log => {
                if (!agg[log.empId]) {
                    agg[log.empId] = {
                        empId: log.empId,
                        phFront: 0, phBack: 0, sh: 0, calls: 0,
                        nightPhFront: 0, nightPhBack: 0, nightSh: 0,
                        captchas: 0, deliveries: 0,
                        ftoDay1: 0, ftoDay2: 0, ftoExams: 0,
                    };
                }
                const rec = agg[log.empId];
                if (log.type === 'counts') {
                    rec.captchas += log.captchas || 0;
                    rec.deliveries += log.deliveries || 0;
                } else {
                    const cat = log.category.toLowerCase();
                    if (cat === 'ph front') {
                        if (log.isNight) rec.nightPhFront += log.durationHrs;
                        else rec.phFront += log.durationHrs;
                    }
                    else if (cat === 'ph back') {
                        if (log.isNight) rec.nightPhBack += log.durationHrs;
                        else rec.phBack += log.durationHrs;
                    }
                    else if (cat === 'sh') {
                        if (log.isNight) rec.nightSh += log.durationHrs;
                        else rec.sh += log.durationHrs;
                    }
                    else if (cat === 'calls') rec.calls += log.durationHrs;
                    else if (cat === 'fto day 1') rec.ftoDay1 += log.durationHrs;
                    else if (cat === 'fto day 2') rec.ftoDay2 += log.durationHrs;
                    else if (cat === 'fto exams') rec.ftoExams += log.durationHrs;
                    else if (cat === 'fto') rec.ftoDay1 += log.durationHrs;
                }
            });
            
            let filteredAgg = Object.values(agg);
            
            filteredAgg.forEach(rec => {
                const emp = appState.roster.find(r => r.id === rec.empId) || { name: 'Unknown', rank: '', badge: '' };
                rec._name = (emp.name || 'Unknown').toLowerCase();
                rec._badge = (emp.badge || '').toLowerCase();
                
                rec._totalLobby = rec.phFront + rec.phBack + rec.sh + rec.nightPhFront + rec.nightPhBack + rec.nightSh;
                rec._totalNight = rec.nightPhFront + rec.nightPhBack + rec.nightSh;
                rec._totalHours = rec._totalLobby + rec.calls + rec.ftoDay1 + rec.ftoDay2 + rec.ftoExams;
            });
            
            const searchQuery = (document.getElementById('report-search')?.value || '').toLowerCase();

            if (searchQuery) {
                filteredAgg = filteredAgg.filter(rec => {
                    return rec._name.includes(searchQuery) || rec._badge.includes(searchQuery);
                });
            }
            
            filteredAgg.sort((a, b) => {
                let valA, valB;
                switch(currentReportSort.col) {
                    case 'employee': valA = a._name; valB = b._name; break;
                    case 'phFront': valA = a.phFront; valB = b.phFront; break;
                    case 'phBack': valA = a.phBack; valB = b.phBack; break;
                    case 'sh': valA = a.sh; valB = b.sh; break;
                    case 'nightPhFront': valA = a.nightPhFront; valB = b.nightPhFront; break;
                    case 'nightPhBack': valA = a.nightPhBack; valB = b.nightPhBack; break;
                    case 'nightSh': valA = a.nightSh; valB = b.nightSh; break;
                    case 'calls': valA = a.calls; valB = b.calls; break;
                    case 'captchas': valA = a.captchas; valB = b.captchas; break;
                    case 'deliveries': valA = a.deliveries; valB = b.deliveries; break;
                    case 'ftoDay1': valA = a.ftoDay1; valB = b.ftoDay1; break;
                    case 'ftoDay2': valA = a.ftoDay2; valB = b.ftoDay2; break;
                    case 'ftoExams': valA = a.ftoExams; valB = b.ftoExams; break;
                    case 'totalLobby': valA = a._totalLobby; valB = b._totalLobby; break;
                    case 'totalNight': valA = a._totalNight; valB = b._totalNight; break;
                    case 'totalHours': valA = a._totalHours; valB = b._totalHours; break;
                    default: valA = a._totalHours; valB = b._totalHours; break;
                }
                
                if (valA < valB) return currentReportSort.desc ? 1 : -1;
                if (valA > valB) return currentReportSort.desc ? -1 : 1;
                return 0;
            });

            const tbody = document.getElementById('reports-table-body');
            
            if (filteredAgg.length === 0) {
                tbody.innerHTML = '<tr><td colspan="17" class="text-center py-4 text-slate-500">No matches found</td></tr>';
            } else {
                tbody.innerHTML = filteredAgg.map(rec => {
                    const emp = appState.roster.find(r => r.id === rec.empId) || { name: 'Unknown', rank: '', badge: '' };
                    const formatHrs = (h) => h > 0 ? h.toFixed(2) + 'h' : '-';
                    const formatCnt = (c) => c > 0 ? c : '-';

                    return `
                        <tr class="hover:bg-slate-800/50 transition-colors">
                            <td class="px-4 py-3 whitespace-nowrap">
                                <div class="flex flex-col">
                                    <span class="font-medium text-white">${emp.name}</span>
                                    <span class="text-[10px] text-slate-500">${emp.rank} | ${emp.badge}</span>
                                </div>
                            </td>
                            <td class="px-4 py-3 text-right text-slate-300">${formatHrs(rec.phFront)}</td>
                            <td class="px-4 py-3 text-right text-slate-300">${formatHrs(rec.phBack)}</td>
                            <td class="px-4 py-3 text-right text-slate-300">${formatHrs(rec.sh)}</td>
                            <td class="px-4 py-3 text-right text-indigo-400">${formatHrs(rec.nightPhFront)}</td>
                            <td class="px-4 py-3 text-right text-indigo-400">${formatHrs(rec.nightPhBack)}</td>
                            <td class="px-4 py-3 text-right text-indigo-400">${formatHrs(rec.nightSh)}</td>
                            <td class="px-4 py-3 text-right text-slate-300">${formatHrs(rec.calls)}</td>
                            <td class="px-4 py-3 text-center text-rose-400 font-medium">${formatCnt(rec.captchas)}</td>
                            <td class="px-4 py-3 text-center text-emerald-400 font-medium">${formatCnt(rec.deliveries)}</td>
                            <td class="px-4 py-3 text-right text-amber-400 font-medium">${formatHrs(rec.ftoDay1)}</td>
                            <td class="px-4 py-3 text-right text-amber-400 font-medium">${formatHrs(rec.ftoDay2)}</td>
                            <td class="px-4 py-3 text-right text-amber-400 font-medium">${formatHrs(rec.ftoExams)}</td>
                            <td class="px-4 py-3 text-right text-white font-bold border-l border-slate-700/50">${formatHrs(rec._totalLobby)}</td>
                            <td class="px-4 py-3 text-right text-indigo-400 font-bold">${formatHrs(rec._totalNight)}</td>
                            <td class="px-4 py-3 text-right text-white font-bold border-l border-slate-700/50">${formatHrs(rec._totalHours)}</td>
                            <td class="px-4 py-3 text-center border-l border-slate-700/50">
                                <button onclick="openEmployeeRecordsModal('${rec.empId}')" class="text-indigo-400 hover:text-indigo-300 transition-colors" title="View Records">
                                    <i class="fa-solid fa-eye"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
            
            if (currentReportView === 'aggregated') {
                renderWeeklyCharts();
            } else {
                renderRawDataExplorer(dailyLogs, searchQuery);
            }
        }

        function renderRawDataExplorer(dailyLogs, searchQuery) {
            const tbody = document.getElementById('raw-data-table-body');
            
            let filteredLogs = dailyLogs;
            
            if (searchQuery) {
                filteredLogs = filteredLogs.filter(log => {
                    const emp = appState.roster.find(r => r.id === log.empId) || { name: 'Unknown', badge: '' };
                    const n = (emp.name || 'Unknown').toLowerCase();
                    const b = (emp.badge || '').toLowerCase();
                    return n.includes(searchQuery) || b.includes(searchQuery);
                });
            }

            if (filteredLogs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-500">No raw data matches found for this date range and filter.</td></tr>';
                return;
            }

            // Sort by date desc
            filteredLogs.sort((a,b) => (b.date || '').localeCompare(a.date || ''));

            tbody.innerHTML = filteredLogs.map(log => {
                const emp = appState.roster.find(r => r.id === log.empId) || { name: 'Unknown', rank: '', badge: '' };
                const rawLines = log.raw.split('\\n').map(l => `<div class="truncate max-w-[20rem] xl:max-w-md" title="${l.replace(/"/g, '&quot;')}">${l}</div>`).join('');
                
                let extHTML = '';
                if (log.type === 'duty') {
                    extHTML = `
                        <div class="flex flex-col gap-1">
                            <span class="text-indigo-400 font-medium">Category: ${log.category} ${log.isNight ? '<i class="fa-solid fa-moon text-indigo-300 ml-1"></i>' : ''}</span>
                            <span class="text-slate-300"><i class="fa-solid fa-clock w-4"></i> ${log.onTime} - ${log.offTime}</span>
                            <span class="text-emerald-400 font-bold"><i class="fa-solid fa-hourglass-end w-4"></i> ${log.durationHrs.toFixed(2)}h</span>
                        </div>
                    `;
                } else if (log.type === 'counts') {
                    extHTML = `
                        <div class="flex flex-col gap-1">
                            <span class="text-amber-400 font-medium">Duty Type: Counts</span>
                            <span class="text-rose-400"><i class="fa-solid fa-robot w-4"></i> ${log.captchas} Captchas</span>
                            <span class="text-emerald-400"><i class="fa-solid fa-truck w-4"></i> ${log.deliveries} Deliveries</span>
                        </div>
                    `;
                }

                return `
                    <tr class="hover:bg-slate-800/50 transition-colors">
                        <td class="px-4 py-3 whitespace-nowrap text-slate-300 align-top">${log.date}</td>
                        <td class="px-4 py-3 whitespace-nowrap align-top">
                            <div class="flex flex-col">
                                <span class="font-bold text-white">${emp.name}</span>
                                <span class="text-xs text-slate-500">${emp.rank} | ${emp.badge}</span>
                            </div>
                        </td>
                        <td class="px-4 py-3 text-slate-400 font-mono text-xs leading-relaxed align-top">
                            ${rawLines}
                        </td>
                        <td class="px-4 py-3 text-sm align-top bg-slate-800/20 border-l border-slate-700/50">
                            ${extHTML}
                        </td>
                    </tr>
                `;
            }).join('');
        }

        function renderWeeklyCharts() {
            const weeklyLogs = appState.discordLogs.filter(l => l.week === appState.currentHourlyWeek);
            
            let phFront = 0, phBack = 0, sh = 0, calls = 0, labs = 0;
            let day = 0, night = 0;
            
            weeklyLogs.forEach(log => {
                if (log.type === 'counts') return;
                
                const cat = log.category.toLowerCase();
                if (cat === 'ph front') phFront += log.durationHrs;
                else if (cat === 'ph back') phBack += log.durationHrs;
                else if (cat === 'sh') sh += log.durationHrs;
                else if (cat === 'calls') calls += log.durationHrs;
                else if (cat === 'labs') labs += log.durationHrs;
                
                if (log.isNight) night += log.durationHrs;
                else day += log.durationHrs;
            });
            
            const ctxLoc = document.getElementById('weekly-location-chart');
            if(ctxLoc) {
                if (reportCharts.location) reportCharts.location.destroy();
                reportCharts.location = new Chart(ctxLoc, {
                    type: 'bar',
                    data: {
                        labels: ['PH Front', 'PH Back', 'SH', 'Calls', 'Labs (Legacy)'],
                        datasets: [{
                            label: 'Total Hours',
                            data: [phFront, phBack, sh, calls, labs],
                            backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b'],
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } }
                    }
                });
            }
            
            const ctxShift = document.getElementById('weekly-shift-chart');
            if(ctxShift) {
                if (reportCharts.shift) reportCharts.shift.destroy();
                reportCharts.shift = new Chart(ctxShift, {
                    type: 'doughnut',
                    data: {
                        labels: ['Day Shift', 'Night Shift'],
                        datasets: [{
                            data: [day, night],
                            backgroundColor: ['#38bdf8', '#312e81'],
                            borderColor: '#0f172a',
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1' } } }
                    }
                });
            }
        }

        // ================= EMPLOYEE RECORDS MODAL =================
        window.openEmployeeRecordsModal = function(empId) {
            const emp = appState.roster.find(r => r.id === empId);
            if (!emp) return;
            
            document.getElementById('emp-records-name').innerText = `${emp.name} (${emp.badge})`;
            
            // Filter logs for this employee for the current week
            const logs = appState.discordLogs.filter(l => l.empId === empId && l.week === appState.currentHourlyWeek);
            
            // Sort by raw log insertion (newest first or oldest first) - we'll just display as ingested
            const tbody = document.getElementById('emp-records-table-body');
            
            if (logs.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-slate-500 italic">No records found for this week.</td></tr>`;
            } else {
                tbody.innerHTML = logs.map(log => {
                    const formatNum = (n) => typeof n === 'number' ? n.toLocaleString() : n;
                    
                    let timestampDisplay = '';
                    let categoryDisplay = log.category || 'Unknown';
                    let typeDisplay = '';
                    let durationDisplay = '';
                    let bonusDisplay = (log.dayBonus || 0) + (log.nightBonus || 0) + (log.labFtoBonus || 0);
                    bonusDisplay = bonusDisplay.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
                    
                    if (log.type === 'counts') {
                        timestampDisplay = log.datePart || 'Unknown Date';
                        typeDisplay = '<span class="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Task Count</span>';
                        let tasks = [];
                        if (log.captchas > 0) tasks.push(`${log.captchas} Captchas`);
                        if (log.deliveries > 0) tasks.push(`${log.deliveries} Deliveries`);
                        durationDisplay = tasks.join(', ');
                        categoryDisplay = 'Labs';
                    } else {
                        timestampDisplay = log.timePart ? `${log.timePart}` : 'Unknown Time';
                        typeDisplay = log.isNight ? 
                            '<span class="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded">Night Shift</span>' : 
                            '<span class="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">Day Shift</span>';
                        durationDisplay = `${log.durationHrs.toFixed(2)} hrs`;
                    }
                    
                    return `
                        <tr class="hover:bg-slate-800/50 transition-colors">
                            <td class="px-4 py-3 whitespace-nowrap text-slate-300 font-mono text-xs">${timestampDisplay}</td>
                            <td class="px-4 py-3 text-slate-200">${categoryDisplay}</td>
                            <td class="px-4 py-3">${typeDisplay}</td>
                            <td class="px-4 py-3 text-right text-slate-300">${durationDisplay}</td>
                            <td class="px-4 py-3 text-right font-medium text-emerald-400">${bonusDisplay}</td>
                        </tr>
                    `;
                }).join('');
            }
            
            openModal('modal-employee-records');
        };

        window.generateSnapshotUrl = async function() {
            if (!db) {
                showToast('Firebase is not configured! Check script.js', 'error');
                return;
            }
            try {
                const payload = JSON.stringify(appState);
                const compressed = LZString.compressToEncodedURIComponent(payload);
                const encrypted = CryptoJS.AES.encrypt(compressed, 'ems_public_share_key').toString();
                
                // Add 7 days expiration
                const expireAt = new Date();
                expireAt.setDate(expireAt.getDate() + 7);

                const btn = document.getElementById('btn-share-snapshot');
                const origText = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
                btn.disabled = true;

                const docRef = await db.collection('snapshots').add({
                    data: encrypted,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    expireAt: firebase.firestore.Timestamp.fromDate(expireAt)
                });
                
                const url = new URL(window.location.href);
                url.searchParams.delete('snapshot');
                url.searchParams.set('snapshotId', docRef.id);
                
                btn.innerHTML = origText;
                btn.disabled = false;

                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(url.toString()).then(() => {
                        showToast('Snapshot URL generated and copied!', 'success');
                    });
                } else {
                    prompt("Copy the snapshot URL below:", url.toString());
                }
            } catch(e) {
                console.error(e);
                showToast('Failed to generate snapshot in Firestore', 'error');
                const btn = document.getElementById('btn-share-snapshot');
                btn.innerHTML = '<i class="fa-solid fa-share-nodes"></i> Share';
                btn.disabled = false;
            }
        };

        /* ================= INITIALIZATION ================= */
        document.addEventListener('DOMContentLoaded', async () => {
            // Setup listeners
            document.getElementById('buffer-input').addEventListener('change', (e) => {
                appState.bufferTimeMinutes = parseInt(e.target.value) || 0;
                showToast(`Buffer time updated to ${appState.bufferTimeMinutes}m`, 'success');
                recalculateEverything();
                if(!window.isSnapshotMode) saveData();
            });

            // Load Data if exists or from Snapshot
            const urlParams = new URLSearchParams(window.location.search);
            const snapshotStr = urlParams.get('snapshot');
            const snapshotId = urlParams.get('snapshotId');
            
            let encryptedStr = null;

            if (snapshotId && db) {
                try {
                    const doc = await db.collection('snapshots').doc(snapshotId).get();
                    if (doc.exists) {
                        const data = doc.data();
                        const now = new Date();
                        if (data.expireAt && data.expireAt.toDate() < now) {
                            showToast('This snapshot has expired (older than 7 days).', 'error');
                        } else {
                            encryptedStr = data.data;
                        }
                    } else {
                        showToast('Snapshot not found in database.', 'error');
                    }
                } catch(e) {
                    console.error("Firestore error:", e);
                    showToast('Failed to load snapshot from database', 'error');
                }
            } else if (snapshotStr) {
                encryptedStr = snapshotStr;
            }

            if(encryptedStr) {
                try {
                    const decrypted = CryptoJS.AES.decrypt(encryptedStr, 'ems_public_share_key').toString(CryptoJS.enc.Utf8);
                    const decompressed = LZString.decompressFromEncodedURIComponent(decrypted);
                    if(decompressed) {
                        appState = JSON.parse(decompressed);
                        window.isSnapshotMode = true;
                        
                        // Hide Interactive / Edit UI elements
                        const hideIds = ['nav-discord-hub', 'nav-csv-center', 'btn-bonus-config', 'btn-share-snapshot'];
                        hideIds.forEach(id => {
                            const el = document.getElementById(id);
                            if(el) el.classList.add('hidden', 'md:hidden');
                        });

                        // Inject CSS to forcefully hide all mutable controls
                        const style = document.createElement('style');
                        style.innerHTML = `
                            button[onclick*="delete"], 
                            button[onclick*="edit"], 
                            button[onclick*="resetAppData"], 
                            button[onclick*="togglePaymentStatus"], 
                            button[onclick*="approve"], 
                            button[onclick*="openFlaggedModal"],
                            button[onclick*="openModal('modal-roster')"],
                            #nav-roster, 
                            #nav-hcbonus, 
                            #nav-payouts { display: none !important; }
                        `;
                        document.head.appendChild(style);
                        
                        showToast('Loaded Snapshot in Read-Only mode', 'info');
                    }
                } catch(e) {
                    console.error("Snapshot load error", e);
                    showToast('Invalid or corrupted snapshot data', 'error');
                    await loadData();
                }
            } else {
                await loadData();
            }

            // Initialize Dashboard
            renderCurrentTab();
            
            // Auto-enable Edit Mode if forceEdit is true
            if (urlParams.has('forceEdit')) {
                toggleEditMode();
            }
        });
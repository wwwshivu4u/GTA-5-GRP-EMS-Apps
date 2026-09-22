/**
 * EMS Companion - State Management & Template Engine
 */

import {
    DEFAULT_DISCORD_SERVER_ID,
    DEFAULT_DISCORD_CHANNELS,
    DEFAULT_SHIFT_RATES,
    ALL_DUTY_STEPS
} from './data.js';

class StateManager {
    constructor() {
        this.STORAGE_KEY = 'emsSettings';
        this.listeners = new Set();
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
            this.notify();
        } catch (err) {
            console.error('Failed to save state:', err);
        }
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        this.listeners.forEach(fn => fn(this.state));
    }

    get(key) {
        return this.state[key];
    }

    set(key, value) {
        this.state[key] = value;
        this.save();
    }

    update(updater) {
        this.state = updater(this.state);
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

    exportDb(customFileName = '') {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const cleanName = (this.state.employeeName || this.state.name || '').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
        
        let finalFileName = '';
        if (customFileName && customFileName.trim()) {
            finalFileName = customFileName.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_');
            if (!finalFileName.toLowerCase().endsWith('.txt')) {
                finalFileName += '.txt';
            }
        } else {
            finalFileName = cleanName ? `EMS_Config_${cleanName}_${dateStr}.txt` : `EMS_Companion_Config_${dateStr}.txt`;
        }

        const customCount = Object.keys(this.state.customCommands || {}).length;
        const payload = {
            _exportMeta: {
                appName: 'EMS Companion',
                version: '2.1',
                exportedAt: now.toISOString(),
                authorName: (this.state.employeeName || this.state.name || 'Anonymous'),
                authorId: (this.state.employeeId || this.state.id || ''),
                customCommandsCount: customCount
            },
            ...this.state
        };

        const dataStr = JSON.stringify(payload, null, 2);
        const blob = new Blob([dataStr], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = finalFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return finalFileName;
    }

    importDb(file, onSuccess, onError) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (!imported || typeof imported !== 'object') {
                    throw new Error('Invalid JSON structure');
                }

                const hasCommands = imported.customCommands || imported.deptCommands || imported._exportMeta || imported.discordChannels;
                if (!hasCommands) {
                    throw new Error('File does not appear to be an EMS Companion config or backup file.');
                }

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
                delete this.state._exportMeta;
                this.save();
                if (onSuccess) onSuccess(imported);
            } catch (err) {
                console.error('Import error:', err);
                if (onError) onError(err);
            }
        };
        reader.readAsText(file);
    }

    resetToFactoryDefaults() {
        this.state.customCommands = {};
        this.state.userAddedCommands = [];
        this.state.userDefaults = {};
        this.state.deletedCommands = [];
        this.state.customTitles = {};
        this.save();
    }

    resetToSavedDefaults() {
        if (!this.state.userDefaults || Object.keys(this.state.userDefaults).length === 0) {
            return false;
        }
        this.state.customCommands = { ...this.state.userDefaults };
        this.save();
        return true;
    }

    saveCurrentAsDefault() {
        this.state.userDefaults = { ...(this.state.customCommands || {}) };
        this.save();
        return Object.keys(this.state.userDefaults).length;
    }
}

export const stateManager = new StateManager();

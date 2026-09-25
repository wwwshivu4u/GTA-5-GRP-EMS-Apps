/**
 * SAHP Companion - Web Audio Police Sound Synthesizer
 * No external audio files needed; generates high quality tactical audio via Web Audio API.
 */
class PoliceAudioSystem {
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

    // Police Radio Mic Click / Squelch
    playRadioClick() {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // White noise burst
        const bufferSize = this.ctx.sampleRate * 0.04;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1800;
        filter.Q.value = 3.0;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(now);
    }

    // Tactical Chime for On Duty / Shift Action
    playDutyChime() {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const notes = [440.00, 554.37, 659.25, 880.00]; // A major triumphant chime

        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.1);

            gain.gain.setValueAtTime(0, now + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.15, now + i * 0.1 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.5);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.6);
        });
    }

    // Success Copied Beep
    playCopyBeep() {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(987.77, now); // B5
        osc.frequency.setValueAtTime(1318.51, now + 0.06); // E6

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.18);
    }

    // Emergency Panic / 11-99 Siren Alert
    playEmergencyAlert() {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(1100, now + 0.15);
        osc.frequency.linearRampToValueAtTime(600, now + 0.3);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.32);
    }

    // Timer Warning (5 min / 1 min remaining on arrest)
    playTimerWarning() {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        [0, 0.18, 0.36].forEach(offset => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(800, now + offset);

            gain.gain.setValueAtTime(0.12, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + offset);
            osc.stop(now + offset + 0.12);
        });
    }
}

window.soundSystem = new PoliceAudioSystem();

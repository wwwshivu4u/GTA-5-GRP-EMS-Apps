/**
 * EMS Companion - Web Audio Synthesizer
 * Provides crisp audio cues without external assets.
 */

class SoundSystem {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playDutyChime() {
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Positive arpeggio)

        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.12);

            gain.gain.setValueAtTime(0, now + i * 0.12);
            gain.gain.linearRampToValueAtTime(0.18, now + i * 0.12 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.6);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + i * 0.12);
            osc.stop(now + i * 0.12 + 0.65);
        });
    }

    playCopySound() {
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now); // A5
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08); // E6

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.15);
    }
}

export const sound = new SoundSystem();

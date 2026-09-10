export type Cue = 'tick' | 'catch' | 'miss' | 'over';

/** Gesture-created, finite one-shot tones. Never creates a context during hover or mount. */
export function createEggAudio() {
	let context: AudioContext | undefined;
	let disposed = false;
	const voices = new Set<{ oscillator: OscillatorNode; gain: GainNode }>();
	function silence() {
		for (const voice of voices) {
			voice.oscillator.onended = null;
			try { voice.oscillator.stop(); } catch { /* Already ended. */ }
			voice.oscillator.disconnect(); voice.gain.disconnect();
		}
		voices.clear();
	}
	async function enable(): Promise<boolean> {
		if (disposed) return false;
		try {
			context ??= new AudioContext();
			if (context.state === 'suspended') await context.resume();
			return !disposed && context.state === 'running';
		} catch { return false; }
	}
	function play(cue: Cue) {
		if (disposed || context?.state !== 'running') return;
		// Bound rapid manual stepping to one finite cue, including queued notes.
		silence();
		try {
		const notes = cue === 'catch' ? [880, 1320] : cue === 'miss' ? [220, 150] : cue === 'over' ? [330, 247, 165, 110] : [640];
		const length = cue === 'tick' ? .025 : .075;
		for (const [index, frequency] of notes.entries()) {
			const oscillator = context.createOscillator(), gain = context.createGain();
			const voice = { oscillator, gain }; voices.add(voice);
			const start = context.currentTime + index * (length + .025);
			oscillator.type = 'square'; oscillator.frequency.setValueAtTime(frequency, start);
			gain.gain.setValueAtTime(0, start);
			gain.gain.linearRampToValueAtTime(cue === 'tick' ? .012 : .025, start + .003);
			gain.gain.exponentialRampToValueAtTime(.0001, start + length);
			oscillator.connect(gain); gain.connect(context.destination);
			oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); voices.delete(voice); };
			oscillator.start(start); oscillator.stop(start + length + .005);
		}
		} catch { silence(); /* Audio device loss must not interrupt the game. */ }
	}
	function destroy() {
		disposed = true; silence();
		if (context && context.state !== 'closed') void context.close().catch(() => {});
	}
	return { enable, play, silence, destroy };
}
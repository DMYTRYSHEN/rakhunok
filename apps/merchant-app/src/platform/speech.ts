export type MicrophonePermission = 'prompt' | 'granted' | 'denied' | 'unsupported';
export type SpeechLocale = 'uk-UA' | 'ru-RU';

type SpeechResultEvent = Event & {
	resultIndex: number;
	results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

type SpeechErrorEvent = Event & { error: string };

type NativeSpeechRecognition = {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	maxAlternatives: number;
	onresult: ((event: SpeechResultEvent) => void) | null;
	onerror: ((event: SpeechErrorEvent) => void) | null;
	onend: (() => void) | null;
	start(): void;
	stop(): void;
	abort(): void;
};

type SpeechRecognitionConstructor = new () => NativeSpeechRecognition;

declare global {
	interface Window {
		SpeechRecognition?: SpeechRecognitionConstructor;
		webkitSpeechRecognition?: SpeechRecognitionConstructor;
	}
}

export function isSpeechRecognitionSupported() {
	return typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export async function getMicrophonePermission(): Promise<MicrophonePermission> {
	if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
	if (!navigator.permissions?.query) return 'prompt';
	try {
		const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
		return status.state;
	} catch {
		return 'prompt';
	}
}

export async function requestMicrophonePermission(): Promise<MicrophonePermission> {
	if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
	try {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		stream.getTracks().forEach((track) => track.stop());
		return 'granted';
	} catch (error) {
		return error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
			? 'denied'
			: 'prompt';
	}
}

export function createSpeechRecognition(
	locale: SpeechLocale,
	handlers: {
		onTranscript: (text: string, final: boolean) => void;
		onError: (message: string) => void;
		onEnd: () => void;
	}
) {
	const Constructor = window.SpeechRecognition || window.webkitSpeechRecognition;
	if (!Constructor) return null;
	const recognition = new Constructor();
	recognition.lang = locale;
	recognition.continuous = false;
	recognition.interimResults = true;
	recognition.maxAlternatives = 1;
	recognition.onresult = (event) => {
		let transcript = '';
		let final = false;
		for (let index = event.resultIndex; index < event.results.length; index += 1) {
			transcript += event.results[index][0].transcript;
			final ||= event.results[index].isFinal;
		}
		handlers.onTranscript(transcript.trim(), final);
	};
	recognition.onerror = (event) => handlers.onError(speechErrorMessage(event.error));
	recognition.onend = handlers.onEnd;
	return recognition;
}

function speechErrorMessage(error: string) {
	if (error === 'not-allowed' || error === 'service-not-allowed') return 'Доступ до мікрофона заборонено.';
	if (error === 'no-speech') return 'Не вдалося почути команду. Спробуйте ще раз.';
	if (error === 'audio-capture') return 'Мікрофон недоступний.';
	if (error === 'network') return 'Сервіс розпізнавання мовлення недоступний.';
	return 'Не вдалося розпізнати команду.';
}
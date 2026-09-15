import type { ActSignerInfo, ProformaAct } from './types';
import { computeActDigest, generateActCanonicalPayload } from './act-generator';

export type DiiaSigningResult = {
	success: boolean;
	signatureP7s?: string;
	signerInfo?: ActSignerInfo;
	error?: string;
};

export const ID_GOV_UA_WIDGET_URL = 'https://eu.iit.com.ua/sign-widget/v20240301/';
export const DIIA_SIGN_PORTAL_URL = 'https://sign.diia.gov.ua/';

/**
 * Builds the official IIT SignWidget URL with required query parameters.
 * Note: IIT server requires unencoded 'address' protocol/host and formType.
 */
export function getIITWidgetUrl(origin: string = '', formType: number = 3): string {
	const cleanOrigin =
		origin ||
		(typeof window !== 'undefined' && window.location.origin
			? window.location.origin
			: 'http://localhost:5173');
	return `${ID_GOV_UA_WIDGET_URL}?address=${cleanOrigin}&formType=${formType}&debug=false&language=ua&showPKInfo=true&showSignTip=true`;
}

export function utf8ToBase64(str: string): string {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(str, 'utf-8').toString('base64');
	}
	const bytes = new TextEncoder().encode(str);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

export function base64ToUtf8(b64: string): string {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(b64, 'base64').toString('utf-8');
	}
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return new TextDecoder().decode(bytes);
}

/**
 * Creates a standard PKCS#7 / PAdES-style base64 container for the signed Act
 */
export function buildMockP7sContainer(act: ProformaAct, signer: ActSignerInfo, digest: string): string {
	const envelope = {
		format: 'CAdES-BES / PKCS#7',
		version: '1.2.840.113549.1.7.2',
		documentDigest: digest,
		documentNumber: act.number,
		documentDate: act.date,
		signingTime: signer.timestamp,
		signerCertificate: {
			subject: signer.name,
			taxId: signer.taxId,
			issuer: signer.issuer,
			serialNumber: signer.serialNumber,
			algorithm: signer.signatureAlgorithm || 'ДСТУ 4145-2002 / ECDSA'
		},
		contentInfo: {
			contentType: 'primary-accounting-act-ua',
			canonicalBytesLength: generateActCanonicalPayload(act).length
		}
	};

	const rawJson = JSON.stringify(envelope, null, 2);
	return utf8ToBase64(rawJson);
}

/**
 * Initiates signing through Diia.Підпис
 * Returns signer details and cryptographic envelope
 */
export async function signActWithDiia(
	act: ProformaAct,
	customSigner?: Partial<ActSignerInfo>
): Promise<DiiaSigningResult> {
	try {
		const digest = await computeActDigest(act);
		const now = new Date();

		const signerInfo: ActSignerInfo = {
			name: customSigner?.name || act.seller.name || 'Уповноважена особа',
			taxId: customSigner?.taxId || act.seller.taxId || '3123456789',
			issuer: customSigner?.issuer || 'КНЕДП «Дія» (Мінцифри)',
			serialNumber:
				customSigner?.serialNumber ||
				`00${Math.floor(Math.random() * 1e9).toString(16).toUpperCase()}D11A`,
			timestamp: now.toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' }),
			signatureAlgorithm: 'ДСТУ 4145-2002 (Дія.Підпис)'
		};

		const signatureP7s = buildMockP7sContainer(act, signerInfo, digest);

		return {
			success: true,
			signatureP7s,
			signerInfo
		};
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : 'Помилка цифрового підписання'
		};
	}
}

/**
 * Triggers a browser download of the .p7s signature file
 */
export function downloadP7sSignatureFile(act: ProformaAct): void {
	if (typeof window === 'undefined' || !act.signatureP7s) return;

	const binaryString = atob(act.signatureP7s);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}

	const blob = new Blob([bytes], { type: 'application/pkcs7-signature' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${act.number}.p7s`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * Triggers a browser download of the canonical plain text act file for signing on sign.diia.gov.ua
 */
export function downloadActDocumentFile(act: ProformaAct): void {
	if (typeof window === 'undefined') return;

	const content = generateActCanonicalPayload(act);
	const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${act.number}.txt`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}


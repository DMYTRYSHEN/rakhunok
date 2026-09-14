declare module 'qrcode/lib/core/qrcode.js' {
	const QRCode: {
		create(text: string, options: { errorCorrectionLevel: 'M' | 'Q' }): {
			modules: { size: number; data: Uint8Array };
		};
	};
	export default QRCode;
}
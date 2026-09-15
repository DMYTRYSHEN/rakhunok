import { describe, expect, it } from 'vitest';
import {
	computeLiquidGeometry,
	stepSpring,
	ACTIVATION_THRESHOLD,
	MAX_DRAG_DISTANCE,
	type SpringState
} from './liquid-payment-physics';

describe('liquid payment physics', () => {
	it('computes initial button geometry at progress 0', () => {
		const geo = computeLiquidGeometry(0, 180, 340, 380);
		expect(geo.width).toBe(180);
		expect(geo.height).toBe(52);
		expect(geo.buttonContentOpacity).toBe(1);
		expect(geo.windowContentOpacity).toBe(0);
	});

	it('computes fully expanded window geometry at progress 1.0', () => {
		const geo = computeLiquidGeometry(1.0, 180, 340, 380);
		expect(geo.width).toBe(340);
		expect(geo.height).toBe(380);
		expect(geo.buttonContentOpacity).toBe(0);
		expect(geo.windowContentOpacity).toBe(1);
		expect(geo.blur).toBeGreaterThanOrEqual(45);
	});

	it('crossfades content early — window visible by p=0.65', () => {
		const geo = computeLiquidGeometry(0.65, 180, 340, 380);
		expect(geo.buttonContentOpacity).toBe(0);
		expect(geo.windowContentOpacity).toBe(1);
	});

	it('button text fully gone by p=0.3', () => {
		const geo = computeLiquidGeometry(0.3, 180, 340, 380);
		expect(geo.buttonContentOpacity).toBe(0);
	});

	it('geometry is continuous and clamp protected', () => {
		const below = computeLiquidGeometry(-0.5, 180, 340, 380);
		const zero = computeLiquidGeometry(0, 180, 340, 380);
		expect(below).toEqual(zero);

		const above = computeLiquidGeometry(1.5, 180, 340, 380);
		const one = computeLiquidGeometry(1.0, 180, 340, 380);
		expect(above).toEqual(one);
	});

	it('spring converges towards target with overshoot', () => {
		let state: SpringState = { value: 0, velocity: 0, target: 1 };
		const dt = 1 / 60;
		let hadOvershoot = false;
		for (let i = 0; i < 180; i++) {
			state = stepSpring(state, dt);
			if (state.value > 1.01) hadOvershoot = true;
		}
		expect(state.value).toBeCloseTo(1, 2);
		expect(state.velocity).toBeCloseTo(0, 2);
		// Underdamped spring should overshoot
		expect(hadOvershoot).toBe(true);
	});

	it('spring respects activation threshold boundary', () => {
		expect(ACTIVATION_THRESHOLD).toBeGreaterThan(0.4);
		expect(ACTIVATION_THRESHOLD).toBeLessThan(0.8);
	});

	it('rim opacity peaks at mid-morph', () => {
		const atZero = computeLiquidGeometry(0, 180, 340, 380);
		const atMid = computeLiquidGeometry(0.5, 180, 340, 380);
		const atOne = computeLiquidGeometry(1.0, 180, 340, 380);
		expect(atMid.rimOpacity).toBeGreaterThan(atZero.rimOpacity);
		expect(atMid.rimOpacity).toBeGreaterThan(atOne.rimOpacity);
	});

	it('width increases monotonically with progress', () => {
		let prevWidth = 0;
		for (let p = 0; p <= 1; p += 0.05) {
			const geo = computeLiquidGeometry(p, 180, 340, 380);
			expect(geo.width).toBeGreaterThanOrEqual(prevWidth);
			prevWidth = geo.width;
		}
	});
});

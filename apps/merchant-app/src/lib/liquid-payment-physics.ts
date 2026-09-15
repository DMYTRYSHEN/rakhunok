export interface LiquidGeometry {
	width: number;
	height: number;
	borderRadius: number;
	blur: number;
	shadowBlur: number;
	shadowOffsetY: number;
	shadowOpacity: number;
	rimOpacity: number;
	buttonContentOpacity: number;
	windowContentOpacity: number;
}

export interface SpringConfig {
	stiffness: number;
	damping: number;
	mass: number;
}

export interface SpringState {
	value: number;
	velocity: number;
	target: number;
}

/**
 * Underdamped spring — ζ ≈ 0.6 for natural overshoot like iOS Liquid Glass.
 */
export const DEFAULT_SPRING_CONFIG: SpringConfig = {
	stiffness: 180,
	damping: 16,
	mass: 1
};

export const ACTIVATION_THRESHOLD = 0.6;
export const MAX_DRAG_DISTANCE = 300;

/**
 * Step a 1D damped harmonic oscillator (spring physics).
 */
export function stepSpring(
	state: SpringState,
	dt: number,
	config: SpringConfig = DEFAULT_SPRING_CONFIG
): SpringState {
	const clampedDt = Math.min(Math.max(dt, 0.001), 0.05);
	const displacement = state.value - state.target;
	const springForce = -config.stiffness * displacement;
	const dampingForce = -config.damping * state.velocity;
	const acceleration = (springForce + dampingForce) / config.mass;

	const nextVelocity = state.velocity + acceleration * clampedDt;
	const nextValue = state.value + nextVelocity * clampedDt;

	if (
		Math.abs(nextVelocity) < 0.0005 &&
		Math.abs(nextValue - state.target) < 0.0005
	) {
		return { value: state.target, velocity: 0, target: state.target };
	}

	return { value: nextValue, velocity: nextVelocity, target: state.target };
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/**
 * Hermite smoothstep — continuous first derivative for smooth morphing.
 */
export function smoothstep(t: number): number {
	const c = clamp(t, 0, 1);
	return c * c * (3 - 2 * c);
}

/**
 * Compute liquid geometry from normalized progress p ∈ [0, 1].
 *
 * Single continuous parametric curve — no segmented phases.
 * Position (top/left) is handled by the component using fixed positioning.
 */
export function computeLiquidGeometry(
	progress: number,
	buttonWidth: number = 180,
	windowWidth: number = 340,
	windowHeight: number = 380
): LiquidGeometry {
	const p = clamp(progress, 0, 1);
	const t = smoothstep(p);

	const width = lerp(buttonWidth, windowWidth, t);
	const height = lerp(52, windowHeight, t);
	const borderRadius = lerp(26, 24, t);

	const blur = lerp(28, 48, t);
	const shadowBlur = lerp(16, 48, t);
	const shadowOffsetY = lerp(4, 24, t);
	const shadowOpacity = lerp(0.25, 0.4, t);
	const rimOpacity = lerp(0.3, 0.7, Math.sin(p * Math.PI));

	const buttonContentOpacity = clamp(1 - p / 0.3, 0, 1);
	const windowContentOpacity = clamp((p - 0.35) / 0.3, 0, 1);

	return {
		width,
		height,
		borderRadius,
		blur,
		shadowBlur,
		shadowOffsetY,
		shadowOpacity,
		rimOpacity,
		buttonContentOpacity,
		windowContentOpacity
	};
}

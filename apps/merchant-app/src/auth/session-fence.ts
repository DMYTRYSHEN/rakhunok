/** Invalidates UI continuations, never the underlying request or its outcome. */
export function createSessionFence() {
	let generation = 0;
	return {
		capture: () => generation,
		advance: () => ++generation,
		isCurrent: (captured: number) => captured === generation
	};
}
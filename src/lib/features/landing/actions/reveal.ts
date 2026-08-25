export function reveal(node: HTMLElement) {
	if (!('IntersectionObserver' in window)) return;

	node.classList.add('reveal-pending');
	const observer = new IntersectionObserver(
		([entry]) => {
			if (!entry.isIntersecting) return;
			node.classList.add('reveal-visible');
			observer.disconnect();
		},
		{ threshold: 0.12 }
	);

	observer.observe(node);

	return {
		destroy: () => observer.disconnect()
	};
}

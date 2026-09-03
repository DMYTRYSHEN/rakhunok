import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { createStarterProcessDefinition } from './process-definition';
import { merchantPaymentFlow, merchantPaymentScenarios } from './merchant-payment-flow';
import ProcessDiagram from './ProcessDiagram.svelte';

describe('ProcessDiagram', () => {
	it('renders an accessible localized shell before client-side Mermaid rendering', () => {
		const { body } = render(ProcessDiagram, {
			props: {
				definition: createStarterProcessDefinition(),
				events: [],
				locale: 'uk'
			}
		});

		expect(body).toContain('aria-label="Діаграма процесу"');
		expect(body).toContain('role="tablist"');
		expect(body).toContain('Структура');
		expect(body).toContain('Послідовність');
		expect(body).toContain('Будуємо діаграму...');
		expect(body).toMatch(/<div class="diagram-svg [^"]*hidden"><\/div>/);
	});

	it('exposes cross-process flow scenarios when a composition is provided', () => {
		const { body } = render(ProcessDiagram, {
			props: {
				definition: createStarterProcessDefinition(),
				flow: merchantPaymentFlow,
				flowScenarios: merchantPaymentScenarios,
				locale: 'uk'
			}
		});

		expect(body).toContain('Flow');
		expect(body).not.toContain('Сценарій');
	});
});

import { describe, expect, it } from 'vitest';
import { createStarterProcessDefinition } from './process-definition';
import { restoreVersionAsDraft } from './process-version-history';

describe('process version history', () => {
	it('restores a published snapshot without replacing the active draft identity', () => {
		const currentDraft = { ...createStarterProcessDefinition(), id: 'active-process', revision: 9 };
		const publishedDefinition = {
			...createStarterProcessDefinition(),
			id: 'historical-process',
			name: 'Published v3',
			revision: 3,
			lifecycle: 'published' as const
		};

		const restored = restoreVersionAsDraft(currentDraft, publishedDefinition);

		expect(restored).toMatchObject({
			id: 'active-process',
			revision: 9,
			lifecycle: 'draft',
			name: 'Published v3'
		});
		expect(restored).not.toBe(publishedDefinition);
		expect(restored.nodes).not.toBe(publishedDefinition.nodes);
	});
});

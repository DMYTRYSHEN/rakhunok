import type { ProcessDefinition } from './process-definition';

export function restoreVersionAsDraft(
	currentDraft: ProcessDefinition,
	publishedDefinition: ProcessDefinition
): ProcessDefinition {
	return structuredClone({
		...publishedDefinition,
		id: currentDraft.id,
		revision: currentDraft.revision,
		lifecycle: 'draft' as const
	});
}

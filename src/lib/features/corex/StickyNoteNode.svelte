<script lang="ts">
	import { Pin, Trash2 } from '@lucide/svelte';

	let { data, id }: { data: { title?: string; text?: string; color?: 'yellow' | 'blue' | 'green' | 'purple'; author?: string; onDelete?: (id: string) => void; onUpdate?: (id: string, text: string) => void }; id: string } = $props();

	let editing = $state(false);
	let noteText = $state('');
	let displayedText = $derived(data.text ?? 'Note for team...');

	function edit() {
		noteText = displayedText;
		editing = true;
	}

	function save() {
		data.onUpdate?.(id, noteText);
		editing = false;
	}
</script>

<div class="sticky-note color-{data.color ?? 'yellow'}">
	<div class="note-header">
		<div class="pin-badge">
			<Pin size={11} />
			<span>{data.title ?? 'NOTE'}</span>
		</div>
		{#if data.onDelete}
			<button class="delete-btn" type="button" onclick={() => data.onDelete?.(id)} title="Delete note">
				<Trash2 size={11} />
			</button>
		{/if}
	</div>

	{#if editing}
		<textarea
			class="note-textarea"
			bind:value={noteText}
			onblur={save}
			onkeydown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); }}
			rows={3}
		></textarea>
	{:else}
		<div class="note-body" ondblclick={edit} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter') edit(); }}>
			{displayedText}
		</div>
	{/if}

	<div class="note-footer">
		<small>{data.author ?? 'Architect'}</small>
		{#if !editing}
			<span class="edit-hint">double-click to edit</span>
		{/if}
	</div>
</div>

<style>
	.sticky-note {
		width: 210px;
		min-height: 110px;
		border-radius: 12px;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		font-family: 'Manrope', sans-serif;
		box-shadow: 0 4px 16px -2px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05);
		border: 1px solid rgba(0, 0, 0, 0.06);
		transition: transform 140ms ease, box-shadow 140ms ease;
	}
	.sticky-note:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 24px -4px rgba(15, 23, 42, 0.12);
	}
	.color-yellow {
		background: linear-gradient(135deg, #fffdf0 0%, #fef9c3 100%);
		border-color: #fde047;
	}
	.color-blue {
		background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
		border-color: #bae6fd;
	}
	.color-green {
		background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
		border-color: #bbf7d0;
	}
	.color-purple {
		background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
		border-color: #e9d5ff;
	}

	.note-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 6px;
	}
	.pin-badge {
		display: flex;
		align-items: center;
		gap: 4px;
		color: #475569;
		font-size: 9.5px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.delete-btn {
		border: 0;
		background: transparent;
		color: #94a3b8;
		cursor: pointer;
		padding: 2px;
		border-radius: 4px;
		display: grid;
		place-items: center;
	}
	.delete-btn:hover {
		color: #ef4444;
		background: rgba(239, 68, 68, 0.1);
	}

	.note-body {
		color: #1e293b;
		font-size: 11px;
		line-height: 1.45;
		white-space: pre-wrap;
		word-break: break-word;
		cursor: pointer;
		flex: 1;
	}
	.note-textarea {
		width: 100%;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		padding: 4px;
		font-size: 11px;
		font-family: inherit;
		background: rgba(255, 255, 255, 0.8);
		color: #1e293b;
		resize: none;
		outline: none;
	}

	.note-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 8px;
		padding-top: 4px;
		border-top: 1px dashed rgba(0, 0, 0, 0.08);
	}
	.note-footer small {
		color: #64748b;
		font-size: 8.5px;
		font-weight: 700;
		text-transform: uppercase;
	}
	.edit-hint {
		color: #94a3b8;
		font-size: 8px;
	}
</style>

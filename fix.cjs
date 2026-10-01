const fs = require('fs');
let code = fs.readFileSync('apps/platform/src/lib/demo/PeoplePanel.svelte', 'utf8');

code = code.replace(/<button[^>]*>Запросити уточнення<\/button>[\s\S]*$/, 
`<button onclick={() => execute({ type: 'seller.clarify', courierId: selected, reason })}>Запросити уточнення</button>
			</div>
		{/if}
	</div>{/if}
{/if}
</section>`);

fs.writeFileSync('apps/platform/src/lib/demo/PeoplePanel.svelte', code, 'utf8');

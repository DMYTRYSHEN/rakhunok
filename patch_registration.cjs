const fs = require('fs');

function patchFile(filename) {
    let code = fs.readFileSync(filename, 'utf8');

    // Remove the entire <style> block
    code = code.replace(/<style>[\s\S]*?<\/style>/g, '');

    // Replace the main wrapper class
    code = code.replace(/<section class="registration">/g, '<section class="module">');

    // Update steps to look like Apple Segmented Control using Tailwind
    code = code.replace(
        /<div class="steps"([^>]*)>{#each groups as group, index \(group.title\)}<span aria-current=\{step === index \? 'step' : undefined\}>\{index \+ 1\}\. \{group\.title\}<\/span>\{\/each\}<\/div>/g,
        '<div class="flex gap-2 mb-8 bg-slate-100/50 p-1.5 rounded-2xl" $1>{#each groups as group, index (group.title)}<div class="flex-1 text-center py-2.5 rounded-xl text-sm font-bold transition-all duration-300 {step === index ? \'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-900/5\' : \'text-slate-400\'}"><span class="opacity-50 mr-1">{index + 1}.</span> {group.title}</div>{/each}</div>'
    );

    // Add a div wrapper for the fields to look like a modern card
    code = code.replace(
        /<h3>\{groups\[step\]\.title\}<\/h3>/g,
        '<div class="bg-white/40 p-6 rounded-3xl border border-white/60 mb-6 shadow-sm"><h3 class="text-lg font-bold text-slate-800 mb-6">{groups[step].title}</h3><div class="space-y-4">'
    );

    // Close the wrapper div just before the actions
    code = code.replace(
        /<div class="actions">/g,
        '</div></div><div class="flex items-center justify-between mt-8 pt-6 border-t border-slate-200/50">'
    );

    // Fix history section so it's hidden in a details block
    code = code.replace(
        /\{#if latest\}\s*<h3>/g,
        '{#if latest}<details class="mt-12 bg-white/50 rounded-2xl border border-slate-200 overflow-hidden group"><summary class="px-6 py-4 cursor-pointer font-bold text-slate-700 flex items-center justify-between hover:bg-white/80 transition-colors"><span>Історія версій та рішення</span></summary><div class="p-6 border-t border-slate-200 text-sm space-y-6"><h3>'
    );

    // Close the history details block
    code = code.replace(
        /\{\/each\}\s*\{\/if\}\s*<\/section>/g,
        '{/each}</div></details>{/if}</section>'
    );

    fs.writeFileSync(filename, code, 'utf8');
    console.log('Patched ' + filename);
}

patchFile('apps/platform/src/lib/demo/RegistrationPanel.svelte');

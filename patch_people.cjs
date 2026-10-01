const fs = require('fs');

function patchFile(filename) {
    let code = fs.readFileSync(filename, 'utf8');

    // Remove the <style> block
    code = code.replace(/<style>[\s\S]*?<\/style>/g, '');

    // Replace the main wrapper section to apply global Antigravity module styles
    code = code.replace(/<section>/g, '<section class="module space-y-6">');

    // Make inputs beautiful Apple style
    code = code.replace(
        /input id="/g,
        'input class="w-full px-4 py-3 bg-white/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" id="'
    );
    code = code.replace(
        /select id="/g,
        'select class="w-full px-4 py-3 bg-white/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" id="'
    );

    // Style buttons
    code = code.replace(
        /<button onclick=\{save\}>/g,
        '<button class="mt-4 px-6 py-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold rounded-xl flex items-center gap-2 transition-all w-full justify-center" onclick={save}>'
    );
    
    // Convert the {#if selected} block to a card
    code = code.replace(
        /\{#if selected\}\s*<h2>\{selected\}<\/h2><p>/g,
        '{#if selected}<div class="mt-8 p-6 bg-white/40 border border-white/60 rounded-3xl shadow-sm"><h2 class="text-xl font-black text-slate-800 mb-2">{selected}</h2><p class="text-sm text-slate-500 mb-6">'
    );

    // Style the independent verification blocks inside the selected card
    code = code.replace(
        /<h3>Незалежні перевірки · DEMO<\/h3>/,
        '<div class="mt-8 pt-6 border-t border-slate-200/50"><h3 class="text-lg font-bold text-slate-800 mb-4">Незалежні перевірки · DEMO</h3>'
    );
    
    // Close the card
    code = code.replace(
        /\{\/if\}\s*\{\/if\}\s*<\/section>/g,
        '</div>{/if}</div>{/if}</section>'
    );

    // Make labels uppercase and sleek
    code = code.replace(
        /<label for=/g,
        '<label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 mt-4" for='
    );

    fs.writeFileSync(filename, code, 'utf8');
    console.log('Patched ' + filename);
}

patchFile('apps/platform/src/lib/demo/PeoplePanel.svelte');

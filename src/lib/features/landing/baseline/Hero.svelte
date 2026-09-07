<script lang="ts">
 import { ArrowRight, Play } from '@lucide/svelte';
 import ProductMockup from './ProductMockup.svelte';
 import { pilotHref,type BaselineCopy } from './copy';
 import type { Locale } from '../data/translations';
 let {c,locale}:{c:BaselineCopy;locale:Locale}=$props();
</script>
<section id="top" class="b-hero b-wrap" data-section="2" aria-labelledby="b-hero-title"><div class="b-hero-message"><p class="b-eyebrow"><span class="b-pulse"></span>RAHUNOK / PAY BY BANK</p><h1 id="b-hero-title">{c.title} <span>{c.accent}</span></h1><p class="b-hero-intro">{c.intro}</p><div class="b-actions"><a class="b-button" href={pilotHref}>{c.pilot}<ArrowRight size={18}/></a><a class="b-button b-secondary" href="#calculator">{c.calculate}</a></div><div class="b-hero-badges">{#each c.badges as badge (badge)}<span>{badge}</span>{/each}</div></div><div class="b-hero-product"><ProductMockup {c} {locale}/><a class="b-demo-link" href="#demo"><Play size={14}/>{c.openDemo}<ArrowRight size={15}/></a></div></section>
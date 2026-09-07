<script lang="ts">
 import { Menu, X, Sun, Moon } from '@lucide/svelte';
 import { pilotHref, type BaselineCopy } from './copy';
 import type { Locale } from '../data/translations';
 let {c,locale,darkMode,onThemeToggle,onLocaleChange}:{c:BaselineCopy;locale:Locale;darkMode:boolean;onThemeToggle:()=>void;onLocaleChange?:(locale:Locale)=>void}=$props();
 let open=$state(false);
 const anchors=['demo','solutions','features','calculator','security','pricing'];
 function close(event:KeyboardEvent){if(event.key==='Escape'&&open){open=false;document.getElementById('b-menu-toggle')?.focus();}}
</script>
<svelte:window onkeydown={close}/>
<header class="b-header b-wrap" data-section="1">
 <a class="b-brand" href="#top" aria-label="Rahunok"><span class="b-brand-mark" aria-hidden="true"><svg width="25" height="25" viewBox="0 0 208 221" fill="currentColor"><path d="M108.903 29.2451C119.845 29.2451 129.281 31.4851 137.211 35.9649C145.14 40.4448 151.167 46.3148 155.29 53.5752C159.413 60.8356 161.475 68.6366 161.475 76.9783C161.475 86.8647 158.62 96.0563 152.911 104.552C147.361 112.894 139.193 119.15 128.409 123.321L169.325 191.445C144.049 191.445 120.737 178.182 108.337 156.747L94.6296 133.053C82.5427 133.053 72.7443 142.588 72.7443 154.351V191.445C53.3001 191.445 37.5375 176.106 37.5375 157.183V137.192C37.5375 118.27 53.3001 102.93 72.7443 102.93C105.753 104.095 124.948 105.313 126.268 80.4542C126.648 60.1615 109.721 58.9323 72.7443 60.7583H69.9196C52.0355 60.7583 37.5375 46.6494 37.5375 29.2451H108.903ZM101.528 102.93C109.299 102.93 115.326 100.768 119.608 96.4421C124.048 91.9623 126.268 86.633 126.268 80.4542C126.268 74.7384 124.365 70.0268 120.559 66.3194C116.753 62.612 111.202 60.7583 103.907 60.7583H72.7443C109.721 58.9323 126.648 60.1615 126.268 80.4542C124.948 105.313 105.753 104.095 72.7443 102.93H101.528Z"/></svg></span>Rahunok</a>
 <nav class="b-desktop-nav" aria-label={c.shared.menu}>{#each c.nav as label,i (label)}<a href={`#${anchors[i]}`}>{label}</a>{/each}</nav>
 <div class="b-header-actions"><select aria-label={c.shared.language} value={locale} onchange={e=>onLocaleChange?.(e.currentTarget.value as Locale)}><option value="uk">UA</option><option value="en">EN</option><option value="pl">PL</option></select><button class="b-icon-button" type="button" aria-label={c.shared.theme} aria-pressed={darkMode} onclick={onThemeToggle}>{#if darkMode}<Sun size={18}/>{:else}<Moon size={18}/>{/if}</button><a class="b-button b-header-cta" href={pilotHref}>{c.pilot}</a><button id="b-menu-toggle" class="b-icon-button b-menu-toggle" aria-label={c.shared.menu} aria-expanded={open} aria-controls="b-mobile-nav" onclick={()=>open=!open}>{#if open}<X size={20}/>{:else}<Menu size={20}/>{/if}</button></div>
 <nav id="b-mobile-nav" class="b-mobile-nav" hidden={!open} aria-label={c.shared.menu}>{#each c.nav as label,i (label)}<a href={`#${anchors[i]}`} onclick={()=>open=false}>{label}</a>{/each}<a class="b-button" href={pilotHref}>{c.pilot}</a></nav>
</header>
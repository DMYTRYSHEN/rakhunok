<script lang="ts">
 let {paused=false}:{paused?:boolean}=$props();
 function ambient(node:HTMLDivElement){
  const reduced=matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)');let frame=0;
  const visibility=()=>node.classList.toggle('b-hidden',document.hidden);visibility();
  function move(e:PointerEvent){if(paused||reduced.matches||frame)return;frame=requestAnimationFrame(()=>{node.style.setProperty('--x',`${(e.clientX/innerWidth-.5)*90}px`);node.style.setProperty('--y',`${(e.clientY/innerHeight-.5)*70}px`);frame=0;});}
  window.addEventListener('pointermove',move,{passive:true});document.addEventListener('visibilitychange',visibility);
  return()=>{window.removeEventListener('pointermove',move);document.removeEventListener('visibilitychange',visibility);cancelAnimationFrame(frame);};
 }
</script>
<div class="b-ambient" class:b-paused={paused} {@attach ambient} aria-hidden="true"><i></i><i></i><i></i></div>
function activate(id){
 document.querySelectorAll('.workflow-board').forEach(b=>b.dataset.active=id);
 document.querySelectorAll('[data-flow]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.flow===id)));
 document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==id);
 const selected=document.querySelector('[data-flow="'+id+'"]'),description=document.querySelector('#workflow-description');
 if(description&&selected)description.textContent=selected.dataset.description;
}
document.querySelectorAll('[data-flow]').forEach(b=>{b.addEventListener('click',()=>activate(b.dataset.flow));b.addEventListener('focus',()=>activate(b.dataset.flow));});
const stage=document.querySelector('.product-stage'),consolePanel=stage?.querySelector('.product-console');
const motion=matchMedia('(prefers-reduced-motion: reduce)');
function reset(){if(consolePanel)consolePanel.style.transform='';}
if(stage&&consolePanel){
 stage.addEventListener('pointermove',e=>{if(motion.matches||e.pointerType!=='mouse'||innerWidth<1000)return;const r=stage.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;consolePanel.style.transform='rotateY('+x*3+'deg) rotateX('+(-y*2)+'deg)';});
 stage.addEventListener('pointerleave',reset);motion.addEventListener('change',reset);
}

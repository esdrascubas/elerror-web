(function(){
  const canvas = document.getElementById('logoCanvas');
  const panelEl = document.querySelector('.panel');
  const toggleEl = document.getElementById('togglePanel');
  const fallEl = document.getElementById('falloff');
  const fallVal = document.getElementById('falloffVal');
  const stepEl = document.getElementById('step');
  const dotREl = document.getElementById('dotR');
  const effREl = document.getElementById('effR');
  const pushEl = document.getElementById('push');
  const retEl = document.getElementById('ret');
  const stepVal = document.getElementById('stepVal');
  const dotRVal = document.getElementById('dotRVal');
  const effRVal = document.getElementById('effRVal');
  const pushVal = document.getElementById('pushVal');
  const retVal = document.getElementById('retVal');

  const renderer = new DotsRenderer(canvas);

  function syncUI(){
    fallVal.textContent = Math.round(+fallEl.value*100)+ '%';
    stepVal.textContent = stepEl.value + ' px';
    dotRVal.textContent = dotREl.value + ' px';
    effRVal.textContent = effREl.value + ' px';
    pushVal.textContent = '×' + (+pushEl.value).toFixed(2);
    retVal.textContent = '×' + (+retEl.value).toFixed(2);
  }
  function updateFromUI(clearGrid){
    renderer.setParams({
      FALL_MIX: parseFloat(fallEl.value),
      BASE_STEP: parseInt(stepEl.value,10),
      BASE_RADIUS: parseInt(dotREl.value,10),
      EFFECT_RADIUS_BASE: parseInt(effREl.value,10),
      pushMul: parseFloat(pushEl.value),
      retMul: parseFloat(retEl.value)
    });
    if (clearGrid) renderer.state.clear();
    syncUI();
  }

  [stepEl, dotREl, effREl, pushEl, retEl, fallEl].forEach(el => el.addEventListener('input', () => updateFromUI(false)));
  function applyPanel(){ panelEl.style.display = toggleEl.checked ? 'block' : 'none'; }
  toggleEl.addEventListener('change', applyPanel); applyPanel();

  // Pointer events
  function cssToDeviceScale(){ const sx = canvas.width / canvas.clientWidth; const sy = canvas.height / canvas.clientHeight; return {sx, sy}; }
  canvas.addEventListener('pointermove', (e)=>{ const {sx,sy}=cssToDeviceScale(); renderer.setPointer(true, e.offsetX*sx, e.offsetY*sy); });
  canvas.addEventListener('pointerleave', ()=>{ renderer.setPointer(false); });
  canvas.addEventListener('pointerdown', (e)=>{ try{ canvas.setPointerCapture(e.pointerId);}catch(_){} const {sx,sy}=cssToDeviceScale(); renderer.setPointer(true, e.offsetX*sx, e.offsetY*sy); if(e.cancelable) e.preventDefault(); });
  canvas.addEventListener('pointerup', (e)=>{ try{ canvas.releasePointerCapture(e.pointerId);}catch(_){} renderer.setPointer(false); });
  canvas.addEventListener('pointercancel', ()=>{ renderer.setPointer(false); });

  // Touch hover emulation (press & move)
  function getTouchPos(t){ const rect = canvas.getBoundingClientRect(); const {sx,sy}=cssToDeviceScale(); return {x:(t.clientX-rect.left)*sx, y:(t.clientY-rect.top)*sy}; }
  function ts(e){ if(e.cancelable) e.preventDefault(); const t=e.touches&&e.touches[0]; if(!t) return; const p=getTouchPos(t); renderer.setPointer(true, p.x, p.y); }
  function tm(e){ if(e.cancelable) e.preventDefault(); const t=e.touches&&e.touches[0]; if(!t) return; const p=getTouchPos(t); renderer.setPointer(true, p.x, p.y); }
  function te(e){ if(e.touches && e.touches.length>0){ const t=e.touches[0]; const p=getTouchPos(t); renderer.setPointer(true, p.x, p.y); } else { renderer.setPointer(false); } }
  function tc(){ renderer.setPointer(false); }
  canvas.addEventListener('touchstart', ts, {passive:false});
  canvas.addEventListener('touchmove', tm, {passive:false});
  canvas.addEventListener('touchend', te, {passive:false});
  canvas.addEventListener('touchcancel', tc, {passive:false});


  function loadScript(src){
    return new Promise((resolve, reject)=>{
      const s = document.createElement('script');
      s.src = src; s.onload = ()=>resolve(); s.onerror = reject; document.head.appendChild(s);
    });
  }
  function loadMap(mapPath){
    if (mapPath.endsWith('.js')){
      return loadScript(mapPath).then(()=> window.MAP_DATA);
    }
    return fetch(mapPath).then(r=>r.json()).catch(()=>{
      // Fallback for file:// or blocked fetch
      return loadScript(mapPath.replace(/\.json$/i, '.js')).then(()=> window.MAP_DATA);
    });
  }
  function getMapPath(){
    const params = new URLSearchParams(window.location.search);
    const p = params.get('map');
    return p || 'assets/map.json';
  }
  loadMap(getMapPath()).then(data=>{ renderer.setMapData(data); updateFromUI(true); syncUI(); renderer.requestTick && renderer.requestTick(); }).catch(err=>{ console.error('No se pudo cargar el mapa', err); });

})();

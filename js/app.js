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
  // Exponer el renderer para acceso desde la consola (ej: renderer.getMovedFlags())
  window.renderer = renderer;

  // Lista de mapas disponibles (puedes añadir nuevas rutas aquí)
  // Puede ser un string simple o un objeto {path: '...', step: 12}
  const MAPS = [
    { path: 'assets/map.json', step: 15 },
    { path: 'assets/pixel_map_el_error.json', step: 8 },
    { path: 'assets/pixel_map_figuress.json', step: 15 }
  ];
  // Exponer para uso externo / consola
  window.MAPS = MAPS;

  // Función auxiliar para extraer path y step de un elemento de MAPS
  function getMapConfig(mapItem) {
    if (typeof mapItem === 'string') {
      return { path: mapItem, step: null };
    } else if (mapItem && typeof mapItem === 'object') {
      return { path: mapItem.path, step: mapItem.step || null };
    }
    return { path: null, step: null };
  }

  var indexMAP = 1;

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
  // Toggleable debug logs for touch on mobile
  window.DOTS_TOUCH_DEBUG = window.DOTS_TOUCH_DEBUG || false;
  function getTouchPos(t){ const rect = canvas.getBoundingClientRect(); const {sx,sy}=cssToDeviceScale(); return {x:(t.clientX-rect.left)*sx, y:(t.clientY-rect.top)*sy}; }
  function ts(e){ if(e.cancelable) e.preventDefault(); const t=e.touches&&e.touches[0]; if(!t) return; const p=getTouchPos(t); renderer.setPointer(true, p.x, p.y); }
  function tm(e){ if(e.cancelable) e.preventDefault(); const t=e.touches&&e.touches[0]; if(!t) return; const p=getTouchPos(t); renderer.setPointer(true, p.x, p.y); }
  function te(e){ if(e.touches && e.touches.length>0){ const t=e.touches[0]; const p=getTouchPos(t); renderer.setPointer(true, p.x, p.y); } else { renderer.setPointer(false); } }
  function tc(){ renderer.setPointer(false); }
  canvas.addEventListener('touchstart', ts, {passive:false});
  canvas.addEventListener('touchmove', tm, {passive:false});
  canvas.addEventListener('touchend', te, {passive:false});
  canvas.addEventListener('touchcancel', tc, {passive:false});

  // Enhanced touch debug: wrap handlers to log when enabled
  if (window.DOTS_TOUCH_DEBUG) {
    const _ts = ts, _tm = tm, _te = te, _tc = tc;
    window.DOTS_TOUCH_DEBUG = true;
    canvas.removeEventListener('touchstart', ts);
    canvas.removeEventListener('touchmove', tm);
    canvas.removeEventListener('touchend', te);
    canvas.removeEventListener('touchcancel', tc);
    canvas.addEventListener('touchstart', function(e){ console.log('touchstart', e.touches && e.touches[0] && getTouchPos(e.touches[0])); return _ts(e); }, {passive:false});
    canvas.addEventListener('touchmove', function(e){ console.log('touchmove', e.touches && e.touches[0] && getTouchPos(e.touches[0])); return _tm(e); }, {passive:false});
    canvas.addEventListener('touchend', function(e){ console.log('touchend', e.touches && e.touches[0] && getTouchPos(e.touches[0]), 'touchesLen', e.touches && e.touches.length); return _te(e); }, {passive:false});
    canvas.addEventListener('touchcancel', function(e){ console.log('touchcancel'); return _tc(e); }, {passive:false});
  }


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
    if (!p) return MAPS[0];
    // Si es un índice numérico, devolver ese mapa
    if (/^\d+$/.test(p)){
      const idx = parseInt(p,10);
      return MAPS[idx] || MAPS[0];
    }
    // Si coincide con una ruta en MAPS, devuélvelo
    const mapPaths = MAPS.map(m => typeof m === 'string' ? m : m.path);
    if (mapPaths.indexOf(p) !== -1) return p;
    // Otherwise use the raw value (allows arbitrary paths)
    return p;
  }
  
  // Cargar mapa inicial
  const initialMapItem = getMapPath();
  const initialConfig = getMapConfig(initialMapItem);
  loadMap(initialConfig.path).then(data=>{
    const options = initialConfig.step ? { step: initialConfig.step } : undefined;
    renderer.setMapData(data, options);
    // Si se especificó un step, actualizar el UI
    if (initialConfig.step && typeof initialConfig.step === 'number') {
      stepEl.value = initialConfig.step;
    }
    updateFromUI(true);
    syncUI();
    renderer.requestTick && renderer.requestTick();
  }).catch(err=>{ console.error('No se pudo cargar el mapa', err); });

  // Permite cambiar el mapa dinámicamente desde la consola o desde UI:
  window.changeMap = function(path){
    // allow numeric index or string path
    var target = path;
    var config = null;
    
    if (typeof path === 'number' || (/^\d+$/.test(String(path)))){
      var idx = parseInt(path,10);
      target = MAPS[idx] || MAPS[0];
      config = getMapConfig(target);
    } else {
      // Si es un string, usarlo directamente (retrocompatibilidad)
      config = { path: target, step: null };
    }
    
    loadMap(config.path)
      .then(data=>{
        const options = config.step ? { step: config.step } : undefined;
        renderer.setMapData(data, options);
        // Si se especificó un step, actualizar el slider del UI
        if (config.step && typeof config.step === 'number') {
          stepEl.value = config.step;
        }
        updateFromUI(true);
        syncUI();
        renderer.fadeIn(150); // efecto de fade-in rápido al cambiar mapa
        renderer.requestTick && renderer.requestTick();
      })
      .catch(err=>{ console.error('No se pudo cargar el mapa', err); });
  };

  // Escuchar el evento personalizado
    canvas.addEventListener('imageCleared', (e) => {
        console.log('Datos recibidos:', e.detail);
        toggleMenu();
        changeMap(getNextMap());
    });

    function getNextMap() {
  const current = MAPS[indexMAP];
  indexMAP = (indexMAP + 1) % MAPS.length;
  return indexMAP - 1 < 0 ? MAPS.length - 1 : indexMAP - 1;
}

function toggleMenu() {
  
  document.getElementById("bottomMenu").classList.add("show");
}





  
})();

function goToSection(index) {
  const sections = document.querySelectorAll(".snap-section");
  if (sections[index]) {
    sections[index].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }
}

// Actualizar el botón activo del menú según la sección visible
function updateActiveMenuButton() {
  const container = document.querySelector('.snap-container');
  const buttons = document.querySelectorAll('#bottomMenu .icon-btn');
  if (!container || !buttons.length) return;
  
  const vw = window.innerWidth || document.documentElement.clientWidth;
  const currentIndex = Math.round(container.scrollLeft / vw);
  
  buttons.forEach((btn, idx) => {
    if (idx === currentIndex) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Escuchar cambios de sección
document.addEventListener('DOMContentLoaded', function() {
  const container = document.querySelector('.snap-container');
  if (container) {
    let scrollTimeout;
    container.addEventListener('scroll', function() {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(updateActiveMenuButton, 100);
    });
    // Actualizar al cargar
    updateActiveMenuButton();
  }
});

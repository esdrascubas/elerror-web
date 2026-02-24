// Navegación horizontal para secciones full-screen con soporte móvil y desktop.
(function () {
  const container = document.querySelector('.snap-container');
  if (!container) return;

  const sections = Array.from(container.querySelectorAll('.snap-section'));
  let index = 0;

  // ---------- Utilidades ----------
  function clamp(n, min, max) { return Math.max(min, Math.min(n, max)); }

  function currentIndexFromScroll() {
    const vw = window.innerWidth || document.documentElement.clientWidth;
    if (!vw) return index;
    const approx = Math.round(container.scrollLeft / vw);
    return clamp(approx, 0, sections.length - 1);
  }

  function goTo(i, behavior = 'smooth') {
    index = clamp(i, 0, sections.length - 1);
    const target = sections[index];
    if (target) {
      target.scrollIntoView({ behavior, inline: 'start', block: 'nearest' });
      // (Opcional) Sincroniza hash:
      // history.replaceState(null, '', '#' + target.id);
    }
  }

  // ---------- Teclado (desktop) ----------
  window.addEventListener('keydown', (e) => {
    // Ignora si el foco está en inputs para no interferir
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) return;

    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index - 1); }
  });

  // ---------- Botones (opcionales) ----------
  const btnPrev = document.querySelector('.btn-prev');
  const btnNext = document.querySelector('.btn-next');
  btnPrev && btnPrev.addEventListener('click', () => goTo(index - 1));
  btnNext && btnNext.addEventListener('click', () => goTo(index + 1));

  // ---------- Wheel horizontal (trackpad/ratón) ----------
  // Normaliza desplazamiento horizontal; filtra el vertical predominante.
  let wheelRAF = false;
  container.addEventListener('wheel', (e) => {
    // Si predomina el eje X, prevenimos el scroll vertical accidental
    const absX = Math.abs(e.deltaX);
    const absY = Math.abs(e.deltaY);
    if (absX > absY) {
      // Permitimos el scroll horizontal nativo del contenedor
      // pero evitamos que burbujee como scroll vertical de la página
      e.preventDefault();
      container.scrollLeft += e.deltaX;
    }
    if (!wheelRAF) {
      wheelRAF = true;
      requestAnimationFrame(() => {
        index = currentIndexFromScroll();
        wheelRAF = false;
      });
    }
  }, { passive: false });

  // ---------- Pointer / Touch (móvil y también mouse drag) ----------
  // Usamos Pointer Events para unificar touch/mouse/pen.
  let isPointerDown = false;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let totalDX = 0;
  let totalDY = 0;
  const H_SWIPE_THRESHOLD = 40;   // px para considerar swipe
  const V_CANCEL_THRESHOLD = 25;  // si vertical supera esto, priorizamos vertical

  function onPointerDown(e) {
    // Solo botón principal o contacto primario
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    isPointerDown = true;
    startX = lastX = e.clientX;
    startY = e.clientY;
    totalDX = 0;
    totalDY = 0;
    container.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!isPointerDown) return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - startY;
    lastX = e.clientX;

    totalDX += dx;
    totalDY = dy;

    // Si estamos desplazándonos principalmente en horizontal, bloqueamos scroll vertical de la página
    if (Math.abs(totalDX) > Math.abs(totalDY)) {
      e.preventDefault(); // Necesario en móviles para bloquear el scroll vertical de body
      container.scrollLeft -= dx; // invertimos porque dx>0 es movimiento a derecha, scrollLeft decrece
    } else if (Math.abs(totalDY) > V_CANCEL_THRESHOLD) {
      // El gesto es vertical -> soltamos para que la página pueda desplazarse
      // No prevenimos por accesibilidad de scroll vertical
    }
  }

  function onPointerUp(e) {
    if (!isPointerDown) return;
    isPointerDown = false;
    container.releasePointerCapture?.(e.pointerId);

    // Decidir si el gesto fue un "swipe" a otra sección
    if (Math.abs(totalDX) >= H_SWIPE_THRESHOLD && Math.abs(totalDX) > Math.abs(totalDY)) {
      if (totalDX < 0) goTo(index + 1); // arrastró a la izquierda -> siguiente
      else goTo(index - 1);             // arrastró a la derecha -> anterior
    } else {
      // Re-encaja a la sección actual más cercana
      goTo(currentIndexFromScroll());
    }
  }

  // En móviles iOS, para poder llamar preventDefault en move, debemos no usar passive:true
  container.addEventListener('pointerdown', onPointerDown, { passive: true });
  container.addEventListener('pointermove', onPointerMove, { passive: false });
  container.addEventListener('pointerup', onPointerUp, { passive: true });
  container.addEventListener('pointercancel', onPointerUp, { passive: true });
  container.addEventListener('pointerleave', onPointerUp, { passive: true });

  // ---------- Sync al hacer scroll manual ----------
  container.addEventListener('scroll', () => {
    if (container._ticking) return;
    container._ticking = true;
    requestAnimationFrame(() => {
      index = currentIndexFromScroll();
      container._ticking = false;
    });
  });

  // ---------- Hash (opcional) ----------
  window.addEventListener('hashchange', () => {
    const id = location.hash.replace('#', '');
    const i = sections.findIndex(s => s.id === id);
    if (i >= 0) goTo(i);
  });

  // ---------- Inicio ----------
  window.addEventListener('DOMContentLoaded', () => {
    const id = location.hash.replace('#', '');
    const i = sections.findIndex(s => s.id === id);
    goTo(i >= 0 ? i : 0, 'auto');
  });

  // ---------- Resize ----------
  // Si cambia el ancho de la viewport, re-encaja la sección actual
  window.addEventListener('resize', () => {
    goTo(index, 'auto');
  });
})();
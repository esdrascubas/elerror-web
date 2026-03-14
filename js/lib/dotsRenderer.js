(function (global) {
  function DotsRenderer(canvas, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.state = new Map(); // key: ix\n iy -> {ox, oy, vx, vy}
    this.FALL_MIX = 0.5; // 0=lineal, 1=gauss
    this.BASE_STEP = 12;    // px CSS base
    this.BASE_RADIUS = 2;   // px CSS base
    this.EFFECT_RADIUS_BASE = 30; // px device

    this.SIGMA_FACTOR = 0.35; // gauss
    this.FORCE_BASE = 6000;   // pxCSS/s^2
    this.K_BASE = 8.0;        // rigidez base
    this.IDLE_ACC = 55;       // px_device / s^2
    this.IDLE_FREQ = 0.0075;  // 1/ms
    this.IDLE_BIAS = 0.0;
    this.pushMul = 1.0;       // 0.5..3
    this.retMul = 1.0;        // 0.5..3
    this.ZETA = 0.9;          // amortiguación

    this.pointerActive = false;
    this.pointerX = 0; this.pointerY = 0;

    this.animId = 0; this.lastNow = 0; this.liveCount = 0;

    this.mapData = null; // {width, height, compressed_map}
    // moved-pixels flags for logo pixels (key: "x\ny" on map coordinates)
    this._movedFlags = new Map();

    this._onResize = this._onResize.bind(this);
    this._tick = this._tick.bind(this);
    this._totalPixels = 0;
    this._logoPixels = 0;
    this._logoPixelsMoved = 0;
    this._dotReturned = 0;
    this._dotOriginal = 0;
    this._eventFired = false;


    this._fadeUntil = 0;
    this._fadeDur = 0;


    window.addEventListener('resize', this._onResize);
  }



  DotsRenderer.prototype.dispose = function () {
    cancelAnimationFrame(this.animId);
    this.animId = 0;
    window.removeEventListener('resize', this._onResize);
  };


  DotsRenderer.prototype.fadeIn = function (duration = 280) {
    this._fadeDur = duration;
    this._fadeUntil = performance.now() + duration;
    this.requestTick();
  };


  DotsRenderer.prototype.setMapData = function (mapData, options) {
    this.mapData = mapData;
    this._totalPixels = 0;
    this._logoPixels = 0;
    this._logoPixelsMoved = 0;
    this._dotReturned = 0;
    this._dotOriginal = 0;
    this._eventFired = false;
    this.state.clear();
    // initialize moved flags: set false for every logo pixel in the map
    this._movedFlags.clear();
    this._logoPixelsMoved = 0;
    
    // Aplicar step opcional si se proporciona y es válido
    if (options && typeof options.step === 'number' && options.step > 0) {
      this.BASE_STEP = Math.round(options.step);
    }
    
    if (mapData && mapData.compressed_map) {
      var rows = mapData.compressed_map;
      for (var ry = 0; ry < rows.length; ry++) {
        var row = rows[ry]; if (!row) continue;
        var xPos = 0;
        for (var si = 0; si < row.length; si++) {
          var seg = row[si]; var isLogo = !!seg[0]; var count = seg[1];
          this._totalPixels = this._totalPixels + parseInt(count);
          if (isLogo) { this._logoPixels = this._logoPixels + parseInt(count); for (var mx = xPos; mx < xPos + count; mx++) { this._movedFlags.set(key(mx, ry), false); } }
          xPos += count;
        }
      }
    }
    this.requestTick();
  };

  DotsRenderer.prototype.setParams = function (params) {
    if ('FALL_MIX' in params) this.FALL_MIX = params.FALL_MIX;
    if ('BASE_STEP' in params) this.BASE_STEP = params.BASE_STEP | 0;
    if ('BASE_RADIUS' in params) this.BASE_RADIUS = params.BASE_RADIUS | 0;
    if ('EFFECT_RADIUS_BASE' in params) this.EFFECT_RADIUS_BASE = params.EFFECT_RADIUS_BASE | 0;
    if ('pushMul' in params) this.pushMul = +params.pushMul;
    if ('retMul' in params) this.retMul = +params.retMul;
    this.requestTick();
  };

  DotsRenderer.prototype.setPointer = function (active, x, y) {
    this.pointerActive = !!active;
    this.pointerX = x || 0; this.pointerY = y || 0;
    this.requestTick();

  };

  // Return a copy of moved flags map (key -> boolean)
  DotsRenderer.prototype.getMovedFlags = function () {
    return new Map(this._movedFlags);
  };

  function key(ix, iy) { return ix + '\n' + iy; }
  function hash2d(ix, iy) { var s = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453; return s - Math.floor(s); }

  DotsRenderer.prototype.requestTick = function () {
    if (!this.animId) this.animId = requestAnimationFrame(this._tick);
  };
  DotsRenderer.prototype._tick = function (now) {
    this.draw(now);
    this.animId = (this._needsAnimation() ? requestAnimationFrame(this._tick) : 0);
  };
  DotsRenderer.prototype._needsAnimation = function () {
    return this.pointerActive || this.liveCount > 0 || this._fadeUntil > 0;
  };

  DotsRenderer.prototype._onResize = function () {
    this.state.clear();
    this.requestTick();
  };

  DotsRenderer.prototype._readColorsFromCSS = function () {
    // Colors via CSS variables (external to JS)
    var root = getComputedStyle(document.documentElement);
    var bg = root.getPropertyValue('--canvas-bg-color').trim() || 'transparent';
    var logoStr = root.getPropertyValue('--logo-color-list').trim() || '#ff7701';
    var returned = root.getPropertyValue('--returned-color').trim() || root.getPropertyValue('--returned_color').trim() || '';
    
    // Parsear logo-color-list: puede ser un solo color o una lista separada por comas
    var logoColors = logoStr.split(',').map(function(c) { return c.trim(); }).filter(function(c) { return c.length > 0; });
    
    return { bg: bg, logoColors: logoColors, returned: returned };
  };
  
  // Función auxiliar para obtener un color aleatorio de la lista de colores logo
  DotsRenderer.prototype._getRandomLogoColor = function (logoColors) {
    if (!logoColors || logoColors.length === 0) return '#ff7701';
    if (logoColors.length === 1) return logoColors[0];
    var idx = Math.floor(Math.random() * logoColors.length);
    return logoColors[idx];
  };

  // Función auxiliar para convertir color hex/rgb a componentes RGB
  DotsRenderer.prototype._parseColor = function (colorStr) {
    // Si es rgba o rgb
    var rgbaMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbaMatch) {
      return { r: parseInt(rgbaMatch[1]), g: parseInt(rgbaMatch[2]), b: parseInt(rgbaMatch[3]) };
    }
    // Si es hex
    var hex = colorStr.replace('#', '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16)
    };
  };

  // Función auxiliar para interpolar entre dos colores
  DotsRenderer.prototype._lerpColor = function (color1, color2, t) {
    return {
      r: Math.floor(color1.r + (color2.r - color1.r) * t),
      g: Math.floor(color1.g + (color2.g - color1.g) * t),
      b: Math.floor(color1.b + (color2.b - color1.b) * t)
    };
  };

  // Función auxiliar para obtener color de fuego basado en "temperatura"
  // Usa los colores de CSS para crear el gradiente
  DotsRenderer.prototype._getFireColor = function (intensity, alpha, baseColor) {
    // intensity: 0 (frío) a 1 (caliente)
    alpha = alpha !== undefined ? alpha : 1.0;
    
    // Parsear el color base de CSS
    var base = this._parseColor(baseColor || '#ff7701');
    
    // Crear gradiente desde versión oscura del color base hasta blanco
    // 0.0 - 0.3: Color oscuro (30% del brillo original)
    // 0.3 - 0.6: Color base
    // 0.6 - 1.0: Color base hacia blanco
    
    var color;
    if (intensity < 0.3) {
      // Oscurecer el color base
      var darkFactor = intensity / 0.3; // 0 a 1
      var dark = { r: Math.floor(base.r * 0.3), g: Math.floor(base.g * 0.3), b: Math.floor(base.b * 0.3) };
      color = this._lerpColor(dark, base, darkFactor);
    } else if (intensity < 0.6) {
      // Mantener el color base, quizás ligeramente más brillante
      var t = (intensity - 0.3) / 0.3;
      var bright = { r: Math.min(255, Math.floor(base.r * 1.2)), g: Math.min(255, Math.floor(base.g * 1.2)), b: Math.min(255, Math.floor(base.b * 1.2)) };
      color = this._lerpColor(base, bright, t);
    } else {
      // Interpolar hacia el blanco
      var t = (intensity - 0.6) / 0.4;
      var current = { r: Math.min(255, Math.floor(base.r * 1.2)), g: Math.min(255, Math.floor(base.g * 1.2)), b: Math.min(255, Math.floor(base.b * 1.2)) };
      var white = { r: 255, g: 255, b: 255 };
      color = this._lerpColor(current, white, t);
    }
    
    return 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', ' + alpha + ')';
  };

  DotsRenderer.prototype.draw = function (now) {
    if (!this.mapData) return;
    var map = this.mapData;

    this._dotReturned = 0;
    this._dotOriginal = 0;


    var W = map.width, H = map.height, rows = map.compressed_map;
    if (!W || !H || !rows) return;

    var dpr = Math.max(1, window.devicePixelRatio || 1);
    var vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    var vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    var s = Math.min(vw / W, vh / H);
    var cssW = Math.floor(W * s), cssH = Math.floor(H * s);
    this.canvas.width = Math.max(1, Math.floor(cssW * dpr));
    this.canvas.height = Math.max(1, Math.floor(cssH * dpr));
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';

    var stepPx = Math.max(1, Math.round(this.BASE_STEP * s * dpr));
    var radiusPx = Math.max(1, Math.round(this.BASE_RADIUS * s * dpr));
    var R = Math.max(1, Math.round(this.EFFECT_RADIUS_BASE * dpr));
    var sigma = Math.max(1, Math.round(R * this.SIGMA_FACTOR));
    var Fmax = this.FORCE_BASE * this.pushMul * dpr;
    var K = this.K_BASE * this.retMul;
    var D = 2 * Math.sqrt(Math.max(0.001, K)) * this.ZETA;

    var dt = 1 / 60; if (this.lastNow) { dt = Math.min(0.05, Math.max(0.001, (now - this.lastNow) / 1000)); } this.lastNow = now;

    var colors = this._readColorsFromCSS();
    var ctx = this.ctx;

///////////////


// 1) Limpiar a transparente (si aún pintas fondo sólido, cámbialo por clearRect)
ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

// 2) Cálculo de alpha (0→1) si hay fade activo
var alpha = 1;
if (this._fadeUntil > 0) {
  var nowMs = now; // 'now' viene de requestAnimationFrame en ms
  var restante = this._fadeUntil - nowMs;
  if (restante > 0) {
    var t = 1 - (restante / this._fadeDur); // 0..1
    alpha = Math.max(0, Math.min(1, t));
  } else {
    // terminado el fade
    this._fadeUntil = 0;
  }
}

// 3) Guardar estado y aplicar opacidad global
ctx.save();
ctx.globalAlpha = alpha;


//////////////




    ctx.fillStyle = colors.bg; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.liveCount = 0; var MAX_DISP = Math.round(R * 0.9);

    for (var y = 0; y < this.canvas.height; y += stepPx) {
      var yLogic = Math.min(H - 1, Math.round(y / (s * dpr)));
      var row = rows[yLogic]; if (!row) continue;
      var xPos = 0;
      for (var si = 0; si < row.length; si++) {
        var seg = row[si];
        var isLogo = !!seg[0];
        var count = seg[1];
        if (xPos >= W) break;
        if (count > W - xPos) count = W - xPos;
        if (isLogo) {
          var start = xPos, end = xPos + count;
          var xScreen = Math.round(start * s * dpr);
          var x = xScreen + ((stepPx - (xScreen % stepPx)) % stepPx);
          var xEndScreen = Math.round(end * s * dpr);
          for (; x < xEndScreen; x += stepPx) {
            var bx = x, by = y;
            var ix = Math.floor(bx / stepPx), iy = Math.floor(by / stepPx);
            var k = key(ix, iy);
            var st = this.state.get(k); if (!st) { st = { ox: 0, oy: 0, vx: 0, vy: 0 }; this.state.set(k, st); }


            // Dentro del bucle por cada punto:
            var wasPushedThisFrame = false;

            var fx = 0, fy = 0;
            if (this.pointerActive) {
              var dx = bx - this.pointerX, dy = by - this.pointerY; var d2 = dx * dx + dy * dy;
              if (d2 < R * R && d2 > 0) {
                var dist = Math.sqrt(d2); var g = Math.exp(- d2 / (2 * sigma * sigma));
                var t = 1 - (dist / R); var w_lin = Math.max(0, t);
                var w = (1 - this.FALL_MIX) * w_lin + (this.FALL_MIX) * g;
                var F = Fmax * w; var ux = dx / dist, uy = dy / dist; fx += ux * F; fy += uy * F;
                wasPushedThisFrame = true;
              }
            }
            // movimiento propio
            var phase0 = hash2d(ix, iy) * 6.28318 + this.IDLE_BIAS;
            var th = phase0 + now * this.IDLE_FREQ;
            fx += this.IDLE_ACC * Math.sin(th);
            fy += this.IDLE_ACC * Math.cos(th);

            // resorte-amortiguador
            var ax = -K * st.ox - D * st.vx + fx;
            var ay = -K * st.oy - D * st.vy + fy;
            st.vx += ax * dt; st.vy += ay * dt;
            st.ox += st.vx * dt; st.oy += st.vy * dt;
            var disp = Math.hypot(st.ox, st.oy);
            if (disp > MAX_DISP) { var sc = MAX_DISP / disp; st.ox *= sc; st.oy *= sc; disp = Math.hypot(st.ox, st.oy); }
            // Movement detection thresholds tuned to visual grid:
            // - dispThreshold: fraction of the grid step in device pixels
            // - velThresholdPerSec: reasonable px/s velocity threshold
            var dispThreshold = Math.max(0.5, stepPx * 0.25); // e.g., quarter of mesh step
            var velThresholdPerSec = Math.max(20, stepPx * 4); // px/s
            // consider moved if either displacement or velocity exceed thresholds
            var moved = (disp > dispThreshold) || (Math.abs(st.vx) > velThresholdPerSec) || (Math.abs(st.vy) > velThresholdPerSec);
            if (moved) {
              // reset rest counter and returned-logging when it becomes active again
              st._restCount = 0;
              st._returnedLogged = false;
            }
            if (moved) this.liveCount++;
            // update moved flag for this map pixel (map coords)
            var mapX = Math.min(W - 1, Math.max(0, Math.floor(bx / (s * dpr))));
            var mapKey = key(mapX, yLogic);

            if (wasPushedThisFrame) {
              st.userPushed = true; // for potential future use (e.g., visual feedback on pushed pixels)  
            }

            // Only record movement for logo pixels (explicit check).
            if (isLogo && moved && st.userPushed && this._movedFlags.has(mapKey)) {
              if (!this._movedFlags.get(mapKey)) { this._logoPixelsMoved++; }
              this._movedFlags.set(mapKey, true);
            }
            var cx = bx + st.ox, cy = by + st.oy;
            // If this map pixel moved before and is now at rest, draw it with returned color.
            // Use thresholds consistent with the movement detection and add simple hysteresis
            var atRest = (disp <= dispThreshold && Math.abs(st.vx) <= velThresholdPerSec && Math.abs(st.vy) <= velThresholdPerSec);
            // per-state rest counter for hysteresis (avoid flicker if it oscillates)
            if (!st._restCount) st._restCount = 0;
            if (atRest) st._restCount++; else st._restCount = 0;
            var returnedHysteresisFrames = 3;
            var isReturned = false;
            if (this._movedFlags.has(mapKey) && this._movedFlags.get(mapKey) && st._restCount >= returnedHysteresisFrames) isReturned = true;
            
            // Efecto de fuego: calcular intensidad basada en movimiento y posición
            var fireIntensity = 0;
            var particleAlpha = 1.0;
            var particleRadius = radiusPx;
            
            if (moved || !atRest) {
              // Intensidad basada en velocidad (más rápido = más caliente)
              var speed = Math.hypot(st.vx, st.vy);
              fireIntensity = Math.min(1, speed / (velThresholdPerSec * 3));
              // Agregar variación aleatoria para efecto de parpadeo
              fireIntensity = fireIntensity * (0.7 + Math.random() * 0.3);
              // Variar tamaño (partículas más calientes son más pequeñas y brillantes)
              particleRadius = radiusPx * (1 + fireIntensity * 0.5);
              // Variar opacidad
              particleAlpha = 0.8 + fireIntensity * 0.2;
            } else if (isReturned) {
              // Partículas en reposo tienen intensidad baja (brasas)
              fireIntensity = 0.1 + Math.random() * 0.15;
              particleRadius = Math.max(1, Math.round(radiusPx * 1.4));
              particleAlpha = 0.6 + Math.random() * 0.2;
            } else {
              // Estado normal
              fireIntensity = 0.3 + Math.random() * 0.2;
              particleAlpha = 0.9;
            }
            
            // Dibujar partícula con color de fuego
            if (isReturned) {
              // Dibujar con efecto de brasa usando el color returned
              ctx.save();
              ctx.globalAlpha = alpha * particleAlpha;
              // Usar returned_color si está disponible, sino usar un logo color aleatorio
              var returnedColor = colors.returned || this._getRandomLogoColor(colors.logoColors);
              ctx.fillStyle = this._getFireColor(fireIntensity, 1, returnedColor);
              ctx.beginPath();
              ctx.arc(cx, cy, particleRadius, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
              this._dotReturned++;
            } else {
              // Dibujar con efecto de llama activa usando un color aleatorio de la lista
              ctx.save();
              ctx.globalAlpha = alpha * particleAlpha;
              
              // Elegir un color aleatorio de la lista para esta partícula
              var particleColor = this._getRandomLogoColor(colors.logoColors);
              
              // Crear efecto de resplandor con múltiples capas
              if (fireIntensity > 0.5) {
                // Capa exterior (resplandor difuso)
                ctx.fillStyle = this._getFireColor(fireIntensity * 0.6, 0.3, particleColor);
                ctx.beginPath();
                ctx.arc(cx, cy, particleRadius * 1.8, 0, Math.PI * 2);
                ctx.fill();
              }
              
              // Capa principal
              ctx.fillStyle = this._getFireColor(fireIntensity, 1, particleColor);
              ctx.beginPath();
              ctx.arc(cx, cy, particleRadius, 0, Math.PI * 2);
              ctx.fill();
              
              // Núcleo brillante para partículas muy calientes
              if (fireIntensity > 0.7) {
                ctx.fillStyle = this._getFireColor(1.0, 0.8, particleColor);
                ctx.beginPath();
                ctx.arc(cx, cy, particleRadius * 0.5, 0, Math.PI * 2);
                ctx.fill();
              }
              
              ctx.restore();
              this._dotOriginal++;
            }
          }
        }
        xPos += count;
      }
    }
    
    // Restaurar contexto después del fade
    ctx.restore();

    //console.log("Original:", this._dotOriginal, "; Returned: ", this._dotReturned);

    if (this._dotOriginal < (this._dotReturned * 0.05) && !this._eventFired) {
      var eventCleared; // The custom event that will be created
      console.log("Original:", this._dotOriginal, "; Returned: ", this._dotReturned);

      console.log("lanzo evento");
      // Crear evento personalizado con datos (detail)
      var eventCleared = new CustomEvent('imageCleared', {
        detail: { id: 10, estado: 'activo' }
      });
      // Disparar
      this.canvas.dispatchEvent(eventCleared);
      this._eventFired = true;
    };



  };

  // Expose
  global.DotsRenderer = DotsRenderer;
})(window);

/* Rikuy Lab pitch — navigation, reveals, demos, presenter mode. No dependencies. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const chapters = $$('.ch');
  const railLinks = $$('.rail a');
  let current = 0;

  const fmt = (n, d = 0) => {
    const [i, f] = Math.abs(n).toFixed(d).split('.');
    const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (n < 0 ? '−' : '') + g + (f ? ',' + f : '');
  };

  /* ---------- image fallback ---------- */
  $$('.bg img').forEach(img => {
    const fail = () => img.parentElement.classList.add('noimg');
    if (img.complete && img.naturalWidth === 0) fail();
    img.addEventListener('error', fail);
  });

  /* ---------- kinetic headlines ---------- */
  $$('.kinetic').forEach(h => {
    const words = h.textContent.trim().split(/\s+/);
    h.setAttribute('aria-label', h.textContent.trim());
    h.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`).join(' ');
  });

  /* ---------- counters ---------- */
  function runCounters(root) {
    $$('.count', root).forEach(el => {
      if (el.dataset.done) return;
      el.dataset.done = '1';
      const to = parseFloat(el.dataset.to), d = +el.dataset.dec || 0;
      if (reduce) { el.textContent = fmt(to, d); return; }
      const dur = 1500, t0 = performance.now();
      const tick = now => {
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(to * e, d);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /* ---------- staged reveals per chapter ---------- */
  const stage = (items, gap, first = 0) => items.forEach((el, i) => {
    el.classList.add('rv');
    setTimeout(() => el.classList.add('in'), reduce ? 0 : first + i * gap);
  });
  const onEnter = {
    c1: s => stage($$('.story li', s), 1700, 900),
    c2: s => stage($$('.stat', s), 500, 400),
    c3: s => { stage([$('.cards', s), $('.holo', s)], 300, 600); loadHolo(); },
    c4: s => demo.start(),
    c5: s => stage([...$$('.chain li', s), $('.quote', s)], 350, 500),
    c6: s => stage([$('.payers', s), $('.payer-detail', s), $('.calc', s)], 250, 500),
    c7: s => { $$('.path li', s).forEach((li, i) => setTimeout(() => li.classList.add('lit'), reduce ? 0 : 500 + i * 650)); stage([$('.why', s), $('.ask', s)], 500, 1600); },
    c8: s => stage([$('.close-lead', s), $('.close-sign', s), $('.qr', s)], 600, 300),
  };
  // hide staged items before first view (only if JS runs)
  ['.story li', '.stat', '.cards', '.holo', '.chain li', '.quote', '.payers', '.payer-detail', '.calc', '.why', '.ask', '.close-lead', '.close-sign', '.qr']
    .forEach(sel => $$(sel).forEach(el => el.classList.add('rv')));

  function activate(i) {
    if (i < 0 || i >= chapters.length) return;
    current = i;
    chapters.forEach((c, k) => c.classList.toggle('is-active', k === i));
    const s = chapters[i];
    if (!s.classList.contains('seen')) {
      s.classList.add('seen');
      runCounters(s);
      onEnter[s.id] && onEnter[s.id](s);
    }
    railLinks.forEach((a, k) => { a.classList.toggle('on', k === i); a.classList.toggle('done', k < i); a.toggleAttribute('aria-current', k === i); });
    document.body.classList.toggle('on-light', s.classList.contains('light'));
    if (location.hash !== '#' + s.id) history.replaceState(null, '', '#' + s.id);
    if (s.id !== 'c3') holoExit();
    presenter.render();
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) activate(chapters.indexOf(e.target)); });
  }, { threshold: 0.55 });
  chapters.forEach(c => io.observe(c));
  // tall chapters on phones never reach 55%: fallback on scroll
  let scrollRaf = 0;
  addEventListener('scroll', () => {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      const mid = innerHeight * 0.45;
      const i = chapters.findIndex(c => { const r = c.getBoundingClientRect(); return r.top <= mid && r.bottom > mid; });
      if (i > -1 && i !== current) activate(i);
      parallax();
    });
  }, { passive: true });

  function parallax() {
    if (reduce) return;
    for (let k = Math.max(0, current - 1); k <= Math.min(chapters.length - 1, current + 1); k++) {
      const bg = $('.bg', chapters[k]);
      if (!bg) continue;
      const r = chapters[k].getBoundingClientRect();
      bg.style.transform = `translate3d(0, ${(r.top * -0.12).toFixed(1)}px, 0)`;
    }
  }

  function go(i) {
    i = Math.max(0, Math.min(chapters.length - 1, i));
    chapters[i].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    activate(i);
  }
  railLinks.forEach((a, k) => a.addEventListener('click', e => { e.preventDefault(); go(k); }));

  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (lbKey(e)) return;
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    const k = e.key;
    if (k === 'p' || k === 'P') { presenter.toggle(); return; }
    if (k === 't' || k === 'T') { presenter.pause(); return; }
    if (k === 'r' || k === 'R') { presenter.reset(); return; }
    if (typing && (k.startsWith('Arrow') || k === ' ')) return; // sliders keep their keys
    if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !e.shiftKey && t.tagName !== 'BUTTON') || k === 'ArrowDown') { e.preventDefault(); go(current + 1); }
    else if (k === 'ArrowLeft' || k === 'PageUp' || (k === ' ' && e.shiftKey) || k === 'ArrowUp') { e.preventDefault(); go(current - 1); }
    else if (k === 'Home') { e.preventDefault(); go(0); }
    else if (k === 'End') { e.preventDefault(); go(chapters.length - 1); }
    else if (k === 'Escape') holoExit();
  });

  /* ---------- ch2: interactive gap ---------- */
  $$('.gap-row').forEach(b => b.addEventListener('click', () => {
    $$('.gap-row').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
    $('.gap-verdict').textContent = b.dataset.row === 'home'
      ? '85,8% de los hogares rurales ya tiene internet. El celular llegó.'
      : 'Sus colegios, solo el 18,9%. El laboratorio, no.';
  }));

  /* ---------- ch3: flip cards + live hologram ---------- */
  $$('.card').forEach(c => c.addEventListener('click', () => c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true'))));
  const holoFrame = $('.holo-frame'), iframe = $('iframe', holoFrame), exitBtn = $('.holo-exit');
  function loadHolo() {
    if (iframe.src) return;
    iframe.addEventListener('load', () => holoFrame.classList.add('loaded'), { once: true });
    iframe.src = iframe.dataset.src;
  }
  $('.holo-cover').addEventListener('click', () => {
    loadHolo();
    holoFrame.classList.add('live');
    exitBtn.hidden = false;
    setTimeout(() => iframe.focus(), 50);
  });
  function holoExit() {
    if (!holoFrame.classList.contains('live')) return;
    holoFrame.classList.remove('live');
    exitBtn.hidden = true;
    document.body.focus({ preventScroll: true });
  }
  // the embedded app must not steal deck keys unless the presenter opened it
  addEventListener('blur', () => setTimeout(() => {
    if (document.activeElement === iframe && !holoFrame.classList.contains('live')) { iframe.blur(); document.body.focus({ preventScroll: true }); }
  }, 0));
  exitBtn.addEventListener('click',() => { holoExit(); $('.holo-cover').focus(); });

  /* ---------- holo tabs + hand/camera control ---------- */
  $$('.holo-tab').forEach(b => b.addEventListener('click', () => {
    $$('.holo-tab').forEach(o => o.setAttribute('aria-selected', String(o === b)));
    iframe.dataset.src = b.dataset.src;
    holoFrame.classList.remove('loaded');
    iframe.addEventListener('load', () => holoFrame.classList.add('loaded'), { once: true });
    iframe.src = b.dataset.src;
  }));
  const camMsg = $('.holo-cam-msg');
  $('.holo-cam').addEventListener('click', () => {
    if (!iframe.src || !iframe.src.includes('demo-raspberry')) $$('.holo-tab')[1].click();
    holoFrame.classList.add('live'); exitBtn.hidden = false;
    camMsg.textContent = 'Activando la cámara…';
    let tries = 0;
    const tryClick = () => {
      tries++;
      let btn = null;
      try {
        const d = iframe.contentDocument;
        btn = d && Array.from(d.querySelectorAll('button')).find(x => (x.textContent || '').includes('Controlar con la cámara'));
      } catch (_) { /* cross-origin: fall back to manual */ }
      if (btn) { btn.click(); iframe.focus(); camMsg.textContent = 'Cámara activa: mueve la mano frente a la cámara para girar el objeto.'; return; }
      if (tries < 40) setTimeout(tryClick, 500);
      else { iframe.focus(); camMsg.textContent = 'Pulsa “✋ Controlar con la cámara” dentro del visor.'; }
    };
    setTimeout(tryClick, 600);
  });

  /* ---------- ch9: onboarding video ---------- */
  const onb = $('.onb'), onbSound = $('.onb-sound');
  if (onb) {
    const tryPlay = () => { onb.muted = onb.muted; onb.play().catch(() => {}); };
    window.addEventListener('hashchange', tryPlay); document.addEventListener('keydown', () => setTimeout(tryPlay, 400)); setInterval(() => { const r = onb.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0 && onb.paused) tryPlay(); }, 800);
    new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) onb.play().catch(() => {}); else onb.pause(); }), { threshold: .3 }).observe(onb);
    onbSound.addEventListener('click', () => {
      onb.muted = !onb.muted;
      onbSound.textContent = onb.muted ? '🔇 Activar sonido' : '🔊 Silenciar';
      if (!onb.muted) onb.play().catch(() => {});
    });
  }

  /* ---------- lightbox (architecture + gallery) ---------- */
  const lb = $('.lb'), lbImg = $('img', lb), lbCap = $('.lb-cap', lb);
  let lbList = [], lbI = 0;
  function lbShow() {
    const it = lbList[lbI];
    lbImg.src = it.src; lbImg.alt = it.cap; lbCap.textContent = it.cap;
    lb.classList.toggle('tall', !!it.tall);
    const multi = lbList.length > 1;
    $('.lb-prev', lb).hidden = !multi; $('.lb-next', lb).hidden = !multi;
    lb.scrollTop = 0;
  }
  function lbOpen(list, i) { lbList = list; lbI = i; lbShow(); lb.hidden = false; $('.lb-x', lb).focus(); }
  function lbClose() { lb.hidden = true; }
  function lbStep(d) { lbI = (lbI + d + lbList.length) % lbList.length; lbShow(); }
  const shots = $$('.shot').map(b => ({ src: $('img', b).src, cap: $('span', b).textContent }));
  $$('.shot').forEach((b, i) => b.addEventListener('click', () => lbOpen(shots, i)));
  $$('.zoomable').forEach(b => b.addEventListener('click', () => lbOpen([{ src: b.dataset.full, cap: 'Arquitectura de Rikuy Lab', tall: true }], 0)));
  $('.lb-x', lb).addEventListener('click', lbClose);
  $('.lb-prev', lb).addEventListener('click', () => lbStep(-1));
  $('.lb-next', lb).addEventListener('click', () => lbStep(1));
  lb.addEventListener('click', e => { if (e.target === lb) lbClose(); });
  function lbKey(e) {
    if (lb.hidden) return false;
    if (e.key === 'Escape') lbClose();
    else if (e.key === 'ArrowRight') lbStep(1);
    else if (e.key === 'ArrowLeft') lbStep(-1);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === ' ' || e.key === 'PageDown' || e.key === 'PageUp') return true;
    else return false;
    e.preventDefault(); return true;
  }

  /* ---------- ch4: pendulum + guided chat ---------- */
  const demo = (() => {
    const g = 9.81;
    const cv = $('.sim-canvas'), ctx = cv.getContext('2d');
    const range = $('#len'), outL = $('.sim-L'), outT = $('.sim-T');
    const msgs = $$('.chat .msg');
    let L = +range.value, shownL = L, step = -1, running = false, last = 0, phase = 0, touched = false;
    const period = l => 2 * Math.PI * Math.sqrt(l / g);
    const show = n => { while (step < n) { step++; msgs[step] && msgs[step].classList.add('in'); } };

    function size() {
      const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth || 400;
      cv.width = Math.round(w * dpr); cv.height = Math.round(w * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function readout() {
      outL.textContent = fmt(L, 2) + ' m';
      outT.textContent = fmt(period(L), 1) + ' s';
    }
    function draw(now) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
      shownL += (L - shownL) * Math.min(1, dt * 8);
      phase += (2 * Math.PI / period(shownL)) * dt;
      const w = cv.clientWidth, h = w;
      ctx.clearRect(0, 0, w, h);
      const ox = w / 2, oy = h * 0.08, scale = (h * 0.78) / 2;
      const len = shownL * scale, th = (reduce ? 0.18 : 0.42) * Math.cos(phase);
      const bx = ox + len * Math.sin(th), by = oy + len * Math.cos(th);
      // ruler
      ctx.strokeStyle = 'rgba(245,246,241,.18)'; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(245,246,241,.5)';
      ctx.font = `${Math.max(11, w * 0.028)}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
      for (let m = 0.5; m <= 2; m += 0.5) {
        const y = oy + m * scale;
        ctx.beginPath(); ctx.moveTo(w * 0.06, y); ctx.lineTo(w * 0.13, y); ctx.stroke();
        ctx.fillText(fmt(m, 1) + ' m', w * 0.15, y + 4);
      }
      // arc of swing
      ctx.strokeStyle = 'rgba(25,203,238,.25)'; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.arc(ox, oy, len, Math.PI / 2 - 0.42, Math.PI / 2 + 0.42); ctx.stroke(); ctx.setLineDash([]);
      // support
      ctx.fillStyle = '#F5F6F1'; ctx.fillRect(ox - w * 0.12, oy - 4, w * 0.24, 4);
      // string + bob
      ctx.strokeStyle = '#F5F6F1'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(bx, by); ctx.stroke();
      const r = Math.max(10, w * 0.04);
      const grd = ctx.createRadialGradient(bx - r * .3, by - r * .3, r * .1, bx, by, r);
      grd.addColorStop(0, '#FFE08A'); grd.addColorStop(1, '#F5B301');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
      if (running) requestAnimationFrame(draw);
    }
    function update(fromUser) {
      L = +range.value; readout();
      if (fromUser && !touched) { touched = true; show(2); }
      if (L >= 1.95) { show(3); setTimeout(() => show(4), reduce ? 0 : 700); }
    }
    range.addEventListener('input', () => update(true));
    $('.sim-voice').addEventListener('click', () => {
      show(2); show(3);
      const from = +range.value, t0 = performance.now(), dur = reduce ? 1 : 1400;
      const tick = now => {
        const p = Math.min(1, (now - t0) / dur), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        range.value = (from + (2 - from) * e).toFixed(2);
        update(false);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    new ResizeObserver(size).observe(cv);
    // pause drawing when off-screen
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) { running = true; last = performance.now(); requestAnimationFrame(draw); }
      else if (!e.isIntersecting) running = false;
    }).observe(cv);
    size(); readout();
    return {
      start() { show(0); setTimeout(() => show(1), reduce ? 0 : 1600); },
      next() { show(Math.min(4, step + 1)); },
    };
  })();

  /* video slot: drop images/prisma.mp4 and it plays; otherwise the poster stays */
  (() => {
    const clip = $('.clip'), v = $('.clip-video', clip), src = $('source', v);
    const ok = () => { clip.classList.add('has-video'); v.hidden = false; };
    v.addEventListener('loadeddata', ok, { once: true });
    src.addEventListener('error', () => { v.remove(); }, { once: true });
    new IntersectionObserver(([e]) => {
      if (!v.isConnected) return;
      if (e.isIntersecting) { v.play().catch(() => {}); } else v.pause();
    }).observe(clip);
    v.load();
  })();

  /* ---------- ch6: payers + calculator ---------- */
  const payerCopy = {
    b2b: 'El colegio privado paga 80 soles por alumno al año, menos del 2% de una pensión económica.',
    b2g: 'La UGEL o el gobierno regional paga 15 soles por alumno.',
    rse: 'El aula rural la financian empresas por responsabilidad social. Para el colegio es gratis.',
  };
  $$('.payer').forEach(b => b.addEventListener('click', () => {
    $$('.payer').forEach(o => o.setAttribute('aria-selected', String(o === b)));
    $('.payer-detail').textContent = payerCopy[b.dataset.k];
  }));
  (() => {
    const STUDENTS = 450, PRICE = 80, COST = 520000 / 18, MAX = 40;
    const r = $('#schools'), n = $('.calc-n'), rev = $('.calc-rev'), fill = $('.calc-fill'), msg = $('.calc-msg'), cost = $('.calc-cost');
    const maxRev = MAX * STUDENTS * PRICE / 12;
    cost.style.left = (COST / maxRev * 100).toFixed(2) + '%';
    const upd = () => {
      const k = +r.value, m = k * STUDENTS * PRICE / 12;
      n.textContent = k;
      rev.textContent = 'S/ ' + fmt(Math.round(m / 100) * 100);
      fill.style.width = (m / maxRev * 100).toFixed(2) + '%';
      const ok = m >= COST;
      msg.classList.toggle('ok', ok);
      msg.textContent = ok
        ? (k === 10 ? '10 colegios privados cubren los costos del mes' : `${k} colegios cubren los costos del mes`)
        : `Faltan ${Math.ceil(COST / (STUDENTS * PRICE / 12)) - k} colegios para cubrir el mes`;
    };
    r.addEventListener('input', upd); upd();
  })();

  /* ---------- presenter mode ---------- */
  const NOTES = [
    'Les presento a María. Tiene 14 años y estudia en un colegio de la sierra de Puno. Mañana debe explicar cómo la lactasa rompe la lactosa de la leche. María nunca ha visto una enzima: en su colegio no hay laboratorio y la señal no llega al aula. Así que memoriza… y la próxima semana lo olvida. Pero hay algo que María sí tiene: el celular de su mamá.',
    'María no es un caso aislado. Según el BID, el 88% de las escuelas primarias de América Latina no tiene laboratorio de ciencias. En PISA 2025 el Perú sacó 406 puntos en ciencias, 78 por debajo de la OCDE, y menos de la mitad de los alumnos llega al nivel básico. El 85,8% de los hogares rurales ya tiene internet; sus colegios, solo el 18,9%. El celular llegó. El laboratorio, no.',
    'Rikuy significa “ver” en quechua. Rompe tres esquemas. Uno: el laboratorio es el celular que ya está en el aula, bajo una pirámide de mica de menos de tres soles, proyectando un holograma que se transforma con la voz: del sistema digestivo hasta la lactasa rompiendo la lactosa. Sin internet. Dos: la IA deja de dar respuestas: pregunta, da pistas y deja que el alumno descubra. Tres: la evaluación deja de calificar si acertaste: el panel muestra cómo razona cada grupo. No medimos memoria: medimos pensamiento.',
    '“Si alargamos la cuerda, ¿el péndulo irá más rápido o más lento?” — “No sé.” — Rikuy da una pista. — “Pon la longitud en dos metros.” — El periodo pasa de 1,4 a 2,8 segundos. Lo descubrió el alumno, no se lo dijeron.',
    'Ya está en un aula. La ONG PRISMA nos abrió las puertas del Colegio Sor Ana Circa. Lo probaron tres docentes de ciencias, de física y biología, y el director.',
    'El código es abierto; el servicio se paga. B2B: el colegio privado paga 80 soles por alumno al año, menos del 2% de una pensión económica. B2G: la UGEL o el gobierno regional, 15 soles por alumno. Y el aula rural la financian empresas por responsabilidad social. Solo en el Perú es un mercado de 300 millones de soles al año; nuestra meta al año 3 es de 13 millones. Después, Latinoamérica.',
    'Con PRISMA entramos al aula: el docente lo usa gratis, el colegio contrata y, con resultados, firma la UGEL. ¿Por qué ganar? Porque lo que vive de donaciones se apaga; aquí cada colegio que paga sostiene un aula rural. Buscamos 520 mil soles para 18 meses, y con diez colegios privados ya cubrimos nuestros costos.',
    'Para que mañana María no memorice la lactasa, sino que la vea, la comprenda y la explique con sus propias palabras. Rikuy Lab: ver para entender, comprender para transformar. Muchas gracias.',
    'Anexo: todo el sistema en un video. Activa el sonido si hay tiempo.',
    'Anexo: arquitectura. Toca la imagen para ampliarla.',
    'Anexo: capturas reales. Toca una para ampliarla; flechas para recorrerlas, Esc para cerrar.',
  ];
  const ENDS = [25, 50, 90, 115, 130, 155, 170, 180]; // cumulative seconds, total 3:00
  const presenter = (() => {
    const el = $('.presenter'), tEl = $('.pr-time'), tgEl = $('.pr-target'), chEl = $('.pr-ch'), nEl = $('.pr-notes'), bar = $('.pr-bar');
    let t0 = 0, acc = 0, on = false, timer = 0;
    const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const elapsed = () => acc + (on ? (performance.now() - t0) / 1000 : 0);
    function render() {
      if (el.hidden) return;
      const s = elapsed(), extra = current >= ENDS.length, end = ENDS[Math.min(current, ENDS.length - 1)], start = current && !extra ? ENDS[current - 1] : 0;
      tEl.textContent = mmss(s);
      chEl.textContent = `${current + 1}/${chapters.length} ${chapters[current].dataset.title}`;
      tgEl.textContent = extra ? 'anexo' : `meta ${mmss(start)}–${mmss(end)}`;
      const late = !extra && s > end;
      tgEl.classList.toggle('late', late); tgEl.classList.toggle('ok', !late);
      bar.classList.toggle('late', s > 180);
      $('span', bar).style.width = Math.min(100, s / 180 * 100) + '%';
      if (nEl.dataset.i !== String(current)) { nEl.textContent = NOTES[current]; nEl.dataset.i = current; }
    }
    function start() { if (on) return; on = true; t0 = performance.now(); timer = setInterval(render, 250); }
    return {
      render,
      toggle() { el.hidden = !el.hidden; if (!el.hidden) { start(); render(); } },
      pause() { if (on) { acc = elapsed(); on = false; clearInterval(timer); } else start(); render(); },
      reset() { acc = 0; t0 = performance.now(); render(); },
    };
  })();

  /* ---------- boot ---------- */
  const fromHash = chapters.findIndex(c => '#' + c.id === location.hash);
  if (fromHash > 0) { chapters[fromHash].scrollIntoView(); activate(fromHash); } else activate(0);
  addEventListener('resize', parallax, { passive: true });
})();

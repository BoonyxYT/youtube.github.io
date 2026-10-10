(() => {
  const $ = (id) => document.getElementById(id);
  const audio = $('audio');
  const playBtn = $('playBtn');
  const playIcon = $('playIcon');
  const visualizer = $('visualizer');
  const audioNote = $('audioNote');
  const toastEl = $('toast');
  let toastTimer;
  let inRoom = false;
  let isHost = false;
  let activeCode = '';
  let isPlaying = false;
  let selectedTrack = 'demo';

  const tracks = {
    demo: {
      title: 'Demo 01', subtitle: 'La primera prueba · Single promocional', game: 'reaction',
      gameTitle: 'Caza el estribillo.', gameDescription: 'Cuando aparezca la señal, pulsa antes que nadie. Esta canción tiene su propia dinámica: aquí empieza el calentamiento.'
    }
  };

  // Genera una composición visual consistente sin depender de imágenes externas.
  const bars = $('bars');
  for (let i = 0; i < 54; i++) {
    const bar = document.createElement('span');
    bar.className = 'bar';
    const wave = Math.abs(Math.sin(i * .49) * Math.cos(i * .16));
    bar.style.setProperty('--h', `${12 + Math.pow(wave, .7) * 78}%`);
    bar.style.setProperty('--speed', `${.28 + (i % 9) * .065}s`);
    bar.style.setProperty('--delay', `${(i % 13) * -.075}s`);
    bars.appendChild(bar);
  }

  // La portada y el MP3 se sustituyen colocando los ficheros indicados en assets/.
  $('albumCover').addEventListener('load', () => {
    $('albumCover').style.display = 'block';
    $('coverFallback').style.display = 'none';
  });
  $('albumCover').addEventListener('error', () => {
    $('albumCover').style.display = 'none';
    $('coverFallback').style.display = 'flex';
  });
  audio.addEventListener('loadedmetadata', () => {
    $('duration').textContent = formatTime(audio.duration);
    audioNote.innerHTML = '<span>✓</span> Audio cargado. Pulsa reproducir para escuchar la prueba.';
  });
  audio.addEventListener('error', () => {
    audioNote.innerHTML = '<span>↳</span> Añade tu canción a <code>assets/cancion-prueba.mp3</code> para activar el audio real.';
  });
  audio.addEventListener('timeupdate', () => {
    $('currentTime').textContent = formatTime(audio.currentTime || 0);
    if (Number.isFinite(audio.duration) && audio.duration > 0) $('seek').value = (audio.currentTime / audio.duration) * 100;
  });
  audio.addEventListener('play', () => setPlaying(true));
  audio.addEventListener('pause', () => setPlaying(false));
  audio.addEventListener('ended', () => { setPlaying(false); toast('Fin de la prueba. El público exige otra.'); });

  playBtn.addEventListener('click', async () => {
    if (audio.error || !audio.currentSrc) {
      toast('Falta el MP3: colócalo en assets/cancion-prueba.mp3.');
      return;
    }
    try {
      if (audio.paused) await audio.play(); else audio.pause();
    } catch (_) { toast('No se ha podido reproducir el archivo de audio.'); }
  });
  $('restartBtn').addEventListener('click', () => { audio.currentTime = 0; if (audio.paused) toast('La canción vuelve al principio.'); });
  $('seek').addEventListener('input', (e) => { if (Number.isFinite(audio.duration)) audio.currentTime = (Number(e.target.value) / 100) * audio.duration; });
  $('volume').addEventListener('input', (e) => { audio.volume = Number(e.target.value); audio.muted = audio.volume === 0; $('muteBtn').textContent = audio.muted ? '×' : '◖))'; });
  $('muteBtn').addEventListener('click', () => { audio.muted = !audio.muted; $('muteBtn').textContent = audio.muted ? '×' : '◖))'; });
  audio.volume = 0.8;

  $('jumpToRoom').addEventListener('click', () => $('roomSection').scrollIntoView({ behavior: 'smooth' }));
  $('createRoomBtn').addEventListener('click', () => {
    activeCode = makeCode(); inRoom = true; isHost = true;
    showRoom();
    const url = new URL(window.location.href); url.searchParams.set('room', activeCode); history.replaceState({}, '', url);
    toast(`Sala ${activeCode} creada en modo maqueta.`);
  });
  $('joinForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $('roomCodeInput').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) { $('joinHint').textContent = 'Escribe un código de al menos 4 caracteres.'; return; }
    activeCode = code; inRoom = true; isHost = false; showRoom();
    const url = new URL(window.location.href); url.searchParams.set('room', activeCode); history.replaceState({}, '', url);
    toast(`Vista de invitado para la sala ${activeCode}.`);
  });
  $('copyCodeBtn').addEventListener('click', async () => {
    const url = new URL(window.location.href); url.searchParams.set('room', activeCode);
    try { await navigator.clipboard.writeText(`${activeCode} — ${url.toString()}`); toast('Código y enlace copiados.'); }
    catch (_) { toast(`Comparte este código: ${activeCode}`); }
  });
  $('leaveRoomBtn').addEventListener('click', () => {
    inRoom = false; isHost = false; activeCode = '';
    $('activeRoomView').hidden = true; $('noRoomView').hidden = false; $('roomState').textContent = 'SIN SALA';
    const url = new URL(window.location.href); url.searchParams.delete('room'); history.replaceState({}, '', url);
    toast('Has salido de la vista de sala.');
  });

  $('trackSelect').addEventListener('change', (e) => {
    selectedTrack = e.target.value;
    $('queueTitle').textContent = tracks[selectedTrack]?.title || 'Tema seleccionado';
  });
  $('setNextBtn').addEventListener('click', () => {
    if (!inRoom || !isHost) { toast('Necesitas crear una sala para usar la mesa de mezclas.'); return; }
    const track = tracks[selectedTrack];
    $('trackTitle').textContent = track.title;
    $('trackSubtitle').textContent = track.subtitle;
    $('gameTitle').innerHTML = 'Caza el <em>estribillo.</em>';
    $('gameDescription').textContent = track.gameDescription;
    toast(`Siguiente tema seleccionado: ${track.title}.`);
    $('hostHint').textContent = 'Selección guardada en esta maqueta local; aún no se envía a otros dispositivos.';
  });

  let gameMode = 'ready';
  let signalAt = 0;
  $('gameActionBtn').addEventListener('click', () => {
    const btn = $('gameActionBtn');
    const result = $('gameResult');
    if (gameMode === 'waiting') return;
    if (gameMode === 'signal') {
      const reaction = Math.max(0, Math.round(performance.now() - signalAt));
      result.textContent = `${reaction} ms · ${reaction < 250 ? 'REFLEJOS DE LEYENDA' : reaction < 420 ? 'NADA MAL' : 'EL BEAT TE HA GANADO'}`;
      btn.textContent = 'OTRA RONDA ↗';
      gameMode = 'finished';
      return;
    }
    gameMode = 'waiting';
    btn.disabled = true; btn.textContent = 'ESPERA A LA SEÑAL…'; result.textContent = 'PREPARADOS…';
    const delay = 1100 + Math.random() * 2300;
    window.setTimeout(() => {
      gameMode = 'signal'; signalAt = performance.now();
      result.textContent = '¡AHORA!'; btn.textContent = '¡PULSA!'; btn.disabled = false;
      $('mainGame').classList.add('flash');
      window.setTimeout(() => $('mainGame').classList.remove('flash'), 380);
    }, delay);
  });

  function showRoom() {
    $('noRoomView').hidden = true; $('activeRoomView').hidden = false;
    $('roomCodeDisplay').textContent = activeCode; $('roomState').textContent = isHost ? 'ERES HOST' : 'INVITADO';
    $('roomLiveText').textContent = isHost ? 'SALA CREADA EN ESTE NAVEGADOR' : 'VISTA DE INVITADO · SIMULACIÓN';
    $('peopleCount').textContent = '01 CONECTADO';
    $('peopleList').innerHTML = `<div class="person"><span class="avatar ${isHost ? 'avatar-host' : ''}">${isHost ? 'TÚ' : 'INV'}</span><span class="person-name">${isHost ? 'Anfitrión/a' : 'Invitado/a'}</span><span class="host-label">${isHost ? 'HOST' : 'TÚ'}</span></div>`;
    $('setNextBtn').disabled = !isHost;
    $('setNextBtn').style.opacity = isHost ? '1' : '.45';
    $('hostHint').textContent = isHost ? 'El control compartido entre dispositivos se conectará en la siguiente fase.' : 'Solo el anfitrión controla el repertorio.';
  }
  function setPlaying(playing) {
    isPlaying = playing;
    playIcon.textContent = playing ? 'Ⅱ' : '▶';
    playBtn.setAttribute('aria-label', playing ? 'Pausar canción' : 'Reproducir canción');
    visualizer.classList.toggle('playing', playing);
    if (playing) audioNote.innerHTML = '<span>♪</span> En reproducción. La sala de conciertos ya está abierta.';
  }
  function makeCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
  function formatTime(seconds) { if (!Number.isFinite(seconds) || seconds < 0) return '00:00'; return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }
  function toast(message) { toastEl.textContent = message; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 3100); }

  // Permite abrir un enlace con ?room=CODIGO, como demo visual de la invitación.
  const requestedRoom = new URLSearchParams(window.location.search).get('room');
  if (requestedRoom) { $('roomCodeInput').value = requestedRoom; $('joinHint').textContent = `Código detectado: ${requestedRoom}. Pulsa entrar para abrir la simulación.`; }
})();

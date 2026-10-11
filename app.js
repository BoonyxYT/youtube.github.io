(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const audio = $('audio');
  const toastEl = $('toast');
  let toastTimer = null;
  let supabaseClient = null;
  let user = null;
  let room = null;
  let roomChannel = null;
  let isHost = false;
  let audioUnlocked = false;
  let loadedTrackId = '';
  let loadingTrackPromises = new Map();
  let signedUrlExpiresAt = 0;
  let gameMode = 'ready';
  let signalAt = 0;
  let currentRoomRow = null;
  let roomStateApplicationRevision = 0;
  let trackLoadToken = 0;
  const cubePositions = new Map();
  const cubeTargets = new Map();
  const cubeElements = new Map();
  const pendingCubePositions = new Map();
  const cubeLastSequence = new Map();
  const cubeMotionSegments = new Map();
  let cubeAnimationFrameId = null;
  const cubeUpdateTimestamps = new Map();
  let cubeMoveSequence = 0;
  const CUBE_BROADCAST_INTERVAL_MS = 33;
  const CUBE_REMOTE_MIN_DURATION_MS = 40;
  const CUBE_REMOTE_MAX_DURATION_MS = 75;
  const CUBE_KEYBOARD_SPEED = 38; // porcentaje del área por segundo
  let myCubePosition = { x: 50, y: 52 };
  let cubeMoveActive = false;
  const heldCubeKeys = new Set();
  let keyboardMovementFrameId = null;
  let keyboardFramePreviousTimestamp = 0;
  let cubePersistTimer = null;
  let cubeBroadcastTimer = null;
  let cubeColorPersistTimer = null;
  let cubeColorLoadedRoomId = null;
  let myCubeColor = '#5ee7ff';
  let latestPeople = [];
  let roomHeartbeatTimer = null;
  let roomFallbackPollTimer = null;
  let databasePeople = [];
  let heartbeatInFlightRoomId = null;
  let heartbeatErrorNotified = false;
  let roomClosing = false;
  const ROOM_HEARTBEAT_INTERVAL_MS = 15_000;
  const PLAYER_COLOR_PALETTE = ['#5ee7ff', '#d6ff62', '#ff72b6', '#a78bfa', '#ffad66', '#6ee7a8', '#ff6b6b', '#f5f5f5'];
  const DEFAULT_THEME_COLOR = '#d6ff62';
  let activeThemeColor = DEFAULT_THEME_COLOR;
  let pendingThemeColor = null;
  let themePersistTimer = null;
  let themeBroadcastTimer = null;
  let themePersistQueue = Promise.resolve();

  // Añade aquí cada tema. Sube sus archivos al bucket privado "album-audio" de Supabase.
  const TRACKS = {
    demo: {
      title: 'Cuack.',
      subtitle: '',
      storagePath: 'demo.mp3',
      coverPath: 'assets/portada-demo.png',
      fallbackCoverPath: 'assets/portada.jpg',
      themeColor: '#d6ff62',
      game: {
        type: 'MOVIMIENTO',
        emoji: '◇',
        title: 'Mueve tu <em>cubo.</em>',
        description: 'Arrastra por la pista o usa las flechas. Todos veis los movimientos en directo.'
      }
    },
    spaceWar: {
      title: 'Space War',
      subtitle: '',
      storagePath: 'space-war.mp3',
      coverPath: 'assets/portada-space-war.png',
      fallbackCoverPath: 'assets/portada-demo.png',
      themeColor: '#a78bfa',
      game: {
        type: 'SPACE WAR',
        emoji: '✦',
        title: 'Sobrevive a la <em>órbita.</em>',
        description: 'Pilota tu cubo por la pista espacial. Todos veis los movimientos en directo.'
      }
    }
  };

  const config = window.LASALA_CONFIG || {};
  const hasConfig = Boolean(
    typeof config.supabaseUrl === 'string' && config.supabaseUrl.startsWith('https://') &&
    !config.supabaseUrl.includes('PEGA_AQUI') &&
    typeof config.supabaseAnonKey === 'string' && config.supabaseAnonKey.length > 20 &&
    !config.supabaseAnonKey.includes('PEGA_AQUI')
  );

  // Portada cuadrada del álbum para la antesala y portada horizontal independiente por canción.
  const coverImage = $('albumCover');
  const coverFallback = $('coverFallback');
  const preShowAlbumImage = $('preShowAlbumCover');
  const preShowAlbumFallback = $('preShowAlbumFallback');
  let songCoverRequestId = 0;
  const LEGACY_COVER_PATH = 'assets/portada.jpg';
  let concertHasStarted = false;

  function applyCoverBackground() {
    const source = coverImage.currentSrc || coverImage.src;
    if (source) document.documentElement.style.setProperty('--cover-image', `url("${source}")`);
  }

  function showPreShowAlbumCover() {
    if (!preShowAlbumImage || !preShowAlbumFallback) return;
    preShowAlbumImage.hidden = false;
    preShowAlbumFallback.hidden = true;
  }

  function showPreShowAlbumFallback() {
    if (!preShowAlbumImage || !preShowAlbumFallback) return;
    preShowAlbumImage.hidden = true;
    preShowAlbumFallback.hidden = false;
  }

  function setupPreShowAlbumCover() {
    if (!preShowAlbumImage) return;
    let triedLegacy = false;
    preShowAlbumImage.addEventListener('load', showPreShowAlbumCover);
    preShowAlbumImage.addEventListener('error', () => {
      if (!triedLegacy && preShowAlbumImage.getAttribute('src') !== LEGACY_COVER_PATH) {
        triedLegacy = true;
        preShowAlbumImage.src = LEGACY_COVER_PATH;
        return;
      }
      showPreShowAlbumFallback();
    });
    if (preShowAlbumImage.complete && preShowAlbumImage.naturalWidth > 0) showPreShowAlbumCover();
    else if (preShowAlbumImage.complete && preShowAlbumImage.naturalWidth === 0) preShowAlbumImage.dispatchEvent(new Event('error'));
  }

  function updateSongCover(trackId) {
    if (!coverImage || !coverFallback) return;
    const requestId = ++songCoverRequestId;
    const track = TRACKS[trackId] || {};
    const primaryPath = track.coverPath || 'assets/portada-demo.png';
    const fallbackPath = track.fallbackCoverPath || LEGACY_COVER_PATH;
    const fallbackHint = coverFallback.querySelector('small');
    let triedFallback = false;

    coverImage.alt = `Portada de ${track.title || 'la canción'}`;
    if (fallbackHint) fallbackHint.textContent = `AÑADE ${primaryPath}`;
    coverImage.style.display = 'block';
    coverFallback.style.display = 'none';
    document.documentElement.style.setProperty('--cover-image', 'linear-gradient(135deg,#303828,#0b0e0b)');

    const onLoaded = () => {
      if (requestId !== songCoverRequestId) return;
      coverImage.style.display = 'block';
      coverFallback.style.display = 'none';
      applyCoverBackground();
    };
    const onFailed = () => {
      if (requestId !== songCoverRequestId) return;
      if (!triedFallback && fallbackPath !== primaryPath) {
        triedFallback = true;
        coverImage.src = fallbackPath;
        return;
      }
      coverImage.style.display = 'none';
      coverFallback.style.display = 'flex';
      document.documentElement.style.setProperty('--cover-image', 'linear-gradient(135deg,#303828,#0b0e0b)');
    };
    coverImage.onload = onLoaded;
    coverImage.onerror = onFailed;
    if (coverImage.getAttribute('src') !== primaryPath) coverImage.src = primaryPath;
    else if (coverImage.complete && coverImage.naturalWidth > 0) onLoaded();
    else if (coverImage.complete && coverImage.naturalWidth === 0) onFailed();
  }

  setupPreShowAlbumCover();
  updateSongCover(Object.keys(TRACKS)[0]);
  populateTracks();
  setupPlayer();
  setupRooms();
  setupMiniGame();
  setupPersonalCubeColorControl();
  setupInitialRoomLink();
  initializeConnection();

  function populateTracks() {
    const select = $('trackSelect');
    select.replaceChildren();
    Object.entries(TRACKS).forEach(([id, track], index) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = track.subtitle ? `${track.title} — ${track.subtitle}` : track.title;
      select.appendChild(option);
      if (index === 0) $('queueTitle').textContent = 'Sin siguiente tema';
    });
  }

  function setupPlayer() {
    $('jumpToRoom').addEventListener('click', () => $('roomSection').scrollIntoView({ behavior: 'smooth' }));

    audio.addEventListener('loadedmetadata', () => {
      $('duration').textContent = formatTime(audio.duration);
      $('audioNote').classList.remove('error');
      if (currentRoomRow) syncAudioFromRoom(currentRoomRow).catch(() => {});
    });
    audio.addEventListener('timeupdate', () => {
      $('currentTime').textContent = formatTime(audio.currentTime || 0);
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        const progress = (audio.currentTime / audio.duration) * 100;
        $('seek').value = String(progress);
        $('guestProgressFill').style.width = `${progress}%`;
      }
    });
    audio.addEventListener('play', () => setPlaying(true));
    audio.addEventListener('pause', () => setPlaying(false));
    audio.addEventListener('ended', () => {
      setPlaying(false);
      if (room && isHost) {
        if (room.next_track_id && TRACKS[room.next_track_id]) advanceToNextTrack().catch(showError);
        else publishPlayback('paused', audio.currentTime, null).catch(showError);
      }
    });
    audio.addEventListener('error', () => {
      setAudioNote('No se ha podido cargar el MP3 privado. Comprueba el archivo en el bucket “album-audio”.', true);
    });

    $('playBtn').addEventListener('click', async () => {
      if (!room) {
        toast('Crea una sala o entra con un código para escuchar.');
        return;
      }
      if (!isHost) {
        toast('Solo el anfitrión controla la reproducción.');
        return;
      }
      if (!audio.currentSrc) {
        toast('Carga un tema y comprueba que el MP3 está subido.');
        return;
      }
      try {
        audioUnlocked = true;
        if (audio.paused) {
          if (audio.ended) audio.currentTime = 0;
          await audio.play();
          await publishPlayback('playing', audio.currentTime, new Date().toISOString());
        } else {
          audio.pause();
          await publishPlayback('paused', audio.currentTime, null);
        }
      } catch (error) {
        showError(error);
      }
    });

    $('skipBtn').addEventListener('click', () => {
      if (!room || !isHost || !room.next_track_id) { toast('Primero elige la siguiente canción.'); return; }
      advanceToNextTrack().catch(showError);
    });

    $('restartBtn').addEventListener('click', async () => {
      if (!room || !isHost || !audio.currentSrc) return;
      audio.currentTime = 0;
      const playing = !audio.paused;
      try {
        await publishPlayback(playing ? 'playing' : 'paused', 0, playing ? new Date().toISOString() : null);
      } catch (error) { showError(error); }
    });

    $('seek').addEventListener('input', (event) => {
      if (room && isHost && Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = (Number(event.target.value) / 100) * audio.duration;
      }
    });
    $('seek').addEventListener('change', async () => {
      if (!room || !isHost || !Number.isFinite(audio.currentTime)) return;
      const playing = !audio.paused;
      try {
        await publishPlayback(playing ? 'playing' : 'paused', audio.currentTime, playing ? new Date().toISOString() : null);
      } catch (error) { showError(error); }
    });

    $('volume').addEventListener('input', (event) => {
      audio.volume = Number(event.target.value);
      audio.muted = false;
      $('volumeValue').textContent = `${Math.round(audio.volume * 100)}%`;
    });
    audio.volume = Number($('volume').value || 0.8);
    $('volumeValue').textContent = `${Math.round(audio.volume * 100)}%`;

    $('enableAudioBtn').addEventListener('click', () => activateAudioFromGesture($('enableAudioBtn')));
    $('preEnableAudioBtn').addEventListener('click', () => activateAudioFromGesture($('preEnableAudioBtn')));

    $('playBtn').disabled = true;
    $('restartBtn').disabled = true;
    $('skipBtn').disabled = true;
    $('seek').disabled = true;
  }

  async function activateAudioFromGesture(button) {
    try {
      if (!audio.currentSrc) {
        audioUnlocked = false;
        $('preShowAudioStatus').textContent = 'La canción todavía se está preparando. Espera un momento y vuelve a pulsar.';
        toast('La canción todavía se está cargando. Inténtalo de nuevo en unos segundos.');
        return;
      }
      // El gesto del usuario desbloquea el elemento de audio sin iniciar el concierto.
      if (currentRoomRow && currentRoomRow.playback_status === 'playing') {
        audioUnlocked = true;
        await syncAudioFromRoom(currentRoomRow, true);
      } else {
        const previousTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
        const previousMuted = audio.muted;
        audio.muted = true;
        await audio.play();
        audio.pause();
        audio.currentTime = previousTime;
        audio.muted = previousMuted;
        audioUnlocked = true;
        setAudioNote('Sonido activado. El anfitrión controla cuándo empieza.', false);
      }
      $('preShowAudioStatus').textContent = 'Sonido activado. Todo listo para el concierto.';
      $('preShowAudioStatus').classList.remove('error');
      $('enableAudioBtn').textContent = 'SONIDO ACTIVADO';
      $('preEnableAudioBtn').textContent = 'SONIDO ACTIVADO';
      $('enableAudioBtn').disabled = true;
      $('preEnableAudioBtn').disabled = true;
      updateRoomPermissions();
    } catch (error) {
      audio.muted = false;
      $('preShowAudioStatus').textContent = 'El navegador aún no ha permitido el audio. Pulsa otra vez.';
      $('preShowAudioStatus').classList.add('error');
      setAudioNote('Pulsa de nuevo “Activar sonido” para permitir la reproducción.', true);
      showError(error);
    }
  }

  function setupRooms() {
    $('createRoomBtn').addEventListener('click', () => createRoom().catch(showError));
    $('joinForm').addEventListener('submit', (event) => {
      event.preventDefault();
      joinRoom($('roomCodeInput').value).catch(showError);
    });
    $('copyCodeBtn').addEventListener('click', copyInvite);
    $('myColorButton')?.addEventListener('click', () => {
      const control = $('playerColorControl');
      const picker = $('cubeColorPicker');
      if (!control || !room) return;
      control.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => picker?.focus({ preventScroll: true }), 280);
    });
    $('leaveRoomBtn').addEventListener('click', () => leaveRoom().catch(showError));
    $('playSelectedNowBtn').addEventListener('click', () => playSelectedNow().catch(showError));
    $('peopleButton').addEventListener('click', openPeopleModal);
    $('closePeopleButton').addEventListener('click', closePeopleModal);
    $('closePeopleBackdrop').addEventListener('click', closePeopleModal);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePeopleModal(); });
    $('trackSelect').addEventListener('change', () => {
      const track = TRACKS[$('trackSelect').value];
      $('queueTitle').textContent = track ? track.title : 'Selecciona un tema';
    });
    $('setNextBtn').addEventListener('click', () => loadSelectedTrack().catch(showError));
    setupThemeControls();
  }

  function setupThemeControls() {
    const picker = $('themeColorPicker');
    picker.addEventListener('input', () => {
      if (!room || !isHost) return;
      setLiveThemeColor(picker.value);
    });
    picker.addEventListener('change', () => {
      if (!room || !isHost) return;
      setLiveThemeColor(picker.value);
      flushPendingThemeColor().catch(showError);
    });
    $('themeColorSwatches').addEventListener('click', (event) => {
      const button = event.target.closest('[data-theme-color]');
      if (!button || !room || !isHost) return;
      setLiveThemeColor(button.dataset.themeColor);
      flushPendingThemeColor().catch(showError);
    });
    $('resetThemeColorBtn').addEventListener('click', () => {
      if (!room || !isHost) return;
      const defaultColor = getTrackThemeColor(room.current_track_id);
      setLiveThemeColor(defaultColor);
      flushPendingThemeColor().catch(showError);
    });
    applyThemeColor(DEFAULT_THEME_COLOR);
  }

  function sanitizeHexColor(value) {
    const color = String(value || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : null;
  }

  function getTrackThemeColor(trackId) {
    return sanitizeHexColor(TRACKS[trackId]?.themeColor) || DEFAULT_THEME_COLOR;
  }

  function applyThemeColor(value) {
    const color = sanitizeHexColor(value) || DEFAULT_THEME_COLOR;
    activeThemeColor = color;
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    document.documentElement.style.setProperty('--acid', color);
    document.documentElement.style.setProperty('--acid-contrast', luminance > 0.62 ? '#11140f' : '#f8f8f2');
    document.documentElement.style.setProperty('--theme-tint', `color-mix(in srgb, ${color} 14%, transparent)`);
    const picker = $('themeColorPicker');
    if (picker) picker.value = color;
    const output = $('themeColorHex');
    if (output) output.textContent = color.toUpperCase();
    const swatches = $('themeColorSwatches');
    if (swatches) {
      swatches.querySelectorAll('[data-theme-color]').forEach((button) => {
        button.classList.toggle('is-selected', sanitizeHexColor(button.dataset.themeColor) === color);
      });
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', color);
  }

  function setLiveThemeColor(value) {
    if (!room || !isHost) return;
    const color = sanitizeHexColor(value);
    if (!color) return;
    pendingThemeColor = color;
    applyThemeColor(color);
    $('themeColorHint').textContent = 'Color aplicado en tu pantalla y enviándose a la sala…';
    scheduleThemeColorBroadcast(color);
    if (themePersistTimer) window.clearTimeout(themePersistTimer);
    themePersistTimer = window.setTimeout(() => {
      themePersistTimer = null;
      persistThemeColor(color).catch((error) => {
        $('themeColorHint').textContent = 'El color se ve en directo, pero no se pudo guardar para nuevos invitados.';
        console.warn('No se pudo guardar el color de la sala.', error);
      });
    }, 280);
  }

  function scheduleThemeColorBroadcast(color) {
    if (themeBroadcastTimer) return;
    themeBroadcastTimer = window.setTimeout(() => {
      themeBroadcastTimer = null;
      broadcastThemeColor(pendingThemeColor || color).catch((error) => console.warn('No se pudo enviar el color en directo.', error));
    }, 55);
  }

  async function broadcastThemeColor(color) {
    if (!roomChannel || !room || !isHost || !user) return;
    const result = await roomChannel.send({
      type: 'broadcast',
      event: 'theme_color_changed',
      payload: { room_id: room.id, sender_user_id: user.id, color, sent_at: Date.now() }
    });
    if (result && result !== 'ok') console.warn('Supabase no confirmó el cambio de color:', result);
  }

  async function persistThemeColor(color) {
    const normalized = sanitizeHexColor(color);
    if (!normalized || !room || !isHost || !supabaseClient || !user) return;
    const roomId = room.id;
    themePersistQueue = themePersistQueue.catch(() => {}).then(async () => {
      if (!room || room.id !== roomId || !isHost) return;
      const { data, error } = await supabaseClient.from('rooms').update({
        theme_color: normalized,
        updated_by_user_id: user.id,
        updated_at: new Date().toISOString()
      }).eq('id', roomId).select().single();
      if (error) throw error;
      if (!room || room.id !== roomId) return;
      const liveColor = activeThemeColor;
      currentRoomRow = { ...(currentRoomRow || {}), ...data };
      room = { ...room, ...data };
      // No dejes que una respuesta de red atrasada pise el color que el anfitrión sigue eligiendo.
      if (liveColor !== sanitizeHexColor(data.theme_color)) {
        currentRoomRow.theme_color = liveColor;
        room.theme_color = liveColor;
      }
      if (!pendingThemeColor || pendingThemeColor === normalized) {
        pendingThemeColor = null;
        $('themeColorHint').textContent = 'Color guardado para todos los invitados y para quien entre después.';
      }
    });
    return themePersistQueue;
  }

  async function flushPendingThemeColor() {
    if (themeBroadcastTimer) {
      window.clearTimeout(themeBroadcastTimer);
      themeBroadcastTimer = null;
    }
    if (themePersistTimer) {
      window.clearTimeout(themePersistTimer);
      themePersistTimer = null;
    }
    const color = pendingThemeColor || activeThemeColor;
    if (!room || !isHost || !color) return;
    await broadcastThemeColor(color);
    await persistThemeColor(color);
  }

  async function initializeConnection() {
    if (!hasConfig) {
      $('connectionLabel').textContent = 'CONFIGURACIÓN PENDIENTE';
      $('joinHint').textContent = 'Añade la URL y la clave pública en supabase-config.js.';
      $('hostHint').textContent = 'Configura Supabase para activar las salas reales.';
      disableConnectionButtons(true);
      return;
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      $('connectionLabel').textContent = 'ERROR DE CONEXIÓN';
      $('joinHint').textContent = 'No se ha podido cargar Supabase. Comprueba la conexión a Internet.';
      disableConnectionButtons(true);
      return;
    }
    // Usa almacenamiento por pestaña, no localStorage compartido. Así dos pestañas de
    // test obtienen usuarios anónimos distintos y no heredan ambas el rol de anfitrión.
    const tabStorage = getTabScopedAuthStorage();
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: tabStorage,
        storageKey: 'la-sala-tab-auth-v3'
      }
    });
    $('connectionLabel').textContent = 'LISTO PARA CONECTAR';
    $('joinHint').textContent = 'Crea una sala o introduce el código que te han enviado.';
    $('hostHint').textContent = 'Crea una sala para activar la mesa de control.';
    disableConnectionButtons(false);
  }

  function getTabScopedAuthStorage() {
    // sessionStorage vive en la pestaña actual y persiste al recargarla, a diferencia
    // de localStorage, que comparte el mismo usuario anónimo entre todas las pestañas.
    try {
      const storage = window.sessionStorage;
      const testKey = '__la_sala_storage_test__';
      storage.setItem(testKey, '1');
      storage.removeItem(testKey);
      return storage;
    } catch (_) {
      // Entornos que bloquean el almacenamiento: permite la sesión durante esta carga.
      const memory = new Map();
      return {
        getItem: (key) => memory.has(key) ? memory.get(key) : null,
        setItem: (key, value) => memory.set(key, String(value)),
        removeItem: (key) => memory.delete(key)
      };
    }
  }

  function disableConnectionButtons(disabled) {
    $('createRoomBtn').disabled = disabled;
    $('joinForm').querySelector('button[type="submit"]').disabled = disabled;
    $('setNextBtn').disabled = true;
    $('playSelectedNowBtn').disabled = true;
    $('trackSelect').disabled = true;
    $('playBtn').disabled = true;
    $('restartBtn').disabled = true;
    $('seek').disabled = true;
  }

  async function ensureAuthenticated() {
    if (!supabaseClient) throw new Error('Supabase no está configurado.');
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError) throw sessionError;
    if (sessionData.session?.user) {
      user = sessionData.session.user;
      return user;
    }
    const { data, error } = await supabaseClient.auth.signInAnonymously();
    if (error) throw new Error(`No se ha podido iniciar sesión anónima. Activa Anonymous Sign-Ins en Supabase. ${error.message}`);
    user = data.user;
    return user;
  }

  function getDisplayName() {
    const name = $('displayNameInput').value.trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!name) {
      $('displayNameInput').focus();
      throw new Error('Escribe tu nombre antes de entrar.');
    }
    return name;
  }

  async function createRoom() {
    if (!supabaseClient) throw new Error('Configura Supabase antes de crear una sala.');
    const displayName = getDisplayName();
    const hostPassword = $('hostPasswordInput').value;
    if (!hostPassword) throw new Error('Introduce tu clave de anfitrión para crear una sala.');
    setRoomHint('Creando sala…');
    setBusy(true);
    try {
      await ensureAuthenticated();
      const { data, error } = await supabaseClient.rpc('create_room', { p_display_name: displayName, p_host_password: hostPassword });
      if (error) throw error;
      await enterRoom(normalizeRoomResponse(data));
      $('hostPasswordInput').value = '';
      toast(`Sala ${room.code} creada.`);
    } finally { setBusy(false); }
  }

  async function joinRoom(rawCode) {
    if (!supabaseClient) throw new Error('Configura Supabase antes de entrar en una sala.');
    const code = String(rawCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 10) {
      setRoomHint('El código debe tener 10 caracteres.');
      return;
    }
    const displayName = getDisplayName();
    $('roomCodeInput').value = code;
    setRoomHint('Entrando en la sala…');
    setBusy(true);
    try {
      await ensureAuthenticated();
      const { data, error } = await supabaseClient.rpc('join_room', { p_code: code, p_display_name: displayName });
      if (error) throw error;
      await enterRoom(normalizeRoomResponse(data));
      toast(`Has entrado en la sala ${room.code}.`);
    } finally { setBusy(false); }
  }

  function normalizeRoomResponse(data) {
    if (Array.isArray(data)) return data[0];
    return data;
  }

  async function enterRoom(roomRecord) {
    if (!roomRecord || !roomRecord.id || !roomRecord.code) {
      throw new Error('Supabase no ha devuelto una sala válida. Comprueba las funciones SQL.');
    }
    await disposeChannel();
    stopCubeAnimation();
    cubePositions.clear();
    cubeTargets.clear();
    cubeElements.forEach((element) => element.remove());
    cubeElements.clear();
    pendingCubePositions.clear();
    cubeMotionSegments.clear();
    cubeLastSequence.clear();
    cubeUpdateTimestamps.clear();
    cubeMoveSequence = 0;
    latestPeople = [];
    room = roomRecord;
    currentRoomRow = roomRecord;
    concertHasStarted = Boolean(roomRecord.concert_started_at || roomRecord.playback_status === 'playing' || Number(roomRecord.position_seconds || 0) > 0.25);
    cubeColorLoadedRoomId = null;
    if (user?.id) myCubeColor = colorForId(user.id);
    syncPersonalCubeColorControl();
    isHost = Boolean(user && room.host_user_id === user.id);
    $('noRoomView').hidden = true;
    $('activeRoomView').hidden = false;
    $('roomCodeDisplay').textContent = room.code;
    $('roomState').textContent = isHost ? 'ANFITRIÓN' : 'INVITADO';
    $('roomLiveText').textContent = 'CONECTANDO…';
    $('peopleList').replaceChildren();
    $('connectionLabel').textContent = 'CONECTANDO A SALA';
    const url = new URL(window.location.href);
    url.searchParams.set('room', room.code);
    history.replaceState({}, '', url);
    updateRoomPermissions();
    setAudioNote('Conectando la reproducción privada…', false);

    if (!cubePositions.has(user.id)) cubePositions.set(user.id, { ...myCubePosition, display_name: getNameForPresence() });
    cubeTargets.set(user.id, { x: myCubePosition.x, y: myCubePosition.y });
    roomChannel = supabaseClient.channel(`room-${room.id}`, { config: { presence: { key: user.id } } });
    roomChannel
      .on('presence', { event: 'sync' }, renderPeople)
      .on('presence', { event: 'join' }, renderPeople)
      .on('presence', { event: 'leave' }, renderPeople)
      .on('broadcast', { event: 'cube_move' }, ({ payload }) => receiveCubePosition(payload))
      .on('broadcast', { event: 'cube_color_changed' }, ({ payload } = {}) => receiveCubeColor(payload))
      .on('broadcast', { event: 'theme_color_changed' }, ({ payload } = {}) => {
        if (!room || payload?.room_id !== room.id || payload?.sender_user_id !== room.host_user_id) return;
        const color = sanitizeHexColor(payload?.color);
        if (!color) return;
        // Este canal da feedback inmediato; la fila rooms guarda el color definitivo.
        applyThemeColor(color);
      })
      // El broadcast es una señal rápida; el estado auténtico siempre se vuelve a leer de Postgres.
      // Esto evita depender únicamente de que llegue el evento postgres_changes a cada navegador.
      .on('broadcast', { event: 'room_state_changed' }, () => {
        fetchAndApplyLatestRoomState().catch((fetchError) => console.warn('No se pudo actualizar el estado de la sala.', fetchError));
      })
      .on('broadcast', { event: 'room_closed' }, ({ payload } = {}) => {
        // No cierres una sala solo por un mensaje. Comprueba primero la fila real de Postgres
        // y exige que el aviso diga venir del anfitrión de esta sala.
        if (!room || payload?.sender_user_id !== room.host_user_id) return;
        fetchAndApplyLatestRoomState().catch((closeError) => console.warn('No se pudo confirmar el cierre de la sala.', closeError));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, (payload) => {
        if (payload?.new) applyRoomState(payload.new).catch(showError);
      });
    // Empieza el heartbeat y la sincronización por consultas aunque el websocket tarde en conectar.
    // El websocket mejora la velocidad, pero no es el único camino para verse entre navegadores.
    startRoomHeartbeat();
    roomChannel.subscribe(async (status, error) => {
        if (status === 'SUBSCRIBED') {
          try {
            await roomChannel.track({
              user_id: user.id,
              display_name: getNameForPresence(),
              is_host: isHost,
              online_at: new Date().toISOString(),
              cube_x: myCubePosition.x,
              cube_y: myCubePosition.y,
              cube_updated_at: myCubePosition.updated_at || Date.now()
            });
            $('roomLiveText').textContent = 'SALA EN DIRECTO';
            $('connectionLabel').textContent = 'SALA CONECTADA';
            $('hostHint').textContent = isHost ? 'Elige el próximo tema. El cambio se hará al terminar la canción actual.' : 'Solo el anfitrión decide el próximo tema y controla la reproducción.';
            renderPeople();
            fetchAndApplyLatestRoomState().catch((fetchError) => console.warn('No se pudo recuperar el estado actual de la sala.', fetchError));
          } catch (trackError) { showError(trackError); }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (room && room.id === roomRecord.id) {
            $('roomLiveText').textContent = 'RECONECTANDO…';
            $('connectionLabel').textContent = 'RECONECTANDO';
            setAudioNote('La conexión en tiempo real se ha interrumpido. Intentando reconectar…', true);
          }
          if (error) console.error('Error de Supabase Realtime:', error);
        }
      });

    await applyRoomState(roomRecord, true);
    updateRoomPermissions();
  }

  function startRoomHeartbeat() {
    stopRoomHeartbeat();
    if (!room || !supabaseClient) return;
    heartbeatErrorNotified = false;
    const roomId = room.id;
    // Heartbeat del anfitrión y de cada invitado para que Supabase pueda limpiar sesiones caídas.
    sendRoomHeartbeat(roomId);
    roomHeartbeatTimer = window.setInterval(() => sendRoomHeartbeat(roomId), ROOM_HEARTBEAT_INTERVAL_MS);
    // Respaldo para navegadores/canales Realtime que pierdan algún evento: sincroniza el estado
    // musical y los participantes leyendo la base de datos cada pocos segundos.
    pollRoomSnapshot(roomId);
    roomFallbackPollTimer = window.setInterval(() => pollRoomSnapshot(roomId), 4_000);
  }

  function stopRoomHeartbeat() {
    if (roomHeartbeatTimer) window.clearInterval(roomHeartbeatTimer);
    if (roomFallbackPollTimer) window.clearInterval(roomFallbackPollTimer);
    roomHeartbeatTimer = null;
    roomFallbackPollTimer = null;
    databasePeople = [];
  }

  async function pollRoomSnapshot(roomId) {
    if (!room || room.id !== roomId || !supabaseClient) return;
    try {
      await Promise.all([fetchAndApplyLatestRoomState(), refreshRoomMembersSnapshot(roomId)]);
    } catch (error) {
      console.warn('La sincronización de respaldo de la sala ha fallado temporalmente.', error);
    }
  }

  async function refreshRoomMembersSnapshot(roomId) {
    if (!room || room.id !== roomId || !supabaseClient) return;
    const { data, error } = await supabaseClient
      .from('room_members')
      .select('user_id,display_name,last_seen_at,cube_x,cube_y,cube_updated_at,cube_color,cube_color_updated_at')
      .eq('room_id', roomId);
    if (error) throw error;
    if (!room || room.id !== roomId) return;
    const now = Date.now();
    databasePeople = (data || [])
      .filter((member) => {
        const seen = Date.parse(member.last_seen_at || '');
        return Number.isFinite(seen) && now - seen < 90_000;
      })
      .map((member) => ({
        user_id: member.user_id,
        key: member.user_id,
        display_name: member.display_name || 'Invitado',
        last_seen_at: member.last_seen_at,
        cube_x: Number(member.cube_x),
        cube_y: Number(member.cube_y),
        cube_color: sanitizeHexColor(member.cube_color),
        cube_color_updated_at: Date.parse(member.cube_color_updated_at || '') || 0,
        // Convierte la marca del servidor a milisegundos; el renderer solo necesita una marca
        // comparable para decidir si la instantánea es más reciente que un movimiento en directo.
        cube_updated_at: Date.parse(member.cube_updated_at || '') || 0
      }));

    // Recupera el color del usuario desde Supabase al entrar. Si aún no tiene uno,
    // guarda el predeterminado determinista, sin afectar al color de la página.
    if (cubeColorLoadedRoomId !== roomId) {
      cubeColorLoadedRoomId = roomId;
      const selfMember = databasePeople.find((person) => person.user_id === user?.id);
      const savedColor = sanitizeHexColor(selfMember?.cube_color);
      if (savedColor) {
        myCubeColor = savedColor;
      } else {
        persistMyCubeColor(myCubeColor).catch((error) => {
          console.warn('No se pudo guardar el color inicial del cubo.', error);
        });
      }
      syncPersonalCubeColorControl();
    }
    renderPeople();
  }

  async function sendRoomHeartbeat(roomId) {
    if (!roomId || !room || room.id !== roomId || !supabaseClient || heartbeatInFlightRoomId === roomId) return;
    heartbeatInFlightRoomId = roomId;
    try {
      const { data, error } = await supabaseClient.rpc('heartbeat_room', { p_room_id: roomId });
      if (error) {
        if (!heartbeatErrorNotified) {
          heartbeatErrorNotified = true;
          console.warn('Heartbeat de LA SALA falló. Comprueba que se ha ejecutado el SQL de actualización.', error);
          setAudioNote('La sala funciona, pero falta activar su comprobación automática en Supabase. Sigue la guía de actualización.', true);
        }
        return;
      }
      heartbeatErrorNotified = false;
      if (data && data.active === true && room && room.id === roomId) {
        $('roomLiveText').textContent = 'SALA EN DIRECTO';
        if ($('connectionLabel').textContent === 'RECONECTANDO' || $('connectionLabel').textContent === 'CONECTANDO A SALA') {
          $('connectionLabel').textContent = 'SALA CONECTADA';
        }
      }
      if (!data || data.active !== true) {
        const reason = data?.reason || 'room_closed';
        await handleRoomEnded(reason);
      }
    } catch (error) {
      if (!heartbeatErrorNotified) {
        heartbeatErrorNotified = true;
        console.warn('No se pudo confirmar que la sala siga activa.', error);
      }
    } finally {
      if (heartbeatInFlightRoomId === roomId) heartbeatInFlightRoomId = null;
    }
  }

  async function fetchAndApplyLatestRoomState() {
    if (!room || !supabaseClient) return;
    const roomId = room.id;
    const { data, error } = await supabaseClient
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle();
    if (error) throw error;
    if (!room || room.id !== roomId) return;
    if (!data) {
      await handleRoomEnded('room_closed');
      return;
    }
    const current = currentRoomRow;
    const fetchedStamp = Date.parse(data.updated_at || '');
    const currentStamp = Date.parse(current?.updated_at || '');
    const stateChanged = !current ||
      (Number.isFinite(fetchedStamp) && (!Number.isFinite(currentStamp) || fetchedStamp > currentStamp)) ||
      data.current_track_id !== current.current_track_id ||
      data.next_track_id !== current.next_track_id ||
      data.playback_status !== current.playback_status ||
      data.position_seconds !== current.position_seconds ||
      data.playback_started_at !== current.playback_started_at ||
      data.theme_color !== current.theme_color;
    const trackNeedsLoad = !audio.currentSrc || loadedTrackId !== data.current_track_id || Date.now() > signedUrlExpiresAt - 60_000;
    if (stateChanged || trackNeedsLoad) await applyRoomState(data);
  }

  async function signalRoomStateChanged() {
    if (!roomChannel || !room) return;
    try {
      const result = await roomChannel.send({
        type: 'broadcast',
        event: 'room_state_changed',
        payload: { room_id: room.id, sent_at: Date.now() }
      });
      if (result && result !== 'ok') console.warn('La señal de cambio de sala no se confirmó:', result);
    } catch (error) {
      // La suscripción Postgres sigue siendo el canal de respaldo si falla el broadcast.
      console.warn('No se pudo enviar la señal de cambio de sala.', error);
    }
  }

  async function handleRoomEnded(reason) {
    if (!room || roomClosing) return;
    roomClosing = true;
    const message = reason === 'host_closed'
      ? 'El anfitrión ha cerrado la sala.'
      : reason === 'host_disconnected'
        ? 'El anfitrión ha perdido la conexión. La sala se ha cerrado.'
        : reason === 'not_member'
          ? 'Tu sesión ya no figura en esta sala. Vuelve a entrar con el código de invitación.'
          : 'Esta sala ya no existe y se ha cerrado en tu pantalla.';
    try {
      await resetRoomLocally(message);
    } finally {
      roomClosing = false;
    }
  }

  async function resetRoomLocally(message) {
    stopRoomHeartbeat();
    if (cubeColorPersistTimer) window.clearTimeout(cubeColorPersistTimer);
    cubeColorPersistTimer = null;
    cubeColorLoadedRoomId = null;
    if (themePersistTimer) window.clearTimeout(themePersistTimer);
    if (themeBroadcastTimer) window.clearTimeout(themeBroadcastTimer);
    themePersistTimer = null;
    themeBroadcastTimer = null;
    pendingThemeColor = null;
    applyThemeColor(DEFAULT_THEME_COLOR);
    const hadRoom = Boolean(room);
    // Desvincula primero el estado local para que callbacks tardíos no reactiven la sala cerrada.
    room = null;
    currentRoomRow = null;
    isHost = false;
    concertHasStarted = false;
    roomStateApplicationRevision += 1;
    trackLoadToken += 1;
    await disposeChannel();
    if (cubeBroadcastTimer) window.clearTimeout(cubeBroadcastTimer);
    if (cubePersistTimer) window.clearTimeout(cubePersistTimer);
    cubeBroadcastTimer = null;
    cubePersistTimer = null;
    cubeMoveActive = false;
    heldCubeKeys.clear();
    stopKeyboardMovement();
    stopCubeAnimation();
    cubePositions.clear();
    cubeTargets.clear();
    cubeMotionSegments.clear();
    cubeElements.forEach((element) => element.remove());
    cubeElements.clear();
    pendingCubePositions.clear();
    cubeUpdateTimestamps.clear();
    cubeMoveSequence = 0;
    latestPeople = [];
    audioUnlocked = false;
    loadedTrackId = '';
    signedUrlExpiresAt = 0;
    loadingTrackPromises.clear();
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    closePeopleModal();
    $('activeRoomView').hidden = true;
    $('noRoomView').hidden = false;
    $('roomState').textContent = 'SIN SALA';
    $('roomLiveText').textContent = 'SALA CERRADA';
    $('connectionLabel').textContent = 'LISTO PARA CONECTAR';
    $('roomCodeInput').value = '';
    $('peopleList').replaceChildren();
    $('peopleCount').textContent = '0';
    $('peopleModalSubline').textContent = '0 personas conectadas';
    $('trackTitle').textContent = TRACKS[Object.keys(TRACKS)[0]]?.title || 'Sin canciones';
    $('trackSubtitle').textContent = TRACKS[Object.keys(TRACKS)[0]]?.subtitle || '';
    updateSongCover(Object.keys(TRACKS)[0]);
    $('queueTitle').textContent = 'Sin siguiente tema';
    const firstTrackId = Object.keys(TRACKS)[0];
    if (firstTrackId) $('trackSelect').value = firstTrackId;
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    history.replaceState({}, '', url);
    setAudioNote('Entra en una sala para escuchar.', false);
    setRoomHint('Crea una sala o entra con un código para escuchar.');
    updateRoomPermissions();
    if (message && hadRoom) toast(message);
  }

  function getNameForPresence() {
    return $('displayNameInput').value.trim().replace(/\s+/g, ' ').slice(0, 24) || 'Invitado';
  }

  async function applyRoomState(row, force = false) {
    if (!row || !room || row.id !== room.id) return;
    const incomingUpdatedAt = Date.parse(row.updated_at || '');
    const currentUpdatedAt = Date.parse(currentRoomRow?.updated_at || '');
    // No permitas que un evento antiguo de Postgres revierta una selección/reproducción más reciente.
    if (!force && Number.isFinite(incomingUpdatedAt) && Number.isFinite(currentUpdatedAt) && incomingUpdatedAt < currentUpdatedAt) return;
    const stateRevision = ++roomStateApplicationRevision;
    const previousTrackId = room.current_track_id;
    room = { ...room, ...row };
    currentRoomRow = row;
    if (row.concert_started_at || row.playback_status === 'playing' || Number(row.position_seconds || 0) > 0.25) concertHasStarted = true;
    const incomingThemeColor = sanitizeHexColor(row.theme_color) || getTrackThemeColor(row.current_track_id);
    const localThemeIsPending = isHost && pendingThemeColor && incomingThemeColor !== pendingThemeColor;
    if (!localThemeIsPending) applyThemeColor(incomingThemeColor);
    $('playbackStatus').textContent = row.playback_status === 'playing' ? 'EN DIRECTO' : 'EN PAUSA';
    $('trackTitle').textContent = TRACKS[row.current_track_id]?.title || 'Tema no disponible';
    $('trackSubtitle').textContent = TRACKS[row.current_track_id]?.subtitle || '';
    if (force || previousTrackId !== row.current_track_id) updateSongCover(row.current_track_id);
    $('queueTitle').textContent = TRACKS[row.next_track_id]?.title || 'Sin siguiente tema';
    if (TRACKS[row.next_track_id]) $('trackSelect').value = row.next_track_id;
    else if (TRACKS[row.current_track_id] && (!isHost || !TRACKS[$('trackSelect').value])) $('trackSelect').value = row.current_track_id;
    updateGameForTrack(row.current_track_id);
    updateRoomPermissions();

    if (force || previousTrackId !== row.current_track_id || loadedTrackId !== row.current_track_id || !audio.currentSrc || Date.now() > signedUrlExpiresAt - 60_000) {
      try {
        await loadPrivateTrack(row.current_track_id);
      } catch (error) {
        setAudioNote(error.message || 'No se ha podido cargar el audio privado.', true);
        return;
      }
    }

    // Si llegó otro cambio durante una descarga, aplica solo el estado más reciente.
    if (stateRevision !== roomStateApplicationRevision) return;
    // El anfitrión mantiene el control local tras sus propias órdenes; los invitados las reciben aquí.
    if (row.updated_by_user_id && user && row.updated_by_user_id === user.id && !force) return;
    await syncAudioFromRoom(row);
  }

  async function loadPrivateTrack(trackId) {
    const track = TRACKS[trackId];
    if (!track) throw new Error('Ese tema no está definido en el catálogo de la web.');
    if (!room || !supabaseClient) throw new Error('Entra en una sala antes de acceder al audio privado.');
    if (loadedTrackId === trackId && audio.currentSrc && Date.now() < signedUrlExpiresAt - 60_000) return;
    if (loadingTrackPromises.has(trackId)) return loadingTrackPromises.get(trackId);

    const token = ++trackLoadToken;
    loadedTrackId = '';
    const operation = (async () => {
      const { data, error } = await supabaseClient.storage.from('album-audio').createSignedUrl(track.storagePath, 3600);
      if (error) throw new Error(`No se ha podido abrir “${track.title}”. Sube ${track.storagePath} al bucket privado “album-audio”. (${error.message})`);
      if (token !== trackLoadToken || !room) return;
      loadedTrackId = trackId;
      signedUrlExpiresAt = Date.now() + 3_600_000;
      audio.pause();
      audio.src = data.signedUrl;
      audio.load();
      setAudioNote('Audio privado listo. El anfitrión controla la reproducción.', false);
      updateRoomPermissions();
    })();
    loadingTrackPromises.set(trackId, operation);
    try {
      await operation;
    } finally {
      if (loadingTrackPromises.get(trackId) === operation) loadingTrackPromises.delete(trackId);
    }
  }

  async function syncAudioFromRoom(row, forcePlay = false) {
    if (!row || !room || !audio.currentSrc) return;
    const status = row.playback_status;
    const target = targetPosition(row);
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      $('seek').value = String(Math.min(100, Math.max(0, (target / audio.duration) * 100)));
    }
    if (status !== 'playing') {
      if (Number.isFinite(target) && audio.readyState >= 1 && Math.abs(audio.currentTime - target) > 0.8) audio.currentTime = Math.min(target, Number.isFinite(audio.duration) ? audio.duration : target);
      audio.pause();
      setAudioNote(isHost ? 'Listo. Pulsa reproducir para que empiece el directo.' : 'En pausa. El anfitrión elegirá cuándo continuar.', false);
      return;
    }
    if (Number.isFinite(audio.duration) && audio.duration > 0 && target >= audio.duration - 0.15) {
      audio.pause();
      return;
    }
    if (audio.readyState >= 1 && Math.abs(audio.currentTime - target) > 1.8) audio.currentTime = Math.max(0, target);
    if (!audioUnlocked && !isHost && !forcePlay) {
      setAudioNote('Pulsa “Activar audio” una vez para escuchar el directo.', false);
      return;
    }
    try {
      await audio.play();
      setAudioNote('Reproduciendo en directo.', false);
    } catch (_) {
      if (!isHost) setAudioNote('Pulsa “Activar audio” para permitir la reproducción.', true);
    }
  }

  function targetPosition(row) {
    const position = Number(row.position_seconds) || 0;
    if (row.playback_status !== 'playing' || !row.playback_started_at) return position;
    const started = Date.parse(row.playback_started_at);
    return position + (Number.isFinite(started) ? Math.max(0, (Date.now() - started) / 1000) : 0);
  }

  async function publishPlayback(status, position, startedAt) {
    if (!room || !isHost) return;
    const { data, error } = await supabaseClient.from('rooms').update({
      playback_status: status,
      position_seconds: Math.max(0, Number(position) || 0),
      playback_started_at: startedAt,
      updated_by_user_id: user.id,
      updated_at: new Date().toISOString()
    }).eq('id', room.id).select().single();
    if (error) throw error;
    currentRoomRow = data;
    room = { ...room, ...data };
    if (status === 'playing') concertHasStarted = true;
    $('playbackStatus').textContent = status === 'playing' ? 'EN DIRECTO' : 'EN PAUSA';
    updateRoomPermissions();
    await signalRoomStateChanged();
  }

  async function loadSelectedTrack() {
    if (!room || !isHost) {
      toast('Solo el anfitrión puede elegir la siguiente canción.');
      return;
    }
    const trackId = $('trackSelect').value;
    const track = TRACKS[trackId];
    if (!track) return;
    setBusy(true);
    try {
      const { data, error } = await supabaseClient.from('rooms').update({
        next_track_id: trackId,
        updated_by_user_id: user.id,
        updated_at: new Date().toISOString()
      }).eq('id', room.id).select().single();
      if (error) throw error;
      currentRoomRow = data;
      room = { ...room, ...data };
      await signalRoomStateChanged();
      await applyRoomState(data);
      $('queueTitle').textContent = track.title;
      toast(`${track.title} queda como siguiente canción.`);
      $('hostHint').textContent = 'Siguiente tema guardado. La canción actual seguirá hasta terminar.';
    } finally { setBusy(false); }
  }

  async function advanceToNextTrack() {
    if (!room || !isHost || !room.next_track_id || !TRACKS[room.next_track_id]) {
      if (room && isHost) await publishPlayback('paused', audio.currentTime, null);
      return;
    }
    const nextTrackId = room.next_track_id;
    const { data, error } = await supabaseClient.from('rooms').update({
      current_track_id: nextTrackId,
      next_track_id: null,
      theme_color: getTrackThemeColor(nextTrackId),
      playback_status: 'paused',
      position_seconds: 0,
      playback_started_at: null,
      updated_by_user_id: user.id,
      updated_at: new Date().toISOString()
    }).eq('id', room.id).select().single();
    if (error) throw error;
    currentRoomRow = data;
    room = { ...room, ...data };
    await signalRoomStateChanged();
    await applyRoomState(data);
    if (loadedTrackId !== nextTrackId || !audio.currentSrc) {
      await publishPlayback('paused', 0, null);
      return;
    }
    audio.currentTime = 0;
    audioUnlocked = true;
    await audio.play();
    await publishPlayback('playing', audio.currentTime, new Date().toISOString());
  }

  async function renderPeople() {
    if (!roomChannel || !room) return;
    const presence = roomChannel.presenceState();
    const entries = [];
    Object.entries(presence).forEach(([key, metadata]) => {
      (metadata || []).forEach((item) => entries.push({ key, ...item }));
    });
    // La presencia de Realtime es instantánea cuando funciona; room_members es el respaldo
    // persistente para que los nombres y cubos aparezcan aunque un navegador pierda eventos.
    const peopleById = new Map();
    databasePeople.forEach((person) => peopleById.set(person.user_id || person.key, { ...person }));
    entries.forEach((person) => {
      const id = person.user_id || person.key;
      if (!id) return;
      const dbPerson = peopleById.get(id);
      if (!dbPerson) {
        peopleById.set(id, person);
        return;
      }
      const presenceStamp = Number(person.cube_updated_at) || 0;
      const dbStamp = Number(dbPerson.cube_updated_at) || 0;
      const combined = { ...dbPerson, ...person };
      if (dbStamp > presenceStamp) {
        combined.cube_x = dbPerson.cube_x;
        combined.cube_y = dbPerson.cube_y;
        combined.cube_updated_at = dbPerson.cube_updated_at;
      }
      if (!person.display_name) combined.display_name = dbPerson.display_name;
      if (!sanitizeHexColor(person.cube_color) && sanitizeHexColor(dbPerson.cube_color)) {
        combined.cube_color = dbPerson.cube_color;
      }
      peopleById.set(id, combined);
    });
    const unique = [...peopleById.values()];
    // El rol visible se deriva del registro de sala, nunca del nombre enviado por el cliente.
    unique.forEach((person) => { person.is_host = Boolean(room && person.user_id === room.host_user_id); });
    unique.sort((a, b) => Number(Boolean(b.is_host)) - Number(Boolean(a.is_host)) || String(a.display_name || '').localeCompare(String(b.display_name || ''), 'es'));
    latestPeople = unique;
    const presentIds = new Set(unique.map((person) => person.user_id || person.key));
    for (const id of [...cubePositions.keys()]) {
      if (!presentIds.has(id)) {
        cubePositions.delete(id);
        cubeTargets.delete(id);
        cubeMotionSegments.delete(id);
        cubeLastSequence.delete(id);
        const element = cubeElements.get(id);
        if (element) element.remove();
        cubeElements.delete(id);
        cubeUpdateTimestamps.delete(id);
      }
    }
    unique.forEach((person) => {
      const id = person.user_id || person.key;
      const pending = pendingCubePositions.get(id);
      const hasCoordinates = person.cube_x != null && person.cube_y != null && Number.isFinite(Number(person.cube_x)) && Number.isFinite(Number(person.cube_y));
      const presenceTimestamp = Number(person.cube_updated_at) || 0;
      const current = cubePositions.get(id);
      if (pending && (!current || (Number(pending.updated_at) || 0) >= (Number(current.updated_at) || 0))) {
        const start = current || { ...initialCubePosition(id), display_name: person.display_name || pending.display_name || 'Invitado' };
        cubePositions.set(id, {
          x: start.x, y: start.y,
          updated_at: pending.updated_at || 0,
          display_name: person.display_name || pending.display_name || 'Invitado',
          cube_color: sanitizeHexColor(person.cube_color) || myColorFallback(id)
        });
        setCubeMotionTarget(id, pending.x, pending.y, 55);
        pendingCubePositions.delete(id);
      } else if (!current) {
        const position = hasCoordinates
          ? { x: Number(person.cube_x), y: Number(person.cube_y), updated_at: presenceTimestamp }
          : { ...initialCubePosition(id), updated_at: 0 };
        cubePositions.set(id, { ...position, display_name: person.display_name || 'Invitado', cube_color: sanitizeHexColor(person.cube_color) || myColorFallback(id) });
        cubeTargets.set(id, { x: position.x, y: position.y });
        if (id === user?.id) myCubePosition = { x: position.x, y: position.y, updated_at: position.updated_at };
        if (pending) pendingCubePositions.delete(id);
      } else {
        // Presence actúa como instantánea para nuevos miembros; actualiza posiciones ya
        // conocidas solo si su marca de tiempo es más reciente que el último movimiento.
        const lastLiveMove = cubeUpdateTimestamps.get(id) || 0;
        const recentLiveMove = Date.now() - lastLiveMove < 2_500;
        if (hasCoordinates && !recentLiveMove) {
          // Trata la posición de Postgres como destino y no como coordenada de reloj:
          // los relojes de los dispositivos y del servidor pueden no coincidir.
          const dbX = Number(person.cube_x);
          const dbY = Number(person.cube_y);
          if (id === user?.id) {
            current.x = dbX;
            current.y = dbY;
            myCubePosition = { x: dbX, y: dbY, updated_at: Date.now() };
          }
          cubeTargets.set(id, { x: dbX, y: dbY });
          current.updated_at = Date.now();
        }
        current.display_name = person.display_name || current.display_name || 'Invitado';
        current.cube_color = sanitizeHexColor(person.cube_color) || current.cube_color || myColorFallback(id);
        if (pending) pendingCubePositions.delete(id);
      }
    });
    const list = $('peopleList');
    list.replaceChildren();
    unique.forEach((person) => {
      const row = document.createElement('div');
      row.className = 'person';
      const avatar = document.createElement('span');
      avatar.className = `avatar${person.is_host ? ' avatar-host' : ''}`;
      avatar.textContent = (person.display_name || 'IN').trim().slice(0, 2).toUpperCase();
      const name = document.createElement('span');
      name.className = 'person-name';
      name.textContent = person.display_name || 'Invitado';
      const tag = document.createElement('span');
      tag.className = 'host-label';
      tag.textContent = person.is_host ? 'ANFITRIÓN' : (person.user_id === user?.id ? 'TÚ' : '');
      row.append(avatar, name, tag);
      list.appendChild(row);
    });
    $('peopleCount').textContent = String(unique.length);
    $('peopleModalSubline').textContent = `${unique.length} ${unique.length === 1 ? 'persona conectada' : 'personas conectadas'}`;
    renderCubes();
  }

  function updateRoomPermissions() {
    const hasRoom = Boolean(room);
    $('roomState').textContent = !hasRoom ? 'SIN SALA' : (isHost ? 'ANFITRIÓN' : 'INVITADO');
    $('hostControls').hidden = !hasRoom || !isHost;
    $('concertView').hidden = !hasRoom;
    $('activeRoomView').hidden = !hasRoom;
    document.body.classList.toggle('in-room', hasRoom);
    $('createRoomBtn').disabled = !supabaseClient || hasRoom;
    $('joinForm').querySelector('button[type="submit"]').disabled = !supabaseClient || hasRoom;
    $('setNextBtn').disabled = !hasRoom || !isHost;
    $('playSelectedNowBtn').disabled = !hasRoom || !isHost;
    $('trackSelect').disabled = !hasRoom || !isHost;
    $('playBtn').disabled = !hasRoom || !isHost;
    $('restartBtn').disabled = !hasRoom || !isHost;
    $('skipBtn').disabled = !hasRoom || !isHost || !room?.next_track_id;
    $('seek').disabled = !hasRoom || !isHost;
    $('themeColorPicker').disabled = !hasRoom || !isHost;
    $('resetThemeColorBtn').disabled = !hasRoom || !isHost;
    $('themeColorSwatches').querySelectorAll('button').forEach((button) => { button.disabled = !hasRoom || !isHost; });
    const personalColorPicker = $('cubeColorPicker');
    if (personalColorPicker) personalColorPicker.disabled = !hasRoom;
    $('cubeColorSwatches')?.querySelectorAll('button').forEach((button) => { button.disabled = !hasRoom; });
    updateConcertStage();
    const canUnlockAudio = hasRoom && !audioUnlocked && Boolean(audio.currentSrc || audio.src);
    $('preEnableAudioBtn').hidden = !hasRoom || concertHasStarted || audioUnlocked;
    $('preEnableAudioBtn').disabled = !canUnlockAudio;
    $('enableAudioBtn').hidden = !hasRoom || !concertHasStarted || audioUnlocked;
    $('enableAudioBtn').disabled = !canUnlockAudio;
    if (!hasRoom) $('playbackStatus').textContent = 'EN ESPERA';
  }

  function updateConcertStage() {
    const hasRoom = Boolean(room);
    const preShow = hasRoom && !concertHasStarted;
    $('preShowView').hidden = !preShow;
    $('nowPlayingSection').hidden = !hasRoom || preShow;
    $('gameSection').hidden = !hasRoom || preShow;
    const setupTools = $('playerSetupTools');
    const setupDestination = $(preShow ? 'preShowColorSlot' : 'gameColorSlot');
    if (setupTools && setupDestination && setupTools.parentElement !== setupDestination) setupDestination.appendChild(setupTools);
    if (preShow) {
      $('preShowMessage').textContent = isHost
        ? 'Elige una canción en tu mesa de control y pulsa «REPRODUCIR AHORA» cuando estéis listos.'
        : 'Activa el sonido y elige el color de tu cubo. El anfitrión comenzará el concierto cuando esté listo.';
      if (audioUnlocked) $('preShowAudioStatus').textContent = 'Sonido activado. Todo listo para el concierto.';
    }
  }

  async function copyInvite() {
    if (!room) return;
    const url = new URL(window.location.href);
    url.searchParams.set('room', room.code);
    const content = `Código: ${room.code}\nEnlace: ${url.toString()}`;
    try {
      await navigator.clipboard.writeText(content);
      toast('Código y enlace copiados.');
    } catch (_) {
      toast(`Código de sala: ${room.code}`);
    }
  }

  async function leaveRoom() {
    if (!room) return;
    if (isHost && pendingThemeColor) {
      try { await flushPendingThemeColor(); } catch (error) { console.warn('No se pudo guardar el último color antes de salir.', error); }
    }
    const roomId = room.id;
    const wasHost = isHost;
    let cleanupError = null;
    setBusy(true);
    roomClosing = true;
    try {
      const { error } = await supabaseClient.rpc('leave_room', { p_room_id: roomId });
      if (error) cleanupError = error;
      if (!error && wasHost && roomChannel) {
        try {
          await roomChannel.send({ type: 'broadcast', event: 'room_closed', payload: { sender_user_id: user.id, reason: 'host_closed', sent_at: Date.now() } });
        } catch (sendError) { console.warn('No se pudo avisar del cierre al resto de la sala.', sendError); }
      }
    } catch (error) {
      cleanupError = error;
    } finally {
      await resetRoomLocally(wasHost ? 'Has cerrado la sala.' : 'Has salido de la sala.');
      roomClosing = false;
      setBusy(false);
    }
    if (cleanupError) {
      console.warn('No se pudo cerrar la sala inmediatamente en el servidor:', cleanupError);
      toast('Has salido de la sala. Supabase la limpiará automáticamente cuando expire su conexión.');
    }
  }

  async function disposeChannel() {
    if (roomChannel && supabaseClient) {
      try { await supabaseClient.removeChannel(roomChannel); } catch (_) { /* canal ya cerrado */ }
    }
    roomChannel = null;
  }

  function setupInitialRoomLink() {
    const requestedRoom = new URLSearchParams(window.location.search).get('room');
    if (requestedRoom) {
      $('roomCodeInput').value = requestedRoom.toUpperCase();
      $('joinHint').textContent = 'Código detectado. Escribe tu nombre y pulsa entrar.';
    }
  }

  function setPlaying(playing) {
    $('playIcon').textContent = playing ? 'Ⅱ' : '▶';
    $('playBtn').setAttribute('aria-label', playing ? 'Pausar para todos' : 'Reproducir para todos');
    $('visualizer').classList.toggle('playing', playing);
  }

  function setAudioNote(message, isError) {
    const note = $('audioNote');
    note.textContent = message;
    note.classList.toggle('error', Boolean(isError));
    // Antes de comenzar, los errores de carga también deben estar visibles en la antesala.
    if (isError && $('preShowView') && !$('preShowView').hidden) {
      $('preShowAudioStatus').textContent = message;
      $('preShowAudioStatus').classList.add('error');
    }
  }

  function setRoomHint(message) { $('joinHint').textContent = message; }

  function setBusy(busy) {
    $('createRoomBtn').disabled = busy || !supabaseClient || Boolean(room);
    $('joinForm').querySelector('button[type="submit"]').disabled = busy || !supabaseClient || Boolean(room);
    if (!room || !isHost) $('setNextBtn').disabled = true;
    else $('setNextBtn').disabled = busy;
    $('playSelectedNowBtn').disabled = busy || !room || !isHost;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  function showError(error) {
    const message = error?.message || 'Ha ocurrido un error inesperado.';
    console.error(error);
    setRoomHint(message);
    toast(message.length > 100 ? `${message.slice(0, 97)}…` : message);
  }

  function updateGameForTrack(trackId) {
    const game = TRACKS[trackId]?.game;
    const type = $('gameType');
    const title = $('gameTitle');
    const description = $('gameDescription');
    if (type) type.textContent = game?.type || 'LIBRE';
    if (title) title.innerHTML = game?.title || 'Mueve tu cubo.';
    if (description) description.textContent = game?.description || 'Arrastra en la pista para moverte.';
  }

  function setupPersonalCubeColorControl() {
    const picker = $('cubeColorPicker');
    const swatches = $('cubeColorSwatches');
    if (!picker || !swatches) return;
    picker.addEventListener('input', () => setMyCubeColor(picker.value));
    picker.addEventListener('change', () => setMyCubeColor(picker.value, true));
    swatches.addEventListener('click', (event) => {
      const button = event.target.closest('[data-player-color]');
      if (!button || button.disabled) return;
      setMyCubeColor(button.dataset.playerColor, true);
    });
    syncPersonalCubeColorControl();
  }

  function syncPersonalCubeColorControl() {
    const picker = $('cubeColorPicker');
    const output = $('cubeColorHex');
    const swatches = $('cubeColorSwatches');
    const color = sanitizeHexColor(myCubeColor) || '#5ee7ff';
    myCubeColor = color;
    if (picker) picker.value = color;
    const shortcutDot = $('myColorShortcutDot');
    if (shortcutDot) shortcutDot.style.setProperty('--my-cube-color', color);
    if (output) output.textContent = color.toUpperCase();
    if (swatches) swatches.querySelectorAll('[data-player-color]').forEach((button) => {
      button.classList.toggle('is-selected', sanitizeHexColor(button.dataset.playerColor) === color);
    });
  }

  function setMyCubeColor(value, commit = false) {
    if (!room || !user) {
      toast('Entra en una sala para elegir el color de tu cubo.');
      return;
    }
    const color = sanitizeHexColor(value);
    if (!color) return;
    myCubeColor = color;
    const updatedAt = Date.now();
    latestPeople = latestPeople.map((person) => (person.user_id || person.key) === user.id
      ? { ...person, cube_color: color, cube_color_updated_at: updatedAt }
      : person);
    databasePeople = databasePeople.map((person) => person.user_id === user.id
      ? { ...person, cube_color: color, cube_color_updated_at: updatedAt }
      : person);
    const ownPosition = cubePositions.get(user.id);
    if (ownPosition) ownPosition.cube_color = color;
    syncPersonalCubeColorControl();
    renderCubes();
    const hint = $('cubeColorHint');
    if (hint) hint.textContent = 'Tu color está aplicado y se comparte con la sala.';

    // Mientras se arrastra el selector, agrupa los cambios muy seguidos. Así la sala no
    // recibe decenas de paquetes; al confirmar el color se envía y persiste enseguida.
    if (cubeColorPersistTimer) window.clearTimeout(cubeColorPersistTimer);
    cubeColorPersistTimer = window.setTimeout(() => {
      cubeColorPersistTimer = null;
      const finalColor = myCubeColor;
      if (roomChannel && room && user) {
        roomChannel.send({
          type: 'broadcast', event: 'cube_color_changed',
          payload: { room_id: room.id, user_id: user.id, display_name: getNameForPresence(), color: finalColor, updated_at: Date.now() }
        }).catch((error) => console.warn('No se pudo enviar el color final del cubo.', error));
      }
      persistMyCubeColor(finalColor).catch((error) => {
        if (hint) hint.textContent = 'El color se ve en directo, pero no se pudo guardar para próximas entradas.';
        console.warn('No se pudo guardar el color del cubo.', error);
      });
    }, commit ? 0 : 140);
  }

  async function persistMyCubeColor(color) {
    if (!room || !user || !supabaseClient) return;
    const roomId = room.id;
    const normalized = sanitizeHexColor(color);
    if (!normalized) return;
    const { error } = await supabaseClient.rpc('update_member_cube_color', {
      p_room_id: roomId,
      p_color: normalized
    });
    if (error) throw error;
    if (!room || room.id !== roomId) return;
    const savedAt = Date.now();
    databasePeople = databasePeople.map((person) => person.user_id === user.id
      ? { ...person, cube_color: normalized, cube_color_updated_at: savedAt }
      : person);
    latestPeople = latestPeople.map((person) => (person.user_id || person.key) === user.id
      ? { ...person, cube_color: normalized, cube_color_updated_at: savedAt }
      : person);
    if ($('cubeColorHint')) $('cubeColorHint').textContent = 'Color guardado para esta sala.';
    renderCubes();
  }

  function receiveCubeColor(payload) {
    if (!payload || !room || payload.room_id !== room.id || !payload.user_id) return;
    const color = sanitizeHexColor(payload.color);
    if (!color) return;
    const updatedAt = Number(payload.updated_at) || Date.now();
    const id = payload.user_id;
    databasePeople = databasePeople.map((person) => person.user_id === id
      ? { ...person, cube_color: color, cube_color_updated_at: updatedAt }
      : person);
    latestPeople = latestPeople.map((person) => (person.user_id || person.key) === id
      ? { ...person, display_name: payload.display_name || person.display_name, cube_color: color, cube_color_updated_at: updatedAt }
      : person);
    const current = cubePositions.get(id);
    if (current) current.cube_color = color;
    if (id === user?.id) {
      myCubeColor = color;
      syncPersonalCubeColorControl();
    }
    renderCubes();
  }


  function setupMiniGame() {
    const arena = $('cubeArena');
    if (!arena) return;

    const moveFromPointer = (event) => {
      const rect = arena.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      setMyCubePosition(x, y);
    };

    arena.addEventListener('pointerdown', (event) => {
      if (!room) { toast('Entra en una sala para jugar.'); return; }
      if (event.button !== undefined && event.button !== 0) return;
      cubeMoveActive = true;
      arena.focus({ preventScroll: true });
      try { arena.setPointerCapture(event.pointerId); } catch (_) {}
      moveFromPointer(event);
    });
    arena.addEventListener('pointermove', (event) => {
      if (cubeMoveActive) moveFromPointer(event);
    });
    const endMove = () => { cubeMoveActive = false; };
    arena.addEventListener('pointerup', endMove);
    arena.addEventListener('pointercancel', endMove);
    arena.addEventListener('lostpointercapture', endMove);
    const movementKeys = new Set(['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's']);
    arena.addEventListener('keydown', (event) => {
      if (!room) return;
      const key = event.key.toLowerCase();
      if (!movementKeys.has(key)) return;
      event.preventDefault();
      heldCubeKeys.add(key);
      // Mover en cada frame mientras se mantenga la tecla evita depender del
      // retraso de repetición del teclado del sistema operativo.
      if (keyboardMovementFrameId === null) {
        keyboardFramePreviousTimestamp = 0;
        keyboardMovementFrameId = window.requestAnimationFrame(animateKeyboardMovement);
      }
    });
    window.addEventListener('keyup', (event) => {
      heldCubeKeys.delete(event.key.toLowerCase());
      if (!heldCubeKeys.size) stopKeyboardMovement();
    });
    window.addEventListener('blur', () => {
      heldCubeKeys.clear();
      stopKeyboardMovement();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        heldCubeKeys.clear();
        stopKeyboardMovement();
      }
    });
  }

  function animateKeyboardMovement(timestamp) {
    keyboardMovementFrameId = null;
    if (!room || !heldCubeKeys.size) {
      keyboardFramePreviousTimestamp = 0;
      return;
    }
    if (!keyboardFramePreviousTimestamp) keyboardFramePreviousTimestamp = timestamp - (1000 / 60);
    const deltaSeconds = Math.max(0, Math.min(0.05, (timestamp - keyboardFramePreviousTimestamp) / 1000));
    keyboardFramePreviousTimestamp = timestamp;

    let dx = 0;
    let dy = 0;
    if (heldCubeKeys.has('arrowleft') || heldCubeKeys.has('a')) dx -= 1;
    if (heldCubeKeys.has('arrowright') || heldCubeKeys.has('d')) dx += 1;
    if (heldCubeKeys.has('arrowup') || heldCubeKeys.has('w')) dy -= 1;
    if (heldCubeKeys.has('arrowdown') || heldCubeKeys.has('s')) dy += 1;
    const length = Math.hypot(dx, dy);
    if (length > 0 && deltaSeconds > 0) {
      const distance = CUBE_KEYBOARD_SPEED * deltaSeconds / length;
      setMyCubePosition(myCubePosition.x + dx * distance, myCubePosition.y + dy * distance);
    }
    keyboardMovementFrameId = window.requestAnimationFrame(animateKeyboardMovement);
  }

  function stopKeyboardMovement() {
    if (keyboardMovementFrameId !== null) {
      window.cancelAnimationFrame(keyboardMovementFrameId);
      keyboardMovementFrameId = null;
    }
    keyboardFramePreviousTimestamp = 0;
  }

  function setCubeMotionTarget(id, x, y, durationMs) {
    const current = cubePositions.get(id);
    if (!current) return;
    const targetX = Math.max(4, Math.min(96, Number(x)));
    const targetY = Math.max(8, Math.min(90, Number(y)));
    const distance = Math.hypot(targetX - current.x, targetY - current.y);
    cubeTargets.set(id, { x: targetX, y: targetY });
    if (distance < 0.015) {
      current.x = targetX;
      current.y = targetY;
      cubeMotionSegments.delete(id);
      return;
    }
    cubeMotionSegments.set(id, {
      fromX: current.x,
      fromY: current.y,
      toX: targetX,
      toY: targetY,
      startAt: performance.now(),
      duration: Math.max(CUBE_REMOTE_MIN_DURATION_MS, Math.min(CUBE_REMOTE_MAX_DURATION_MS, Number(durationMs) || 50))
    });
    scheduleCubeAnimation();
  }

  function openPeopleModal() {
    if (!room) return;
    $('peopleModal').hidden = false;
    $('closePeopleButton').focus();
  }

  function closePeopleModal() {
    const modal = $('peopleModal');
    if (modal) modal.hidden = true;
  }

  function initialCubePosition(id) {
    let hash = 0;
    for (let i = 0; i < String(id).length; i += 1) hash = (hash * 31 + String(id).charCodeAt(i)) | 0;
    const positive = Math.abs(hash);
    return { x: 12 + (positive % 760) / 10, y: 18 + ((positive >> 4) % 580) / 10 };
  }

  function setMyCubePosition(x, y) {
    if (!room || !user) return;
    const numericX = Number(x);
    const numericY = Number(y);
    myCubePosition = {
      x: Math.max(4, Math.min(96, Number.isFinite(numericX) ? numericX : 50)),
      y: Math.max(8, Math.min(90, Number.isFinite(numericY) ? numericY : 50)),
      updated_at: Date.now()
    };
    cubePositions.set(user.id, { ...myCubePosition, display_name: getNameForPresence() });
    cubeTargets.set(user.id, { x: myCubePosition.x, y: myCubePosition.y });
    renderCubes();

    // Throttle/trailing send: no se reinicia el temporizador en cada pixel movido.
    // El código anterior era un debounce y, al arrastrar continuamente, no enviaba nada
    // hasta soltar el ratón/dedo.
    if (!cubeBroadcastTimer) {
      cubeBroadcastTimer = window.setTimeout(() => {
        cubeBroadcastTimer = null;
        publishCubePosition().catch((error) => console.warn('No se ha podido compartir el movimiento del cubo.', error));
      }, CUBE_BROADCAST_INTERVAL_MS);
    }

    // Guarda una instantánea en room_members como respaldo. Así otros navegadores pueden
    // recuperar la posición aunque pierdan un broadcast en tiempo real.
    if (!cubePersistTimer) {
      cubePersistTimer = window.setTimeout(async () => {
        cubePersistTimer = null;
        if (!supabaseClient || !user || !room) return;
        const roomId = room.id;
        try {
          const { error } = await supabaseClient.rpc('update_cube_position', {
            p_room_id: roomId,
            p_x: myCubePosition.x,
            p_y: myCubePosition.y
          });
          if (error) throw error;
        } catch (error) {
          console.warn('No se ha podido guardar la posición compartida del cubo.', error);
        }
      }, 450);
    }
  }

  async function publishCubePosition() {
    if (!roomChannel || !user || !room) return;
    cubeMoveSequence += 1;
    const payload = {
      user_id: user.id,
      display_name: getNameForPresence(),
      x: myCubePosition.x,
      y: myCubePosition.y,
      sequence: cubeMoveSequence,
      sent_at: Date.now()
    };
    const result = await roomChannel.send({ type: 'broadcast', event: 'cube_move', payload });
    if (result && result !== 'ok') console.warn('Supabase Realtime no confirmó el movimiento:', result);
  }

  function receiveCubePosition(payload) {
    if (!payload || !payload.user_id || payload.user_id === user?.id) return;
    const id = payload.user_id;
    const x = Number(payload.x);
    const y = Number(payload.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    // Los broadcasts pueden llegar fuera de orden; no permitas que uno viejo retroceda el cubo.
    const sequence = Number(payload.sequence) || 0;
    const previousSequence = cubeLastSequence.get(id) || 0;
    if (sequence && previousSequence && sequence <= previousSequence) return;
    if (sequence) cubeLastSequence.set(id, sequence);

    const receivedAt = Date.now();
    const previousAt = cubeUpdateTimestamps.get(id) || 0;
    cubeUpdateTimestamps.set(id, receivedAt);
    const interval = previousAt ? Math.max(0, receivedAt - previousAt) : 45;
    const duration = Math.max(CUBE_REMOTE_MIN_DURATION_MS, Math.min(CUBE_REMOTE_MAX_DURATION_MS, interval * 1.2));
    const target = {
      x: Math.max(4, Math.min(96, x)),
      y: Math.max(8, Math.min(90, y)),
      display_name: payload.display_name || 'Invitado'
    };

    const person = latestPeople.find((item) => (item.user_id || item.key) === id);
    if (!person) {
      // Presence puede llegar después del broadcast inicial; conserva el último destino.
      pendingCubePositions.set(id, { ...target, updated_at: receivedAt });
      while (pendingCubePositions.size > 50) pendingCubePositions.delete(pendingCubePositions.keys().next().value);
      return;
    }

    let current = cubePositions.get(id);
    if (!current) {
      const initial = initialCubePosition(id);
      current = { ...initial, updated_at: receivedAt, display_name: target.display_name };
      cubePositions.set(id, current);
    } else {
      current.display_name = target.display_name || current.display_name || 'Invitado';
      current.updated_at = receivedAt;
    }
    setCubeMotionTarget(id, target.x, target.y, duration);
    // No esperamos a un segundo paquete para empezar la animación del primer movimiento.
    scheduleCubeAnimation();
    renderCubes();
  }

  function renderCubes() {
    const layer = $('cubeLayer');
    if (!layer) return;
    const visibleIds = new Set();

    for (const person of latestPeople) {
      const id = person.user_id || person.key;
      if (!id) continue;
      visibleIds.add(id);
      if (!cubePositions.has(id)) {
        const initial = initialCubePosition(id);
        cubePositions.set(id, { ...initial, display_name: person.display_name || 'Invitado', updated_at: 0 });
        cubeTargets.set(id, { x: initial.x, y: initial.y });
      }
      const position = cubePositions.get(id);
      if (!cubeTargets.has(id)) cubeTargets.set(id, { x: position.x, y: position.y });

      let cube = cubeElements.get(id);
      if (!cube) {
        cube = document.createElement('div');
        cube.className = 'player-cube';
        const face = document.createElement('span');
        face.className = 'cube-face';
        const label = document.createElement('span');
        label.className = 'cube-name';
        cube.append(face, label);
        cubeElements.set(id, cube);
      }
      cube.classList.toggle('is-me', id === user?.id);
      cube.style.left = `${position.x}%`;
      cube.style.top = `${position.y}%`;
      const playerColor = sanitizeHexColor(person.cube_color) || sanitizeHexColor(position.cube_color) || colorForId(id);
      cube.style.setProperty('--cube-color', playerColor);
      const label = cube.querySelector('.cube-name');
      label.textContent = id === user?.id ? `${person.display_name || 'Tú'} · TÚ` : (person.display_name || position.display_name || 'Invitado');
      label.style.color = playerColor;
      label.style.borderColor = `${playerColor}99`;
      label.style.boxShadow = `0 3px 14px ${playerColor}20`;
      if (cube.parentElement !== layer) layer.appendChild(cube);
    }

    for (const [id, element] of cubeElements.entries()) {
      if (!visibleIds.has(id)) {
        element.remove();
        cubeElements.delete(id);
        cubeTargets.delete(id);
        cubePositions.delete(id);
        cubeMotionSegments.delete(id);
        cubeLastSequence.delete(id);
        cubeUpdateTimestamps.delete(id);
      }
    }
    scheduleCubeAnimation();
  }

  // Anima los destinos remotos por segmentos cortos a la frecuencia de refresco de la pantalla.
  // El cubo local sigue el puntero o el teclado inmediatamente; aquí solo se mueven los remotos.
  function scheduleCubeAnimation() {
    if (!room || cubeAnimationFrameId !== null || cubeMotionSegments.size === 0) return;
    cubeAnimationFrameId = window.requestAnimationFrame(animateCubeFrames);
  }

  function animateCubeFrames(timestamp) {
    cubeAnimationFrameId = null;
    if (!room) {
        return;
    }

    // Cada paquete de red propone un pequeño segmento temporal. Se dibuja a 60 FPS
    // entre el punto actual y el destino, sin saltar directamente de paquete a paquete.
    let keepAnimating = false;
    for (const [id, segment] of cubeMotionSegments.entries()) {
      if (id === user?.id) continue;
      const current = cubePositions.get(id);
      const element = cubeElements.get(id);
      if (!current || !element) continue;

      const progress = Math.max(0, Math.min(1, (timestamp - segment.startAt) / segment.duration));
      current.x = segment.fromX + (segment.toX - segment.fromX) * progress;
      current.y = segment.fromY + (segment.toY - segment.fromY) * progress;
      element.style.left = `${current.x}%`;
      element.style.top = `${current.y}%`;
      element.classList.toggle('is-moving', progress < 1);

      if (progress < 1) {
        keepAnimating = true;
      } else {
        current.x = segment.toX;
        current.y = segment.toY;
        element.style.left = `${current.x}%`;
        element.style.top = `${current.y}%`;
        element.classList.remove('is-moving');
        cubeMotionSegments.delete(id);
      }
    }
    if (keepAnimating) scheduleCubeAnimation();
  }

  function stopCubeAnimation() {
    if (cubeAnimationFrameId !== null) {
      window.cancelAnimationFrame(cubeAnimationFrameId);
      cubeAnimationFrameId = null;
    }
  }

  function colorForId(id) {
    let hash = 0;
    for (let i = 0; i < String(id).length; i += 1) hash = ((hash << 5) - hash + String(id).charCodeAt(i)) | 0;
    return PLAYER_COLOR_PALETTE[Math.abs(hash) % PLAYER_COLOR_PALETTE.length];
  }

  function myColorFallback(id) {
    return id === user?.id ? (sanitizeHexColor(myCubeColor) || colorForId(id)) : colorForId(id);
  }

  async function playSelectedNow() {
    if (!room || !isHost) { toast('Solo el anfitrión puede cambiar la canción.'); return; }
    const trackId = $('trackSelect').value;
    const track = TRACKS[trackId];
    if (!track) return;
    setBusy(true);
    try {
      const { data, error } = await supabaseClient.from('rooms').update({ current_track_id: trackId, next_track_id: null, theme_color: getTrackThemeColor(trackId), playback_status: 'paused', position_seconds: 0, playback_started_at: null, updated_by_user_id: user.id, updated_at: new Date().toISOString() }).eq('id', room.id).select().single();
      if (error) throw error;
      currentRoomRow = data;
      room = { ...room, ...data };
      await signalRoomStateChanged();
      await applyRoomState(data, true);
      audio.currentTime = 0;
      audioUnlocked = true;
      await audio.play();
      await publishPlayback('playing', audio.currentTime, new Date().toISOString());
      $('hostHint').textContent = `${track.title} está sonando para todos.`;
      toast(`${track.title} está sonando.`);
    } finally { setBusy(false); }
  }

  window.addEventListener('online', () => {
    if (!room) return;
    $('roomLiveText').textContent = 'RECONECTANDO…';
    sendRoomHeartbeat(room.id);
    fetchAndApplyLatestRoomState().catch((error) => console.warn('No se pudo resincronizar la sala tras recuperar Internet.', error));
  });

  // Corrige desfases leves de los invitados a partir del reloj compartido por la sala.
  window.setInterval(() => {
    if (!room || isHost || !currentRoomRow || currentRoomRow.playback_status !== 'playing' || !audioUnlocked || !audio.currentSrc || audio.paused || !Number.isFinite(audio.duration)) return;
    const target = targetPosition(currentRoomRow);
    if (target < audio.duration - 0.2 && Math.abs(audio.currentTime - target) > 2) audio.currentTime = target;
  }, 3000);
})();

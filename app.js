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
  // Se inicializa antes de configurar el selector, porque setupVisualModeControl
  // aplica la preferencia guardada durante el arranque de la aplicación.
  let currentVisualMode = 'classic';
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
  const sharedObjects = new Map();
  const sharedObjectElements = new Map();
  const BETTING_TRACK_ID = 'todoAlRojo';
  const INITIAL_VIRTUAL_CHIPS = 100;
  let bettingState = null;
  let bettingRoomId = '';
  let bettingTrackId = '';
  let bettingSelectedSide = 'red';
  let bettingSelectedAmount = 10;
  const sharedObjectPushCooldowns = new Map();
  let activeObjectTrackId = '';
  let sharedObjectAnimationFrameId = null;
  let sharedObjectPreviousFrameAt = 0;
  let sharedObjectPhysicsActiveUntil = 0;
  let sharedObjectLastBroadcastAt = 0;
  let sharedObjectStateSequence = 0;
  let sharedObjectLastReceivedSequence = 0;
  const SHARED_OBJECT_BROADCAST_INTERVAL_MS = 70;
  const SHARED_OBJECT_PUSH_IMPULSE = 245;
  const SHARED_OBJECT_MAX_SPEED = 430;
  const SHARED_OBJECT_FRICTION = 2.0;
  const LEGACY_LIME_THEME_COLOR = '#d6ff62';
  const THEME_BLUE_MIGRATION_CUTOFF = Date.parse('2026-10-11T11:15:00Z');
  // Mantiene la velocidad horizontal anterior, pero mide el movimiento en píxeles:
  // la velocidad vertical ya no depende de que la pista sea más ancha que alta.
  const CUBE_KEYBOARD_SPEED = 38; // porcentaje del ancho de la pista por segundo
  let myCubePosition = { x: 50, y: 52 };
  let cubeMoveTarget = null;
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
  let roomSmokeCooldownUntil = 0;
  let roomSmokeCooldownTimer = null;
  let roomSmokeAnimationFrameId = null;
  let roomSmokeCleanupTimer = null;
  let pendingRoomSmokePayload = null;
  const ROOM_HEARTBEAT_INTERVAL_MS = 15_000;
  const PLAYER_COLOR_PALETTE = ['#5ee7ff', '#d6ff62', '#ff72b6', '#a78bfa', '#ffad66', '#6ee7a8', '#ff6b6b', '#f5f5f5'];
  const DEFAULT_THEME_COLOR = '#68caff';
  let activeThemeColor = DEFAULT_THEME_COLOR;
  let pendingThemeColor = null;
  let themePersistTimer = null;
  let themeBroadcastTimer = null;
  let themePersistQueue = Promise.resolve();

  // Modos arcade por canción. El anfitrión simula la física y publica snapshots
  // por Realtime; los invitados solo envían acciones y suavizan la representación.
  let activeArcadeMode = '';
  let activeArcadeTrackId = '';
  let arcadeState = null;
  let arcadeFrameId = null;
  let arcadePreviousFrameAt = 0;
  let arcadeLastBroadcastAt = 0;
  let arcadeSequence = 0;
  let arcadeLastReceivedSequence = 0;
  let arcadeLastActionAt = new Map();
  let arcadeEntityElements = new Map();
  let arcadeVisuals = new Map();
  let arcadeHudUpdatedAt = 0;
  let spaceShootTimer = null;
  let arcadeAdvanceTimeout = null;
  const spaceFireSources = new Set();
  const ARCADE_BROADCAST_INTERVAL_MS = 65;
  const SPACE_SHOT_COOLDOWN_MS = 220;
  const SPACE_SHOT_SPEED = 560;
  const SPACE_ENEMY_SHOT_SPEED = 225;
  const VOLLEY_TOUCH_RANGE_PX = 43;
  const VOLLEY_TOUCH_COOLDOWN_MS = 650;
  let arcadeCinematicEventId = '';
  let arcadeCinematicPhaseIndex = -1;
  let arcadeCinematicStartedAt = 0;
  let arcadeCinematicFailsafeTimer = null;
  const arcadeCinematicTimers = [];
  let arcadeEndSequenceRunning = false;
  let arcadeWaitingAfterFinish = false;
  const CINEMATIC_PHASE_ORDER = { 'track-black': 0, 'track-cover': 1, 'track-settle': 2, switch: 0, travel: 0, sun: 1, explode: 2, restore: 3, waiting: 4, clear: 5, resume: 0 };
  const ALIEN_BOTTLE_CAP = 26;
  const ALIEN_BOTTLE_BURST_INTERVAL_MS = 560;

  // Añade aquí cada tema. Sube sus archivos al bucket privado "album-audio" de Supabase.
  const TRACKS = {
    demo: {
      title: 'Cuack.',
      subtitle: '',
      storagePath: 'demo.mp3',
      coverPath: 'assets/portada-demo.png',
      fallbackCoverPath: 'assets/portada.jpg',
      themeColor: '#68caff',
      game: {
        type: 'CUACK VÓLEY',
        emoji: '🏐',
        title: 'Cuack. vóley',
        description: '',
        objects: []
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
        title: 'Space War',
        description: '',
        objects: []
      }
    },
    todoAlRojo: {
      title: 'Todo al rojo',
      subtitle: '',
      storagePath: 'todo-al-rojo.mp3',
      coverPath: 'assets/portada-todo-al-rojo.png',
      fallbackCoverPath: 'assets/portada-demo.png',
      themeColor: '#ff4c4c',
      game: {
        type: 'TODO AL ROJO',
        emoji: '♥',
        title: 'Todo al rojo',
        description: '',
        objects: [
          { id: 'red-card-heart', label: 'Carta roja', emoji: '♥', kind: 'playing-card card-red', x: 17, y: 28, size: 46 },
          { id: 'red-card-diamond', label: 'Carta roja', emoji: '♦', kind: 'playing-card card-red', x: 82, y: 28, size: 46 },
          { id: 'black-card-spade', label: 'Carta negra', emoji: '♠', kind: 'playing-card card-black', x: 16, y: 72, size: 46 },
          { id: 'black-card-club', label: 'Carta negra', emoji: '♣', kind: 'playing-card card-black', x: 83, y: 72, size: 46 },
          { id: 'red-chip-1', label: 'Ficha roja', emoji: '●', kind: 'bet-chip chip-red', x: 32, y: 18, size: 34 },
          { id: 'black-chip-1', label: 'Ficha negra', emoji: '●', kind: 'bet-chip chip-black', x: 68, y: 82, size: 34 }
        ]
      }
    },
    trainLove: {
      title: 'El tren de el amor',
      subtitle: '',
      storagePath: 'el-tren-de-el-amor.mp3',
      coverPath: 'assets/portada-el-tren-de-el-amor.png',
      fallbackCoverPath: 'assets/portada-demo.png',
      themeColor: '#ff72b6',
      game: {
        type: 'EL TREN DEL AMOR',
        emoji: '🚂',
        title: 'El tren de el amor',
        description: '',
        objects: []
      }
    },
    dosLesbianas: {
      title: 'Dos lesbianas',
      subtitle: '',
      storagePath: 'dos-lesbianas.mp3',
      coverPath: 'assets/portada-dos-lesbianas.png',
      fallbackCoverPath: 'assets/portada-demo.png',
      themeColor: '#438dff',
      game: {
        type: 'ALIEN VS BOTELLAS',
        emoji: '👽',
        title: 'Dos lesbianas',
        description: '',
        objects: []
      }
    },
    ducha: {
      title: 'Ducha',
      subtitle: '',
      storagePath: 'ducha.mp3',
      coverPath: 'assets/portada-ducha.png',
      fallbackCoverPath: 'assets/portada-demo.png',
      themeColor: '#55dce8',
      game: { type: '', emoji: '', title: '', description: '', objects: [] }
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
  setupVisualModeControl();
  setupRooms();
  setupMiniGame();
  setupArcadeControls();
  setupPersonalCubeColorControl();
  setupInitialRoomLink();
  initializeConnection().catch((error) => {
    console.error('No se pudo inicializar la conexión de LA SALA.', error);
    const message = error?.message || 'No se pudo inicializar Supabase. Recarga la página y comprueba la configuración.';
    $('connectionLabel').textContent = 'ERROR DE CONEXIÓN';
    setRoomHint(`No se pudo preparar la conexión: ${message}`);
    disableConnectionButtons(true);
  });

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
      if (room && isHost) startSongEndCinematic().catch(showError);
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
        if (arcadeEndSequenceRunning) { toast('Espera a que termine la transición del concierto.'); return; }
        audioUnlocked = true;
        if (audio.paused) {
          await resumeArcadeAfterFinish();
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
      if (arcadeEndSequenceRunning) { toast('Espera a que termine la transición del concierto.'); return; }
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
        $('preShowAudioStatus').textContent = 'Cargando…';
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
      $('preShowAudioStatus').textContent = 'Audio activado';
      $('preShowAudioStatus').classList.remove('error');
      $('enableAudioBtn').textContent = 'SONIDO ACTIVADO';
      $('preEnableAudioBtn').textContent = 'SONIDO ACTIVADO';
      $('enableAudioBtn').disabled = true;
      $('preEnableAudioBtn').disabled = true;
      updateRoomPermissions();
    } catch (error) {
      audio.muted = false;
      $('preShowAudioStatus').textContent = 'Activa el audio para escuchar.';
      $('preShowAudioStatus').classList.add('error');
      setAudioNote('Pulsa de nuevo “Activar sonido” para permitir la reproducción.', true);
      showError(error);
    }
  }

  // The visual layout is local to each browser tab. Both designs use the same DOM,
  // room channel, player positions, audio clock and authoritative arcade snapshots.
  // Switching CSS never modifies Supabase state or resets a minigame.
  // Esta versión vuelve al diseño 5.4. El estado del juego y Supabase no dependen del estilo.
  function applyVisualMode(mode = 'classic', announce = false) {
    currentVisualMode = 'classic';
    const style55 = $('styleMode55');
    const style54 = $('styleMode54');
    if (style55) style55.disabled = true;
    if (style54) style54.disabled = false;
    try { window.sessionStorage.setItem('la-sala-visual-mode', 'classic'); } catch (_) {}
    if (announce) toast('Vista 5.4 activada.');
  }

  function setupVisualModeControl() {
    applyVisualMode('classic', false);
  }

  function closeMyColorPopover() {
    const popover = $('myColorPopover');
    if (popover) popover.hidden = true;
    $('myColorButton')?.setAttribute('aria-expanded', 'false');
  }

  function setupRooms() {
    $('createRoomBtn').addEventListener('click', (event) => { event.preventDefault(); createRoom().catch((error) => { setRoomHint(error?.message || 'No se pudo crear la sala.'); showError(error); }); });
    $('joinForm').addEventListener('submit', (event) => {
      event.preventDefault();
      joinRoom($('roomCodeInput').value).catch(showError);
    });
    $('copyCodeBtn').addEventListener('click', copyInvite);
    $('myColorButton')?.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!room) return;
      const popover = $('myColorPopover');
      const willOpen = Boolean(popover?.hidden);
      if (popover) popover.hidden = !willOpen;
      $('myColorButton')?.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) window.setTimeout(() => $('cubeColorPicker')?.focus({ preventScroll: true }), 0);
    });
    $('closeMyColorPopover')?.addEventListener('click', closeMyColorPopover);
    document.addEventListener('pointerdown', (event) => {
      const popover = $('myColorPopover');
      if (!popover || popover.hidden) return;
      if (popover.contains(event.target) || $('myColorButton')?.contains(event.target)) return;
      closeMyColorPopover();
    });
    $('leaveRoomBtn').addEventListener('click', () => leaveRoom().catch(showError));
    $('playSelectedNowBtn').addEventListener('click', () => playSelectedNow().catch(showError));
    $('peopleButton').addEventListener('click', openPeopleModal);
    $('closePeopleButton').addEventListener('click', closePeopleModal);
    $('closePeopleBackdrop').addEventListener('click', closePeopleModal);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closePeopleModal(); closeMyColorPopover(); } });
    $('trackSelect').addEventListener('change', () => {
      const track = TRACKS[$('trackSelect').value];
      $('queueTitle').textContent = track ? track.title : 'Selecciona un tema';
    });
    $('setNextBtn').addEventListener('click', () => loadSelectedTrack().catch(showError));
    setupThemeControls();
    setupBettingControls();
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
    stopSharedObjectAnimation();
    stopArcadeAnimation();
    clearArcadeEntities();
    arcadeState = null;
    activeArcadeMode = '';
    activeArcadeTrackId = '';
    clearSharedObjects();
    activeObjectTrackId = '';
    bettingState = null;
    bettingRoomId = '';
    bettingTrackId = '';
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
      .on('broadcast', { event: 'shared_objects_state' }, ({ payload } = {}) => receiveSharedObjectsState(payload))
      .on('broadcast', { event: 'shared_objects_request' }, ({ payload } = {}) => {
        if (!room || !isHost || payload?.room_id !== room.id) return;
        publishSharedObjectsState().catch((error) => console.warn('No se pudo enviar el estado de los objetos compartidos.', error));
      })
      .on('broadcast', { event: 'betting_state' }, ({ payload } = {}) => receiveBettingState(payload))
      .on('broadcast', { event: 'betting_state_request' }, ({ payload } = {}) => {
        if (!room || !isHost || payload?.room_id !== room.id || activeObjectTrackId !== BETTING_TRACK_ID) return;
        ensureBettingPlayers();
        publishBettingState().catch((error) => console.warn('No se pudo compartir la mesa de apuestas.', error));
      })
      .on('broadcast', { event: 'betting_action_request' }, ({ payload } = {}) => {
        if (!room || !isHost || payload?.room_id !== room.id || activeObjectTrackId !== BETTING_TRACK_ID) return;
        processBettingAction(payload).catch((error) => console.warn('No se pudo procesar la apuesta.', error));
      })
      .on('broadcast', { event: 'betting_notice' }, ({ payload } = {}) => {
        if (!room || payload?.room_id !== room.id || payload?.target_user_id !== user?.id) return;
        if (payload.message) { $('bettingStatus').textContent = payload.message; toast(payload.message); }
      })
      .on('broadcast', { event: 'arcade_state' }, ({ payload } = {}) => receiveArcadeState(payload))
      .on('broadcast', { event: 'arcade_cinematic' }, ({ payload } = {}) => receiveArcadeCinematic(payload))
      .on('broadcast', { event: 'arcade_state_request' }, ({ payload } = {}) => {
        if (!room || !isHost || payload?.room_id !== room.id || payload?.track_id !== activeArcadeTrackId || !activeArcadeMode) return;
        publishArcadeState().catch((error) => console.warn('No se pudo compartir el estado del minijuego.', error));
      })
      .on('broadcast', { event: 'arcade_action_request' }, ({ payload } = {}) => {
        if (!room || !isHost || payload?.room_id !== room.id || payload?.track_id !== activeArcadeTrackId) return;
        processArcadeAction(payload);
      })
      .on('broadcast', { event: 'train_smoke' }, ({ payload } = {}) => {
        if (!room || payload?.room_id !== room.id || payload?.sender_user_id !== room.host_user_id) return;
        triggerRoomSmoke(payload);
      })
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
            if (isHost) {
              publishSharedObjectsState().catch((objectError) => console.warn('No se pudo anunciar el estado de los objetos.', objectError));
              if (activeObjectTrackId === BETTING_TRACK_ID) {
                ensureBettingPlayers();
                publishBettingState().catch((betError) => console.warn('No se pudo anunciar la mesa de apuestas.', betError));
              }
            } else {
              roomChannel.send({
                type: 'broadcast', event: 'shared_objects_request',
                payload: { room_id: room.id, requester_user_id: user.id, track_id: activeObjectTrackId, sent_at: Date.now() }
              }).catch((objectError) => console.warn('No se pudo pedir el estado de los objetos.', objectError));
              if (activeObjectTrackId === BETTING_TRACK_ID) requestBettingState();
            }
            if (activeArcadeMode) { if (isHost) publishArcadeState().catch(() => {}); else requestArcadeState(); }
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
    const endedRoomId = room?.id;
    if (endedRoomId) {
      try { localStorage.removeItem(bettingStorageKey(endedRoomId)); } catch (_) { /* storage opcional */ }
    }
    bettingState = null;
    bettingRoomId = '';
    bettingTrackId = '';
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
    cubeMoveTarget = null;
    heldCubeKeys.clear();
    stopKeyboardMovement();
    stopCubeAnimation();
    stopSharedObjectAnimation();
    clearSharedObjects();
    activeObjectTrackId = '';
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
    setAudioNote('Sin sala', false);
    setRoomHint('Introduce tu nombre.');
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
    const storedThemeColor = sanitizeHexColor(row.theme_color);
    const roomUpdatedAt = Date.parse(row.updated_at || '') || 0;
    const isOldCuackDefault = row.current_track_id === 'demo' && storedThemeColor === LEGACY_LIME_THEME_COLOR && roomUpdatedAt < THEME_BLUE_MIGRATION_CUTOFF;
    const incomingThemeColor = isOldCuackDefault
      ? getTrackThemeColor('demo')
      : (storedThemeColor || getTrackThemeColor(row.current_track_id));
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
      setAudioNote(isHost ? 'En pausa' : 'Esperando al anfitrión', false);
      return;
    }
    if (Number.isFinite(audio.duration) && audio.duration > 0 && target >= audio.duration - 0.15) {
      audio.pause();
      return;
    }
    if (audio.readyState >= 1 && Math.abs(audio.currentTime - target) > 1.8) audio.currentTime = Math.max(0, target);
    if (!audioUnlocked && !isHost && !forcePlay) {
      setAudioNote('Activa el audio', false);
      return;
    }
    try {
      await audio.play();
      setAudioNote('Reproduciendo', false);
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

  async function advanceToNextTrack(options = {}) {
    if (arcadeAdvanceTimeout !== null) { window.clearTimeout(arcadeAdvanceTimeout); arcadeAdvanceTimeout = null; }
    if (arcadeEndSequenceRunning && !options.skipTransition) { toast('Espera a que termine la transición del concierto.'); return; }
    if (!room || !isHost || !room.next_track_id || !TRACKS[room.next_track_id]) {
      if (room && isHost) await publishPlayback('paused', audio.currentTime, null);
      return;
    }
    const nextTrackId = room.next_track_id;
    // Si el tema en cola coincide con el actual, salimos igualmente de la fase de espera
    // y recreamos el minijuego antes de reproducirlo desde el principio.
    if (arcadeWaitingAfterFinish && room.current_track_id === nextTrackId) await resumeArcadeAfterFinish();
    const visualTransition = (!options.skipTransition && room.current_track_id !== nextTrackId && audio.currentSrc)
      ? await startQuickTrackTransition(nextTrackId)
      : null;
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
      if (visualTransition) await finishQuickTrackTransition(visualTransition);
      return;
    }
    audio.currentTime = 0;
    audioUnlocked = true;
    await audio.play();
    await publishPlayback('playing', audio.currentTime, new Date().toISOString());
    if (visualTransition) await finishQuickTrackTransition(visualTransition);
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
    if (isHost && room && activeObjectTrackId === BETTING_TRACK_ID && bettingState?.room_id === room.id) ensureBettingPlayers();
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
    updateTrainHostTools();
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
    // Activa el diseño compacto de una sola pantalla solo durante la reproducción.
    // Al volver a la antesala o salir, se retira la clase y vuelve el diseño normal.
    document.body.classList.toggle('concert-playing', hasRoom && concertHasStarted && !preShow);
    $('preShowView').hidden = !preShow;
    $('nowPlayingSection').hidden = !hasRoom || preShow;
    $('gameSection').hidden = !hasRoom || preShow;
    if (preShow || !hasRoom) stopArcadeAnimation();
    else if (activeArcadeMode) scheduleArcadeAnimation();
    const setupTools = $('playerSetupTools');
    const setupDestination = $('myColorPopoverContent');
    if (setupTools && setupDestination && setupTools.parentElement !== setupDestination) setupDestination.appendChild(setupTools);
    if (!hasRoom) closeMyColorPopover();
    if (preShow) {
      $('preShowMessage').textContent = isHost ? 'Elige canción y pulsa reproducir.' : 'Activa el sonido.';
      if (audioUnlocked) $('preShowAudioStatus').textContent = 'Audio activado';
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
    if (title) title.textContent = game?.title?.replace(/<[^>]*>/g, '') || 'Juego';
    if (description) description.textContent = '';
    if (trackId && TRACKS[trackId] && trackId !== activeObjectTrackId) configureSharedObjectsForTrack(trackId);
    configureArcadeMode(trackId);
    updateBettingTrackVisibility(trackId);
  }

  // MESA DE TODO AL ROJO: solo usa fichas virtuales, nunca dinero real.
  function bettingStorageKey(roomId) { return `la-sala-betting-${roomId}`; }

  function makeEmptyBettingState(roomId) {
    return { room_id: roomId, track_id: BETTING_TRACK_ID, round: 1, balances: {}, bets: {}, result: null, updated_at: Date.now() };
  }

  function normalizeBettingState(value) {
    if (!value || typeof value !== 'object' || value.room_id !== room?.id || value.track_id !== BETTING_TRACK_ID) return null;
    const balances = {};
    Object.entries(value.balances || {}).forEach(([id, balance]) => {
      const n = Number(balance);
      if (id && Number.isFinite(n) && n >= 0) balances[id] = Math.floor(n);
    });
    const bets = {};
    Object.entries(value.bets || {}).forEach(([id, bet]) => {
      const amount = Number(bet?.amount);
      if (id && bet && ['red', 'black'].includes(bet.side) && Number.isFinite(amount) && amount > 0) {
        bets[id] = { user_id: id, display_name: String(bet.display_name || 'Invitado').slice(0, 24), side: bet.side, amount: Math.floor(amount), placed_at: Number(bet.placed_at) || 0 };
      }
    });
    let result = null;
    if (value.result && ['red', 'black'].includes(value.result.side)) {
      result = { side: value.result.side, symbol: value.result.side === 'red' ? '♥' : '♠', title: value.result.side === 'red' ? 'HA SALIDO ROJO' : 'HA SALIDO NEGRO', at: Number(value.result.at) || Date.now() };
    }
    return { room_id: room.id, track_id: BETTING_TRACK_ID, round: Math.max(1, Math.floor(Number(value.round) || 1)), balances, bets, result, updated_at: Number(value.updated_at) || Date.now() };
  }

  function loadBettingState(roomId) {
    try {
      const raw = localStorage.getItem(bettingStorageKey(roomId));
      return raw ? normalizeBettingState(JSON.parse(raw)) : null;
    } catch (_) { return null; }
  }

  function saveBettingState() {
    if (!isHost || !room || !bettingState || bettingState.room_id !== room.id) return;
    bettingState.updated_at = Date.now();
    try { localStorage.setItem(bettingStorageKey(room.id), JSON.stringify(bettingState)); }
    catch (error) { console.warn('No se pudo guardar el estado local de las fichas virtuales.', error); }
  }

  function knownBettingPlayers() {
    const people = new Map();
    [...databasePeople, ...latestPeople].forEach((person) => {
      const id = person?.user_id || person?.key;
      if (id) people.set(id, { user_id: id, display_name: String(person.display_name || 'Invitado').slice(0, 24) });
    });
    if (user?.id) people.set(user.id, { user_id: user.id, display_name: getNameForPresence() });
    return [...people.values()];
  }

  function ensureBettingPlayers() {
    if (!isHost || !room || !bettingState || bettingState.room_id !== room.id) return false;
    let changed = false;
    knownBettingPlayers().forEach((person) => {
      if (!Object.prototype.hasOwnProperty.call(bettingState.balances, person.user_id)) {
        bettingState.balances[person.user_id] = INITIAL_VIRTUAL_CHIPS;
        changed = true;
      }
      const bet = bettingState.bets[person.user_id];
      if (bet && person.display_name && bet.display_name !== person.display_name) {
        bet.display_name = person.display_name;
        changed = true;
      }
    });
    if (changed) {
      saveBettingState();
      renderBettingUI();
      publishBettingState().catch((error) => console.warn('No se pudo sincronizar el saldo virtual.', error));
    }
    return changed;
  }

  function updateBettingTrackVisibility(trackId) {
    const visible = Boolean(room && trackId === BETTING_TRACK_ID);
    const table = $('bettingTableSurface');
    const controls = $('bettingControls');
    if (table) table.hidden = !visible;
    if (controls) controls.hidden = !visible;
    if (!visible) {
      if (bettingTrackId === BETTING_TRACK_ID) renderBettingUI();
      return;
    }
    if (bettingRoomId !== room.id || bettingTrackId !== trackId) {
      bettingRoomId = room.id;
      bettingTrackId = trackId;
      bettingState = isHost ? (loadBettingState(room.id) || makeEmptyBettingState(room.id)) : null;
      if (isHost) {
        ensureBettingPlayers();
        saveBettingState();
        publishBettingState().catch((error) => console.warn('No se pudo inicializar la mesa de apuestas.', error));
      } else {
        renderBettingUI();
        requestBettingState();
      }
    } else if (isHost) {
      ensureBettingPlayers();
    } else if (!bettingState) {
      requestBettingState();
    }
    renderBettingUI();
  }

  async function requestBettingState() {
    if (!room || !roomChannel || isHost || activeObjectTrackId !== BETTING_TRACK_ID) return;
    try {
      await roomChannel.send({ type: 'broadcast', event: 'betting_state_request', payload: { room_id: room.id, requester_user_id: user?.id, sent_at: Date.now() } });
    } catch (error) { console.warn('No se pudo solicitar el estado de las apuestas.', error); }
  }

  async function publishBettingState() {
    if (!room || !roomChannel || !isHost || !bettingState || activeObjectTrackId !== BETTING_TRACK_ID) return;
    saveBettingState();
    const payload = { room_id: room.id, sender_user_id: user?.id, state: JSON.parse(JSON.stringify(bettingState)), sent_at: Date.now() };
    const result = await roomChannel.send({ type: 'broadcast', event: 'betting_state', payload });
    if (result && result !== 'ok') console.warn('Supabase no confirmó la actualización de la mesa de apuestas:', result);
  }

  function receiveBettingState(payload) {
    if (!room || isHost || !payload || payload.room_id !== room.id || payload.sender_user_id !== room.host_user_id || activeObjectTrackId !== BETTING_TRACK_ID) return;
    const normalized = normalizeBettingState(payload.state);
    if (!normalized) return;
    bettingState = normalized;
    bettingRoomId = room.id;
    bettingTrackId = BETTING_TRACK_ID;
    renderBettingUI();
  }

  async function sendBettingNotice(targetUserId, message) {
    if (!room || !roomChannel) return;
    if (targetUserId === user?.id) {
      const status = $('bettingStatus');
      if (status) status.textContent = message;
      toast(message);
      return;
    }
    try { await roomChannel.send({ type: 'broadcast', event: 'betting_notice', payload: { room_id: room.id, target_user_id: targetUserId, message } }); }
    catch (error) { console.warn('No se pudo enviar el aviso de apuestas.', error); }
  }

  async function processBettingAction(payload) {
    if (!room || !isHost || !bettingState || activeObjectTrackId !== BETTING_TRACK_ID || payload?.room_id !== room.id) return;
    const playerId = String(payload.sender_user_id || '');
    if (!playerId) return;
    const known = knownBettingPlayers().some((person) => person.user_id === playerId);
    if (!known) {
      await sendBettingNotice(playerId, 'No te vemos todavía en la lista de la sala. Espera un momento y prueba otra vez.');
      return;
    }
    const action = payload.action;
    if (action !== 'place_bet') return;
    if (bettingState.result) {
      await sendBettingNotice(playerId, 'La carta ya se ha revelado. El anfitrión debe abrir una nueva ronda.');
      return;
    }
    const side = payload.side === 'black' ? 'black' : payload.side === 'red' ? 'red' : '';
    const amount = Number(payload.amount);
    if (!side || ![10, 25, 50].includes(amount)) {
      await sendBettingNotice(playerId, 'Elige rojo o negro y una apuesta válida de 10, 25 o 50 fichas.');
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(bettingState.balances, playerId)) bettingState.balances[playerId] = INITIAL_VIRTUAL_CHIPS;
    const previousBet = bettingState.bets[playerId];
    const spendable = Number(bettingState.balances[playerId] || 0) + Number(previousBet?.amount || 0);
    if (amount > spendable) {
      await sendBettingNotice(playerId, 'No tienes suficientes fichas virtuales para esa apuesta.');
      return;
    }
    const person = knownBettingPlayers().find((candidate) => candidate.user_id === playerId);
    bettingState.balances[playerId] = spendable - amount;
    bettingState.bets[playerId] = { user_id: playerId, display_name: person?.display_name || String(payload.display_name || 'Invitado').slice(0, 24), side, amount, placed_at: Date.now() };
    saveBettingState();
    renderBettingUI();
    await publishBettingState();
    await sendBettingNotice(playerId, `Apuesta aceptada: ${amount} fichas al ${side === 'red' ? 'ROJO' : 'NEGRO'}.`);
  }

  function placeVirtualBet() {
    if (!room || activeObjectTrackId !== BETTING_TRACK_ID) return;
    const payload = { room_id: room.id, sender_user_id: user?.id, display_name: getNameForPresence(), action: 'place_bet', side: bettingSelectedSide, amount: bettingSelectedAmount, sent_at: Date.now() };
    if (isHost) {
      processBettingAction(payload).catch((error) => showError(error));
    } else if (roomChannel) {
      $('bettingStatus').textContent = 'Enviando tu apuesta al anfitrión…';
      roomChannel.send({ type: 'broadcast', event: 'betting_action_request', payload }).catch((error) => {
        $('bettingStatus').textContent = 'No se pudo enviar la apuesta. Comprueba la conexión de la sala.';
        console.warn('No se pudo enviar la apuesta.', error);
      });
    }
  }

  function revealVirtualCard() {
    if (!room || !isHost || activeObjectTrackId !== BETTING_TRACK_ID || !bettingState) return;
    if (!Object.keys(bettingState.bets || {}).length) { toast('Primero alguien debe hacer una apuesta.'); return; }
    if (bettingState.result) return;
    const side = Math.random() < 0.5 ? 'red' : 'black';
    bettingState.result = { side, symbol: side === 'red' ? '♥' : '♠', title: side === 'red' ? 'HA SALIDO ROJO' : 'HA SALIDO NEGRO', at: Date.now() };
    Object.values(bettingState.bets).forEach((bet) => {
      if (bet.side === side) bettingState.balances[bet.user_id] = Math.max(0, Number(bettingState.balances[bet.user_id] || 0) + bet.amount * 2);
    });
    saveBettingState();
    renderBettingUI();
    publishBettingState().catch((error) => console.warn('No se pudo compartir la carta revelada.', error));
  }

  function startNewBettingRound() {
    if (!room || !isHost || activeObjectTrackId !== BETTING_TRACK_ID || !bettingState || !bettingState.result) return;
    bettingState = { ...bettingState, round: bettingState.round + 1, bets: {}, result: null, updated_at: Date.now() };
    saveBettingState();
    renderBettingUI();
    publishBettingState().catch((error) => console.warn('No se pudo iniciar la siguiente ronda.', error));
  }

  function renderBettingUI() {
    const visible = Boolean(room && activeObjectTrackId === BETTING_TRACK_ID);
    if ($('bettingTableSurface')) $('bettingTableSurface').hidden = !visible;
    if ($('bettingControls')) $('bettingControls').hidden = !visible;
    if (!visible) return;
    const state = bettingState && bettingState.room_id === room.id ? bettingState : null;
    const round = state?.round || 1;
    const bets = Object.values(state?.bets || {});
    const pot = bets.reduce((sum, bet) => sum + Number(bet.amount || 0), 0);
    if ($('bettingRoundTable')) $('bettingRoundTable').textContent = `RONDA ${round}`;
    if ($('bettingRoundControl')) $('bettingRoundControl').textContent = `RONDA ${round}`;
    if ($('bettingPotTable')) $('bettingPotTable').textContent = String(pot);
    if ($('bettingBalance')) $('bettingBalance').textContent = String(state?.balances?.[user?.id] ?? INITIAL_VIRTUAL_CHIPS);
    if ($('bettingBalanceNote')) $('bettingBalanceNote').textContent = state ? 'Fichas de juego' : 'Sincronizando…';
    const resultElement = $('bettingTableResult');
    if (resultElement) {
      resultElement.textContent = state?.result ? `${state.result.symbol} ${state.result.title}` : 'LA SUERTE ESTÁ EN JUEGO';
      resultElement.classList.toggle('has-result', Boolean(state?.result));
      resultElement.classList.toggle('result-red', state?.result?.side === 'red');
      resultElement.classList.toggle('result-black', state?.result?.side === 'black');
    }
    const hostControls = $('bettingHostControls');
    if (hostControls) hostControls.hidden = !isHost;
    if ($('revealBetBtn')) $('revealBetBtn').hidden = !isHost || Boolean(state?.result);
    if ($('newBettingRoundBtn')) $('newBettingRoundBtn').hidden = !isHost || !state?.result;
    const placeButton = $('placeBetBtn');
    if (placeButton) {
      placeButton.textContent = `APOSTAR ${bettingSelectedAmount} AL ${bettingSelectedSide === 'red' ? 'ROJO' : 'NEGRO'}`;
      placeButton.disabled = !state || Boolean(state.result) || (Number(state.balances?.[user?.id] ?? INITIAL_VIRTUAL_CHIPS) + Number(state.bets?.[user?.id]?.amount || 0) < bettingSelectedAmount);
    }
    document.querySelectorAll('[data-bet-side]').forEach((button) => button.classList.toggle('is-selected', button.dataset.betSide === bettingSelectedSide));
    document.querySelectorAll('[data-bet-amount]').forEach((button) => button.classList.toggle('is-selected', Number(button.dataset.betAmount) === bettingSelectedAmount));
    const list = $('bettingBetsList');
    if (list) {
      list.replaceChildren();
      if (!bets.length) {
        const empty = document.createElement('p'); empty.className = 'betting-empty'; empty.textContent = 'Todavía no hay apuestas. ¡Sé el primero!'; list.appendChild(empty);
      } else {
        bets.sort((a, b) => Number(b.placed_at || 0) - Number(a.placed_at || 0)).forEach((bet) => {
          const item = document.createElement('div'); item.className = 'betting-bet-row';
          const identity = document.createElement('span'); identity.className = 'betting-bet-player'; identity.textContent = bet.display_name || 'Invitado';
          const side = document.createElement('span'); side.className = `betting-bet-side ${bet.side}`; side.textContent = bet.side === 'red' ? '♥ ROJO' : '♠ NEGRO';
          const amount = document.createElement('strong'); amount.className = 'betting-bet-amount'; amount.textContent = `${bet.amount} fichas`;
          item.append(identity, side, amount);
          if (state?.result) {
            const outcome = document.createElement('span'); outcome.className = bet.side === state.result.side ? 'betting-outcome win' : 'betting-outcome loss'; outcome.textContent = bet.side === state.result.side ? `+${bet.amount * 2}` : `−${bet.amount}`; item.appendChild(outcome);
          }
          list.appendChild(item);
        });
      }
    }
    if ($('bettingStatus') && !state) $('bettingStatus').textContent = 'Esperando a que el anfitrión sincronice la mesa…';
    else if ($('bettingStatus') && state?.result) $('bettingStatus').textContent = state.result.side === 'red' ? 'Ha salido ROJO. Las apuestas ganadoras reciben el doble de su apuesta.' : 'Ha salido NEGRO. Las apuestas ganadoras reciben el doble de su apuesta.';
    else if ($('bettingStatus') && state && !state.result && !$('bettingStatus').textContent.startsWith('Apuesta aceptada:')) $('bettingStatus').textContent = isHost ? 'La mesa está abierta. Revela la carta cuando queráis cerrar la ronda.' : 'Elige rojo o negro y apuesta tus fichas virtuales.';
  }

  function setupBettingControls() {
    document.querySelectorAll('[data-bet-side]').forEach((button) => button.addEventListener('click', () => {
      bettingSelectedSide = button.dataset.betSide === 'black' ? 'black' : 'red';
      renderBettingUI();
    }));
    document.querySelectorAll('[data-bet-amount]').forEach((button) => button.addEventListener('click', () => {
      const amount = Number(button.dataset.betAmount);
      if (![10, 25, 50].includes(amount)) return;
      bettingSelectedAmount = amount;
      renderBettingUI();
    }));
    $('placeBetBtn')?.addEventListener('click', placeVirtualBet);
    $('revealBetBtn')?.addEventListener('click', revealVirtualCard);
    $('newBettingRoundBtn')?.addEventListener('click', startNewBettingRound);
  }

  // Los objetos tienen autoridad única: el anfitrión simula su física y publica posiciones.
  // Cada invitado interpola esas posiciones localmente, así todos ven los mismos objetos.
  function configureSharedObjectsForTrack(trackId) {
    stopSharedObjectAnimation();
    clearSharedObjects();
    activeObjectTrackId = trackId;
    const definitions = TRACKS[trackId]?.game?.objects || [];
    definitions.forEach((definition) => {
      const object = {
        ...definition,
        x: Number(definition.x) || 50,
        y: Number(definition.y) || 50,
        targetX: Number(definition.x) || 50,
        targetY: Number(definition.y) || 50,
        vx: 0,
        vy: 0,
        lastPushedAt: 0
      };
      sharedObjects.set(object.id, object);
    });
    sharedObjectPushCooldowns.clear();
    sharedObjectPreviousFrameAt = 0;
    sharedObjectLastBroadcastAt = 0;
    sharedObjectStateSequence = 0;
    sharedObjectLastReceivedSequence = 0;
    sharedObjectPhysicsActiveUntil = performance.now() + 260;
    renderSharedObjects();
    activateSharedObjectPhysics(260);
    if (isHost && roomChannel) {
      // El envío tras SUBSCRIBED es el respaldo si este primer intento aún es temprano.
      publishSharedObjectsState().catch(() => {});
    }
  }

  function clearSharedObjects() {
    sharedObjects.clear();
    sharedObjectPushCooldowns.clear();
    sharedObjectElements.forEach((element) => element.remove());
    sharedObjectElements.clear();
  }

  function stopSharedObjectAnimation() {
    if (sharedObjectAnimationFrameId !== null) {
      window.cancelAnimationFrame(sharedObjectAnimationFrameId);
      sharedObjectAnimationFrameId = null;
    }
    sharedObjectPreviousFrameAt = 0;
  }

  function activateSharedObjectPhysics(activeForMs = 280) {
    if (!room || !sharedObjects.size) return;
    sharedObjectPhysicsActiveUntil = Math.max(sharedObjectPhysicsActiveUntil, performance.now() + activeForMs);
    scheduleSharedObjectAnimation();
  }

  function scheduleSharedObjectAnimation() {
    if (!room || !sharedObjects.size || sharedObjectAnimationFrameId !== null) return;
    sharedObjectAnimationFrameId = window.requestAnimationFrame(animateSharedObjects);
  }

  function renderSharedObjects() {
    const layer = $('sharedObjectsLayer');
    if (!layer) return;
    for (const object of sharedObjects.values()) {
      let element = sharedObjectElements.get(object.id);
      if (!element) {
        element = document.createElement('div');
        element.className = `pushable-object pushable-${object.kind || 'generic'}`;
        element.setAttribute('role', 'img');
        const glyph = document.createElement('span');
        glyph.className = 'pushable-object-glyph';
        const label = document.createElement('span');
        label.className = 'pushable-object-label';
        element.append(glyph, label);
        sharedObjectElements.set(object.id, element);
      }
      element.querySelector('.pushable-object-glyph').textContent = object.emoji || '✦';
      element.querySelector('.pushable-object-label').textContent = object.label || 'Objeto';
      element.setAttribute('aria-label', `${object.label || 'Objeto'} compartido; empújalo con tu cubo`);
      element.title = `${object.label || 'Objeto'} · empújalo con tu cubo`;
      element.style.setProperty('--object-size', `${Number(object.size) || 42}px`);
      element.style.left = `${object.x}%`;
      element.style.top = `${object.y}%`;
      element.classList.toggle('is-moving', Math.hypot(object.vx || 0, object.vy || 0) > 42 || Math.hypot((object.targetX ?? object.x) - object.x, (object.targetY ?? object.y) - object.y) > 0.18);
      if (element.parentElement !== layer) layer.appendChild(element);
    }
  }

  function receiveSharedObjectsState(payload) {
    if (!room || isHost || !payload || payload.room_id !== room.id || payload.sender_user_id !== room.host_user_id) return;
    if (payload.track_id !== activeObjectTrackId) return;
    const sequence = Number(payload.sequence) || 0;
    if (sequence && sharedObjectLastReceivedSequence && sequence <= sharedObjectLastReceivedSequence) return;
    if (sequence) sharedObjectLastReceivedSequence = sequence;
    if (!Array.isArray(payload.objects)) return;
    let changed = false;
    payload.objects.forEach((remote) => {
      if (!remote || !sharedObjects.has(remote.id)) return;
      const x = Number(remote.x);
      const y = Number(remote.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const object = sharedObjects.get(remote.id);
      object.targetX = Math.max(4, Math.min(96, x));
      object.targetY = Math.max(8, Math.min(90, y));
      changed = true;
    });
    if (changed) scheduleSharedObjectAnimation();
  }

  async function publishSharedObjectsState() {
    if (!room || !roomChannel || !isHost || !sharedObjects.size) return;
    const payload = {
      room_id: room.id,
      track_id: activeObjectTrackId,
      sender_user_id: user?.id,
      sequence: ++sharedObjectStateSequence,
      sent_at: Date.now(),
      objects: [...sharedObjects.values()].map((object) => ({ id: object.id, x: object.x, y: object.y }))
    };
    const result = await roomChannel.send({ type: 'broadcast', event: 'shared_objects_state', payload });
    if (result && result !== 'ok') console.warn('Supabase Realtime no confirmó la posición de los objetos:', result);
  }

  function simulateSharedObjectPhysics(now, deltaSeconds, rect) {
    if (!isHost || !rect?.width || !rect?.height) return false;
    let objectsMoving = false;
    const players = latestPeople.map((person) => ({ id: person.user_id || person.key, person })).filter((entry) => entry.id);
    if (user?.id && !players.some((entry) => entry.id === user.id)) players.push({ id: user.id, person: { user_id: user.id, display_name: getNameForPresence() } });

    for (const object of sharedObjects.values()) {
      // Un jugador empuja el objeto al acercar su cubo. El anfitrión aplica la física una sola vez.
      for (const entry of players) {
        const position = cubePositions.get(entry.id);
        if (!position) continue;
        const dxPx = (object.x - Number(position.x)) * rect.width / 100;
        const dyPx = (object.y - Number(position.y)) * rect.height / 100;
        const distance = Math.hypot(dxPx, dyPx);
        const collisionRadius = (Number(object.size) || 42) * 0.5 + 14;
        if (distance > collisionRadius) continue;
        const cooldownKey = `${object.id}:${entry.id}`;
        const lastPush = sharedObjectPushCooldowns.get(cooldownKey) || 0;
        if (now - lastPush < 190) continue;
        sharedObjectPushCooldowns.set(cooldownKey, now);
        let ux;
        let uy;
        if (distance > 1) {
          ux = dxPx / distance;
          uy = dyPx / distance;
        } else {
          const angle = ((String(entry.id).length * 97 + object.id.length * 31) % 360) * Math.PI / 180;
          ux = Math.cos(angle);
          uy = Math.sin(angle);
        }
        object.vx += ux * SHARED_OBJECT_PUSH_IMPULSE;
        object.vy += uy * SHARED_OBJECT_PUSH_IMPULSE;
        const speed = Math.hypot(object.vx, object.vy);
        if (speed > SHARED_OBJECT_MAX_SPEED) {
          object.vx = object.vx / speed * SHARED_OBJECT_MAX_SPEED;
          object.vy = object.vy / speed * SHARED_OBJECT_MAX_SPEED;
        }
        object.lastPushedAt = now;
        sharedObjectPhysicsActiveUntil = Math.max(sharedObjectPhysicsActiveUntil, now + 850);
        break;
      }

      object.vx *= Math.exp(-SHARED_OBJECT_FRICTION * deltaSeconds);
      object.vy *= Math.exp(-SHARED_OBJECT_FRICTION * deltaSeconds);
      const vx = Math.abs(object.vx) < 3 ? 0 : object.vx;
      const vy = Math.abs(object.vy) < 3 ? 0 : object.vy;
      object.vx = vx;
      object.vy = vy;
      object.x += object.vx * deltaSeconds / rect.width * 100;
      object.y += object.vy * deltaSeconds / rect.height * 100;

      const marginX = Math.min(9, ((Number(object.size) || 42) * 0.55 / rect.width) * 100);
      const marginY = Math.min(14, ((Number(object.size) || 42) * 0.55 / rect.height) * 100);
      if (object.x < marginX) { object.x = marginX; object.vx = Math.abs(object.vx) * 0.56; }
      else if (object.x > 100 - marginX) { object.x = 100 - marginX; object.vx = -Math.abs(object.vx) * 0.56; }
      if (object.y < marginY) { object.y = marginY; object.vy = Math.abs(object.vy) * 0.56; }
      else if (object.y > 100 - marginY) { object.y = 100 - marginY; object.vy = -Math.abs(object.vy) * 0.56; }
      object.targetX = object.x;
      object.targetY = object.y;
      if (Math.hypot(object.vx, object.vy) > 4) objectsMoving = true;
    }
    return objectsMoving;
  }

  function animateSharedObjects(timestamp) {
    sharedObjectAnimationFrameId = null;
    if (!room || !sharedObjects.size) return;
    const previousAt = sharedObjectPreviousFrameAt || timestamp - 16.67;
    const deltaSeconds = Math.max(0.001, Math.min(0.04, (timestamp - previousAt) / 1000));
    sharedObjectPreviousFrameAt = timestamp;
    const arena = $('cubeArena');
    const rect = arena?.getBoundingClientRect();
    let keepAnimating = false;

    if (isHost) {
      const objectsMoving = simulateSharedObjectPhysics(timestamp, deltaSeconds, rect);
      const shouldContinue = objectsMoving || timestamp < sharedObjectPhysicsActiveUntil;
      if (timestamp - sharedObjectLastBroadcastAt >= SHARED_OBJECT_BROADCAST_INTERVAL_MS && (shouldContinue || objectsMoving)) {
        sharedObjectLastBroadcastAt = timestamp;
        publishSharedObjectsState().catch((error) => console.warn('No se pudo sincronizar el movimiento de los objetos.', error));
      }
      keepAnimating = shouldContinue;
    } else {
      const alpha = 1 - Math.exp(-deltaSeconds / 0.075);
      for (const object of sharedObjects.values()) {
        const dx = object.targetX - object.x;
        const dy = object.targetY - object.y;
        if (Math.hypot(dx, dy) > 0.035) {
          object.x += dx * alpha;
          object.y += dy * alpha;
          keepAnimating = true;
        } else {
          object.x = object.targetX;
          object.y = object.targetY;
        }
      }
    }
    renderSharedObjects();
    if (keepAnimating) scheduleSharedObjectAnimation();
  }

  function getArcadePlayerIds() {
    const ids = new Set((latestPeople || []).map((person) => person.user_id || person.key).filter(Boolean));
    if (user?.id) ids.add(user.id);
    return [...ids];
  }

  function arcadeHash(value) {
    let hash = 0;
    for (const char of String(value || '')) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    return Math.abs(hash);
  }

  function constrainArcadePosition(id, x, y) {
    if (activeArcadeMode !== 'volleyball') return { x, y };
    const team = arcadeState?.teams?.[id];
    if (team === 'blue') return { x, y: Math.max(7, Math.min(44, y)) };
    if (team === 'red') return { x, y: Math.max(56, Math.min(93, y)) };
    return { x, y };
  }

  const SPACE_ENEMY_TYPES = {
    scout: { name: 'EXPLORADOR', glyph: '👾', hp: 1, moveSpeed: 88, verticalSpeed: 19, phaseSpeed: 2.7, fireMin: 1900, fireMax: 2700, shotSpeed: 185, fireStyle: 'single' },
    fighter: { name: 'CAZA', glyph: '🛸', hp: 2, moveSpeed: 54, verticalSpeed: 13, phaseSpeed: 1.55, fireMin: 1100, fireMax: 1650, shotSpeed: 245, fireStyle: 'single' },
    tank: { name: 'TANQUE', glyph: '🤖', hp: 4, moveSpeed: 24, verticalSpeed: 5, phaseSpeed: 0.75, fireMin: 1850, fireMax: 2450, shotSpeed: 185, fireStyle: 'spread' },
    sniper: { name: 'FRANCOTIRADOR', glyph: '🚀', hp: 2, moveSpeed: 31, verticalSpeed: 6, phaseSpeed: 0.9, fireMin: 2050, fireMax: 2850, shotSpeed: 365, fireStyle: 'single' }
  };
  const SPACE_ENEMY_SPAWN_POOL = ['scout', 'scout', 'fighter', 'fighter', 'tank', 'sniper'];

  function makeSpaceEnemy(state, now, forcedType = '') {
    const index = ++state.entity_counter;
    const type = forcedType || SPACE_ENEMY_SPAWN_POOL[Math.floor(Math.random() * SPACE_ENEMY_SPAWN_POOL.length)];
    const spec = SPACE_ENEMY_TYPES[type] || SPACE_ENEMY_TYPES.scout;
    return {
      id: `enemy-${index}`, type, name: spec.name, glyph: spec.glyph,
      x: 10 + Math.random() * 80, y: 9 + Math.random() * 25,
      vx: 0, vy: 0, hp: spec.hp, max_hp: spec.hp,
      move_speed_px: spec.moveSpeed, vertical_speed_px: spec.verticalSpeed,
      phase_speed: spec.phaseSpeed, shot_speed: spec.shotSpeed, fire_style: spec.fireStyle,
      fire_min_ms: spec.fireMin, fire_max_ms: spec.fireMax,
      phase: Math.random() * Math.PI * 2,
      next_fire_at: now + 600 + Math.random() * 1100
    };
  }

  function createArcadeState(mode, trackId, waiting = false) {
    const now = Date.now();
    const state = {
      room_id: room?.id,
      track_id: trackId,
      mode,
      waiting: Boolean(waiting),
      sequence: 0,
      started_at: now,
      entity_counter: 0,
      players: {},
      teams: {},
      scores: { blue: 0, red: 0 },
      ball: { id: 'duck-volleyball', x: 50, y: 50, vx: 85, vy: (Math.random() > 0.5 ? 1 : -1) * 135, last_touch_team: null, hit_cooldowns: {} },
      enemies: [],
      player_shots: [],
      enemy_shots: [],
      pickups: [],
      next_enemy_spawn_at: now + 1300,
      train_groups: [],
      train_counter: 0,
      next_train_spawn_at: now + 1600,
      alien: null,
      alien_bottles: [],
      next_alien_burst_at: now + 620,
      reset_ball_at: 0,
      last_point: '¡Que empiece el partido!'
    };
    if (!waiting && mode === 'spaceWar') {
      ['scout', 'fighter', 'tank'].forEach((type) => state.enemies.push(makeSpaceEnemy(state, now, type)));
      state.pickups = [
        { id: 'shield-1', x: 21, y: 55, available_at: now },
        { id: 'shield-2', x: 50, y: 68, available_at: now + 3200 },
        { id: 'shield-3', x: 79, y: 48, available_at: now + 6600 }
      ];
    }
    if (!waiting && mode === 'alienBottle') {
      state.alien = { id: 'immortal-alien', x: 50, y: 13, phase: Math.random() * Math.PI * 2, immortal: true };
    }
    return state;
  }

  function configureArcadeMode(trackId) {
    const nextMode = trackId === 'demo' ? 'volleyball'
      : (trackId === 'spaceWar' ? 'spaceWar'
      : (trackId === 'trainLove' ? 'trainDodger'
      : (trackId === 'dosLesbianas' ? 'alienBottle' : '')));
    if (activeArcadeTrackId === trackId && activeArcadeMode === nextMode) return;
    arcadeWaitingAfterFinish = false;
    $('gameSection')?.classList.remove('is-arcade-waiting');
    stopArcadeAnimation();
    if (arcadeAdvanceTimeout !== null) { window.clearTimeout(arcadeAdvanceTimeout); arcadeAdvanceTimeout = null; }
    clearArcadeEntities();
    activeArcadeTrackId = trackId || '';
    activeArcadeMode = nextMode;
    arcadeState = null;
    arcadeSequence = 0;
    arcadeLastReceivedSequence = 0;
    arcadeLastActionAt.clear();
    const arena = $('cubeArena');
    arena?.classList.toggle('is-space-war', nextMode === 'spaceWar');
    arena?.classList.toggle('is-volleyball', nextMode === 'volleyball');
    arena?.classList.toggle('is-train-dodger', nextMode === 'trainDodger');
    arena?.classList.toggle('is-alien-bottles', nextMode === 'alienBottle');
    $('volleyballCourt').hidden = nextMode !== 'volleyball';
    $('spaceControls').hidden = nextMode !== 'spaceWar';
    $('volleyballControls').hidden = nextMode !== 'volleyball';
    $('trainControls').hidden = nextMode !== 'trainDodger';
    $('alienControls').hidden = nextMode !== 'alienBottle';
    updateTrainHostTools();
    if (nextMode === 'spaceWar') {
      $('gameType').textContent = 'SPACE WAR';
      $('gameTitle').textContent = 'Space War';
      $('gameDescription').textContent = '';
    } else if (nextMode === 'volleyball') {
      $('gameType').textContent = 'CUACK VÓLEY';
      $('gameTitle').textContent = 'Cuack. vóley';
      $('gameDescription').textContent = '';
    } else if (nextMode === 'trainDodger') {
      $('gameType').textContent = 'EL TREN DEL AMOR';
      $('gameTitle').textContent = 'El tren de el amor';
      $('gameDescription').textContent = '';
    } else if (nextMode === 'alienBottle') {
      $('gameType').textContent = 'DOS LESBIANAS';
      $('gameTitle').textContent = 'Dos lesbianas';
      $('gameDescription').textContent = '';
    }
    const hint = $('arenaHint');
    if (hint) hint.innerHTML = nextMode === 'spaceWar'
      ? '<span class="key-cap">ESPACIO</span><span>MOVER · DISPARAR</span>'
      : (nextMode === 'volleyball'
        ? '<span class="key-cap">↑</span><span class="key-cap">←</span><span class="key-cap">↓</span><span class="key-cap">→</span><span>GOLPE AUTOMÁTICO</span>'
        : ((nextMode === 'trainDodger' || nextMode === 'alienBottle')
          ? '<span class="key-cap">W</span><span class="key-cap">A</span><span class="key-cap">S</span><span class="key-cap">D</span><span>MOVER · ESQUIVAR</span>'
          : '<span class="key-cap">W</span><span class="key-cap">A</span><span class="key-cap">S</span><span class="key-cap">D</span><span>MOVER</span>'));

    if (nextMode && room && isHost) {
      arcadeState = createArcadeState(nextMode, trackId);
      syncArcadePlayerRoster();
      renderCubes();
      publishArcadeState().catch((error) => console.warn('No se pudo iniciar el modo arcade.', error));
    } else if (nextMode && room && roomChannel) {
      requestArcadeState();
    }
    updateArcadeHud(Date.now());
    if (!nextMode) {
      clearArcadeEntities();
      renderCubes();
      return;
    }
    scheduleArcadeAnimation();
  }

  function syncArcadePlayerRoster() {
    if (!isHost || !arcadeState || !activeArcadeMode) return false;
    const ids = getArcadePlayerIds();
    const present = new Set(ids);
    let changed = false;
    const now = Date.now();
    ids.forEach((id) => {
      if (!arcadeState.players[id]) {
        arcadeState.players[id] = {
          health: 3, kills: 0, dead_until: 0, invulnerable_until: now + 1500, shield_until: 0,
          score: 0, deaths: 0, finished: false, final_score: null, respawn_count: 0,
          respawn_x: 8 + (arcadeHash(id) % 9), respawn_y: 84, hit_train_ids: []
        };
        changed = true;
      } else if (activeArcadeMode === 'trainDodger') {
        const player = arcadeState.players[id];
        if (!Number.isFinite(Number(player.score))) { player.score = 0; changed = true; }
        if (!Number.isFinite(Number(player.deaths))) { player.deaths = 0; changed = true; }
        if (!Array.isArray(player.hit_train_ids)) { player.hit_train_ids = []; changed = true; }
        if (!Number.isFinite(Number(player.respawn_count))) { player.respawn_count = 0; changed = true; }
      }
      if (activeArcadeMode === 'volleyball' && !arcadeState.teams[id]) {
        const blue = Object.values(arcadeState.teams).filter((team) => team === 'blue').length;
        const red = Object.values(arcadeState.teams).filter((team) => team === 'red').length;
        arcadeState.teams[id] = blue === red ? (arcadeHash(id) % 2 ? 'blue' : 'red') : (blue < red ? 'blue' : 'red');
        changed = true;
      }
    });
    Object.keys(arcadeState.players).forEach((id) => {
      if (!present.has(id)) {
        delete arcadeState.players[id];
        delete arcadeState.teams[id];
        arcadeLastActionAt.delete(id);
        changed = true;
      }
    });
    // Limita a un solo escuadrón de diferencia incluso al entrar el primer invitado.
    if (activeArcadeMode === 'volleyball') {
      const teamIds = ids.filter((id) => arcadeState.teams[id]);
      const blue = teamIds.filter((id) => arcadeState.teams[id] === 'blue').length;
      const red = teamIds.filter((id) => arcadeState.teams[id] === 'red').length;
      if (Math.abs(blue - red) > 1) {
        const larger = blue > red ? 'blue' : 'red';
        const smaller = larger === 'blue' ? 'red' : 'blue';
        const movable = teamIds.filter((id) => arcadeState.teams[id] === larger).sort((a, b) => arcadeHash(b) - arcadeHash(a));
        while (Math.abs(Object.values(arcadeState.teams).filter((team) => team === 'blue').length - Object.values(arcadeState.teams).filter((team) => team === 'red').length) > 1 && movable.length) {
          arcadeState.teams[movable.shift()] = smaller;
          changed = true;
        }
      }
    }
    if (changed && activeArcadeMode === 'volleyball') renderCubes();
    return changed;
  }

  function requestArcadeState() {
    if (!room || !roomChannel || !activeArcadeMode) return;
    if (isHost) {
      publishArcadeState().catch(() => {});
      return;
    }
    roomChannel.send({
      type: 'broadcast', event: 'arcade_state_request',
      payload: { room_id: room.id, track_id: activeArcadeTrackId, requester_user_id: user?.id, sent_at: Date.now() }
    }).catch((error) => console.warn('No se pudo solicitar el estado del minijuego.', error));
  }

  async function publishArcadeState() {
    if (!room || !roomChannel || !isHost || !activeArcadeMode || !arcadeState || arcadeState.track_id !== activeArcadeTrackId) return;
    arcadeState.sequence = ++arcadeSequence;
    const payload = {
      room_id: room.id,
      track_id: activeArcadeTrackId,
      sender_user_id: user?.id,
      sequence: arcadeSequence,
      sent_at: Date.now(),
      state: arcadeState
    };
    const result = await roomChannel.send({ type: 'broadcast', event: 'arcade_state', payload });
    if (result && result !== 'ok') console.warn('Supabase Realtime no confirmó el estado arcade:', result);
  }

  function receiveArcadeState(payload) {
    if (!room || isHost || !payload || payload.room_id !== room.id || payload.sender_user_id !== room.host_user_id) return;
    if (payload.track_id !== activeArcadeTrackId || !activeArcadeMode || !payload.state || payload.state.mode !== activeArcadeMode) return;
    const sequence = Number(payload.sequence) || 0;
    if (sequence && arcadeLastReceivedSequence && sequence <= arcadeLastReceivedSequence) return;
    const oldTeams = JSON.stringify(arcadeState?.teams || {});
    const oldRespawnCount = Number(arcadeState?.players?.[user?.id]?.respawn_count || 0);
    arcadeLastReceivedSequence = sequence;
    arcadeState = payload.state;
    if (activeArcadeMode === 'volleyball' && oldTeams !== JSON.stringify(arcadeState.teams || {})) renderCubes();
    if (activeArcadeMode === 'trainDodger' || activeArcadeMode === 'alienBottle') {
      const ownPlayer = arcadeState?.players?.[user?.id];
      if (ownPlayer && Number(ownPlayer.respawn_count || 0) > oldRespawnCount) {
        setMyCubePosition(Number(ownPlayer.respawn_x) || 50, Number(ownPlayer.respawn_y) || 84);
      }
    }
    $('gameSection')?.classList.toggle('is-arcade-waiting', Boolean(arcadeState.waiting));
    updateArcadeHud(Date.now());
    scheduleArcadeAnimation();
  }

  function clearArcadeCinematicTimers() {
    while (arcadeCinematicTimers.length) window.clearTimeout(arcadeCinematicTimers.pop());
    if (arcadeCinematicFailsafeTimer !== null) {
      window.clearTimeout(arcadeCinematicFailsafeTimer);
      arcadeCinematicFailsafeTimer = null;
    }
  }

  function resetCinematicTransitionCover() {
    const image = $('cinematicTransitionCover');
    if (!image) return;
    image.hidden = true;
    image.style.transition = '';
    image.style.left = '';
    image.style.top = '';
    image.style.width = '';
    image.style.height = '';
    image.style.transform = '';
    image.style.opacity = '';
    image.style.borderRadius = '';
  }

  function setCinematicTransitionCover(trackId) {
    const image = $('cinematicTransitionCover');
    if (!image) return;
    const track = TRACKS[trackId] || TRACKS.demo;
    const path = track.coverPath || 'assets/portada-demo.png';
    if (image.dataset.trackId !== trackId || !image.getAttribute('src')) {
      image.dataset.trackId = trackId;
      image.dataset.fallbackTried = '';
      image.onerror = () => {
        if (!image.dataset.fallbackTried && track.fallbackCoverPath && track.fallbackCoverPath !== path) {
          image.dataset.fallbackTried = '1';
          image.src = track.fallbackCoverPath;
        }
      };
      image.src = path;
    }
    image.alt = `Portada de ${track.title || 'la canción'}`;
  }

  function showCinematicCoverLarge() {
    const image = $('cinematicTransitionCover');
    if (!image) return;
    image.hidden = false;
    const position = () => {
      if (image.hidden) return;
      const naturalWidth = image.naturalWidth || 16;
      const naturalHeight = image.naturalHeight || 9;
      const ratio = naturalWidth / naturalHeight;
      const maxWidth = Math.min(window.innerWidth * 0.84, 1180);
      const maxHeight = window.innerHeight * 0.68;
      const width = Math.max(150, Math.min(maxWidth, maxHeight * ratio));
      const height = width / ratio;
      image.style.transition = 'none';
      image.style.left = '50%';
      image.style.top = '46%';
      image.style.width = `${Math.round(width)}px`;
      image.style.height = `${Math.round(height)}px`;
      image.style.transform = 'translate(-50%, -50%)';
      image.style.opacity = '0';
      image.style.borderRadius = '12px';
      image.getBoundingClientRect();
      requestAnimationFrame(() => { if (!image.hidden) image.style.opacity = '1'; });
    };
    if (image.complete && image.naturalWidth > 0) position();
    else image.addEventListener('load', position, { once: true });
  }

  function settleCinematicCoverToPlayer() {
    const image = $('cinematicTransitionCover');
    const target = $('coverFrame');
    const overlay = $('arcadeCinematicOverlay');
    if (!image || !target || !overlay) return;
    if (!image.complete || !image.naturalWidth) {
      image.addEventListener('load', settleCinematicCoverToPlayer, { once: true });
      return;
    }
    const from = image.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    if (!to.width || !to.height) {
      overlay.classList.add('phase-track-settle');
      image.style.opacity = '0';
      return;
    }
    image.style.transition = 'none';
    image.style.left = `${Math.round(from.left)}px`;
    image.style.top = `${Math.round(from.top)}px`;
    image.style.width = `${Math.round(from.width)}px`;
    image.style.height = `${Math.round(from.height)}px`;
    image.style.transform = 'none';
    image.style.opacity = '1';
    image.getBoundingClientRect();
    requestAnimationFrame(() => {
      image.style.transition = 'left 880ms cubic-bezier(.22,.78,.2,1), top 880ms cubic-bezier(.22,.78,.2,1), width 880ms cubic-bezier(.22,.78,.2,1), height 880ms cubic-bezier(.22,.78,.2,1), border-radius 880ms ease, opacity 250ms ease';
      image.style.left = `${Math.round(to.left)}px`;
      image.style.top = `${Math.round(to.top)}px`;
      image.style.width = `${Math.round(to.width)}px`;
      image.style.height = `${Math.round(to.height)}px`;
      image.style.borderRadius = getComputedStyle(target).borderRadius || '12px';
      overlay.classList.add('phase-track-settle');
    });
  }

  function applyArcadeCinematic(payload) {
    if (!payload || !room || payload.room_id !== room.id) return;
    const incomingStart = Number(payload.started_at || payload.sent_at || Date.now());
    const incomingEventId = String(payload.event_id || '');
    if (!incomingEventId) return;
    if (incomingEventId !== arcadeCinematicEventId) {
      if (arcadeCinematicEventId && incomingStart < arcadeCinematicStartedAt) return;
      arcadeCinematicEventId = incomingEventId;
      arcadeCinematicStartedAt = incomingStart;
      arcadeCinematicPhaseIndex = -1;
    }
    const phaseIndex = Number.isFinite(Number(payload.phase_index)) ? Number(payload.phase_index) : (CINEMATIC_PHASE_ORDER[payload.phase] ?? 0);
    if (phaseIndex <= arcadeCinematicPhaseIndex) return;
    arcadeCinematicPhaseIndex = phaseIndex;

    const gameSection = $('gameSection');
    const gameScene = $('gameScene');
    const overlay = $('arcadeCinematicOverlay');
    if (!gameSection || !gameScene || !overlay) return;
    const sceneClasses = ['is-cinematic-switch', 'is-cinematic-travel', 'is-cinematic-sun', 'is-cinematic-explode', 'is-cinematic-restore'];
    const overlayClasses = ['phase-switch', 'phase-travel', 'phase-sun', 'phase-explode', 'phase-restore', 'phase-track-black', 'phase-track-cover', 'phase-track-settle'];
    gameScene.classList.remove(...sceneClasses);
    overlay.classList.remove(...overlayClasses, 'has-cinematic-alien');
    const phase = String(payload.phase || 'clear');
    const sourceTrackId = String(payload.source_track_id || activeArcadeTrackId || room.current_track_id || '');
    const targetTrackId = String(payload.target_track_id || '');
    const sunPhases = ['travel', 'sun', 'explode', 'restore'];

    // La cinemática del Sol está reservada exclusivamente al final de Dos lesbianas.
    if (sunPhases.includes(phase) && sourceTrackId !== 'dosLesbianas') return;

    const title = $('arcadeCinematicTitle');
    const subtitle = $('arcadeCinematicSubtitle');
    const cover = $('cinematicTransitionCover');
    const trackTransition = phase === 'track-black' || phase === 'track-cover' || phase === 'track-settle';
    if (trackTransition) {
      const targetId = targetTrackId || sourceTrackId || room.current_track_id;
      setCinematicTransitionCover(targetId);
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
      if (phase === 'track-black') {
        overlay.classList.add('phase-track-black');
        if (cover) { cover.hidden = true; cover.style.opacity = '0'; }
        if (title) title.textContent = '';
        if (subtitle) subtitle.textContent = '';
      } else if (phase === 'track-cover') {
        overlay.classList.add('phase-track-cover');
        if (title) title.textContent = TRACKS[targetId]?.title || '';
        if (subtitle) subtitle.textContent = '';
        showCinematicCoverLarge();
      } else {
        overlay.classList.add('phase-track-settle');
        if (title) title.textContent = '';
        if (subtitle) subtitle.textContent = '';
        if (TRACKS[targetId]) updateSongCover(targetId);
        settleCinematicCoverToPlayer();
      }
    } else if (phase === 'switch') {
      gameSection.classList.remove('is-arcade-waiting');
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('phase-switch');
      gameScene.classList.add('is-cinematic-switch');
      if (title) title.textContent = 'SIGUIENTE';
      if (subtitle) subtitle.textContent = '';
    } else if (phase === 'travel') {
      gameSection.classList.remove('is-arcade-waiting');
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('phase-travel', 'has-cinematic-alien');
      gameScene.classList.add('is-cinematic-travel');
      if (title) title.textContent = 'AL SOL';
      if (subtitle) subtitle.textContent = '';
    } else if (phase === 'sun') {
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('phase-sun', 'has-cinematic-alien');
      gameScene.classList.add('is-cinematic-sun');
      if (title) title.textContent = 'SOL';
      if (subtitle) subtitle.textContent = '';
    } else if (phase === 'explode') {
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('phase-explode');
      gameScene.classList.add('is-cinematic-explode');
      if (title) title.textContent = '¡BOOM!';
      if (subtitle) subtitle.textContent = '';
    } else if (phase === 'restore') {
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('phase-restore');
      gameScene.classList.add('is-cinematic-restore');
      gameSection.classList.add('is-arcade-waiting');
      if (title) title.textContent = 'REINICIO';
      if (subtitle) subtitle.textContent = '';
    } else if (phase === 'waiting') {
      gameSection.classList.add('is-arcade-waiting');
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      gameScene.classList.remove(...sceneClasses);
      resetCinematicTransitionCover();
    } else if (phase === 'resume') {
      gameSection.classList.remove('is-arcade-waiting');
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      gameScene.classList.remove(...sceneClasses);
      resetCinematicTransitionCover();
    } else if (phase === 'clear') {
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      gameScene.classList.remove(...sceneClasses);
      overlay.classList.remove(...overlayClasses, 'has-cinematic-alien');
      gameSection.classList.toggle('is-arcade-waiting', Boolean(payload.keep_waiting));
      resetCinematicTransitionCover();
    }

    if (arcadeCinematicFailsafeTimer !== null) window.clearTimeout(arcadeCinematicFailsafeTimer);
    if (phase !== 'clear' && phase !== 'resume') {
      const eventId = incomingEventId;
      arcadeCinematicFailsafeTimer = window.setTimeout(() => {
        if (arcadeCinematicEventId !== eventId) return;
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        gameScene.classList.remove(...sceneClasses);
        overlay.classList.remove(...overlayClasses, 'has-cinematic-alien');
        resetCinematicTransitionCover();
        gameSection.classList.toggle('is-arcade-waiting', Boolean(arcadeState?.waiting));
        arcadeCinematicFailsafeTimer = null;
      }, 12000);
    } else if (arcadeCinematicFailsafeTimer !== null) {
      window.clearTimeout(arcadeCinematicFailsafeTimer);
      arcadeCinematicFailsafeTimer = null;
    }
  }

  async function publishArcadeCinematicPhase(phase, eventId, phaseIndex, options = {}) {
    if (!room || !isHost || !user) return;
    const payload = {
      room_id: room.id,
      sender_user_id: user.id,
      event_id: eventId,
      phase,
      phase_index: phaseIndex,
      started_at: Number(options.startedAt) || Date.now(),
      sent_at: Date.now(),
      source_track_id: options.sourceTrackId || activeArcadeTrackId || room.current_track_id,
      target_track_id: options.targetTrackId || '',
      keep_waiting: Boolean(options.keepWaiting)
    };
    applyArcadeCinematic(payload);
    if (!roomChannel) return;
    const result = await roomChannel.send({ type: 'broadcast', event: 'arcade_cinematic', payload });
    if (result && result !== 'ok') console.warn('Realtime no confirmó la transición del minijuego:', result);
  }

  function receiveArcadeCinematic(payload) {
    if (!room || !payload || payload.room_id !== room.id || payload.sender_user_id !== room.host_user_id) return;
    applyArcadeCinematic(payload);
  }

  function waitForCinematic(ms) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }

  async function startQuickTrackTransition(targetTrackId, options = {}) {
    if (!room || !isHost || arcadeEndSequenceRunning) return null;
    clearArcadeCinematicTimers();
    const eventId = `${room.id}-switch-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const startedAt = Date.now();
    const sourceTrackId = room.current_track_id || activeArcadeTrackId;
    const targetId = TRACKS[targetTrackId] ? targetTrackId : sourceTrackId;
    const keepWaiting = Boolean(options.keepWaiting);
    await publishArcadeCinematicPhase('track-black', eventId, 0, { startedAt, sourceTrackId, targetTrackId: targetId, keepWaiting });
    await waitForCinematic(420);
    if (!room || !isHost || arcadeCinematicEventId !== eventId) return null;
    await publishArcadeCinematicPhase('track-cover', eventId, 1, { startedAt, sourceTrackId, targetTrackId: targetId, keepWaiting });
    await waitForCinematic(1120);
    return { eventId, startedAt, sourceTrackId, targetTrackId: targetId, keepWaiting };
  }

  async function finishQuickTrackTransition(transition) {
    if (!transition || !room || !isHost) return;
    await publishArcadeCinematicPhase('track-settle', transition.eventId, 2, {
      startedAt: transition.startedAt,
      sourceTrackId: transition.sourceTrackId,
      targetTrackId: transition.targetTrackId,
      keepWaiting: Boolean(transition.keepWaiting)
    });
    await waitForCinematic(900);
    if (!room || !isHost || arcadeCinematicEventId !== transition.eventId) return;
    await publishArcadeCinematicPhase('clear', transition.eventId, 3, {
      startedAt: transition.startedAt,
      sourceTrackId: transition.sourceTrackId,
      targetTrackId: transition.targetTrackId,
      keepWaiting: Boolean(transition.keepWaiting)
    });
  }

  async function enterArcadeWaitingState() {
    arcadeWaitingAfterFinish = true;
    const gameSection = $('gameSection');
    if (gameSection) gameSection.classList.add('is-arcade-waiting');
    // Restablece los objetos empujables a su distribución inicial antes de la fase de espera.
    // No mantiene un bucle físico activo mientras la pista está parada.
    if (activeObjectTrackId && TRACKS[activeObjectTrackId]?.game?.objects?.length && isHost) {
      configureSharedObjectsForTrack(activeObjectTrackId);
      stopSharedObjectAnimation();
      sharedObjectPhysicsActiveUntil = 0;
      publishSharedObjectsState().catch(() => {});
    }
    if (activeArcadeMode && room && isHost) {
      arcadeState = createArcadeState(activeArcadeMode, activeArcadeTrackId, true);
      syncArcadePlayerRoster();
      await publishArcadeState();
      updateArcadeHud(Date.now());
    }
  }

  async function resumeArcadeAfterFinish() {
    if (!arcadeWaitingAfterFinish || !room || !isHost) return;
    arcadeWaitingAfterFinish = false;
    const eventId = `${room.id}-resume-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await publishArcadeCinematicPhase('resume', eventId, 0, { sourceTrackId: activeArcadeTrackId, keepWaiting: false });
    if (activeArcadeMode) {
      arcadeState = createArcadeState(activeArcadeMode, activeArcadeTrackId, false);
      syncArcadePlayerRoster();
      renderCubes();
      await publishArcadeState();
    }
  }

  async function startSongEndCinematic() {
    if (!room || !isHost || arcadeEndSequenceRunning) return;
    arcadeEndSequenceRunning = true;
    clearArcadeCinematicTimers();
    const eventId = `${room.id}-end-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const startedAt = Date.now();
    const sourceTrackId = room.current_track_id || activeArcadeTrackId;
    try {
      if (activeArcadeMode === 'volleyball') finishVolleyballMatch();
      if (activeArcadeMode === 'trainDodger' && arcadeState) {
        Object.values(arcadeState.players || {}).forEach((player) => {
          if (player.finished) return;
          player.finished = true;
          player.finished_at = Date.now();
          player.final_score = Math.max(0, Math.round(Number(player.score) || 0));
          player.final_deaths = Math.max(0, Number(player.deaths) || 0);
        });
        updateArcadeHud(Date.now());
        publishArcadeState().catch(() => {});
      }
      try { await publishPlayback('paused', Number.isFinite(audio.currentTime) ? audio.currentTime : 0, null); }
      catch (error) { console.warn('No se pudo pausar el estado al terminar la canción.', error); }

      if (sourceTrackId === 'dosLesbianas') {
        // El viaje al Sol y la explosión son exclusivos del final de Dos lesbianas.
        await publishArcadeCinematicPhase('travel', eventId, 0, { startedAt, sourceTrackId });
        await waitForCinematic(2650);
        if (!room || !isHost) return;
        await publishArcadeCinematicPhase('sun', eventId, 1, { startedAt, sourceTrackId });
        await waitForCinematic(1100);
        if (!room || !isHost) return;
        await publishArcadeCinematicPhase('explode', eventId, 2, { startedAt, sourceTrackId });
        await waitForCinematic(800);
        if (!room || !isHost) return;
        await publishArcadeCinematicPhase('restore', eventId, 3, { startedAt, sourceTrackId, keepWaiting: true });
        await enterArcadeWaitingState();
        await waitForCinematic(1250);
        if (!room || !isHost) return;
        await publishArcadeCinematicPhase('waiting', eventId, 4, { startedAt, sourceTrackId, keepWaiting: true });
        await waitForCinematic(850);
        if (!room || !isHost) return;
        await publishArcadeCinematicPhase('clear', eventId, 5, { startedAt, sourceTrackId, keepWaiting: true });

        const queuedTrack = room.next_track_id && TRACKS[room.next_track_id] ? room.next_track_id : null;
        if (queuedTrack) {
          arcadeWaitingAfterFinish = false;
          arcadeEndSequenceRunning = false;
          await advanceToNextTrack(); // Siempre inicia el fundido a negro y la portada grande del siguiente tema.
        } else {
          if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = 0;
          await publishPlayback('paused', 0, null);
        }
        return;
      }

      // Para todos los demás temas, la pista vuelve a estado de espera sin la cinemática solar.
      await enterArcadeWaitingState();
      const queuedTrack = room.next_track_id && TRACKS[room.next_track_id] ? room.next_track_id : null;
      arcadeEndSequenceRunning = false;
      if (queuedTrack) {
        await advanceToNextTrack();
      } else {
        // Sin canción en cola, reintroduce la portada actual con el mismo fade general.
        const visualTransition = await startQuickTrackTransition(sourceTrackId, { keepWaiting: true });
        if (visualTransition) await finishQuickTrackTransition(visualTransition);
        if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = 0;
        await publishPlayback('paused', 0, null);
      }
    } finally {
      arcadeEndSequenceRunning = false;
      updateRoomPermissions();
    }
  }

  function setupArcadeControls() {
    const finishTrain = $('trainFinishBtn');
    if (finishTrain) finishTrain.addEventListener('click', () => requestArcadeAction('train_finish'));
    const smokeButton = $('trainSmokeBtn');
    if (smokeButton) smokeButton.addEventListener('click', () => throwTrainSmoke());
    const shoot = $('spaceShootBtn');
    if (shoot) {
      shoot.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        try { shoot.setPointerCapture(event.pointerId); } catch (_) {}
        startSpaceFiring('pointer');
      });
      window.addEventListener('pointerup', () => stopSpaceFiring('pointer'));
      window.addEventListener('pointercancel', () => stopSpaceFiring('pointer'));
      shoot.addEventListener('click', (event) => { if (event.detail === 0) requestArcadeAction('space_shoot'); });
    }
    window.addEventListener('keydown', (event) => {
      if (event.code !== 'Space' || activeArcadeMode !== 'spaceWar' || !room) return;
      if (event.target?.closest?.('button, input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      startSpaceFiring('keyboard');
    });
    window.addEventListener('keyup', (event) => { if (event.code === 'Space') stopSpaceFiring('keyboard'); });
    window.addEventListener('blur', () => { stopSpaceFiring('keyboard'); stopSpaceFiring('pointer'); });
  }

  function updateTrainHostTools() {
    // El efecto es una herramienta global del anfitrión, no está ligado a una canción.
    const tools = $('trainHostTools');
    const button = $('trainSmokeBtn');
    const visible = Boolean(room && isHost);
    if (tools) tools.hidden = !visible;
    if (button) button.disabled = !visible || Date.now() < roomSmokeCooldownUntil;
  }

  async function throwTrainSmoke() {
    if (!room || !isHost || !roomChannel || !user || Date.now() < roomSmokeCooldownUntil) return;
    const now = Date.now();
    roomSmokeCooldownUntil = now + 2200;
    const button = $('trainSmokeBtn');
    if (button) button.disabled = true;
    if (roomSmokeCooldownTimer !== null) window.clearTimeout(roomSmokeCooldownTimer);
    roomSmokeCooldownTimer = window.setTimeout(() => {
      roomSmokeCooldownTimer = null;
      updateTrainHostTools();
    }, 2250);

    const payload = {
      room_id: room.id,
      scope: 'room',
      sender_user_id: user.id,
      effect_id: `${now}-${Math.floor(Math.random() * 1e6)}`,
      seed: now,
      sent_at: now
    };
    // El anfitrión ve el efecto de inmediato; el mismo ID evita duplicarlo si recibe su broadcast.
    triggerRoomSmoke(payload);
    try {
      const result = await roomChannel.send({ type: 'broadcast', event: 'train_smoke', payload });
      if (result && result !== 'ok') throw new Error('Realtime no confirmó el efecto de humo.');
      toast('¡Humo ligero enviado a toda la sala!');
    } catch (error) {
      console.warn('No se pudo compartir el humo con todos los invitados.', error);
      toast('El humo apareció localmente, pero Realtime no confirmó el envío a los invitados.');
    }
  }

  function triggerRoomSmoke(payload = {}) {
    const layer = $('roomSmokeLayer');
    if (!layer) return;
    // Si una pestaña está en segundo plano, aplaza el efecto breve para que el jugador
    // pueda verlo al volver; mientras tanto no anima ni consume GPU en esa pestaña.
    if (document.hidden) {
      pendingRoomSmokePayload = payload;
      return;
    }
    const effectId = String(payload.effect_id || `smoke-${Date.now()}`);
    if (layer.dataset.lastEffectId === effectId) return;
    layer.dataset.lastEffectId = effectId;

    // Un único pseudo-elemento CSS reemplaza las múltiples partículas DOM de la versión
    // anterior. Se anima solo transform/opacity y se elimina el efecto al finalizar.
    if (roomSmokeAnimationFrameId !== null) {
      window.cancelAnimationFrame(roomSmokeAnimationFrameId);
      roomSmokeAnimationFrameId = null;
    }
    if (roomSmokeCleanupTimer !== null) {
      window.clearTimeout(roomSmokeCleanupTimer);
      roomSmokeCleanupTimer = null;
    }
    layer.classList.remove('is-active');
    roomSmokeAnimationFrameId = window.requestAnimationFrame(() => {
      roomSmokeAnimationFrameId = null;
      layer.classList.add('is-active');
    });
    roomSmokeCleanupTimer = window.setTimeout(() => {
      layer.classList.remove('is-active');
      roomSmokeCleanupTimer = null;
    }, 1950);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !pendingRoomSmokePayload) return;
    const pending = pendingRoomSmokePayload;
    pendingRoomSmokePayload = null;
    const age = Date.now() - Number(pending.sent_at || 0);
    if (room && pending.room_id === room.id && age >= 0 && age < 4500) triggerRoomSmoke(pending);
  });

  function startSpaceFiring(source) {
    if (activeArcadeMode !== 'spaceWar' || !room || spaceFireSources.has(source)) return;
    spaceFireSources.add(source);
    requestArcadeAction('space_shoot');
    if (spaceShootTimer === null) spaceShootTimer = window.setInterval(() => {
      if (spaceFireSources.size && activeArcadeMode === 'spaceWar' && room) requestArcadeAction('space_shoot');
      else stopSpaceFiring();
    }, 245);
  }

  function stopSpaceFiring(source) {
    if (source) spaceFireSources.delete(source); else spaceFireSources.clear();
    if (!spaceFireSources.size && spaceShootTimer !== null) {
      window.clearInterval(spaceShootTimer);
      spaceShootTimer = null;
    }
  }

  function requestArcadeAction(action) {
    if (!room || !user || !activeArcadeMode || !arcadeState) return;
    const payload = {
      room_id: room.id,
      track_id: activeArcadeTrackId,
      user_id: user.id,
      action,
      sequence: Date.now(),
      sent_at: Date.now()
    };
    if (isHost) processArcadeAction(payload);
    else if (roomChannel) roomChannel.send({ type: 'broadcast', event: 'arcade_action_request', payload })
      .catch((error) => console.warn('No se pudo enviar la acción del minijuego.', error));
  }

  function processArcadeAction(payload) {
    if (!isHost || !room || !arcadeState || payload?.room_id !== room.id || payload?.track_id !== activeArcadeTrackId) return;
    const id = payload.user_id;
    if (!id || !arcadeState.players[id] || !getArcadePlayerIds().includes(id)) return;
    const now = Date.now();
    const previousAction = arcadeLastActionAt.get(id) || 0;
    if (activeArcadeMode === 'trainDodger' && payload.action === 'train_finish') {
      const player = arcadeState.players[id];
      if (player.finished) return;
      player.finished = true;
      player.finished_at = now;
      player.final_score = Math.max(0, Math.round(Number(player.score) || 0));
      player.final_deaths = Math.max(0, Number(player.deaths) || 0);
      player.score = player.final_score;
      if (id === user?.id) toast(`Resultado guardado: ${player.final_score} puntos · ${player.final_deaths} muertes.`);
      updateArcadeHud(now);
      publishArcadeState().catch((error) => console.warn('No se pudo guardar el resultado del tren.', error));
      return;
    }
    if (activeArcadeMode === 'spaceWar' && payload.action === 'space_shoot') {
      if (now - previousAction < SPACE_SHOT_COOLDOWN_MS) return;
      const player = arcadeState.players[id];
      if (Number(player.dead_until || 0) > now) return;
      const position = cubePositions.get(id);
      if (!position) return;
      const rect = $('cubeArena')?.getBoundingClientRect();
      if (!rect?.width || !rect?.height) return;
      const target = arcadeState.enemies.slice().sort((a, b) => arcadeDistancePx(position, a, rect) - arcadeDistancePx(position, b, rect))[0];
      if (!target) return;
      arcadeLastActionAt.set(id, now);
      const dx = (target.x - position.x) * rect.width / 100;
      const dy = (target.y - position.y) * rect.height / 100;
      const length = Math.max(1, Math.hypot(dx, dy));
      arcadeState.player_shots.push({ id: `ps-${++arcadeState.entity_counter}`, x: position.x, y: position.y, vx: dx / length * SPACE_SHOT_SPEED, vy: dy / length * SPACE_SHOT_SPEED, owner_id: id, expires_at: now + 2200 });
      return;
    }
  }

  function getNameForArcadePlayer(id) {
    return latestPeople.find((person) => (person.user_id || person.key) === id)?.display_name || (id === user?.id ? getNameForPresence() : 'Jugador');
  }

  function arcadeDistancePx(a, b, rect) {
    const dx = (Number(a?.x || 0) - Number(b?.x || 0)) * rect.width / 100;
    const dy = (Number(a?.y || 0) - Number(b?.y || 0)) * rect.height / 100;
    return Math.hypot(dx, dy);
  }

  function simulateArcadeStep(timestamp, deltaSeconds, rect) {
    if (!isHost || !room || !arcadeState || arcadeState.waiting || !rect?.width || !rect?.height) return;
    syncArcadePlayerRoster();
    const now = Date.now();
    if (activeArcadeMode === 'spaceWar') simulateSpaceWar(now, deltaSeconds, rect);
    else if (activeArcadeMode === 'volleyball') simulateVolleyball(now, deltaSeconds, rect);
    else if (activeArcadeMode === 'trainDodger') simulateTrainDodger(now, deltaSeconds, rect);
    else if (activeArcadeMode === 'alienBottle') simulateAlienBottles(now, deltaSeconds, rect);
  }

  function simulateSpaceWar(now, dt, rect) {
    const state = arcadeState;
    // Reaparecen con tres vidas y un instante de invulnerabilidad.
    Object.entries(state.players).forEach(([id, player]) => {
      if (player.dead_until && player.dead_until <= now) {
        player.dead_until = 0;
        player.health = 3;
        player.invulnerable_until = now + 1800;
      }
    });

    if (state.enemies.length < 5 && now >= state.next_enemy_spawn_at) {
      state.enemies.push(makeSpaceEnemy(state, now));
      state.next_enemy_spawn_at = now + 1050 + Math.random() * 850;
    }

    const livingIds = Object.keys(state.players).filter((id) => !state.players[id].dead_until || state.players[id].dead_until <= now);
    state.enemies.forEach((enemy) => {
      const spec = SPACE_ENEMY_TYPES[enemy.type] || SPACE_ENEMY_TYPES.scout;
      enemy.phase = Number(enemy.phase || 0) + dt * Number(enemy.phase_speed || spec.phaseSpeed || 1.1);
      enemy.vx = Math.sin(enemy.phase) * Number(enemy.move_speed_px || spec.moveSpeed || 42);
      enemy.vy = Math.cos(enemy.phase * 0.7) * Number(enemy.vertical_speed_px || spec.verticalSpeed || 10);
      enemy.x += enemy.vx * dt / rect.width * 100;
      enemy.y += enemy.vy * dt / rect.height * 100;
      if (enemy.x < 6) { enemy.x = 6; enemy.phase = Math.PI - enemy.phase; }
      if (enemy.x > 94) { enemy.x = 94; enemy.phase = Math.PI - enemy.phase; }
      enemy.y = Math.max(8, Math.min(39, enemy.y));
      if (livingIds.length && now >= Number(enemy.next_fire_at || 0)) {
        const targets = livingIds.map((id) => ({ id, position: cubePositions.get(id) })).filter((entry) => entry.position);
        if (targets.length) {
          const target = targets.sort((a, b) => arcadeDistancePx(a.position, enemy, rect) - arcadeDistancePx(b.position, enemy, rect))[0];
          const dx = (target.position.x - enemy.x) * rect.width / 100;
          const dy = (target.position.y - enemy.y) * rect.height / 100;
          const length = Math.max(1, Math.hypot(dx, dy));
          const ux = dx / length; const uy = dy / length;
          const spreadAngles = enemy.fire_style === 'spread' ? [-0.24, 0, 0.24] : [0];
          spreadAngles.forEach((angle) => {
            const cos = Math.cos(angle); const sin = Math.sin(angle);
            const speed = Number(enemy.shot_speed || spec.shotSpeed || SPACE_ENEMY_SHOT_SPEED);
            state.enemy_shots.push({
              id: `es-${++state.entity_counter}`, x: enemy.x, y: enemy.y,
              vx: (ux * cos - uy * sin) * speed,
              vy: (ux * sin + uy * cos) * speed,
              variant: enemy.type === 'sniper' ? 'sniper' : (enemy.fire_style === 'spread' ? 'heavy' : 'normal'),
              expires_at: now + 3700
            });
          });
        }
        const minFire = Number(enemy.fire_min_ms || spec.fireMin || 1100);
        const maxFire = Number(enemy.fire_max_ms || spec.fireMax || 1800);
        enemy.next_fire_at = now + minFire + Math.random() * Math.max(0, maxFire - minFire);
      }
    });

    state.player_shots = state.player_shots.filter((shot) => {
      shot.x += shot.vx * dt / rect.width * 100;
      shot.y += shot.vy * dt / rect.height * 100;
      if (shot.expires_at < now || shot.x < -2 || shot.x > 102 || shot.y < -2 || shot.y > 102) return false;
      for (let i = 0; i < state.enemies.length; i += 1) {
        const enemy = state.enemies[i];
        if (arcadeDistancePx(shot, enemy, rect) < 22) {
          enemy.hp -= 1;
          if (enemy.hp <= 0) {
            const shooter = state.players[shot.owner_id];
            if (shooter) shooter.kills = Number(shooter.kills || 0) + 1;
            state.enemies.splice(i, 1);
            state.next_enemy_spawn_at = Math.min(state.next_enemy_spawn_at, now + 500);
          }
          return false;
        }
      }
      return true;
    });

    state.enemy_shots = state.enemy_shots.filter((shot) => {
      shot.x += shot.vx * dt / rect.width * 100;
      shot.y += shot.vy * dt / rect.height * 100;
      if (shot.expires_at < now || shot.x < -2 || shot.x > 102 || shot.y < -2 || shot.y > 102) return false;
      for (const [id, player] of Object.entries(state.players)) {
        if (player.dead_until > now || Number(player.invulnerable_until || 0) > now) continue;
        const position = cubePositions.get(id);
        if (!position || arcadeDistancePx(shot, position, rect) > 24) continue;
        if (Number(player.shield_until || 0) > now) {
          // El escudo absorbe el proyectil y dura unos segundos para cubrir varios impactos.
        } else {
          player.health = Math.max(0, Number(player.health || 0) - 1);
          player.invulnerable_until = now + 850;
          if (player.health <= 0) player.dead_until = now + 2800;
        }
        return false;
      }
      return true;
    });

    state.pickups.forEach((pickup) => {
      if (Number(pickup.available_at || 0) > now) return;
      for (const [id, player] of Object.entries(state.players)) {
        if (player.dead_until > now) continue;
        const position = cubePositions.get(id);
        if (position && arcadeDistancePx(position, pickup, rect) < 32) {
          player.shield_until = now + 9000;
          pickup.available_at = now + 8500;
          pickup.last_collected_by = id;
          break;
        }
      }
    });
  }

  function simulateAlienBottles(now, dt, rect) {
    const state = arcadeState;
    if (!state || state.waiting || !state.alien) return;
    const alien = state.alien;
    alien.phase = Number(alien.phase || 0) + dt * 0.72;
    alien.x = 50 + Math.sin(alien.phase) * 31;
    alien.y = 12 + Math.sin(alien.phase * 1.8) * 2.4;

    Object.entries(state.players || {}).forEach(([id, player]) => {
      if (player.dead_until && player.dead_until <= now) {
        player.dead_until = 0;
        player.health = 3;
        player.invulnerable_until = now + 1500;
      }
      if (!player.finished && Number(player.dead_until || 0) <= now) {
        player.score = Math.max(0, Number(player.score || 0) + dt * 8);
      }
    });

    if (now >= Number(state.next_alien_burst_at || 0)) {
      const targets = Object.entries(state.players || {}).filter(([, player]) => !player.finished && Number(player.dead_until || 0) <= now);
      const burstCount = 4 + Math.floor(Math.random() * 2);
      const bottleGlyphs = ['🍾', '🍺', '🍷', '🥃'];
      for (let i = 0; i < burstCount; i += 1) {
        const targetEntry = targets.length ? targets[(i + Math.floor(Math.random() * targets.length)) % targets.length] : null;
        const target = targetEntry ? cubePositions.get(targetEntry[0]) : { x: 12 + Math.random() * 76, y: 72 + Math.random() * 15 };
        if (!target) continue;
        const dx = (target.x - alien.x) * rect.width / 100;
        const dy = Math.max(45, (target.y - alien.y) * rect.height / 100);
        const length = Math.max(1, Math.hypot(dx, dy));
        const spread = (Math.random() - 0.5) * 0.46;
        const cos = Math.cos(spread); const sin = Math.sin(spread);
        const ux = dx / length; const uy = dy / length;
        const speed = 235 + Math.random() * 105;
        state.alien_bottles.push({
          id: `alien-bottle-${++state.entity_counter}`,
          x: alien.x + (Math.random() - 0.5) * 4,
          y: alien.y + 2,
          vx: (ux * cos - uy * sin) * speed,
          vy: (ux * sin + uy * cos) * speed,
          glyph: bottleGlyphs[Math.floor(Math.random() * bottleGlyphs.length)],
          expires_at: now + 3600
        });
      }
      if (state.alien_bottles.length > ALIEN_BOTTLE_CAP) state.alien_bottles.splice(0, state.alien_bottles.length - ALIEN_BOTTLE_CAP);
      state.next_alien_burst_at = now + ALIEN_BOTTLE_BURST_INTERVAL_MS + Math.random() * 170;
    }

    state.alien_bottles = (state.alien_bottles || []).filter((bottle) => {
      bottle.x += Number(bottle.vx || 0) * dt / rect.width * 100;
      bottle.y += Number(bottle.vy || 0) * dt / rect.height * 100;
      if (bottle.expires_at <= now || bottle.x < -4 || bottle.x > 104 || bottle.y < -8 || bottle.y > 110) return false;
      for (const [id, player] of Object.entries(state.players || {})) {
        if (player.finished || Number(player.dead_until || 0) > now || Number(player.invulnerable_until || 0) > now) continue;
        const position = cubePositions.get(id);
        if (!position || arcadeDistancePx(position, bottle, rect) > 23) continue;
        player.health = Math.max(0, Number(player.health ?? 3) - 1);
        player.invulnerable_until = now + 800;
        if (player.health <= 0) {
          player.deaths = Number(player.deaths || 0) + 1;
          player.dead_until = now + 2400;
          player.respawn_count = Number(player.respawn_count || 0) + 1;
          player.respawn_x = 10 + (arcadeHash(id) % 80);
          player.respawn_y = 83;
          player.health = 0;
          if (id === user?.id) setMyCubePosition(player.respawn_x, player.respawn_y);
        }
        return false;
      }
      return true;
    });
  }

  function makeTrainGroup(state, now) {
    const lanes = [15, 30, 45, 60, 75, 86];
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    state.train_counter = Number(state.train_counter || 0) + 1;
    const cars = 3 + Math.floor(Math.random() * 2);
    return {
      id: `train-${state.train_counter}`,
      y: lane,
      lead_x: -14,
      speed_px: 235 + Math.random() * 95,
      car_count: cars,
      born_at: now,
      hit_players: {}
    };
  }

  function simulateTrainDodger(now, dt, rect) {
    const state = arcadeState;
    if (!state || !Array.isArray(state.train_groups)) state.train_groups = [];

    // El tiempo vivo suma puntos; al terminar, cada participante congela su propio resultado.
    Object.values(state.players || {}).forEach((player) => {
      if (player.finished || Number(player.dead_until || 0) > now) return;
      player.score = Math.max(0, Number(player.score || 0) + dt * 12);
    });

    if (now >= Number(state.next_train_spawn_at || 0) && state.train_groups.length < 3) {
      state.train_groups.push(makeTrainGroup(state, now));
      state.next_train_spawn_at = now + 2300 + Math.random() * 950;
    }

    const removeGroups = new Set();
    state.train_groups.forEach((train) => {
      train.lead_x += Number(train.speed_px || 260) * dt / rect.width * 100;
      train.hit_players ||= {};
      for (let carIndex = 0; carIndex < Number(train.car_count || 3); carIndex += 1) {
        const car = { x: train.lead_x - carIndex * 8.6, y: train.y };
        if (car.x < -14 || car.x > 114) continue;
        Object.entries(state.players || {}).forEach(([id, player]) => {
          if (player.finished || Number(player.dead_until || 0) > now || Number(player.invulnerable_until || 0) > now) return;
          if (train.hit_players[id]) return;
          const position = cubePositions.get(id);
          if (!position) return;
          const dx = Math.abs((position.x - car.x) * rect.width / 100);
          const dy = Math.abs((position.y - car.y) * rect.height / 100);
          if (dx > 34 || dy > 30) return;
          train.hit_players[id] = true;
          player.deaths = Number(player.deaths || 0) + 1;
          player.score = Math.max(0, Number(player.score || 0) - 18);
          player.dead_until = now + 850;
          player.invulnerable_until = now + 1550;
          player.respawn_count = Number(player.respawn_count || 0) + 1;
          player.respawn_x = 8 + (arcadeHash(id) % 9);
          player.respawn_y = 84;
          player.last_hit_at = now;
          if (id === user?.id) setMyCubePosition(player.respawn_x, player.respawn_y);
        });
      }
      // Cuando ha pasado el último vagón, premia a quienes evitaron ese tren.
      if (train.lead_x > 112 + Number(train.car_count || 3) * 8.6) {
        Object.entries(state.players || {}).forEach(([id, player]) => {
          if (!player.finished && !train.hit_players[id]) player.score = Number(player.score || 0) + 24;
        });
        removeGroups.add(train.id);
      }
    });
    if (removeGroups.size) state.train_groups = state.train_groups.filter((train) => !removeGroups.has(train.id));
  }

  function finishVolleyballMatch() {
    if (!isHost || activeArcadeMode !== 'volleyball' || !arcadeState || arcadeState.match_finished) return;
    arcadeState.match_finished = true;
    const blue = Number(arcadeState.scores?.blue || 0);
    const red = Number(arcadeState.scores?.red || 0);
    arcadeState.winner = blue === red ? 'EMPATE' : (blue > red ? 'AZUL' : 'ROJO');
    arcadeState.last_point = blue === red ? `FINAL · EMPATE ${blue}–${red}` : `FINAL · GANA EQUIPO ${arcadeState.winner} ${blue}–${red}`;
    arcadeState.ball.vx = 0;
    arcadeState.ball.vy = 0;
    publishArcadeState().catch((error) => console.warn('No se pudo compartir el resultado final del vóley.', error));
    updateArcadeHud(Date.now());
  }

  function simulateVolleyball(now, dt, rect) {
    const state = arcadeState;
    if (state.match_finished) return;
    const ball = state.ball;
    if (!ball) return;
    if (!ball.hit_cooldowns || typeof ball.hit_cooldowns !== 'object') ball.hit_cooldowns = {};
    if (Number(state.reset_ball_at || 0) > 0) {
      if (now >= state.reset_ball_at) {
        state.reset_ball_at = 0;
        ball.x = 50; ball.y = 50;
        ball.vx = (Math.random() * 2 - 1) * 95;
        ball.vy = (Math.random() > 0.5 ? 1 : -1) * 135;
        ball.last_touch_team = null;
        ball.last_touch_player = null;
        ball.hit_cooldowns = {};
      }
      return;
    }
    ball.x += Number(ball.vx || 0) * dt / rect.width * 100;
    ball.y += Number(ball.vy || 0) * dt / rect.height * 100;
    ball.vx *= Math.exp(-0.11 * dt);
    ball.vy *= Math.exp(-0.035 * dt);
    if (ball.x < 5) { ball.x = 5; ball.vx = Math.abs(ball.vx) * 0.88; }
    else if (ball.x > 95) { ball.x = 95; ball.vx = -Math.abs(ball.vx) * 0.88; }
    if (ball.y <= 5) {
      state.scores.red += 1;
      state.last_point = 'PUNTO PARA ROJO';
      ball.x = 50; ball.y = 50; ball.vx = 0; ball.vy = 0;
      state.reset_ball_at = now + 1100;
      return;
    }
    if (ball.y >= 95) {
      state.scores.blue += 1;
      state.last_point = 'PUNTO PARA AZUL';
      ball.x = 50; ball.y = 50; ball.vx = 0; ball.vy = 0;
      state.reset_ball_at = now + 1100;
      return;
    }

    // Golpe automático: el anfitrión calcula el contacto entre el cubo y el pato,
    // así todos reciben el mismo rebote sin tener que pulsar un botón.
    let touchingPlayer = null;
    for (const [id, team] of Object.entries(state.teams || {})) {
      if (!team || !state.players[id]) continue;
      if (Number(ball.hit_cooldowns[id] || 0) > now) continue;
      const position = cubePositions.get(id);
      if (!position) continue;
      const distance = arcadeDistancePx(position, ball, rect);
      if (distance <= VOLLEY_TOUCH_RANGE_PX && (!touchingPlayer || distance < touchingPlayer.distance)) {
        touchingPlayer = { id, team, position, distance };
      }
    }
    if (touchingPlayer) {
      const { id, team, position } = touchingPlayer;
      const dxPx = (ball.x - position.x) * rect.width / 100;
      const offset = Math.max(-1, Math.min(1, dxPx / Math.max(1, rect.width * 0.18)));
      ball.vx = offset * 250 + Number(ball.vx || 0) * 0.12;
      ball.vy = team === 'blue' ? 385 : -385;
      ball.last_touch_team = team;
      ball.last_touch_player = id;
      ball.hit_cooldowns[id] = now + VOLLEY_TOUCH_COOLDOWN_MS;
      state.last_point = `${getNameForArcadePlayer(id)} toca el pato · ¡devuelto!`;
      updateArcadeHud(now);
    }
  }

  function getArcadeDescriptors(now) {
    if (!arcadeState || arcadeState.waiting) return [];
    const descriptors = [];
    if (activeArcadeMode === 'spaceWar') {
      arcadeState.enemies.forEach((enemy) => descriptors.push({ id: enemy.id, kind: 'space-enemy', variant: enemy.type || 'scout', x: enemy.x, y: enemy.y, glyph: enemy.glyph || '👾', label: `${enemy.name || 'ENEMIGO'} · ${enemy.hp}/${enemy.max_hp || enemy.hp} HP` }));
      arcadeState.player_shots.forEach((shot) => descriptors.push({ id: shot.id, kind: 'space-player-shot', x: shot.x, y: shot.y, glyph: '' }));
      arcadeState.enemy_shots.forEach((shot) => descriptors.push({ id: shot.id, kind: 'space-enemy-shot', variant: shot.variant || 'normal', x: shot.x, y: shot.y, glyph: '' }));
      arcadeState.pickups.forEach((pickup) => {
        if (Number(pickup.available_at || 0) <= now) descriptors.push({ id: pickup.id, kind: 'space-shield-pickup', x: pickup.x, y: pickup.y, glyph: '🛡️', label: 'ESCUDO' });
      });
    } else if (activeArcadeMode === 'volleyball' && arcadeState.ball) {
      descriptors.push({ id: 'duck-volleyball', kind: 'volley-ball', x: arcadeState.ball.x, y: arcadeState.ball.y, glyph: '🦆', label: 'PATO' });
    } else if (activeArcadeMode === 'alienBottle') {
      if (arcadeState.alien) descriptors.push({ id: 'immortal-alien', kind: 'alien-boss', x: arcadeState.alien.x, y: arcadeState.alien.y, glyph: '👽', label: 'ALIEN INMORTAL · LANZA BOTELLAS' });
      (arcadeState.alien_bottles || []).forEach((bottle) => descriptors.push({ id: bottle.id, kind: 'alien-bottle', variant: 'alcohol', x: bottle.x, y: bottle.y, glyph: bottle.glyph || '🍾', label: 'BOTELLA VOLADORA' }));
    } else if (activeArcadeMode === 'trainDodger') {
      (arcadeState.train_groups || []).forEach((train) => {
        for (let i = 0; i < Number(train.car_count || 3); i += 1) {
          const x = Number(train.lead_x || 0) - i * 8.6;
          if (x < -18 || x > 118) continue;
          const locomotive = i === 0;
          descriptors.push({
            id: `${train.id}-car-${i}`,
            kind: locomotive ? 'train-locomotive' : 'train-wagon',
            variant: locomotive ? 'engine' : 'car',
            x, y: train.y,
            glyph: locomotive ? '🚂' : '🚃',
            label: ''
          });
        }
      });
    }
    return descriptors;
  }

  function renderArcadeEntities(timestamp, dt) {
    const layer = $('arcadeEntityLayer');
    if (!layer) return;
    const now = Date.now();
    const descriptors = getArcadeDescriptors(now);
    const present = new Set();
    const alpha = isHost ? 1 : (1 - Math.exp(-Math.max(0.001, dt) / 0.055));
    descriptors.forEach((item) => {
      present.add(item.id);
      let visual = arcadeVisuals.get(item.id);
      if (!visual) {
        visual = { x: item.x, y: item.y, targetX: item.x, targetY: item.y, kind: item.kind };
        arcadeVisuals.set(item.id, visual);
      }
      visual.kind = item.kind;
      visual.targetX = item.x;
      visual.targetY = item.y;
      if (isHost) { visual.x = item.x; visual.y = item.y; }
      else {
        visual.x += (visual.targetX - visual.x) * alpha;
        visual.y += (visual.targetY - visual.y) * alpha;
        if (Math.abs(visual.targetX - visual.x) < 0.018) visual.x = visual.targetX;
        if (Math.abs(visual.targetY - visual.y) < 0.018) visual.y = visual.targetY;
      }
      let element = arcadeEntityElements.get(item.id);
      if (!element) {
        element = document.createElement('div');
        const glyph = document.createElement('span'); glyph.className = 'arcade-entity-glyph';
        const label = document.createElement('span'); label.className = 'arcade-entity-label';
        element.append(glyph, label);
        arcadeEntityElements.set(item.id, element);
      }
      element.className = `arcade-entity ${item.kind}${item.variant ? ` ${item.kind}-${item.variant}` : ''}`;
      element.querySelector('.arcade-entity-glyph').textContent = item.glyph || '';
      element.querySelector('.arcade-entity-label').textContent = item.label || '';
      element.style.left = `${visual.x}%`;
      element.style.top = `${visual.y}%`;
      element.setAttribute('aria-label', item.label || item.kind);
      if (element.parentElement !== layer) layer.appendChild(element);
    });
    for (const [id, element] of arcadeEntityElements.entries()) {
      if (!present.has(id)) { element.remove(); arcadeEntityElements.delete(id); arcadeVisuals.delete(id); }
    }
  }

  function updateArcadeHud(now = Date.now()) {
    if (activeArcadeMode === 'spaceWar') {
      const player = arcadeState?.players?.[user?.id];
      const health = Math.max(0, Number(player?.health ?? 3));
      const shield = Number(player?.shield_until || 0) > now;
      const deadMs = Math.max(0, Number(player?.dead_until || 0) - now);
      const status = $('spaceStatus');
      if (status) {
        status.textContent = deadMs > 0
          ? `NAVE DESTRUIDA · REAPARECES EN ${(deadMs / 1000).toFixed(1)} s`
          : `CASCO ${'♥'.repeat(health)}${'♡'.repeat(Math.max(0, 3 - health))} · ${shield ? 'ESCUDO ACTIVO' : 'BUSCA ESCUDOS'} · BAJAS ${Number(player?.kills || 0)}`;
      }
      const board = $('spacePlayersBoard');
      if (board) {
        board.replaceChildren();
        const ids = Object.keys(arcadeState?.players || {}).sort((a, b) => Number(arcadeState.players[b]?.kills || 0) - Number(arcadeState.players[a]?.kills || 0));
        ids.forEach((id) => {
          const data = arcadeState.players[id];
          const row = document.createElement('span'); row.className = 'space-player-pill';
          row.textContent = `${getNameForArcadePlayer(id)} · ${Math.max(0, Number(data.health || 0))} ♥ · ${Number(data.kills || 0)} bajas`;
          board.appendChild(row);
        });
      }
      updateCubeArcadeAppearance(now);
    } else if (activeArcadeMode === 'volleyball') {
      const blueScore = $('volleyBlueScore'); const redScore = $('volleyRedScore');
      if (blueScore) blueScore.textContent = String(arcadeState?.scores?.blue || 0);
      if (redScore) redScore.textContent = String(arcadeState?.scores?.red || 0);
      const ball = arcadeState?.ball;
      const pos = cubePositions.get(user?.id);
      const rect = $('cubeArena')?.getBoundingClientRect();
      const near = Boolean(ball && pos && rect?.width && arcadeDistancePx(pos, ball, rect) <= VOLLEY_TOUCH_RANGE_PX && !(Number(arcadeState?.reset_ball_at || 0) > now));
      const team = arcadeState?.teams?.[user?.id];
      const teamCount = Object.values(arcadeState?.teams || {}).filter((value) => value === team).length;
      const otherCount = Object.values(arcadeState?.teams || {}).filter((value) => value && value !== team).length;
      const status = $('volleyballStatus');
      if (arcadeState?.match_finished) {
        if (status) status.textContent = arcadeState.winner === 'EMPATE'
          ? `FINAL · EMPATE ${arcadeState.scores?.blue || 0}–${arcadeState.scores?.red || 0}`
          : `FINAL · GANA EQUIPO ${arcadeState.winner} ${arcadeState.scores?.blue || 0}–${arcadeState.scores?.red || 0}`;
      } else if (status) status.textContent = team
        ? `EQUIPO ${team === 'blue' ? 'AZUL' : 'ROJO'} · ${teamCount} VS ${otherCount} · ${near ? '¡TOCA EL PATO PARA DEVOLVERLO!' : 'ACÉRCATE Y TOCA EL PATO'}`
        : 'Repartiendo jugadores en equipos…';
      const point = $('volleyPointMessage'); if (point) point.textContent = arcadeState?.last_point || '¡Que empiece el partido!';
      updateCubeArcadeAppearance(now);
    } else if (activeArcadeMode === 'alienBottle') {
      const player = arcadeState?.players?.[user?.id] || { health: 3, score: 0, deaths: 0, dead_until: 0 };
      const deadMs = Math.max(0, Number(player.dead_until || 0) - now);
      const status = $('alienStatus');
      if (status) status.textContent = deadMs > 0
        ? `TE HA ALCANZADO UNA BOTELLA · REAPARECES EN ${(deadMs / 1000).toFixed(1)} s · ALIEN INMORTAL`
        : `CASCO ${'♥'.repeat(Math.max(0, Number(player.health ?? 3)))}${'♡'.repeat(Math.max(0, 3 - Number(player.health ?? 3)))} · ${Math.round(Number(player.score || 0))} PUNTOS · ${Number(player.deaths || 0)} MUERTES · ALIEN INMORTAL`;
      const board = $('alienPlayersBoard');
      if (board) {
        board.replaceChildren();
        Object.keys(arcadeState?.players || {}).sort((a, b) => Number(arcadeState.players[b]?.score || 0) - Number(arcadeState.players[a]?.score || 0)).forEach((id) => {
          const data = arcadeState.players[id];
          const row = document.createElement('span');
          row.className = 'alien-player-pill';
          row.textContent = `${getNameForArcadePlayer(id)} · ${Math.round(Number(data.score || 0))} pts · ${Number(data.deaths || 0)} muertes`;
          board.appendChild(row);
        });
      }
      updateCubeArcadeAppearance(now);
    } else if (activeArcadeMode === 'trainDodger') {
      const player = arcadeState?.players?.[user?.id] || { score: 0, deaths: 0, finished: false };
      const status = $('trainStatus');
      if (status) status.textContent = player.finished
        ? `RESULTADO CERRADO · ${Number(player.final_score ?? player.score ?? 0)} PUNTOS · ${Number(player.final_deaths ?? player.deaths ?? 0)} MUERTES`
        : `PUNTOS ${Math.max(0, Math.round(Number(player.score || 0)))} · MUERTES ${Number(player.deaths || 0)} · ${Number(player.dead_until || 0) > now ? `REAPARECES EN ${((Number(player.dead_until) - now) / 1000).toFixed(1)} s` : 'ESQUIVA LOS VAGONES'}`;
      const finishButton = $('trainFinishBtn');
      if (finishButton) {
        finishButton.disabled = !room || Boolean(player.finished);
        finishButton.textContent = player.finished ? 'RESULTADO GUARDADO ✓' : 'TERMINADO · VER MI SCORE';
      }
      const finalCard = $('trainFinalCard');
      if (finalCard) finalCard.hidden = !player.finished;
      const finalScore = $('trainFinalScore');
      const finalDeaths = $('trainFinalDeaths');
      if (finalScore) finalScore.textContent = String(Math.max(0, Math.round(Number(player.final_score ?? player.score ?? 0))));
      if (finalDeaths) finalDeaths.textContent = String(Number(player.final_deaths ?? player.deaths ?? 0));
      const board = $('trainScoreboard');
      if (board) {
        board.replaceChildren();
        const ids = Object.keys(arcadeState?.players || {}).sort((a, b) => Number(arcadeState.players[b]?.final_score ?? arcadeState.players[b]?.score ?? 0) - Number(arcadeState.players[a]?.final_score ?? arcadeState.players[a]?.score ?? 0));
        ids.forEach((id) => {
          const data = arcadeState.players[id];
          const row = document.createElement('span');
          row.className = `train-player-pill${data.finished ? ' is-finished' : ''}`;
          row.textContent = `${getNameForArcadePlayer(id)} · ${Math.round(Number(data.final_score ?? data.score ?? 0))} pts · ${Number(data.final_deaths ?? data.deaths ?? 0)} muertes${data.finished ? ' · FIN' : ''}`;
          board.appendChild(row);
        });
      }
      updateCubeArcadeAppearance(now);
    }
  }

  function updateCubeArcadeAppearance(now = Date.now()) {
    for (const [id, element] of cubeElements.entries()) {
      const player = arcadeState?.players?.[id];
      element.classList.toggle('is-dead', (activeArcadeMode === 'spaceWar' || activeArcadeMode === 'trainDodger' || activeArcadeMode === 'alienBottle') && Number(player?.dead_until || 0) > now);
      element.classList.toggle('is-shielded', activeArcadeMode === 'spaceWar' && Number(player?.shield_until || 0) > now);
      element.classList.toggle('is-train-finished', activeArcadeMode === 'trainDodger' && Boolean(player?.finished));
      const label = element.querySelector('.cube-name');
      if (label && activeArcadeMode === 'volleyball') {
        const person = latestPeople.find((entry) => (entry.user_id || entry.key) === id);
        const name = person?.display_name || cubePositions.get(id)?.display_name || 'Jugador';
        const team = arcadeState?.teams?.[id];
        label.textContent = `${name}${id === user?.id ? ' · TÚ' : ''}${team ? ` · ${team === 'blue' ? 'AZUL' : 'ROJO'}` : ''}`;
        label.style.color = team === 'blue' ? '#73d0ff' : (team === 'red' ? '#ff777f' : '');
      }
    }
  }

  function scheduleArcadeAnimation() {
    if (!room || !activeArcadeMode || arcadeFrameId !== null || $('gameSection')?.hidden) return;
    arcadeFrameId = window.requestAnimationFrame(animateArcadeFrame);
  }

  function animateArcadeFrame(timestamp) {
    arcadeFrameId = null;
    if (!room || !activeArcadeMode || $('gameSection')?.hidden) return;
    const previous = arcadePreviousFrameAt || timestamp - 16.67;
    const dt = Math.max(0.001, Math.min(0.04, (timestamp - previous) / 1000));
    arcadePreviousFrameAt = timestamp;
    const rect = $('cubeArena')?.getBoundingClientRect();
    if (isHost && arcadeState && rect?.width && rect?.height && !audio.paused && room?.playback_status === 'playing') {
      simulateArcadeStep(timestamp, dt, rect);
      if (timestamp - arcadeLastBroadcastAt >= ARCADE_BROADCAST_INTERVAL_MS) {
        arcadeLastBroadcastAt = timestamp;
        publishArcadeState().catch((error) => console.warn('No se pudo sincronizar el minijuego.', error));
      }
    }
    renderArcadeEntities(timestamp, dt);
    if (Date.now() - arcadeHudUpdatedAt > 140) {
      arcadeHudUpdatedAt = Date.now();
      updateArcadeHud(arcadeHudUpdatedAt);
    }
    arcadeFrameId = window.requestAnimationFrame(animateArcadeFrame);
  }

  function stopArcadeAnimation() {
    if (arcadeFrameId !== null) window.cancelAnimationFrame(arcadeFrameId);
    arcadeFrameId = null;
    arcadePreviousFrameAt = 0;
    stopSpaceFiring();
  }

  function clearArcadeEntities() {
    for (const element of arcadeEntityElements.values()) element.remove();
    arcadeEntityElements.clear();
    arcadeVisuals.clear();
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

    // El ratón/táctil ya no arrastra ni teletransporta el cubo. Un clic (o toque)
    // fija un destino y el cubo recorre la distancia a la misma velocidad que WASD.
    arena.addEventListener('pointerdown', (event) => {
      if (!room) { toast('Entra en una sala para jugar.'); return; }
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target.closest('button, input, select, a')) return;
      const rect = arena.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      event.preventDefault();
      heldCubeKeys.clear();
      arena.focus({ preventScroll: true });
      const targetX = ((event.clientX - rect.left) / rect.width) * 100;
      const targetY = ((event.clientY - rect.top) / rect.height) * 100;
      cubeMoveTarget = constrainArcadePosition(
        user.id,
        Math.max(4, Math.min(96, targetX)),
        Math.max(8, Math.min(90, targetY))
      );
      if (keyboardMovementFrameId === null) {
        keyboardFramePreviousTimestamp = 0;
        keyboardMovementFrameId = window.requestAnimationFrame(animateKeyboardMovement);
      }
    });

    const movementKeys = new Set(['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's']);
    arena.addEventListener('keydown', (event) => {
      if (!room) return;
      if (event.code === 'Space' && activeArcadeMode === 'spaceWar') {
        event.preventDefault();
        startSpaceFiring('keyboard');
        return;
      }
      const key = event.key.toLowerCase();
      if (!movementKeys.has(key)) return;
      event.preventDefault();
      // El teclado toma el control inmediatamente y cancela el destino del clic.
      cubeMoveTarget = null;
      heldCubeKeys.add(key);
      if (keyboardMovementFrameId === null) {
        keyboardFramePreviousTimestamp = 0;
        keyboardMovementFrameId = window.requestAnimationFrame(animateKeyboardMovement);
      }
    });
    window.addEventListener('keyup', (event) => {
      heldCubeKeys.delete(event.key.toLowerCase());
      if (!heldCubeKeys.size && !cubeMoveTarget) stopKeyboardMovement();
      if (event.code === 'Space') stopSpaceFiring('keyboard');
    });
    window.addEventListener('blur', () => {
      heldCubeKeys.clear();
      cubeMoveTarget = null;
      stopKeyboardMovement();
      stopSpaceFiring('keyboard');
      stopSpaceFiring('pointer');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        heldCubeKeys.clear();
        cubeMoveTarget = null;
        stopKeyboardMovement();
      }
    });
  }

  function animateKeyboardMovement(timestamp) {
    keyboardMovementFrameId = null;
    if (!room || (!heldCubeKeys.size && !cubeMoveTarget)) {
      keyboardFramePreviousTimestamp = 0;
      return;
    }
    if (!keyboardFramePreviousTimestamp) keyboardFramePreviousTimestamp = timestamp - (1000 / 60);
    const deltaSeconds = Math.max(0, Math.min(0.05, (timestamp - keyboardFramePreviousTimestamp) / 1000));
    keyboardFramePreviousTimestamp = timestamp;
    const arenaRect = $('cubeArena')?.getBoundingClientRect();
    if (!arenaRect?.width || !arenaRect?.height) {
      keyboardMovementFrameId = window.requestAnimationFrame(animateKeyboardMovement);
      return;
    }

    // La velocidad base se expresa en píxeles por segundo. Antes se sumaban los mismos
    // porcentajes en X e Y: como la pista es ancha y baja, el movimiento vertical parecía
    // mucho más lento. Ahora ambos ejes tienen la misma velocidad física en pantalla.
    const speedPxPerSecond = arenaRect.width * CUBE_KEYBOARD_SPEED / 100;
    let dx = 0;
    let dy = 0;
    if (heldCubeKeys.has('arrowleft') || heldCubeKeys.has('a')) dx -= 1;
    if (heldCubeKeys.has('arrowright') || heldCubeKeys.has('d')) dx += 1;
    if (heldCubeKeys.has('arrowup') || heldCubeKeys.has('w')) dy -= 1;
    if (heldCubeKeys.has('arrowdown') || heldCubeKeys.has('s')) dy += 1;

    if (dx || dy) {
      const length = Math.hypot(dx, dy);
      const stepPx = speedPxPerSecond * deltaSeconds;
      setMyCubePosition(
        myCubePosition.x + (dx / length) * stepPx / arenaRect.width * 100,
        myCubePosition.y + (dy / length) * stepPx / arenaRect.height * 100
      );
    } else if (cubeMoveTarget) {
      const target = constrainArcadePosition(user.id, cubeMoveTarget.x, cubeMoveTarget.y);
      const dxPx = (target.x - myCubePosition.x) * arenaRect.width / 100;
      const dyPx = (target.y - myCubePosition.y) * arenaRect.height / 100;
      const distancePx = Math.hypot(dxPx, dyPx);
      const stepPx = speedPxPerSecond * deltaSeconds;
      if (distancePx <= Math.max(stepPx, 0.75)) {
        setMyCubePosition(target.x, target.y);
        cubeMoveTarget = null;
      } else if (distancePx > 0) {
        setMyCubePosition(
          myCubePosition.x + (dxPx / distancePx) * stepPx / arenaRect.width * 100,
          myCubePosition.y + (dyPx / distancePx) * stepPx / arenaRect.height * 100
        );
      }
    }
    if (heldCubeKeys.size || cubeMoveTarget) keyboardMovementFrameId = window.requestAnimationFrame(animateKeyboardMovement);
    else keyboardFramePreviousTimestamp = 0;
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
    const constrained = constrainArcadePosition(user.id,
      Math.max(4, Math.min(96, Number.isFinite(numericX) ? numericX : 50)),
      Math.max(8, Math.min(90, Number.isFinite(numericY) ? numericY : 50)));
    myCubePosition = { x: constrained.x, y: constrained.y, updated_at: Date.now() };
    cubePositions.set(user.id, { ...myCubePosition, display_name: getNameForPresence() });
    cubeTargets.set(user.id, { x: myCubePosition.x, y: myCubePosition.y });
    renderCubes();
    activateSharedObjectPhysics();

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
    const constrained = constrainArcadePosition(id, Math.max(4, Math.min(96, x)), Math.max(8, Math.min(90, y)));
    const target = { x: constrained.x, y: constrained.y, display_name: payload.display_name || 'Invitado' };

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
    activateSharedObjectPhysics();
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
      const safePosition = constrainArcadePosition(id, position.x, position.y);
      if (Math.abs(safePosition.x - position.x) > 0.001 || Math.abs(safePosition.y - position.y) > 0.001) {
        position.x = safePosition.x; position.y = safePosition.y;
        cubeTargets.set(id, { x: safePosition.x, y: safePosition.y });
        if (id === user?.id) myCubePosition = { ...myCubePosition, x: safePosition.x, y: safePosition.y };
      }
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
      let playerLabel = id === user?.id ? `${person.display_name || 'Tú'} · TÚ` : (person.display_name || position.display_name || 'Invitado');
      const team = activeArcadeMode === 'volleyball' ? arcadeState?.teams?.[id] : null;
      if (team) playerLabel += ` · ${team === 'blue' ? 'AZUL' : 'ROJO'}`;
      label.textContent = playerLabel;
      const arcadePlayer = arcadeState?.players?.[id];
      cube.classList.toggle('is-dead', activeArcadeMode === 'spaceWar' && Number(arcadePlayer?.dead_until || 0) > Date.now());
      cube.classList.toggle('is-shielded', activeArcadeMode === 'spaceWar' && Number(arcadePlayer?.shield_until || 0) > Date.now());
      label.style.color = team ? (team === 'blue' ? '#73d0ff' : '#ff777f') : playerColor;
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
    if (arcadeEndSequenceRunning) { toast('Espera a que termine la transición del concierto.'); return; }
    const trackId = $('trackSelect').value;
    const track = TRACKS[trackId];
    if (!track) return;
    setBusy(true);
    try {
      if (arcadeWaitingAfterFinish && trackId === room.current_track_id) await resumeArcadeAfterFinish();
      const visualTransition = room.current_track_id !== trackId && audio.currentSrc ? await startQuickTrackTransition(trackId) : null;
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
      if (visualTransition) await finishQuickTrackTransition(visualTransition);
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

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

  // Añade aquí cada tema. Sube sus archivos al bucket privado "album-audio" de Supabase.
  const TRACKS = {
    demo: {
      title: 'Demo 01',
      subtitle: 'La primera prueba',
      storagePath: 'demo.mp3',
      game: {
        type: 'REFLEJOS',
        emoji: '✳',
        title: 'Pulsa en <em>el momento justo.</em>',
        description: 'Espera a que aparezca la señal y mide tus reflejos.'
      }
    }
    // Ejemplo para añadir otro tema:
    // tema02: { title: 'Tema 02', subtitle: 'Segundo single', storagePath: 'tema02.mp3', game: { type: 'QUIZ', emoji: '？', title: '¿Te sabes <em>la letra?</em>', description: 'Responde antes que el resto.' } }
  };

  const config = window.LASALA_CONFIG || {};
  const hasConfig = Boolean(
    typeof config.supabaseUrl === 'string' && config.supabaseUrl.startsWith('https://') &&
    !config.supabaseUrl.includes('PEGA_AQUI') &&
    typeof config.supabaseAnonKey === 'string' && config.supabaseAnonKey.length > 20 &&
    !config.supabaseAnonKey.includes('PEGA_AQUI')
  );

  // Visualizador decorativo. Se anima cuando el audio está reproduciéndose.
  const bars = $('bars');
  for (let i = 0; i < 54; i += 1) {
    const bar = document.createElement('span');
    bar.className = 'bar';
    const wave = Math.abs(Math.sin(i * 0.49) * Math.cos(i * 0.16));
    bar.style.setProperty('--h', `${12 + Math.pow(wave, 0.7) * 78}%`);
    bar.style.setProperty('--speed', `${0.28 + (i % 9) * 0.065}s`);
    bar.style.setProperty('--delay', `${(i % 13) * -0.075}s`);
    bars.appendChild(bar);
  }

  // Portada definitiva: si no existe todavía, se muestra una cubierta temporal sobria.
  $('albumCover').addEventListener('load', () => {
    $('albumCover').style.display = 'block';
    $('coverFallback').style.display = 'none';
  });
  $('albumCover').addEventListener('error', () => {
    $('albumCover').style.display = 'none';
    $('coverFallback').style.display = 'flex';
  });

  populateTracks();
  setupPlayer();
  setupRooms();
  setupMiniGame();
  setupInitialRoomLink();
  initializeConnection();

  function populateTracks() {
    const select = $('trackSelect');
    select.replaceChildren();
    Object.entries(TRACKS).forEach(([id, track], index) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = `${track.title} — ${track.subtitle}`;
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
        $('seek').value = String((audio.currentTime / audio.duration) * 100);
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
      if (audio.volume > 0) audio.muted = false;
      $('muteBtn').textContent = audio.muted ? '×' : '◖))';
    });
    $('muteBtn').addEventListener('click', () => {
      audio.muted = !audio.muted;
      $('muteBtn').textContent = audio.muted ? '×' : '◖))';
    });
    audio.volume = 0.8;

    $('enableAudioBtn').addEventListener('click', async () => {
      audioUnlocked = true;
      try {
        if (!audio.currentSrc) {
          toast('El anfitrión todavía no ha cargado una canción.');
          return;
        }
        // Un gesto explícito del invitado permite que el navegador acepte futuras órdenes remotas.
        if (currentRoomRow && currentRoomRow.playback_status === 'playing') {
          await syncAudioFromRoom(currentRoomRow, true);
        } else {
          audio.muted = true;
          await audio.play();
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
          setAudioNote('Audio activado. El anfitrión controla cuándo empieza.', false);
        }
        $('enableAudioBtn').textContent = 'AUDIO ACTIVADO';
        $('enableAudioBtn').disabled = true;
      } catch (error) {
        audio.muted = false;
        setAudioNote('Pulsa de nuevo “Activar audio” para permitir la reproducción.', true);
        showError(error);
      }
    });

    $('playBtn').disabled = true;
    $('restartBtn').disabled = true;
    $('skipBtn').disabled = true;
    $('seek').disabled = true;
  }

  function setupRooms() {
    $('createRoomBtn').addEventListener('click', () => createRoom().catch(showError));
    $('joinForm').addEventListener('submit', (event) => {
      event.preventDefault();
      joinRoom($('roomCodeInput').value).catch(showError);
    });
    $('copyCodeBtn').addEventListener('click', copyInvite);
    $('leaveRoomBtn').addEventListener('click', () => leaveRoom().catch(showError));
    $('trackSelect').addEventListener('change', () => {
      const track = TRACKS[$('trackSelect').value];
      $('queueTitle').textContent = track ? track.title : 'Selecciona un tema';
    });
    $('setNextBtn').addEventListener('click', () => loadSelectedTrack().catch(showError));
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
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    $('connectionLabel').textContent = 'LISTO PARA CONECTAR';
    $('joinHint').textContent = 'Crea una sala o introduce el código que te han enviado.';
    $('hostHint').textContent = 'Crea una sala para activar la mesa de control.';
    disableConnectionButtons(false);
  }

  function disableConnectionButtons(disabled) {
    $('createRoomBtn').disabled = disabled;
    $('joinForm').querySelector('button[type="submit"]').disabled = disabled;
    $('setNextBtn').disabled = true;
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
    room = roomRecord;
    currentRoomRow = roomRecord;
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

    roomChannel = supabaseClient.channel(`room-${room.id}`, { config: { presence: { key: user.id } } });
    roomChannel
      .on('presence', { event: 'sync' }, renderPeople)
      .on('presence', { event: 'join' }, renderPeople)
      .on('presence', { event: 'leave' }, renderPeople)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, (payload) => {
        applyRoomState(payload.new).catch(showError);
      })
      .subscribe(async (status, error) => {
        if (status === 'SUBSCRIBED') {
          try {
            await roomChannel.track({
              user_id: user.id,
              display_name: getNameForPresence(),
              is_host: isHost,
              online_at: new Date().toISOString()
            });
            $('roomLiveText').textContent = 'SALA EN DIRECTO';
            $('connectionLabel').textContent = 'SALA CONECTADA';
            $('hostHint').textContent = isHost ? 'Elige el próximo tema. El cambio se hará al terminar la canción actual.' : 'Solo el anfitrión decide el próximo tema y controla la reproducción.';
          } catch (trackError) { showError(trackError); }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          $('roomLiveText').textContent = 'ERROR DE CONEXIÓN';
          if (error) console.error('Error de Supabase Realtime:', error);
        }
      });

    await applyRoomState(roomRecord, true);
    updateRoomPermissions();
  }

  function getNameForPresence() {
    return $('displayNameInput').value.trim().replace(/\s+/g, ' ').slice(0, 24) || 'Invitado';
  }

  async function applyRoomState(row, force = false) {
    if (!row || !room || row.id !== room.id) return;
    const stateRevision = ++roomStateApplicationRevision;
    const previousTrackId = room.current_track_id;
    room = { ...room, ...row };
    currentRoomRow = row;
    $('playbackStatus').textContent = row.playback_status === 'playing' ? 'EN DIRECTO' : 'EN PAUSA';
    $('trackTitle').textContent = TRACKS[row.current_track_id]?.title || 'Tema no disponible';
    $('trackSubtitle').textContent = TRACKS[row.current_track_id]?.subtitle || 'Añade este tema al catálogo';
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
    $('playbackStatus').textContent = status === 'playing' ? 'EN DIRECTO' : 'EN PAUSA';
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
      playback_status: 'paused',
      position_seconds: 0,
      playback_started_at: null,
      updated_by_user_id: user.id,
      updated_at: new Date().toISOString()
    }).eq('id', room.id).select().single();
    if (error) throw error;
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
    const unique = [...new Map(entries.map((item) => [item.user_id || item.key, item])).values()];
    unique.sort((a, b) => Number(Boolean(b.is_host)) - Number(Boolean(a.is_host)) || String(a.display_name || '').localeCompare(String(b.display_name || ''), 'es'));
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
      tag.textContent = person.is_host ? 'HOST' : (person.user_id === user?.id ? 'TÚ' : '');
      row.append(avatar, name, tag);
      list.appendChild(row);
    });
    $('peopleCount').textContent = `${unique.length} ${unique.length === 1 ? 'CONECTADO' : 'CONECTADOS'}`;
  }

  function updateRoomPermissions() {
    const hasRoom = Boolean(room);
    $('roomState').textContent = !hasRoom ? 'SIN SALA' : (isHost ? 'ANFITRIÓN' : 'INVITADO');
    $('hostBadge').textContent = isHost ? 'TÚ ERES EL HOST' : (hasRoom ? 'SOLO ANFITRIÓN' : 'SOLO ANFITRIÓN');
    $('hostSubtext').textContent = isHost ? 'Tú decides qué suena.' : (hasRoom ? 'El anfitrión controla la música.' : 'Elige el siguiente tema.');
    $('createRoomBtn').disabled = !supabaseClient || hasRoom;
    $('joinForm').querySelector('button[type="submit"]').disabled = !supabaseClient || hasRoom;
    $('setNextBtn').disabled = !hasRoom || !isHost;
    $('trackSelect').disabled = !hasRoom || !isHost;
    $('playBtn').disabled = !hasRoom || !isHost;
    $('restartBtn').disabled = !hasRoom || !isHost;
    $('skipBtn').disabled = !hasRoom || !isHost || !room.next_track_id;
    $('seek').disabled = !hasRoom || !isHost;
    $('enableAudioBtn').hidden = !hasRoom || isHost;
    if (!hasRoom) $('playbackStatus').textContent = 'EN ESPERA';
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
    setBusy(true);
    try {
      const { error } = await supabaseClient.rpc('leave_room', { p_room_id: room.id });
      if (error) throw error;
      await disposeChannel();
      room = null;
      currentRoomRow = null;
      isHost = false;
      audioUnlocked = false;
      loadedTrackId = '';
      signedUrlExpiresAt = 0;
      trackLoadToken += 1;
      roomStateApplicationRevision += 1;
      loadingTrackPromises.clear();
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      $('activeRoomView').hidden = true;
      $('noRoomView').hidden = false;
      $('roomState').textContent = 'SIN SALA';
      $('connectionLabel').textContent = 'LISTO PARA CONECTAR';
      $('roomCodeInput').value = '';
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      history.replaceState({}, '', url);
      setAudioNote('Entra en una sala para escuchar.', false);
      $('trackTitle').textContent = 'Demo 01';
      $('trackSubtitle').textContent = 'La primera prueba';
      $('queueTitle').textContent = 'Sin siguiente tema';
      updateRoomPermissions();
      toast('Has salido de la sala.');
    } finally { setBusy(false); }
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
  }

  function setRoomHint(message) { $('joinHint').textContent = message; }

  function setBusy(busy) {
    $('createRoomBtn').disabled = busy || !supabaseClient || Boolean(room);
    $('joinForm').querySelector('button[type="submit"]').disabled = busy || !supabaseClient || Boolean(room);
    if (!room || !isHost) $('setNextBtn').disabled = true;
    else $('setNextBtn').disabled = busy;
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
    if (!game) return;
    $('gameType').textContent = game.type;
    $('gameEmoji').textContent = game.emoji;
    $('gameTitle').innerHTML = game.title;
    $('gameDescription').textContent = game.description;
    $('gameResult').textContent = '';
    $('gameActionBtn').disabled = false;
    $('gameActionBtn').textContent = 'EMPEZAR ↗';
    gameMode = 'ready';
  }

  function setupMiniGame() {
    $('gameActionBtn').addEventListener('click', () => {
      const button = $('gameActionBtn');
      const result = $('gameResult');
      if (gameMode === 'waiting') return;
      if (gameMode === 'signal') {
        const reaction = Math.max(0, Math.round(performance.now() - signalAt));
        result.textContent = `${reaction} ms · ${reaction < 250 ? 'REFLEJOS DE LEYENDA' : reaction < 420 ? 'NADA MAL' : 'EL BEAT TE HA GANADO'}`;
        button.textContent = 'OTRA RONDA ↗';
        gameMode = 'finished';
        return;
      }
      gameMode = 'waiting';
      button.disabled = true;
      button.textContent = 'ESPERA A LA SEÑAL…';
      result.textContent = 'PREPARADOS…';
      window.setTimeout(() => {
        gameMode = 'signal';
        signalAt = performance.now();
        result.textContent = '¡AHORA!';
        button.textContent = '¡PULSA!';
        button.disabled = false;
        $('mainGame').classList.add('flash');
        window.setTimeout(() => $('mainGame').classList.remove('flash'), 380);
      }, 1100 + Math.random() * 2300);
    });
  }

  // Corrige desfases leves de los invitados a partir del reloj compartido por la sala.
  window.setInterval(() => {
    if (!room || isHost || !currentRoomRow || currentRoomRow.playback_status !== 'playing' || !audioUnlocked || !audio.currentSrc || audio.paused || !Number.isFinite(audio.duration)) return;
    const target = targetPosition(currentRoomRow);
    if (target < audio.duration - 0.2 && Math.abs(audio.currentTime - target) > 2) audio.currentTime = target;
  }, 3000);
})();

(function () {
    'use strict';

    // bump when the consent text changes, so everyone is asked again
    const CONSENT_VERSION = 'v2';
    const SKIP_TOLERANCE = 3; // seconds
    const SAVE_INTERVAL = 2000;

    const $ = function (id) {
        return document.getElementById(id);
    };

    // ---------- storage ----------

    function load(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallback : JSON.parse(value);
        } catch (e) {
            return fallback;
        }
    }

    function store(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            // storage full or blocked: keep working in memory
        }
    }

    // Every save file lives in one array. Re-read before writing, so several open tabs
    // don't overwrite each other's progress.
    function getShelf() {
        const shelf = load('shelf', []);
        return Array.isArray(shelf) ? shelf : [];
    }

    function findSlot(id) {
        return getShelf().find(function (slot) {
            return slot.id === id;
        }) || null;
    }

    function saveSlot(slot) {
        const shelf = getShelf().filter(function (s) {
            return s.id !== slot.id;
        });
        shelf.push(slot);
        store('shelf', shelf);
    }

    function removeSlot(id) {
        store('shelf', getShelf().filter(function (s) {
            return s.id !== id;
        }));
    }

    // Before the shelf existed, one video was stored in three separate keys.
    function migrateOldStorage() {
        const src = localStorage.getItem('videoSrc');
        if (src === null) return;
        const parsed = parseYouTubeUrl(src);
        if (parsed && !findSlot(slotIdFor(parsed))) {
            const slot = newSlot(parsed, src);
            slot.time = parseFloat(localStorage.getItem('currentTime')) || 0;
            slot.videoId = localStorage.getItem('currentVideoId') || parsed.videoId;
            saveSlot(slot);
            store('activeSlot', slot.id);
        }
        ['videoSrc', 'currentTime', 'currentVideoId'].forEach(function (key) {
            localStorage.removeItem(key);
        });
    }

    // ---------- URL parsing ----------

    // Returns {videoId, playlistId} (one of them may be null), or null if the input
    // contains neither. Accepts watch, youtu.be, shorts, live, embed and playlist URLs,
    // with or without https://, and bare video IDs.
    function parseYouTubeUrl(input) {
        const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
        // at least 10 characters: excludes private lists like WL (watch later) and LL (liked)
        const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,}$/;

        input = input.trim();
        if (VIDEO_ID.test(input)) {
            return {videoId: input, playlistId: null};
        }

        let url;
        try {
            url = new URL(/^https?:\/\//i.test(input) ? input : 'https://' + input);
        } catch (e) {
            return null;
        }
        const host = url.hostname.replace(/^(www|m|music)\./, '');
        const path = url.pathname.split('/').filter(Boolean);

        let videoId = null;
        if (host === 'youtu.be') {
            videoId = path[0];
        } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
            if (path[0] === 'watch') {
                videoId = url.searchParams.get('v');
            } else if (['shorts', 'live', 'embed', 'v'].includes(path[0]) && path[1] !== 'videoseries') {
                videoId = path[1];
            }
        } else {
            return null;
        }
        let list = url.searchParams.get('list');

        videoId = VIDEO_ID.test(videoId || '') ? videoId : null;
        list = PLAYLIST_ID.test(list || '') ? list : null;
        return videoId || list ? {videoId: videoId, playlistId: list} : null;
    }

    // One save file per playlist or video: opening the same link again resumes it.
    function slotIdFor(parsed) {
        return parsed.playlistId ? 'list:' + parsed.playlistId : 'video:' + parsed.videoId;
    }

    function newSlot(parsed, src) {
        return {
            id: slotIdFor(parsed),
            src: src,
            playlistId: parsed.playlistId,
            videoId: parsed.videoId, // for a playlist: the episode we're on
            time: 0,
            title: '',
            channel: '',
            episode: null,
            episodes: null,
            view: 'watch',
            updated: Date.now()
        };
    }

    // ---------- formatting ----------

    function formatTime(seconds) {
        seconds = Math.max(0, Math.floor(seconds || 0));
        const h = Math.floor(seconds / 3600);
        const m = Math.floor(seconds / 60) % 60;
        const s = seconds % 60;
        return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function formatDuration(seconds) {
        const minutes = Math.floor((seconds || 0) / 60);
        const hours = Math.floor(minutes / 60);
        return (hours ? hours + ' h ' : '') + (minutes % 60) + ' min';
    }

    function formatWhen(timestamp) {
        const day = 24 * 60 * 60 * 1000;
        const startOfToday = new Date().setHours(0, 0, 0, 0);
        if (timestamp >= startOfToday) return 'today';
        if (timestamp >= startOfToday - day) return 'yesterday';
        const days = Math.ceil((startOfToday - timestamp) / day);
        if (days < 14) return days + ' days ago';
        return new Date(timestamp).toLocaleDateString();
    }

    function slotTitle(slot) {
        return slot.title || slot.channel || slot.src;
    }

    function episodeText(slot) {
        if (slot.playlistId && slot.episode && slot.episodes) {
            return 'Episode ' + slot.episode + ' of ' + slot.episodes;
        }
        return slot.playlistId ? 'Playlist' : '';
    }

    // ---------- notices ----------

    let noticeTimer = null;
    let noticeAction = null;

    function showNotice(text, options) {
        options = options || {};
        $('notice-text').textContent = text;
        if (options.time !== undefined) {
            const time = document.createElement('span');
            time.className = 'notice-time';
            time.textContent = formatTime(options.time);
            $('notice-text').append(' ', time, '.');
        }
        $('notice').dataset.tone = options.tone || 'info';
        noticeAction = options.action || null;
        $('notice-action').hidden = !noticeAction;
        if (noticeAction) $('notice-action').textContent = noticeAction.label;
        $('notice').hidden = false;
        clearTimeout(noticeTimer);
        if (options.tone !== 'error') {
            noticeTimer = setTimeout(hideNotice, options.action ? 10000 : 6000);
        }
    }

    function hideNotice() {
        clearTimeout(noticeTimer);
        noticeAction = null;
        $('notice').hidden = true;
    }

    // ---------- state ----------

    let consented = document.cookie.indexOf('consent=' + CONSENT_VERSION) >= 0;
    let activeId = null;
    let youtubeLoading = false;
    let youtubeReady = false;
    let player = null;
    let playerReady = false;
    let interval = null;
    let autoplay = false;
    let started = false; // has this save file played since it was opened?

    // Skip protection: where the video should be, based on the real time
    // that passed while playing and the playback speed.
    let trackedTime = 0;
    let trackedSince = null; // performance.now() of the last update, null while not playing
    let trackedRate = 1;
    let trackedDuration = Infinity;

    // Playlists: which video we're on, so a manual jump to another video can be undone
    let trackedVideoId = null;
    let videoEnded = false;
    let restoring = false;
    let skipTarget = null; // what the last undone jump wanted, for "Keep new position"

    function activeSlot() {
        return activeId ? findSlot(activeId) : null;
    }

    function skipProtectionOn() {
        return $('skip-toggle').checked;
    }

    // ---------- rendering ----------

    function render() {
        const shelf = getShelf();
        const slot = activeSlot();

        $('consent').hidden = consented;
        $('withdraw-consent-button').hidden = !consented;
        $('player-frame').hidden = !consented || !slot;
        $('player-empty').hidden = !consented || !!slot || shelf.length === 0;

        const empty = shelf.length === 0;
        $('add-intro').hidden = !empty;
        if (empty) setAddPanel(true);

        renderNow(slot);
        renderShelf(shelf);
        renderTimePlayed();
    }

    function renderNow(slot) {
        $('slot-now').hidden = !slot;
        if (!slot) return;
        $('now-title').textContent = slotTitle(slot);
        $('now-meta').textContent = [slot.channel, episodeText(slot)].filter(Boolean).join(' · ');
        $('now-time').textContent = formatTime(slot.time);
        $('view-' + (slot.view === 'listen' ? 'listen' : 'watch')).checked = true;
        setView(slot.view);
    }

    function setView(view) {
        view = view === 'listen' ? 'listen' : 'watch';
        $('player-frame').dataset.view = view;
        document.querySelector('.stage').dataset.view = view;
    }

    function renderShelf(shelf) {
        const list = $('slots');
        list.textContent = '';
        shelf.slice().sort(function (a, b) {
            return b.updated - a.updated;
        }).forEach(function (slot) {
            list.appendChild(slotRow(slot));
        });
        if (shelf.length === 0) list.appendChild(emptySlotRow());
    }

    function slotRow(slot) {
        const item = document.createElement('li');
        item.className = 'slot';
        item.dataset.id = slot.id;
        if (slot.id === activeId) item.setAttribute('aria-current', 'true');

        const cursor = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        cursor.setAttribute('class', 'cursor');
        cursor.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#i-cursor');
        cursor.appendChild(use);

        const main = document.createElement('button');
        main.type = 'button';
        main.className = 'slot-main';
        const title = document.createElement('span');
        title.className = 'slot-title';
        title.textContent = slotTitle(slot);
        const meta = document.createElement('span');
        meta.className = 'slot-meta';
        const time = document.createElement('span');
        time.className = 'slot-time';
        time.textContent = formatTime(slot.time);
        const episode = document.createElement('span');
        episode.className = 'slot-episode';
        episode.textContent = episodeText(slot);
        episode.hidden = !episode.textContent;
        const when = document.createElement('span');
        when.textContent = formatWhen(slot.updated);
        meta.append(time, episode, when);
        main.append(title, meta);
        main.setAttribute('aria-label', 'Continue ' + slotTitle(slot) + ', ' + episodeText(slot) + ', at ' + formatTime(slot.time));
        main.addEventListener('click', function () {
            activate(slot.id, true);
        });

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn btn-icon slot-remove';
        remove.setAttribute('aria-label', 'Remove ' + slotTitle(slot));
        remove.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-close"/></svg>';
        remove.addEventListener('click', function () {
            removeSave(slot.id);
        });

        item.append(cursor, main, remove);
        return item;
    }

    function emptySlotRow() {
        const item = document.createElement('li');
        item.className = 'slot slot-empty';
        item.innerHTML = '<svg class="cursor" aria-hidden="true"><use href="#i-cursor"/></svg>' +
            '<button type="button" class="slot-main"><span class="slot-title">Empty</span>' +
            '<span class="slot-meta">Paste a YouTube link to start a save file.</span></button>';
        item.querySelector('button').addEventListener('click', function () {
            setAddPanel(true);
            $('video-url').focus();
        });
        return item;
    }

    // Cheap update every save: only the numbers, so focus inside the shelf is never lost.
    function renderProgress(slot) {
        $('now-time').textContent = formatTime(slot.time);
        $('now-meta').textContent = [slot.channel, episodeText(slot)].filter(Boolean).join(' · ');
        $('now-title').textContent = slotTitle(slot);
        const row = document.querySelector('.slot[data-id="' + CSS.escape(slot.id) + '"]');
        if (row) {
            row.querySelector('.slot-time').textContent = formatTime(slot.time);
            row.querySelector('.slot-title').textContent = slotTitle(slot);
            const episode = row.querySelector('.slot-episode');
            episode.textContent = episodeText(slot);
            episode.hidden = !episode.textContent;
        }
    }

    function renderTimePlayed() {
        const total = parseFloat(localStorage.getItem('totalPlaytime')) || 0;
        const out = $('time-played');
        out.textContent = 'Time played ';
        const value = document.createElement('strong');
        value.textContent = formatDuration(total);
        out.appendChild(value);
    }

    // Before playback starts on a saved position, the button says "Continue"
    function setPlayToggle(playing) {
        const button = $('play-toggle');
        const slot = activeSlot();
        const resume = !playing && !started && !!slot && slot.time > 5;
        button.classList.toggle('is-continue', resume);
        $('play-label').hidden = !resume;
        button.setAttribute('aria-label', playing ? 'Pause' : resume ? 'Continue at ' + formatTime(slot.time) : 'Play');
        button.querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play');
    }

    function setAddPanel(open) {
        $('add-panel').hidden = !open;
        $('add-toggle').setAttribute('aria-expanded', String(open));
    }

    // ---------- shelf actions ----------

    function openLink(input) {
        const parsed = parseYouTubeUrl(input);
        const field = $('video-url');
        if (!parsed) {
            field.setAttribute('aria-invalid', 'true');
            $('video-url-error').textContent = 'That doesn\'t look like a YouTube video or playlist link. Try copying it again from the address bar or the share button.';
            $('video-url-error').hidden = false;
            field.focus();
            return;
        }
        field.removeAttribute('aria-invalid');
        $('video-url-error').hidden = true;
        field.value = '';

        const existing = findSlot(slotIdFor(parsed));
        if (existing) {
            setAddPanel(false);
            activate(existing.id, true);
            showNotice('Already in your save files. Continuing at', {time: existing.time});
            return;
        }
        saveSlot(newSlot(parsed, input.trim()));
        setAddPanel(false);
        activate(slotIdFor(parsed), true);
    }

    function activate(id, userAction) {
        const slot = findSlot(id);
        if (!slot) return;
        if (id === activeId && player) {
            if (userAction && playerReady) player.playVideo();
            return;
        }
        activeId = id;
        store('activeSlot', id);
        slot.updated = Date.now();
        saveSlot(slot);
        render();
        if (userAction && slot.time > 5) {
            showNotice('Continuing ' + slotTitle(slot) + ' at', {time: slot.time});
        }
        if (consented) {
            startPlayer(slot, userAction);
        } else if (userAction) {
            $('consent-button').focus();
        }
    }

    function removeSave(id) {
        const slot = findSlot(id);
        if (!slot) return;
        removeSlot(id);
        if (id === activeId) {
            stopPlayer();
            activeId = null;
            store('activeSlot', null);
        }
        render();
        showNotice('Removed ' + slotTitle(slot) + '.', {
            action: {
                label: 'Undo', run: function () {
                    saveSlot(slot);
                    render();
                }
            }
        });
    }

    // ---------- YouTube ----------

    function loadYouTube(callback) {
        if (youtubeReady) {
            callback();
            return;
        }
        if (youtubeLoading) return;
        youtubeLoading = true;
        const script = document.createElement('script');
        script.onload = function () {
            window.YT.ready(function () {
                youtubeReady = true;
                callback();
            });
        };
        script.onerror = function () {
            youtubeLoading = false;
            showNotice('YouTube couldn\'t be loaded. Check your connection or content blocker and reload the page.', {tone: 'error'});
        };
        script.src = 'https://www.youtube.com/player_api';
        document.head.appendChild(script);
    }

    function stopPlayer() {
        if (interval) clearInterval(interval);
        interval = null;
        advanceTrackedTime();
        trackedSince = null;
        if (player) player.destroy();
        player = null;
        playerReady = false;
        $('play-toggle').disabled = true;
        $('fullscreen-button').disabled = true;
        setPlayToggle(false);
    }

    function startPlayer(slot, wantAutoplay) {
        loadYouTube(function () {
            const current = activeSlot();
            if (!current || current.id !== slot.id) return;
            stopPlayer();

            trackedTime = current.time || 0;
            trackedDuration = Infinity;
            trackedVideoId = current.videoId;
            videoEnded = false;
            restoring = false;
            skipTarget = null;
            autoplay = wantAutoplay;
            started = false;

            const playerVars = {start: Math.floor(trackedTime), playsinline: 1, rel: 0};
            // hide YouTube's fullscreen button when ours can take over
            if (canFullscreen) playerVars.fs = 0;
            if (current.playlistId) {
                playerVars.listType = 'playlist';
                playerVars.list = current.playlistId;
            }
            const options = {
                host: 'https://www.youtube-nocookie.com',
                playerVars: playerVars,
                events: {
                    'onReady': onPlayerReady,
                    'onStateChange': onPlayerStateChange,
                    'onPlaybackRateChange': onPlaybackRateChange,
                    'onError': onPlayerError
                }
            };
            // for a playlist this is the episode to start at; without one, it starts at the first episode
            if (trackedVideoId) options.videoId = trackedVideoId;
            player = new YT.Player('player', options);
        });
    }

    function onPlayerReady() {
        playerReady = true;
        $('play-toggle').disabled = false;
        $('fullscreen-button').disabled = false;
        setPlayToggle(false);
        if (interval) clearInterval(interval);
        interval = setInterval(savePosition, SAVE_INTERVAL);
        if (autoplay) player.playVideo();
    }

    function advanceTrackedTime() {
        if (trackedSince === null) return;
        const now = performance.now();
        trackedTime += (now - trackedSince) / 1000 * trackedRate;
        addListeningTime((now - trackedSince) / 1000);
        trackedSince = now;
    }

    // Real time spent watching or listening (an hour at 2x counts as one hour).
    // Re-read before adding, so several open tabs don't overwrite each other.
    function addListeningTime(seconds) {
        const total = (parseFloat(localStorage.getItem('totalPlaytime')) || 0) + seconds;
        localStorage.setItem('totalPlaytime', total);
        renderTimePlayed();
    }

    function currentVideoId() {
        const list = player.getPlaylist();
        return list ? list[player.getPlaylistIndex()] : trackedVideoId;
    }

    // Returns true if the player is on the video we expect (again).
    function handleVideoChange() {
        const current = currentVideoId();
        if (!current || current === trackedVideoId) {
            restoring = false;
            return true;
        }
        if (restoring) {
            return false;
        }
        const list = player.getPlaylist() || [];
        const index = list.indexOf(trackedVideoId);
        const finished = videoEnded || trackedTime > trackedDuration - SKIP_TOLERANCE;
        if (!trackedVideoId || finished || index < 0 || !skipProtectionOn()) {
            // the playlist moved on by itself (or the user may switch videos): follow it
            followVideo(current, player.getCurrentTime());
            return true;
        }
        // jumped to another episode by hand: go back to where we were
        const slot = activeSlot();
        skipTarget = {videoId: current, index: list.indexOf(current)};
        showNotice('Went back to episode ' + (index + 1) + ' at', {
            time: trackedTime,
            action: {label: 'Keep new episode', run: keepSkipTarget}
        });
        restoring = true;
        trackedSince = null;
        player.loadPlaylist({list: slot.playlistId, listType: 'playlist', index: index, startSeconds: trackedTime});
        return false;
    }

    function followVideo(videoId, time) {
        trackedVideoId = videoId;
        trackedTime = time;
        trackedDuration = Infinity;
        videoEnded = false;
        const slot = activeSlot();
        if (!slot) return;
        slot.videoId = videoId;
        slot.time = time;
        saveSlot(slot);
    }

    function keepSkipTarget() {
        if (!player || !skipTarget) return;
        const target = skipTarget;
        skipTarget = null;
        if (target.index !== undefined && target.index >= 0) {
            followVideo(target.videoId, 0);
            restoring = false;
            player.playVideoAt(target.index);
        } else {
            trackedTime = target.time;
            player.seekTo(target.time, true);
        }
    }

    function onPlayerStateChange(event) {
        const playing = event.data === YT.PlayerState.PLAYING;
        if (playing) started = true;
        setPlayToggle(playing);
        if (event.data === YT.PlayerState.ENDED) {
            videoEnded = true;
        }
        if (playing) {
            if (!handleVideoChange()) return;
            if (trackedSince === null) trackedSince = performance.now();
            trackedRate = player.getPlaybackRate();
        } else {
            // keep the expected position up to the moment playing stopped,
            // so pauses and buffering don't look like a skip
            advanceTrackedTime();
            trackedSince = null;
        }
    }

    function onPlayerError(event) {
        const reasons = {
            2: 'the video or playlist ID is invalid',
            5: 'the video can\'t be played in this browser\'s player',
            100: 'the video was not found or is private',
            101: 'the owner doesn\'t allow playing it on other websites',
            150: 'the owner doesn\'t allow playing it on other websites'
        };
        // in a playlist, moving on from a broken video must not count as a skip
        videoEnded = true;
        showNotice('YouTube can\'t play this: ' + (reasons[event.data] || 'error ' + event.data) + '.', {tone: 'error'});
    }

    function onPlaybackRateChange(event) {
        advanceTrackedTime();
        trackedRate = event.data;
    }

    function savePosition() {
        if (!player || player.getPlayerState() !== YT.PlayerState.PLAYING) return;

        if (!handleVideoChange()) return;

        advanceTrackedTime();
        trackedDuration = player.getDuration() || Infinity;
        let playerTime = player.getCurrentTime();
        if (skipProtectionOn() && trackedSince !== null
            && Math.abs(playerTime - trackedTime) > SKIP_TOLERANCE) {
            skipTarget = {time: playerTime};
            showNotice('Jumped back to', {
                time: trackedTime,
                action: {label: 'Keep new position', run: keepSkipTarget}
            });
            playerTime = trackedTime;
            player.seekTo(playerTime, true);
        }
        trackedTime = playerTime;

        const slot = activeSlot();
        if (!slot) return;
        slot.time = playerTime;
        slot.videoId = trackedVideoId || slot.videoId;
        slot.updated = Date.now();
        // getVideoData() isn't officially documented; keep the old title when it's missing
        const data = player.getVideoData ? player.getVideoData() : null;
        if (data && data.title) slot.title = data.title;
        if (data && data.author) slot.channel = data.author;
        const list = player.getPlaylist();
        if (list && list.length) {
            slot.episode = player.getPlaylistIndex() + 1;
            slot.episodes = list.length;
        }
        saveSlot(slot);
        renderProgress(slot);
    }

    // ---------- events ----------

    $('add-toggle').addEventListener('click', function () {
        const open = $('add-panel').hidden;
        setAddPanel(open);
        if (open) $('video-url').focus();
    });

    $('add-panel').addEventListener('submit', function (event) {
        event.preventDefault();
        openLink($('video-url').value);
    });

    $('play-toggle').addEventListener('click', function () {
        if (!player || !playerReady) return;
        if (player.getPlayerState() === YT.PlayerState.PLAYING) {
            player.pauseVideo();
        } else {
            player.playVideo();
        }
    });

    // iPhones only allow fullscreen for <video> elements, so there the button stays hidden
    // and YouTube keeps its own fullscreen button
    const canFullscreen = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
    $('fullscreen-button').hidden = !canFullscreen;

    function fullscreenElement() {
        return document.fullscreenElement || document.webkitFullscreenElement || null;
    }

    $('fullscreen-button').addEventListener('click', function () {
        const frame = $('player-frame');
        const request = frame.requestFullscreen ? frame.requestFullscreen() : frame.webkitRequestFullscreen();
        Promise.resolve(request).then(function () {
            // phones turn to landscape where the browser allows it
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(function () {
                });
            }
        }).catch(function () {
            showNotice('Fullscreen is not available in this browser.', {tone: 'error'});
        });
    });

    $('fullscreen-exit').addEventListener('click', function () {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    });

    function onFullscreenChange() {
        if (!fullscreenElement() && screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }
    }

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    document.querySelectorAll('input[name="view"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
            const slot = activeSlot();
            if (!slot) return;
            slot.view = radio.value;
            saveSlot(slot);
            setView(radio.value);
        });
    });

    $('skip-toggle').checked = load('skipProtection', true) !== false;
    $('skip-toggle').addEventListener('change', function () {
        store('skipProtection', $('skip-toggle').checked);
    });

    $('notice-action').addEventListener('click', function () {
        const action = noticeAction;
        hideNotice();
        if (action) action.run();
    });
    $('notice-close').addEventListener('click', hideNotice);

    // Space or K toggles playback when nothing else has focus
    document.addEventListener('keydown', function (event) {
        if (event.target !== document.body || event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.key === ' ' || event.key === 'k') {
            event.preventDefault();
            $('play-toggle').click();
        }
    });

    $('consent-button').addEventListener('click', function () {
        document.cookie = 'consent=' + CONSENT_VERSION + '; max-age=' + (365 * 24 * 60 * 60) + '; SameSite=Lax';
        consented = true;
        render();
        const slot = activeSlot();
        if (slot) startPlayer(slot, true);
        else if (!$('add-panel').hidden) $('video-url').focus();
    });

    $('withdraw-consent-button').addEventListener('click', function () {
        document.cookie = 'consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        // the Google code is already running, only a reload gets rid of it
        location.reload();
    });

    // save the latest position when the tab is closed or put in the background
    window.addEventListener('pagehide', function () {
        if (playerReady) savePosition();
    });
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden' && playerReady) savePosition();
    });

    // ---------- start ----------

    migrateOldStorage();
    const lastActive = load('activeSlot', null);
    activeId = lastActive && findSlot(lastActive) ? lastActive : null;
    render();
    const slot = activeSlot();
    if (consented && slot) startPlayer(slot, false);
}());

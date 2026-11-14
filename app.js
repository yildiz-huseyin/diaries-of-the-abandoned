/* ==========================================================
   Diaries of the Abandoned - Complete Interactive Script
   Three.js Planet Transitions + NASA Trek Leaflet Radar + Audio
   ========================================================== */

(function () {
    'use strict';

    // ==========================================================
    // 1. THREE.JS CELESTIAL GLOBE WITH ATMOSPHERE GLOW
    // ==========================================================
    const T = THREE;
    const cv = document.getElementById('c');
    let R;

    try {
        R = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) {
        console.warn('WebGL not supported');
    }

    let planetMat, atmosphereMesh;

    if (R) {
        R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        R.setSize(window.innerWidth, window.innerHeight);
        R.outputEncoding = T.sRGBEncoding;

        const S = new T.Scene();
        const cam = new T.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        cam.position.set(0, 0, 19);

        // Lighting
        const ambientLight = new T.AmbientLight(0x222238, 0.9);
        const sun = new T.DirectionalLight(0xfff5ea, 2.4);
        sun.position.set(22, 12, 16);
        S.add(ambientLight, sun);

        // Load NASA Textures
        const texLoader = new T.TextureLoader();
        const moonTex = texLoader.load('assest/image/moon_hd.jpg');
        const marsTex = texLoader.load('assest/image/mars_hd.jpg');
        [moonTex, marsTex].forEach(t => { t.encoding = T.sRGBEncoding; t.anisotropy = R.capabilities.getMaxAnisotropy(); });
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Planet Sphere
        const planetGeo = new T.SphereGeometry(6.6, 64, 64);
        planetMat = new T.MeshStandardMaterial({
            map: moonTex,
            roughness: 0.88,
            metalness: 0.12
        });
        const planet = new T.Mesh(planetGeo, planetMat);
        planet.position.set(7.2, -0.8, 0);
        S.add(planet);

        // Atmosphere: soft additive halo that fades outward from the limb
        const atmoGeo = new T.SphereGeometry(7.5, 48, 48);
        const atmoMat = new T.ShaderMaterial({
            uniforms: { glow: { value: new T.Color(0x68a4ff) }, strength: { value: 2.2 } },
            vertexShader: `varying vec3 vN; varying vec3 vV;
                void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
                gl_Position = projectionMatrix * mv; }`,
            fragmentShader: `uniform vec3 glow; uniform float strength; varying vec3 vN; varying vec3 vV;
                void main(){ float f = pow(abs(dot(vN, vV)), 2.2) * strength;
                gl_FragColor = vec4(glow * f, f); }`,
            transparent: true, side: T.BackSide, blending: T.AdditiveBlending, depthWrite: false
        });
        const glowTarget = new T.Color(0x68a4ff);
        atmosphereMesh = new T.Mesh(atmoGeo, atmoMat);
        atmosphereMesh.position.copy(planet.position);
        S.add(atmosphereMesh);

        // Starfield
        const starGeo = new T.BufferGeometry();
        const starCoords = [];
        for (let i = 0; i < 1800; i++) {
            const x = (Math.random() - 0.5) * 450;
            const y = (Math.random() - 0.5) * 450;
            const z = (Math.random() - 0.5) * 400 - 40;
            starCoords.push(x, y, z);
        }
        starGeo.setAttribute('position', new T.Float32BufferAttribute(starCoords, 3));
        const starMat = new T.PointsMaterial({ color: 0xffffff, size: 1.3, transparent: true, opacity: 0.8 });
        const stars = new T.Points(starGeo, starMat);
        S.add(stars);

        // Subtle Mouse Parallax
        let baseX = 7.2, baseY = -0.8, targetX = 7.2, targetY = -0.8;
        function layout() {
            const narrow = window.innerWidth / window.innerHeight < 0.85;
            baseX = narrow ? 0 : 7.2;
            baseY = narrow ? 4.4 : -0.8;
            const s = narrow ? 0.55 : 1;
            planet.scale.setScalar(s);
            atmosphereMesh.scale.setScalar(s);
            targetX = baseX; targetY = baseY;
        }
        layout();
        window.addEventListener('pointermove', e => {
            const nx = (e.clientX / window.innerWidth - 0.5) * 2;
            const ny = (e.clientY / window.innerHeight - 0.5) * 2;
            targetX = baseX + nx * 0.4;
            targetY = baseY - ny * 0.4;
        });

        // Animation Loop
        function animate() {
            requestAnimationFrame(animate);
            if (!reduceMotion) planet.rotation.y += 0.0016;
            atmoMat.uniforms.glow.value.lerp(glowTarget, 0.04);

            planet.position.x += (targetX - planet.position.x) * 0.05;
            planet.position.y += (targetY - planet.position.y) * 0.05;
            atmosphereMesh.position.copy(planet.position);

            R.render(S, cam);
        }
        animate();

        window.addEventListener('resize', () => {
            cam.aspect = window.innerWidth / window.innerHeight;
            cam.updateProjectionMatrix();
            layout();
            R.setSize(window.innerWidth, window.innerHeight);
        });

        // World Texture & Atmosphere Shift
        window.switchPlanetTexture = function (world) {
            if (world === 'mars') {
                planetMat.map = marsTex;
                planetMat.needsUpdate = true;
                glowTarget.setHex(0xe2724a); // Mars reddish glow
            } else {
                planetMat.map = moonTex;
                planetMat.needsUpdate = true;
                glowTarget.setHex(0x68a4ff); // Moon blueish glow
            }
        };
    }

    // ==========================================================
    // 2. NASA TREK LEAFLET RADAR (WMTS REST ENGINE)
    // ==========================================================
    const initializedMaps = new Set();

    function initTrekMap(el) {
        if (!el || initializedMaps.has(el.id)) return;
        initializedMaps.add(el.id);

        const lat = parseFloat(el.dataset.lat);
        const lon = parseFloat(el.dataset.lon);
        const isMoon = el.dataset.body === 'moon';

        const map = L.map(el.id, {
            center: [lat, lon],
            zoom: 2,
            minZoom: 0,
            maxZoom: 6,
            zoomControl: true,
            attributionControl: true
        });

        // Official NASA Solar System Treks WMTS tile endpoint
        const tileUrl = isMoon
            ? 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg'
            : 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg';

        L.tileLayer(tileUrl, {
            attribution: isMoon ? '&copy; NASA Moon Trek (LRO WAC)' : '&copy; NASA Mars Trek (MOLA Relief)',
            noWrap: true
        }).addTo(map);

        // Radar Target Marker
        const markerColor = isMoon ? '#FFD700' : '#e2724a';
        L.circleMarker([lat, lon], {
            radius: 8,
            color: markerColor,
            fillColor: markerColor,
            fillOpacity: 0.85,
            weight: 2
        }).addTo(map);

        // Pulse Radar Ring
        L.circleMarker([lat, lon], {
            radius: 16,
            color: markerColor,
            fillOpacity: 0,
            weight: 1.5,
            opacity: 0.6
        }).addTo(map);

        setTimeout(() => map.invalidateSize(), 300);
    }

    // Intersection observer for smooth map lazy-load
    const mapObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                initTrekMap(entry.target);
            }
        });
    }, { rootMargin: '100px' });

    document.querySelectorAll('.trek-map').forEach(el => mapObserver.observe(el));

    // ==========================================================
    // 3. NAVIGATION, SCROLL TRACKER & TOP HUD
    // ==========================================================
    const secs = [...document.querySelectorAll('.ch')];
    const nav = document.getElementById('nav');
    const bar = document.getElementById('bar');
    const targetIndicator = document.getElementById('current-target');

    secs.forEach((e, i) => {
        const a = document.createElement('a');
        a.href = '#s' + i;
        e.id = 's' + i;
        nav.appendChild(a);
    });

    const dots = [...nav.children];

    function onScroll() {
        let best = 0;
        let bestDist = 1e9;
        secs.forEach((e, i) => {
            const r = e.getBoundingClientRect();
            const d = Math.abs(r.top + r.height / 2 - window.innerHeight / 2);
            if (d < bestDist) {
                bestDist = d;
                best = i;
            }
        });

        secs.forEach((e, k) => e.classList.toggle('on', k === best));
        dots.forEach((d, k) => d.classList.toggle('on', k === best));

        const activeSec = secs[best];
        if (activeSec) {
            // Update HUD target text
            if (targetIndicator && activeSec.dataset.target) {
                targetIndicator.textContent = 'TARGET: ' + activeSec.dataset.target;
            }
            // Switch 3D planet sphere
            if (activeSec.dataset.world && window.switchPlanetTexture) {
                window.switchPlanetTexture(activeSec.dataset.world);
            }
        }

        // Top progress bar
        const total = document.documentElement.scrollHeight - window.innerHeight;
        if (total > 0 && bar) {
            bar.style.width = (window.pageYOffset / total * 100) + '%';
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // ==========================================================
    // 4. LIVE MISSION TIMERS
    // ==========================================================
    function since(d) {
        let s = Math.floor((Date.now() - new Date(d)) / 1000);
        const y = Math.floor(s / 31557600);
        s -= y * 31557600;
        const dy = Math.floor(s / 86400);
        s -= dy * 86400;
        const h = Math.floor(s / 3600);
        s -= h * 3600;
        const mi = Math.floor(s / 60);
        return `${y} yrs, ${dy} days, ${h} hrs, ${mi} min, ${s - mi * 60} sec`;
    }

    const timerEls = [...document.querySelectorAll('[data-since]')];
    const tick = () => timerEls.forEach(e => (e.textContent = since(e.dataset.since)));
    tick();
    setInterval(tick, 1000);

    // ==========================================================
    // 5. ACCORDION TOGGLES
    // ==========================================================
    document.querySelectorAll('.science-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const body = this.nextElementSibling;
            const isOpen = body.classList.contains('open');
            if (isOpen) {
                body.classList.remove('open');
                this.setAttribute('aria-expanded', 'false');
            } else {
                body.classList.add('open');
                this.setAttribute('aria-expanded', 'true');
            }
        });
    });

    // ==========================================================
    // 6. AMBIENT LULLABY MUSIC (Web Audio: warm pads + music-box bells + reverb)
    // ==========================================================
    let audioCtx = null, master = null, bus = null, timer = null;
    let isSoundOn = false, nextChord = 0, chordIdx = 0, nextBell = 0, bellStep = 2;

    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    // Cmaj7 -> Am7 -> Fmaj7 -> G6 : gentle, dreamy, never tense
    const CHORDS = [[48, 52, 55, 59], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 52]];
    const BELLS = [72, 74, 76, 79, 81, 84, 86]; // C major pentatonic, always consonant

    function initAudio() {
        if (audioCtx) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        master = audioCtx.createGain();
        master.gain.value = 0;
        const comp = audioCtx.createDynamicsCompressor();
        // Synthetic hall reverb
        const len = Math.floor(audioCtx.sampleRate * 3.5);
        const ir = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const d = ir.getChannelData(c);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
        }
        const verb = audioCtx.createConvolver();
        verb.buffer = ir;
        const wet = audioCtx.createGain();
        wet.gain.value = 0.55;
        bus = audioCtx.createGain();
        bus.connect(master);
        bus.connect(verb);
        verb.connect(wet);
        wet.connect(master);
        master.connect(comp);
        comp.connect(audioCtx.destination);
    }

    function pad(freq, t, dur, vol) {
        const lp = audioCtx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1100;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 2.2);
        g.gain.setValueAtTime(vol, t + dur);
        g.gain.linearRampToValueAtTime(0, t + dur + 2.6);
        lp.connect(g);
        g.connect(bus);
        [['sine', -4], ['triangle', 4]].forEach(([type, cents]) => {
            const o = audioCtx.createOscillator();
            o.type = type;
            o.frequency.value = freq;
            o.detune.value = cents;
            o.connect(lp);
            o.start(t);
            o.stop(t + dur + 2.7);
        });
    }

    function bell(freq, t, vol) {
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
        g.connect(bus);
        [[1, 1], [2, 0.25], [3.01, 0.08]].forEach(([mul, amp]) => {
            const o = audioCtx.createOscillator();
            const og = audioCtx.createGain();
            o.type = 'sine';
            o.frequency.value = freq * mul;
            og.gain.value = amp;
            o.connect(og);
            og.connect(g);
            o.start(t);
            o.stop(t + 2.9);
        });
    }

    function schedule() {
        const now = audioCtx.currentTime;
        if (nextChord < now - 0.5) { nextChord = now + 0.1; nextBell = now + 2.5; }
        while (nextChord < now + 2) {
            const ch = CHORDS[chordIdx % CHORDS.length];
            ch.forEach(n => pad(mtof(n), nextChord, 7.2, 0.035));
            pad(mtof(ch[0] - 12), nextChord, 7.2, 0.05); // soft bass
            chordIdx++;
            nextChord += 8;
        }
        while (nextBell < now + 2) {
            if (nextBell < now) nextBell = now + 0.1;
            if (Math.random() > 0.22) {
                bellStep = Math.max(0, Math.min(BELLS.length - 1, bellStep + Math.floor(Math.random() * 5) - 2));
                bell(mtof(BELLS[bellStep]), nextBell, 0.05 + Math.random() * 0.03);
            }
            nextBell += 0.7 + Math.random() * 1.3;
        }
    }

    const soundBtn = document.getElementById('sound-btn');
    if (soundBtn) {
        soundBtn.addEventListener('click', () => {
            initAudio();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            isSoundOn = !isSoundOn;
            const label = soundBtn.querySelector('.sound-label');
            const t = audioCtx.currentTime;
            master.gain.cancelScheduledValues(t);
            master.gain.setValueAtTime(master.gain.value, t);
            if (isSoundOn) {
                master.gain.linearRampToValueAtTime(0.9, t + 2.5);
                clearInterval(timer);
                timer = setInterval(schedule, 400);
                schedule();
                if (label) label.textContent = 'MUSIC: ON';
                soundBtn.classList.add('active');
            } else {
                master.gain.linearRampToValueAtTime(0, t + 1.2);
                clearInterval(timer);
                if (label) label.textContent = 'MUSIC: OFF';
                soundBtn.classList.remove('active');
            }
        });
        document.addEventListener('visibilitychange', () => {
            if (!audioCtx || !isSoundOn) return;
            if (document.hidden) audioCtx.suspend(); else audioCtx.resume();
        });
    }

    // ==========================================================
    // 7. CUSTOM SCROLLBAR (same look on desktop and phones)
    // ==========================================================
    const rail = document.createElement('div');
    rail.id = 'rail';
    const thumb = document.createElement('div');
    thumb.id = 'rail-thumb';
    rail.appendChild(thumb);
    document.body.appendChild(rail);

    const root = document.documentElement;
    const maxScroll = () => Math.max(1, root.scrollHeight - window.innerHeight);

    function updateRail() {
        const railH = rail.clientHeight;
        const h = Math.max(44, railH * window.innerHeight / root.scrollHeight);
        thumb.style.height = h + 'px';
        thumb.style.transform = 'translateY(' + ((railH - h) * window.pageYOffset / maxScroll()) + 'px)';
    }
    window.addEventListener('scroll', updateRail, { passive: true });
    window.addEventListener('resize', updateRail);
    window.addEventListener('load', updateRail);
    new ResizeObserver(updateRail).observe(document.body);
    updateRail();

    let dragging = false, startY = 0, startScroll = 0;
    thumb.addEventListener('pointerdown', e => {
        dragging = true;
        startY = e.clientY;
        startScroll = window.pageYOffset;
        thumb.setPointerCapture(e.pointerId);
        rail.classList.add('drag');
        root.style.scrollBehavior = 'auto';
        e.preventDefault();
    });
    thumb.addEventListener('pointermove', e => {
        if (!dragging) return;
        const track = rail.clientHeight - thumb.offsetHeight;
        window.scrollTo(0, startScroll + (e.clientY - startY) * maxScroll() / Math.max(1, track));
    });
    const endDrag = () => { dragging = false; rail.classList.remove('drag'); root.style.scrollBehavior = ''; };
    thumb.addEventListener('pointerup', endDrag);
    thumb.addEventListener('pointercancel', endDrag);
    rail.addEventListener('pointerdown', e => {
        if (e.target !== rail) return;
        const r = rail.getBoundingClientRect();
        window.scrollTo({ top: (e.clientY - r.top) / r.height * maxScroll(), behavior: 'smooth' });
    });

    // ==========================================================
    // 8. CHAPTER NARRATION (assest/sound/1.mp3 ... 5.mp3)
    // ==========================================================
    let narration = null, narrationBtn = null;

    function duck(on) {
        if (!master || !isSoundOn) return;
        const t = audioCtx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(on ? 0.22 : 0.9, t + 0.8);
    }
    function setBtn(btn, playing) {
        btn.classList.toggle('playing', playing);
        btn.setAttribute('aria-pressed', playing);
        btn.querySelector('.listen-label').textContent = playing ? 'Pause the diary' : 'Listen to the diary';
    }
    function stopNarration() {
        if (!narration) return;
        narration.pause();
        narration.currentTime = 0;
        setBtn(narrationBtn, false);
        narration = null;
        narrationBtn = null;
        duck(false);
    }

    document.querySelectorAll('.chapter').forEach(sec => {
        const n = sec.dataset.c;
        const quote = sec.querySelector('.diary-quote');
        if (!n || !quote) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'listen-btn';
        btn.setAttribute('aria-pressed', 'false');
        btn.innerHTML = '<span class="listen-icon" aria-hidden="true"></span><span class="listen-label">Listen to the diary</span>';
        quote.insertAdjacentElement('afterend', btn);

        const audio = new Audio();
        audio.preload = 'none';
        audio.src = 'assest/sound/' + n + '.mp3';
        audio.addEventListener('ended', () => { if (narration === audio) stopNarration(); });
        audio.addEventListener('error', () => {
            if (narration === audio) { narration = null; narrationBtn = null; duck(false); }
            btn.classList.remove('playing');
            btn.disabled = true;
            btn.querySelector('.listen-label').textContent = 'Audio not found';
        });
        btn.addEventListener('click', () => {
            if (narration === audio) { stopNarration(); return; }
            stopNarration();
            narration = audio;
            narrationBtn = btn;
            setBtn(btn, true);
            duck(true);
            audio.play().catch(() => { if (narration === audio) stopNarration(); });
        });
    });

    // Stop narration when its chapter scrolls out of focus
    window.addEventListener('scroll', () => {
        if (narrationBtn && !narrationBtn.closest('.chapter').classList.contains('on')) stopNarration();
    }, { passive: true });

    // ==========================================================
    // 9. 3D MODEL LOAD SAFETY (encodes spaces in file names, reports failures)
    // ==========================================================
    document.querySelectorAll('model-viewer').forEach(mv => {
        const raw = mv.getAttribute('src') || '';
        if (raw && raw.indexOf('%') === -1) mv.setAttribute('src', encodeURI(raw));
        const note = document.createElement('div');
        note.className = 'model-error';
        note.hidden = true;
        mv.insertAdjacentElement('afterend', note);
        mv.addEventListener('error', () => {
            note.hidden = false;
            note.textContent = '3D model could not load: ' + raw + (location.protocol === 'file:' ? ' (open the site through a local web server, not by double-clicking the file)' : '');
        });
        mv.addEventListener('load', () => { note.hidden = true; });
    });

})();

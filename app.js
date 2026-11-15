/**
 * ============================================================================
 * PLANETARY TWIN MATCHER & CARTOGRAFÍA LUNAR / MARCIANA — MOTOR UNIFICADO
 * NASA Space Apps 2026
 * ============================================================================
 */

(() => {
    const DATA = window.PTM_DATA;
    if (!DATA) {
        console.error('Error crítico: datos.js no se cargó antes de app.js.');
        return;
    }

    const {
        MONTHS_FULL,
        MONTHS_SHORT,
        AXIS_NAMES,
        AXIS_FULL,
        MISSION_WEIGHTS,
        PLANET_NOTES,
        analogDatabase,
        LUNAR_ANALOG_CANDIDATES,
        MARS_ANALOG_CANDIDATES,
        LUNAR_CONSTANTS,
        LUNAR_MARIA,
        LUNAR_CRATERS,
        LUNAR_SITES,
        LUNAR_EXTRA_BASINS,
        LUNAR_TYPE_LABELS,
        MARS_CONSTANTS,
        MARS_MARIA,
        MARS_CRATERS,
        MARS_SITES,
        MARS_EXTRA_FEATURES,
        MARS_TYPE_LABELS
    } = DATA;

    const $ = (id) => document.getElementById(id);
    const fmt = (n, d = 1) => Number(n).toFixed(d).replace('.', ',');

    // ========================================================================
    // 1. NAVEGACIÓN ENTRE MÓDULOS (GEMELO PLANETARIO <-> LUNA <-> MARTE)
    // ========================================================================
    let activeView = 'matcher';

    function switchView(viewName) {
        activeView = viewName;
        const isMatcher = viewName === 'matcher';
        const isLunar = viewName === 'lunar';
        const isMars = viewName === 'mars';

        $('tab-matcher').classList.toggle('active', isMatcher);
        $('tab-lunar').classList.toggle('active', isLunar);
        $('tab-mars').classList.toggle('active', isMars);

        $('view-matcher').classList.toggle('hidden', !isMatcher);
        $('matcher-controls').classList.toggle('hidden', !isMatcher);
        $('view-lunar').classList.toggle('hidden', !isLunar);
        $('view-mars').classList.toggle('hidden', !isMars);

        if (isMatcher) {
            setTimeout(() => {
                map.invalidateSize();
                resize3DViewer();
            }, 50);
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => {
                lunarDEM3D.resize();
                marsDEM3D.resize();
            }, 50);
        }
    }

    $('tab-matcher').addEventListener('click', () => switchView('matcher'));
    $('tab-lunar').addEventListener('click', () => switchView('lunar'));
    $('tab-mars').addEventListener('click', () => switchView('mars'));

    // ========================================================================
    // 2. MOTOR MATEMÁTICO & ESTACIONAL (PLANETARY TWIN MATCHER)
    // ========================================================================
    let allRankedCandidates = [];
    let currentTop3 = [];
    let selectedRankIndex = 0;
    let selectedMonthIndex = 6; // Julio por defecto
    let calculatedOptimalInfo = { monthIndex: 6, monthName: 'Julio', score: 93.8, candidateName: '' };
    let mapMarkers = [];

    function getMonthlyEarthMetrics(baseMetrics, seasonalDelta) {
        const sensitivity = [0.85, 0.30, 1.00, 1.15, 0.40];
        return baseMetrics.map((val, idx) => {
            const adjusted = Math.round(val + (seasonalDelta * sensitivity[idx]));
            return Math.max(25, Math.min(100, adjusted));
        });
    }

    function calculateMathematicalSimilarity(targetVec, earthVec, weightVec) {
        let weightedProximitySum = 0;
        let dotProduct = 0;
        let normTargetSq = 0;
        let normEarthSq = 0;

        for (let i = 0; i < 5; i++) {
            const w = weightVec[i];
            const t = targetVec[i];
            const e = earthVec[i];

            const diff = Math.abs(t - e);
            const axisProximity = Math.max(0, 100 - 1.35 * diff);
            weightedProximitySum += w * axisProximity;

            dotProduct += w * t * e;
            normTargetSq += w * (t * t);
            normEarthSq += w * (e * e);
        }

        const cosineSimilarity = (normTargetSq > 0 && normEarthSq > 0)
            ? (dotProduct / (Math.sqrt(normTargetSq) * Math.sqrt(normEarthSq))) * 100
            : 0;

        const finalScore = (0.85 * weightedProximitySum) + (0.15 * cosineSimilarity);

        return {
            total: Number(finalScore.toFixed(1)),
            proximity: Number(weightedProximitySum.toFixed(1)),
            cosine: Number(cosineSimilarity.toFixed(1))
        };
    }

    function computeDynamicOptimalMonth(targetKey, modeKey) {
        const target = analogDatabase[targetKey];
        const weightVec = MISSION_WEIGHTS[modeKey].weights;

        let bestMonthIndex = 0;
        let bestScore = -1;
        let bestCandidateName = '';

        for (let m = 0; m < 12; m++) {
            target.candidates.forEach((c) => {
                const monthlyVec = getMonthlyEarthMetrics(c.earthMetrics, c.seasonalCurve[m]);
                const sim = calculateMathematicalSimilarity(target.targetMetrics, monthlyVec, weightVec);
                if (sim.total > bestScore) {
                    bestScore = sim.total;
                    bestMonthIndex = m;
                    bestCandidateName = c.name;
                }
            });
        }

        return {
            monthIndex: bestMonthIndex,
            monthName: MONTHS_FULL[bestMonthIndex],
            score: bestScore,
            candidateName: bestCandidateName
        };
    }

    function computeCandidateBestMonth(candidate, targetMetrics, weightVec) {
        let bestM = 0;
        let bestS = -1;
        for (let m = 0; m < 12; m++) {
            const vec = getMonthlyEarthMetrics(candidate.earthMetrics, candidate.seasonalCurve[m]);
            const sim = calculateMathematicalSimilarity(targetMetrics, vec, weightVec);
            if (sim.total > bestS) {
                bestS = sim.total;
                bestM = m;
            }
        }
        return { monthIndex: bestM, monthName: MONTHS_FULL[bestM], score: bestS };
    }

    function goToOptimalMonth() {
        const targetKey = $('target-select').value;
        const modeKey = $('mission-mode').value;
        const optimal = computeDynamicOptimalMonth(targetKey, modeKey);

        selectedMonthIndex = optimal.monthIndex;
        $('month-slider').value = selectedMonthIndex;
        updateDashboard(true);
    }

    $('optimal-month-btn').addEventListener('click', goToOptimalMonth);

    // ========================================================================
    // 3. VISOR TOPOGRÁFICO 3D REALISTA (THREE.JS)
    // ========================================================================
    const container3D = $('canvas-3d-container');
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020617, 0.12);

    const width3D = container3D.clientWidth || 340;
    const height3D = container3D.clientHeight || 210;

    const camera = new THREE.PerspectiveCamera(45, width3D / height3D, 0.1, 1000);
    camera.position.set(0, 4.5, 5.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width3D, height3D);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container3D.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
    sunLight.position.set(6, 12, 5);
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    fillLight.position.set(-6, -4, -5);
    scene.add(fillLight);

    const terrainGeometry = new THREE.PlaneGeometry(6, 6, 96, 96);

    function createPlanetTexture(targetKey) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        const targetObj = analogDatabase[targetKey];
        const isMars = (targetObj && targetObj.body === 'MARTE')
            || targetKey.includes('jezero')
            || targetKey.includes('arcadia')
            || targetKey.startsWith('mars_');

        const grad = ctx.createLinearGradient(0, 0, 512, 512);
        if (isMars) {
            grad.addColorStop(0, '#7A2E1E');
            grad.addColorStop(0.5, '#BD5338');
            grad.addColorStop(1, '#9C3E28');
        } else {
            grad.addColorStop(0, '#1E293B');
            grad.addColorStop(0.5, '#334155');
            grad.addColorStop(1, '#0F172A');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        for (let i = 0; i < 60; i++) {
            const cx = Math.random() * 512;
            const cy = Math.random() * 512;
            const cr = Math.random() * 25 + 4;
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, Math.PI * 2);
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    const terrainMaterial = new THREE.MeshStandardMaterial({
        roughness: 0.85,
        metalness: 0.1,
        flatShading: false
    });

    const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
    terrainMesh.rotation.x = -Math.PI / 2.2;
    scene.add(terrainMesh);

    // Altura (unidades de escena) del terreno modelado del objetivo (Luna/Marte) en el punto (x, y)
    function targetHeightAt(targetKey, x, y) {
        const targetObj = analogDatabase[targetKey];
        const rf = targetObj && targetObj.reliefFactor ? targetObj.reliefFactor : 0.5;
        let z = 0;
        const distVal = Math.sqrt(x * x + y * y);

        if (targetKey === 'shackleton') {
            if (distVal < 2.2) {
                z = -1.4 + Math.pow(distVal / 2.2, 2) * 1.6;
                if (distVal > 1.7) z += (distVal - 1.7) * 2.2;
            } else {
                z = 0.3 * Math.sin(x * 1.8) * Math.cos(y * 1.8);
            }
        } else if (targetKey === 'marius') {
            z = Math.cos(x * 1.5) * Math.sin(y * 1.5) * 0.7 + Math.sin(distVal * 2.5) * 0.25;
        } else if (targetKey === 'jezero') {
            const channel = Math.sin(x * 1.2 + y * 0.8) * 0.5;
            z = -0.4 + channel - Math.abs(y) * 0.25 + Math.cos(distVal * 2) * 0.3;
        } else if (targetKey === 'arcadia') {
            z = Math.sin(x * 3) * Math.cos(y * 3) * 0.12 + Math.sin(distVal * 1.2) * 0.15;
        } else if (targetObj && targetObj.marsFeatureObj && targetObj.marsFeatureObj.k === 'volcan') {
            z = (1.6 * rf) * Math.exp(-0.55 * distVal * distVal) - (distVal < 0.45 ? 0.35 * (1 - (distVal / 0.45) ** 2) : 0);
        } else if (targetObj && (targetObj.lunarFeatureObj || targetObj.marsFeatureObj)) {
            const feat = targetObj.lunarFeatureObj || targetObj.marsFeatureObj;
            if (feat.k === 'crater' || feat.k === 'cuenca') {
                z = distVal < 2.0 ? -1.1 * rf * (1 - (distVal / 2.0) ** 2) : 0.25 * Math.sin(x * 1.6) * Math.cos(y * 1.6);
            } else {
                z = Math.sin(x * 1.5) * Math.cos(y * 1.5) * (0.8 * rf);
            }
        } else {
            z = Math.sin(x * 1.5) * Math.cos(y * 1.5) * 0.5;
        }

        return z;
    }

    function generateRealisticTerrain(targetKey) {
        const positions = terrainGeometry.attributes.position;
        const targetObj = analogDatabase[targetKey];

        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = targetHeightAt(targetKey, x, y);

            positions.setZ(i, z);
        }

        terrainGeometry.computeVertexNormals();
        terrainGeometry.attributes.position.needsUpdate = true;
    }

    function resize3DViewer() {
        const width = container3D.clientWidth;
        const height = container3D.clientHeight;
        if (width > 0 && height > 0) {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        }
    }

    function animate3D() {
        requestAnimationFrame(animate3D);
        if (activeView === 'matcher') {
            terrainMesh.rotation.z += 0.0015;
            renderer.render(scene, camera);
        }
        lunarDEM3D.tick();
        marsDEM3D.tick();
    }

    // ========================================================================
    // 3b. MALLA 3D DEM (THREE.JS) PARA LOS SIMULADORES DE LA LUNA Y DE MARTE
    //     Misma malla topográfica del Somkyto main (PlaneGeometry + niebla +
    //     luces + rotación), pero deformada con el DEM real del simulador
    //     (el mismo arreglo de elevaciones que usan el mapa y el perfil).
    // ========================================================================
    function createDEM3DViewer(opts) {
        const host = $(opts.hostId);
        if (!host) return { update() {}, tick() {}, resize() {} };

        const N = 64;          // segmentos de la malla (65 x 65 vértices)
        const SIZE = 6;        // lado del plano en unidades de escena (igual que el main)
        const TILT = -Math.PI / 2.5;

        host.innerHTML = `
            <div class="dem3d-stage">
                <div class="dem3d-view"></div>
                <div class="topo-grid absolute inset-0 pointer-events-none"></div>
                <div class="dem3d-info">
                    <div><span class="dem3d-k">Modelo 3D Malla Digital</span><span class="dem3d-v d3-src"></span></div>
                    <div class="text-right"><span class="dem3d-k">Relieve de la ventana</span><span class="dem3d-v d3-rel"></span></div>
                </div>
            </div>
            <div class="dem3d-controls">
                <label><input type="checkbox" class="d3-wire" checked> Malla</label>
                <label><input type="checkbox" class="d3-rot" checked> Rotar</label>
                <label>Exageración vertical
                    <input type="range" class="d3-ex" min="1" max="40" step="0.5" value="1">
                    <b class="d3-exv">×1</b>
                </label>
                <button type="button" class="d3-reset">Restablecer vista</button>
            </div>
            <p class="dem3d-hint">Arrastra para girar · rueda para acercar · la malla usa la ventana de terreno del perfil topográfico.</p>`;

        const view = host.querySelector('.dem3d-view');
        const q = (sel) => host.querySelector(sel);

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x020617, 0.15);

        const camera = new THREE.PerspectiveCamera(45, 1.5, 0.1, 1000);
        const CAM0 = new THREE.Vector3(0, 4, 6);
        camera.position.copy(CAM0);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(view.clientWidth || 340, view.clientHeight || 230);
        view.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const dirLight = new THREE.DirectionalLight(opts.color, 1.5);
        dirLight.position.set(5, 10, 7);
        scene.add(dirLight);
        const ptLight = new THREE.PointLight(0x818cf8, 2, 50);
        ptLight.position.set(-5, 5, -5);
        scene.add(ptLight);

        const geo = new THREE.PlaneGeometry(SIZE, SIZE, N, N);
        const count = geo.attributes.position.count;
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
        const mat = new THREE.MeshStandardMaterial({
            color: opts.color,
            wireframe: true,
            roughness: 0.4,
            metalness: 0.2
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = TILT;
        scene.add(mesh);

        const elev = new Float32Array(count);
        let st = { mn: 0, mx: 0, me: 0 };
        let R = 100;
        let exag = 1;
        let autoRotate = true;
        let drag = null;

        // Interpolación bilineal del DEM (lat/lon en grados, lon con envoltura)
        function sample(lat, lon) {
            const fx = (lon + 180) / opts.STEP - 0.5;
            const fy = (90 - lat) / opts.STEP - 0.5;
            const i0 = Math.floor(fx);
            const j0 = Math.floor(fy);
            const tx = fx - i0;
            const ty = fy - j0;
            const at = (i, j) =>
                opts.arr[Math.max(0, Math.min(opts.GH - 1, j)) * opts.GW + (((i % opts.GW) + opts.GW) % opts.GW)];
            const a = at(i0, j0) * (1 - tx) + at(i0 + 1, j0) * tx;
            const b = at(i0, j0 + 1) * (1 - tx) + at(i0 + 1, j0 + 1) * tx;
            return a * (1 - ty) + b * ty;
        }

        function refreshInfo() {
            q('.d3-src').textContent = opts.isReal() ? opts.realName : 'DEM sintético';
            q('.d3-rel').textContent = `${(st.mx - st.mn).toFixed(1).replace('.', ',')} km · ±${Math.round(R)} km`;
            q('.d3-exv').textContent = `×${exag}`;
        }

        function applyZ() {
            const pos = geo.attributes.position;
            const unitsPerKm = SIZE / 2 / R;
            for (let i = 0; i < count; i++) {
                pos.setZ(i, (elev[i] - st.me) * unitsPerKm * exag);
            }
            pos.needsUpdate = true;
            geo.computeVertexNormals();
            refreshInfo();
        }

        function applyColors() {
            const col = geo.attributes.color;
            const lo = new THREE.Color(opts.low);
            const hi = new THREE.Color(opts.high);
            const c = new THREE.Color();
            const span = Math.max(0.05, st.mx - st.mn);
            for (let i = 0; i < count; i++) {
                c.copy(lo).lerp(hi, (elev[i] - st.mn) / span);
                col.setXYZ(i, c.r, c.g, c.b);
            }
            col.needsUpdate = true;
        }

        function update(f) {
            const cs = opts.csn(f);
            R = Math.min(2800, Math.max(opts.radius(f) * 1.5, opts.KM * opts.STEP * 5));
            const pos = geo.attributes.position;
            let mn = 1e9;
            let mx = -1e9;
            let sum = 0;
            for (let i = 0; i < count; i++) {
                const dx = (pos.getX(i) / (SIZE / 2)) * R;
                const dy = (pos.getY(i) / (SIZE / 2)) * R;
                const lat = Math.max(-89.8, Math.min(89.8, f.la + dy / opts.KM));
                const lon = f.lo + dx / (opts.KM * cs);
                const e = sample(lat, lon);
                elev[i] = e;
                mn = Math.min(mn, e);
                mx = Math.max(mx, e);
                sum += e;
            }
            st = { mn, mx, me: sum / count };
            // Exageración automática: que el relieve ocupe ~1,4 unidades de escena
            const unitsPerKm = SIZE / 2 / R;
            exag = Math.max(1, Math.min(40, Math.round((1.4 / Math.max(0.05, (mx - mn) * unitsPerKm)) * 2) / 2));
            q('.d3-ex').value = exag;
            applyColors();
            applyZ();
        }

        q('.d3-wire').addEventListener('change', (e) => {
            mat.wireframe = e.target.checked;
            mat.vertexColors = !e.target.checked;
            mat.color.setHex(e.target.checked ? opts.color : 0xffffff);
            mat.needsUpdate = true;
        });
        q('.d3-rot').addEventListener('change', (e) => { autoRotate = e.target.checked; });
        q('.d3-ex').addEventListener('input', (e) => { exag = Number(e.target.value); applyZ(); });
        q('.d3-reset').addEventListener('click', () => {
            mesh.rotation.set(TILT, 0, 0);
            camera.position.copy(CAM0);
            camera.lookAt(0, 0, 0);
        });

        view.addEventListener('pointerdown', (e) => {
            drag = { x: e.clientX, y: e.clientY };
            view.setPointerCapture(e.pointerId);
        });
        view.addEventListener('pointermove', (e) => {
            if (!drag) return;
            mesh.rotation.z -= (e.clientX - drag.x) * 0.008;
            mesh.rotation.x = Math.max(-1.45, Math.min(-0.25, mesh.rotation.x + (e.clientY - drag.y) * 0.005));
            drag = { x: e.clientX, y: e.clientY };
        });
        const endDrag = () => { drag = null; };
        view.addEventListener('pointerup', endDrag);
        view.addEventListener('pointercancel', endDrag);
        view.addEventListener('wheel', (e) => {
            e.preventDefault();
            const k = Math.exp(e.deltaY * 0.001);
            const len = Math.max(3, Math.min(16, camera.position.length() * k));
            camera.position.setLength(len);
        }, { passive: false });

        function resize() {
            const w = view.clientWidth;
            const h = view.clientHeight;
            if (w > 0 && h > 0) {
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                renderer.setSize(w, h);
            }
        }

        function tick() {
            if (!opts.isActive()) return;
            if (autoRotate && !drag) mesh.rotation.z += 0.002;
            renderer.render(scene, camera);
        }

        return { update, tick, resize };
    }

    // ========================================================================
    // 4. MAPA MUNDIAL SATELITAL (LEAFLET) & RADAR (CHART.JS)
    // ========================================================================
    const map = L.map('earth-map').setView([10, -20], 2);
    // Re-calcula el mapa cuando cambia el alto de la fila (las tres columnas se igualan)
    if (window.ResizeObserver) new ResizeObserver(() => map.invalidateSize()).observe($('earth-map'));
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; NASA/USGS Data Layers'
    }).addTo(map);

    function fitAllCandidatesOnMap() {
        if (allRankedCandidates.length === 0) return;
        const bounds = L.latLngBounds(allRankedCandidates.map((c) => [c.lat, c.lon]));
        map.fitBounds(bounds, { padding: [35, 35], maxZoom: 4 });
        if (mapMarkers[selectedRankIndex]) {
            mapMarkers[selectedRankIndex].openPopup();
        }
    }

    $('btn-fit-map').addEventListener('click', fitAllCandidatesOnMap);

    const radarCtx = $('radarChart').getContext('2d');
    const radarChart = new Chart(radarCtx, {
        type: 'radar',
        data: {
            labels: ['Topografía/Pendiente', 'Mineralogía', 'Estrés Térmico', 'Iluminación', 'Acceso Subsuelo'],
            datasets: [
                {
                    label: 'Objetivo Espacial',
                    data: [94, 92, 95, 92, 88],
                    borderColor: '#818cf8',
                    backgroundColor: 'rgba(129, 140, 248, 0.2)',
                    borderWidth: 2
                },
                {
                    label: 'Análogo Terrestre',
                    data: [86, 80, 91, 86, 81],
                    borderColor: '#34d399',
                    backgroundColor: 'rgba(52, 211, 153, 0.2)',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: 2 },
            scales: {
                r: {
                    min: 35,
                    max: 100,
                    ticks: { display: false },
                    grid: { color: 'rgba(148, 163, 184, 0.15)' },
                    angleLines: { color: 'rgba(148, 163, 184, 0.15)' },
                    pointLabels: { color: '#cbd5e1', font: { size: 11, weight: '500' }, padding: 4 }
                }
            },
            plugins: {
                legend: { labels: { color: '#e2e8f0', font: { size: 10 } }, position: 'bottom' }
            }
        }
    });

    // ========================================================================
    // 5. RENDERIZADO DE UI DEL TWIN MATCHER
    // ========================================================================
    function renderMonthTicks() {
        const container = $('month-ticks-container');
        container.innerHTML = '';
        MONTHS_SHORT.forEach((mShort, idx) => {
            const span = document.createElement('span');
            span.className = `month-tick ${idx === selectedMonthIndex ? 'active-month' : ''}`;
            span.textContent = mShort;
            span.onclick = () => {
                $('month-slider').value = idx;
                selectedMonthIndex = idx;
                updateDashboard(false);
            };
            container.appendChild(span);
        });
    }

    function renderActiveWeights(modeKey) {
        const config = MISSION_WEIGHTS[modeKey];
        $('mode-label-short').textContent = config.name;
        const container = $('weights-bars-container');
        container.innerHTML = '';

        config.weights.forEach((w, idx) => {
            const pct = Math.round(w * 100);
            const isHigh = pct >= 25;
            const pill = document.createElement('div');
            pill.className = `weight-pill rounded-lg p-1 border ${isHigh ? 'bg-sky-500/15 border-sky-500/40 text-sky-200' : 'bg-slate-950/60 border-slate-800 text-slate-400'}`;
            pill.innerHTML = `
                <span class="block text-[9px] truncate">${AXIS_NAMES[idx]}</span>
                <span class="text-xs font-extrabold font-mono ${isHigh ? 'text-sky-300' : 'text-slate-300'}">${pct}%</span>
            `;
            container.appendChild(pill);
        });
    }

    function renderTop3Cards() {
        const container = $('top-ranking-list');
        container.innerHTML = '';

        const medals = ['🟢 #1', '🟠 #2', '⚪ #3'];
        const badgeColors = [
            'text-emerald-300 bg-emerald-500/20 border-emerald-500/40',
            'text-amber-300 bg-amber-500/20 border-amber-500/40',
            'text-slate-200 bg-slate-500/20 border-slate-400/40'
        ];

        currentTop3.forEach((candidate, idx) => {
            const isActive = idx === selectedRankIndex;
            const card = document.createElement('button');
            card.type = 'button';
            card.onclick = () => selectCandidate(idx, true);
            card.className = `rank-card text-left p-2.5 rounded-xl border border-slate-700/80 bg-slate-900/70 flex flex-col justify-between ${isActive ? 'active' : 'opacity-80 hover:opacity-100'}`;

            const seasonIcon = candidate.monthDelta === 0 ? '☀️' : (candidate.monthDelta >= -5 ? '⛅' : '❄️');

            card.innerHTML = `
                <div class="flex items-center justify-between w-full mb-1">
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeColors[idx]}">${medals[idx]}</span>
                    <span class="text-xs font-extrabold text-white font-mono">${candidate.currentScore.toFixed(1)}%</span>
                </div>
                <p class="text-xs font-bold text-slate-100 truncate w-full" title="${candidate.name}">${candidate.shortName}</p>
                <div class="flex items-center justify-between w-full mt-0.5">
                    <span class="text-[10px] text-slate-400 truncate">${candidate.country}</span>
                    <span class="text-[10px]" title="Condición climática en el mes seleccionado">${seasonIcon}</span>
                </div>
            `;
            container.appendChild(card);
        });
    }

    function updateMapMarkers() {
        mapMarkers.forEach((m) => map.removeLayer(m));
        mapMarkers = [];

        const monthName = MONTHS_FULL[selectedMonthIndex];

        allRankedCandidates.forEach((candidate, idx) => {
            let pinClass = 'pin-rank-other';
            if (idx === 0) pinClass = 'pin-rank-1';
            else if (idx === 1) pinClass = 'pin-rank-2';
            else if (idx === 2) pinClass = 'pin-rank-3';

            const customIcon = L.divIcon({
                className: '',
                html: `<div class="custom-map-pin ${pinClass}">#${idx + 1} ${candidate.shortName} (${candidate.currentScore.toFixed(1)}%)</div>`,
                iconSize: [120, 26],
                iconAnchor: [60, 13]
            });

            const m = L.marker([candidate.lat, candidate.lon], { icon: customIcon }).addTo(map);
            m.bindPopup(`
                <div style="font-family:sans-serif;min-width:180px;">
                    <div style="font-size:11px;font-weight:bold;color:#0284c7;">PUESTO #${idx + 1} (${monthName.toUpperCase()})</div>
                    <div style="font-size:13px;font-weight:bold;margin:2px 0;">${candidate.name}</div>
                    <div style="font-size:11px;color:#475569;">${candidate.location}</div>
                    <div style="margin-top:4px;font-size:12px;">Similitud en ${monthName}: <b>${candidate.currentScore.toFixed(1)}%</b></div>
                    <div style="font-size:11px;color:#059669;">Mes pico del sitio: <b>${candidate.peakInfo.monthName} (${candidate.peakInfo.score.toFixed(1)}%)</b></div>
                </div>
            `);

            m.on('click', () => {
                if (idx < 3) {
                    selectCandidate(idx, false);
                }
            });

            mapMarkers.push(m);
        });
    }

    function selectCandidate(rankIndex, focusSingleSite = false) {
        selectedRankIndex = rankIndex;
        const targetKey = $('target-select').value;
        const target = analogDatabase[targetKey];
        const analog = currentTop3[rankIndex];
        const monthName = MONTHS_FULL[selectedMonthIndex];

        renderTop3Cards();

        const rankLabels = ['#1 GANADOR DEL MES', '#2 PUESTO DEL MES', '#3 PUESTO DEL MES'];
        $('active-analog-badge').textContent = `${rankLabels[rankIndex]} (${monthName.toUpperCase()})`;
        $('selected-rank-tag').textContent = `Candidato #${rankIndex + 1} (${analog.country})`;

        $('match-score').textContent = `${analog.currentScore.toFixed(1)}%`;
        $('score-month-label').textContent = `en ${monthName}`;
        $('formula-breakdown').textContent = `Prox: ${analog.mathDetails.proximity}% | Cos: ${analog.mathDetails.cosine}%`;

        $('candidate-peak-month-label').textContent =
            `Mejor mes de ${analog.shortName}: ${analog.peakInfo.monthName} (${analog.peakInfo.score.toFixed(1)}%)`;

        const optBtnText = $('optimal-month-btn-text');
        if (selectedMonthIndex === calculatedOptimalInfo.monthIndex) {
            optBtnText.textContent = `Mes óptimo activo: ${calculatedOptimalInfo.monthName} (${calculatedOptimalInfo.score.toFixed(1)}% de similitud)`;
        } else {
            optBtnText.textContent = `Ver mes óptimo: ${calculatedOptimalInfo.monthName} (${calculatedOptimalInfo.score.toFixed(1)}% de similitud)`;
        }

        const statusBadge = $('seasonal-status-badge');
        const penaltyTag = $('seasonal-penalty-tag');

        if (analog.monthDelta === 0) {
            statusBadge.className = 'font-semibold text-emerald-400 truncate';
            statusBadge.textContent = `🟢 ${monthName}: Pico Estacional Óptimo`;
            penaltyTag.className = 'text-[10px] font-mono text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded';
            penaltyTag.textContent = 'Fidelidad Estacional: 100%';
            $('reality-gap-text').textContent = analog.gap;
        } else if (analog.monthDelta >= -5) {
            statusBadge.className = 'font-semibold text-amber-300 truncate';
            statusBadge.textContent = `🟡 ${monthName}: Condición Intermedia`;
            penaltyTag.className = 'text-[10px] font-mono text-amber-200 bg-amber-500/20 px-1.5 py-0.5 rounded';
            penaltyTag.textContent = `Ajuste Estacional: ${analog.monthDelta} pts`;
            $('reality-gap-text').textContent = `${analog.gap} Nota estacional (${monthName}): ${analog.offSeasonReason}`;
        } else {
            statusBadge.className = 'font-semibold text-rose-400 truncate';
            statusBadge.textContent = `🔴 ${monthName}: Condición Climática Adversa`;
            penaltyTag.className = 'text-[10px] font-mono text-rose-200 bg-rose-500/30 px-1.5 py-0.5 rounded';
            penaltyTag.textContent = `Penalización: ${analog.monthDelta} pts`;
            $('reality-gap-text').textContent = `⚠️ ALERTA ESTACIONAL (${monthName.toUpperCase()}): ${analog.offSeasonReason} ${analog.gap}`;
        }

        const modeKey = $('mission-mode').value;
        const w = MISSION_WEIGHTS[modeKey].weights;
        radarChart.data.labels = [
            `Topografía (${Math.round(w[0] * 100)}%)`,
            `Mineralogía (${Math.round(w[1] * 100)}%)`,
            `Estrés Térmico (${Math.round(w[2] * 100)}%)`,
            `Iluminación (${Math.round(w[3] * 100)}%)`,
            `Subsuelo (${Math.round(w[4] * 100)}%)`
        ];
        radarChart.data.datasets[0].data = target.targetMetrics;
        radarChart.data.datasets[1].label = `${analog.shortName} (${monthName})`;
        radarChart.data.datasets[1].data = analog.monthlyMetrics;
        radarChart.update();

        $('earth-title').textContent = analog.name;
        $('earth-location').textContent = `${analog.location} • Pico anual: ${analog.peakInfo.monthName} (${analog.peakInfo.score.toFixed(1)}%)`;
        $('earth-coords').textContent = `${analog.lat.toFixed(2)}°, ${analog.lon.toFixed(2)}°`;
        $('earth-datasets').textContent = analog.datasets;
        $('export-btn').textContent = `📥 JSON (${monthName})`;

        if (focusSingleSite) {
            map.flyTo([analog.lat, analog.lon], 5, { duration: 0.9 });
        }
        if (mapMarkers[rankIndex]) {
            mapMarkers[rankIndex].openPopup();
        }
    }

    function updateDashboard(reframeWorldMap = true) {
        const targetKey = $('target-select').value;
        const modeKey = $('mission-mode').value;
        const target = analogDatabase[targetKey];
        const weightVec = MISSION_WEIGHTS[modeKey].weights;
        const monthName = MONTHS_FULL[selectedMonthIndex];

        calculatedOptimalInfo = computeDynamicOptimalMonth(targetKey, modeKey);

        $('current-month-badge').textContent = monthName.toUpperCase();
        $('ranking-month-indicator').textContent = `Período: ${monthName}`;
        renderMonthTicks();

        $('planet-badge').textContent = target.planet;
        $('target-coords').textContent = target.coords;
        $('target-title').textContent = target.title;
        $('target-desc').textContent = target.desc;
        $('target-dataset').textContent = target.dataset;
        $('target-temp').textContent = target.temp;
        $('target-slope').textContent = target.slope;
        $('target-mineral').textContent = target.mineral;
        $('target-gravity').textContent = target.gravity;

        // Ambos botones debajo de las imágenes de Marte y la Luna permanecen siempre visibles
        $('btn-open-lunar-map').classList.remove('hidden');
        $('btn-open-mars-map').classList.remove('hidden');

        terrainMaterial.map = createPlanetTexture(targetKey);
        terrainMaterial.needsUpdate = true;
        generateRealisticTerrain(targetKey);

        renderActiveWeights(modeKey);

        allRankedCandidates = target.candidates
            .map((c) => {
                const monthDelta = c.seasonalCurve[selectedMonthIndex];
                const monthlyMetrics = getMonthlyEarthMetrics(c.earthMetrics, monthDelta);
                const mathDetails = calculateMathematicalSimilarity(target.targetMetrics, monthlyMetrics, weightVec);
                const peakInfo = computeCandidateBestMonth(c, target.targetMetrics, weightVec);
                return {
                    ...c,
                    monthDelta,
                    monthlyMetrics,
                    currentScore: mathDetails.total,
                    mathDetails,
                    peakInfo
                };
            })
            .sort((a, b) => b.currentScore - a.currentScore);

        currentTop3 = allRankedCandidates.slice(0, 3);

        updateMapMarkers();
        selectCandidate(0, false);

        if (reframeWorldMap) {
            fitAllCandidatesOnMap();
        }
    }

    // ========================================================================
    // 6. EXPORTACIÓN JSON & GENERADOR DE INFORME DE ANÁLISIS PLANETARIO
    // ========================================================================
    function exportReport() {
        const targetKey = $('target-select').value;
        const modeKey = $('mission-mode').value;
        const target = analogDatabase[targetKey];
        const monthName = MONTHS_FULL[selectedMonthIndex];

        const winner1 = allRankedCandidates[0];
        const runnerUp2 = allRankedCandidates[1];
        const runnerUp3 = allRankedCandidates[2];
        const currentlyViewed = allRankedCandidates[selectedRankIndex];

        const reportData = {
            fechaYPeriodoAnalizado: {
                timestampGeneracionISO: new Date().toISOString(),
                periodoMensualAnalizado: monthName,
                indiceMes: selectedMonthIndex + 1,
                mesOptimoCalculadoDinamicamente: {
                    mes: calculatedOptimalInfo.monthName,
                    porcentajeMaximoSimilitud: `${calculatedOptimalInfo.score.toFixed(1)}%`,
                    sitioLiderEnMesOptimo: calculatedOptimalInfo.candidateName
                }
            },
            mesSeleccionado: monthName,
            porcentajeSimilitudMesSeleccionado: {
                sitioGanadorDelMes: `${winner1.currentScore.toFixed(1)}%`,
                sitioActualmenteVisualizado: `${currentlyViewed.currentScore.toFixed(1)}% (${currentlyViewed.name})`
            },
            objetivoEspacialEvaluado: {
                nombre: target.title,
                regionPlanetaria: target.planet,
                coordenadas: target.coords,
                prioridadDePrueba: MISSION_WEIGHTS[modeKey].name,
                vectorPesosAplicado: MISSION_WEIGHTS[modeKey].weights,
                ejesEvaluados: AXIS_NAMES,
                vectorObjetivoEspacial: target.targetMetrics
            },
            sitioGanadorNumero1: {
                puesto: 1,
                nombre: winner1.name,
                pais: winner1.country,
                ubicacion: winner1.location,
                coordenadas: { latitud: winner1.lat, longitud: winner1.lon },
                porcentajeSimilitudEnMes: `${winner1.currentScore.toFixed(1)}%`,
                desgloseMatematico: {
                    proximidadPonderadaL1: `${winner1.mathDetails.proximity}%`,
                    similitudCosenoPonderada: `${winner1.mathDetails.cosine}%`
                },
                indicadoresFisicosDelMes: {
                    topografiaYPendiente: winner1.monthlyMetrics[0],
                    mineralogia: winner1.monthlyMetrics[1],
                    estresTermico: winner1.monthlyMetrics[2],
                    iluminacion: winner1.monthlyMetrics[3],
                    accesoSubsuelo: winner1.monthlyMetrics[4]
                },
                ajusteEstacionalDelMes: winner1.monthDelta,
                mejorMesAnualDelSitio: `${winner1.peakInfo.monthName} (${winner1.peakInfo.score.toFixed(1)}%)`,
                capasSatelitales: winner1.datasets
            },
            puestos2y3: {
                puestoNumero2: {
                    puesto: 2,
                    nombre: runnerUp2.name,
                    pais: runnerUp2.country,
                    ubicacion: runnerUp2.location,
                    coordenadas: { latitud: runnerUp2.lat, longitud: runnerUp2.lon },
                    porcentajeSimilitudEnMes: `${runnerUp2.currentScore.toFixed(1)}%`,
                    indicadoresFisicosDelMes: runnerUp2.monthlyMetrics,
                    ajusteEstacionalDelMes: runnerUp2.monthDelta
                },
                puestoNumero3: {
                    puesto: 3,
                    nombre: runnerUp3.name,
                    pais: runnerUp3.country,
                    ubicacion: runnerUp3.location,
                    coordenadas: { latitud: runnerUp3.lat, longitud: runnerUp3.lon },
                    porcentajeSimilitudEnMes: `${runnerUp3.currentScore.toFixed(1)}%`,
                    indicadoresFisicosDelMes: runnerUp3.monthlyMetrics,
                    ajusteEstacionalDelMes: runnerUp3.monthDelta
                }
            },
            advertenciaRealityGap: {
                sitioEvaluado: currentlyViewed.name,
                limitacionesFisicasLunaMarteVsTierra: currentlyViewed.gap,
                condicionClimaticaDelMesSeleccionado: currentlyViewed.monthDelta === 0
                    ? `En ${monthName} el sitio opera en su pico estacional de fidelidad física sin penalizaciones meteorológicas.`
                    : `En ${monthName} el sitio presenta una penalización estacional de ${currentlyViewed.monthDelta} puntos debido a: ${currentlyViewed.offSeasonReason}`,
                gravedadObjetivoEspacial: target.gravity,
                temperaturaMediaObjetivoEspacial: target.temp
            },
            rankingCompletoDelPeriodo: allRankedCandidates.map((c, idx) => ({
                puesto: idx + 1,
                nombre: c.name,
                pais: c.country,
                ubicacion: c.location,
                coordenadas: `${c.lat.toFixed(2)}°, ${c.lon.toFixed(2)}°`,
                porcentajeSimilitud: `${c.currentScore.toFixed(1)}%`,
                metricasDelMes: c.monthlyMetrics,
                ajusteEstacional: c.monthDelta,
                mesOptimoIndividual: `${c.peakInfo.monthName} (${c.peakInfo.score.toFixed(1)}%)`
            }))
        };

        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `informe-gemelo-${targetKey}-${modeKey}-${monthName.toLowerCase()}.json`;
        a.click();
    }

    $('export-btn').addEventListener('click', exportReport);

    let reportCharts = [];
    let lastReportModel = null;

    function buildReportModel() {
        const targetKey = $('target-select').value;
        const modeKey = $('mission-mode').value;
        const target = analogDatabase[targetKey];
        const weights = MISSION_WEIGHTS[modeKey].weights;
        const winner = allRankedCandidates[0];
        const total = allRankedCandidates.length;

        const rows = AXIS_FULL.map((name, i) => {
            const t = target.targetMetrics[i];
            const e = winner.monthlyMetrics[i];
            const sim = Math.max(0, 100 - 1.35 * Math.abs(t - e));
            return { name, weight: weights[i], target: t, earth: e, sim, contrib: weights[i] * sim };
        });
        const prox = rows.reduce((s, r) => s + r.contrib, 0);

        const series = target.candidates.map((c) => ({
            id: c.id,
            name: c.shortName,
            isWinner: c.id === winner.id,
            data: MONTHS_FULL.map((_, m) => calculateMathematicalSimilarity(
                target.targetMetrics,
                getMonthlyEarthMetrics(c.earthMetrics, c.seasonalCurve[m]),
                weights
            ).total)
        }));

        const planetKey = target.planet.split(' ')[0];
        const planetName = planetKey === 'LUNA' ? 'Luna' : 'Marte';

        const envFactor = planetKey === 'LUNA' ? 8 : 5;
        const gapIndex = (100 - winner.currentScore) + 0.5 * Math.abs(winner.monthDelta) + envFactor;
        const gapLevel = gapIndex < 15 ? 'BAJO' : (gapIndex < 25 ? 'MODERADO' : 'ALTO');

        const sorted = [...rows].sort((a, b) => b.sim - a.sim);
        let strengths = sorted.filter((r) => r.sim >= 90).slice(0, 3);
        if (!strengths.length) strengths = sorted.slice(0, 2);
        const weakRows = [...rows].sort((a, b) => a.sim - b.sim).filter((r) => r.sim < 92).slice(0, 2);

        return {
            targetKey,
            modeKey,
            target,
            weights,
            winner,
            total,
            rows,
            prox,
            series,
            planetKey,
            planetName,
            gapIndex,
            gapLevel,
            strengths,
            weakRows,
            monthName: MONTHS_FULL[selectedMonthIndex],
            second: allRankedCandidates[1],
            modeName: MISSION_WEIGHTS[modeKey].name,
            generated: new Date().toLocaleString('es-CL')
        };
    }

    function reportTexts(M) {
        const w = M.winner;
        const topNames = M.strengths.slice(0, 2).map((r) => r.name.toLowerCase()).join(' y ');
        const lead = M.second ? ` Supera al segundo lugar (${M.second.name}, ${fmt(M.second.currentScore)}%) por ${fmt(w.currentScore - M.second.currentScore)} puntos.` : '';
        const summary = `${w.name} (${w.location}) es el mejor análogo terrestre de ${M.target.title} para ${M.monthName}, con una similitud global de ${fmt(w.currentScore)}% bajo la prioridad «${M.modeName}». Sus mayores coincidencias están en ${topNames}.${lead} Su mejor mes del año es ${w.peakInfo.monthName} (${fmt(w.peakInfo.score)}%).`;

        const strengthLines = M.strengths.map((r) => `${r.name}: ${fmt(r.sim)}% de similitud (objetivo ${r.target} vs. sitio ${r.earth}), con un peso de ${Math.round(r.weight * 100)}%.`);
        if (w.monthDelta === 0) strengthLines.push(`${M.monthName} coincide con el pico estacional del sitio: sin penalización climática.`);

        const limitLines = M.weakRows.map((r) => `${r.name}: solo ${fmt(r.sim)}% de similitud (objetivo ${r.target} vs. sitio ${r.earth}).`);
        if (!M.weakRows.length) limitLines.push('Ninguna variable cae por debajo de 92% de similitud.');
        if (w.monthDelta <= -5) limitLines.push(`Condición estacional adversa en ${M.monthName} (${w.monthDelta} pts): ${w.offSeasonReason}`);
        else if (w.monthDelta < 0) limitLines.push(`Ajuste estacional leve en ${M.monthName} (${w.monthDelta} pts): ${w.offSeasonReason}`);
        limitLines.push(w.gap);

        const gapText = `${w.gap} ${M.planetKey === 'LUNA' || M.planetKey === 'MARTE' ? PLANET_NOTES[M.planetKey] : ''}`;

        const conclusion = `Para ${M.target.title} (${M.planetName}) en ${M.monthName}, se recomienda ${w.name} como sitio de pruebas prioritario (${fmt(w.currentScore)}% de similitud, Reality Gap ${M.gapLevel}). ${w.peakInfo.monthName === M.monthName ? 'El período analizado coincide con su mes óptimo.' : `El mes óptimo del sitio es ${w.peakInfo.monthName} (${fmt(w.peakInfo.score)}%); conviene planificar las campañas allí si el calendario lo permite.`} Los resultados deben validarse con compensaciones de ingeniería para las diferencias de gravedad, presión y radiación.`;

        const CD = buildComparisonData(M);
        const colorTarget = M.planetKey === 'LUNA' ? 'celeste' : 'naranja';
        const compText = `Se muestran lado a lado la malla 3D del gemelo digital terrestre (${w.name}, en verde) y la malla del terreno objetivo (${M.target.title}, en ${colorTarget}), con el mismo plano, la misma escala vertical y la misma vista. El relieve del gemelo es ${fmt(CD.sE.relief, 2)} u. frente a ${fmt(CD.sT.relief, 2)} u. del objetivo (${fmt(CD.sE.relief / Math.max(0.01, CD.sT.relief) * 100, 0)}%).`;
        const compNote = 'Nota: ambas mallas son modelos topográficos sintéticos del prototipo (no un DEM real del sitio). El relieve del gemelo se escala con el eje Topografía del análisis (sitio / objetivo).';

        return { summary, strengthLines, limitLines, gapText, conclusion, compText, compNote };
    }

    function renderAnalysisReport(M) {
        const w = M.winner;
        const T = reportTexts(M);
        const medals = ['🥇', '🥈', '🥉', '&nbsp;&nbsp;&nbsp;'];
        const gapColor = M.gapLevel === 'BAJO' ? '#34d399' : (M.gapLevel === 'MODERADO' ? '#fbbf24' : '#fb7185');
        const sources = [M.target.dataset, w.datasets].join(' • ');
        const CD = buildComparisonData(M);
        const CT = { earth: COMP_THEME.earth, target: COMP_THEME[M.planetKey === 'LUNA' ? 'LUNA' : 'MARTE'] };

        const rowsHtml = M.rows.map((r) => `
            <tr><td>${r.name}</td><td>${Math.round(r.weight * 100)}%</td><td>${r.target} / ${r.earth}</td><td>${fmt(r.sim)}%</td><td>${fmt(r.contrib)}</td></tr>`).join('');

        const rankingHtml = allRankedCandidates.map((c, i) => `
            <div style="display:grid;grid-template-columns:28px 1fr 64px;gap:8px;align-items:center;margin:6px 0;">
                <span style="font-size:16px;">${medals[Math.min(i, 3)]}</span>
                <div><div style="font-size:12px;color:#e2e8f0;">${c.name} <span style="color:#64748b;">· ${c.country}</span></div>
                <div class="rep-bar" style="margin-top:3px;"><span style="width:${Math.max(0, Math.min(100, c.currentScore))}%;"></span></div></div>
                <b style="text-align:right;font-family:ui-monospace,monospace;font-size:13px;">${fmt(c.currentScore)}%</b>
            </div>`).join('');

        return `
            <div style="text-align:center;margin-bottom:14px;">
                <div style="font-size:10px;letter-spacing:.3em;color:#38bdf8;">NASA SPACE APPS 2026</div>
                <h1 style="font-size:20px;font-weight:800;color:#fff;letter-spacing:.08em;">PLANETARY ANALOG ANALYSIS</h1>
            </div>
            <div class="rep-head">
                <div><small>Objetivo</small><b>${M.planetName} · ${M.target.title}</b></div>
                <div><small>Sitio recomendado</small><b>${w.name}</b></div>
                <div><small>Período analizado</small><b>${M.monthName}</b></div>
                <div><small>Similitud global</small><b style="color:#34d399;">${fmt(w.currentScore)}%</b></div>
                <div><small>Ranking</small><b>🥇 #1 de ${M.total} candidatos</b></div>
            </div>

            <h2>1. Resumen</h2>
            <p><b style="color:#fff;">¿Por qué este sitio fue seleccionado?</b></p>
            <p>${T.summary}</p>

            <h2>2. ¿Por qué ${fmt(w.currentScore)}%?</h2>
            <table>
                <thead><tr><th>Variable</th><th>Peso</th><th>Obj. / Sitio</th><th>Similitud</th><th>Aporte</th></tr></thead>
                <tbody>${rowsHtml}</tbody>
                <tfoot>
                    <tr><td colspan="4">Σ Proximidad ponderada (L1)</td><td>${fmt(M.prox)}</td></tr>
                    <tr><td colspan="4">Similitud coseno ponderada</td><td>${fmt(w.mathDetails.cosine)}</td></tr>
                    <tr><td colspan="4">Índice final = 0,85·Prox + 0,15·Cos</td><td style="color:#34d399;">${fmt(w.currentScore)}</td></tr>
                </tfoot>
            </table>
            <div style="position:relative;height:210px;margin-top:12px;"><canvas id="rep-contrib-chart"></canvas></div>

            <h2>3. Comparación del terreno: malla 3D y fotografía</h2>
            <p>${T.compText}</p>
            <div class="rep-3d-grid">
                <div class="rep-3d-card" style="--c:${CT.earth.css};">
                    <div class="rep-3d-title"><i></i>${CT.earth.label} · ${w.name}</div>
                    <div class="rep-3d-stage" id="rep3d-earth"></div>
                </div>
                <div class="rep-3d-card" style="--c:${CT.target.css};">
                    <div class="rep-3d-title"><i></i>${CT.target.label} · ${M.target.title}</div>
                    <div class="rep-3d-stage" id="rep3d-target"></div>
                </div>
            </div>
            <div class="rep-3d-ctrl no-print">
                <label><input type="checkbox" id="rep3d-wire" checked> Malla</label>
                <label><input type="checkbox" id="rep3d-rot" checked> Rotar</label>
                <button type="button" id="rep3d-reset">Restablecer vista</button>
                <span>Arrastra para girar ambos · rueda para acercar</span>
            </div>
            <div class="rep-3d-grid" style="margin-top:4px;">
                <div class="rep-3d-card" style="--c:${CT.earth.css};">
                    <div class="rep-3d-title"><i></i>Foto · ${w.name}</div>
                    <div class="rep-photo-stage" id="rep-photo-earth"><span>Cargando imagen satelital…</span></div>
                    <div class="rep-photo-cap" id="rep-cap-earth">&nbsp;</div>
                </div>
                <div class="rep-3d-card" style="--c:${CT.target.css};">
                    <div class="rep-3d-title"><i></i>Foto · ${M.target.title}</div>
                    <div class="rep-photo-stage" id="rep-photo-target"><span>Buscando foto del sitio…</span></div>
                    <div class="rep-photo-cap" id="rep-cap-target">&nbsp;</div>
                </div>
            </div>
            <table>
                <thead><tr><th>Indicador de la malla</th><th style="color:${CT.earth.css};">${CT.earth.label}</th><th style="color:${CT.target.css};">${CT.target.label}</th></tr></thead>
                <tbody>
                    <tr><td>Relieve relativo (u. escena)</td><td>${fmt(CD.sE.relief, 2)}</td><td>${fmt(CD.sT.relief, 2)}</td></tr>
                    <tr><td>Rugosidad (σ de altura)</td><td>${fmt(CD.sE.sigma, 2)}</td><td>${fmt(CD.sT.sigma, 2)}</td></tr>
                    <tr><td>Similitud topográfica</td><td colspan="2">${fmt(M.rows[0].sim)}%</td></tr>
                </tbody>
            </table>
            <p style="font-size:11px;color:#64748b;margin-top:6px;">${T.compNote}</p>

            <h2>4. Análisis temporal</h2>
            <div style="position:relative;height:230px;"><canvas id="rep-month-chart"></canvas></div>
            <div class="rep-box" style="margin-top:10px;text-align:center;">
                <small style="font-size:10px;letter-spacing:.14em;color:#64748b;">🏆 MES ÓPTIMO DEL SITIO</small><br>
                <b style="font-size:16px;color:#fff;">${w.peakInfo.monthName.toUpperCase()} — ${fmt(w.peakInfo.score)}%</b>
                <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Óptimo global de la misión: ${calculatedOptimalInfo.monthName} — ${fmt(calculatedOptimalInfo.score)}% (${calculatedOptimalInfo.candidateName})</div>
            </div>

            <h2>5. Ranking de candidatos</h2>
            ${rankingHtml}

            <h2>6. Fortalezas y limitaciones</h2>
            <div class="rep-box"><p style="color:#34d399;font-weight:700;">✅ Principales fortalezas</p><ul style="padding-left:18px;list-style:disc;">${T.strengthLines.map((l) => `<li>${l}</li>`).join('')}</ul></div>
            <div class="rep-box" style="margin-top:8px;"><p style="color:#fbbf24;font-weight:700;">⚠️ Principales limitaciones</p><ul style="padding-left:18px;list-style:disc;">${T.limitLines.map((l) => `<li>${l}</li>`).join('')}</ul></div>

            <h2>7. Reality Gap</h2>
            <div class="rep-box">
                <p>Nivel: <b style="color:${gapColor};font-size:15px;">${M.gapLevel}</b> <span style="font-size:11px;color:#64748b;">(índice ${fmt(M.gapIndex)})</span></p>
                <p style="margin-top:6px;">${T.gapText}</p>
            </div>

            <h2>8. Conclusión</h2>
            <p>${T.conclusion}</p>

            <h2>Metodología</h2>
            <div class="rep-box" style="font-size:12px;">
                <p><b style="color:#fff;">Variables utilizadas:</b> ${AXIS_FULL.join(', ')} (escala normalizada 0–100).</p>
                <p><b style="color:#fff;">Pesos utilizados (${M.modeName}):</b> ${AXIS_FULL.map((n, i) => `${n} ${Math.round(M.weights[i] * 100)}%`).join(' · ')}.</p>
                <p><b style="color:#fff;">Método de cálculo:</b> similitud por eje = máx(0, 100 − 1,35·|objetivo − sitio|); Proximidad = Σ Wᵢ·similitudᵢ; Coseno ponderado entre vectores; Índice = 0,85·Proximidad + 0,15·Coseno. Las métricas del sitio se ajustan cada mes con una curva estacional (sensibilidad por eje). Reality Gap = (100 − similitud) + 0,5·|ajuste estacional| + factor ambiental (Luna 8, Marte 5): &lt;15 bajo, &lt;25 moderado, ≥25 alto.</p>
                <p><b style="color:#fff;">Fuente de datos:</b> ${sources}. Las métricas son valores normalizados precargados o derivados de DEM LOLA/MOLA/sintético en este prototipo.</p>
                <p><b style="color:#fff;">Fecha de generación:</b> ${M.generated}</p>
            </div>`;
    }

    function drawReportCharts(M) {
        reportCharts.forEach((c) => c.destroy());
        reportCharts = [];
        const tick = '#94a3b8';
        const grid = 'rgba(148,163,184,0.2)';

        reportCharts.push(new Chart($('rep-contrib-chart'), {
            type: 'bar',
            data: {
                labels: M.rows.map((r) => r.name),
                datasets: [
                    { label: 'Máximo posible (peso×100)', data: M.rows.map((r) => r.weight * 100), backgroundColor: 'rgba(100,116,139,0.45)' },
                    { label: 'Aporte real', data: M.rows.map((r) => Number(r.contrib.toFixed(1))), backgroundColor: '#10b981' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { ticks: { color: tick }, grid: { color: grid } }, y: { ticks: { color: tick }, grid: { color: grid } } },
                plugins: { legend: { labels: { color: tick, font: { size: 10 } } } }
            }
        }));

        const palette = ['#818cf8', '#f59e0b', '#f43f5e', '#94a3b8', '#38bdf8', '#a855f7'];
        const all = M.series.flatMap((s) => s.data);
        const peakIdx = M.winner.peakInfo.monthIndex;
        let k = 0;

        reportCharts.push(new Chart($('rep-month-chart'), {
            type: 'line',
            data: {
                labels: MONTHS_SHORT,
                datasets: M.series.map((s) => {
                    const col = s.isWinner ? '#10b981' : palette[k++ % palette.length];
                    return {
                        label: s.name + (s.isWinner ? ' (#1)' : ''),
                        data: s.data,
                        borderColor: col,
                        backgroundColor: col,
                        borderWidth: s.isWinner ? 3 : 1.5,
                        tension: 0.3,
                        pointRadius: s.isWinner ? s.data.map((_, m) => (m === peakIdx ? 7 : (m === selectedMonthIndex ? 5 : 2))) : 1.5
                    };
                })
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        min: Math.floor(Math.min(...all) / 5) * 5 - 5,
                        max: 100,
                        ticks: { color: tick },
                        grid: { color: grid },
                        title: { display: true, text: 'Similitud (%)', color: tick }
                    },
                    x: { ticks: { color: tick }, grid: { color: grid } }
                },
                plugins: { legend: { labels: { color: tick, font: { size: 10 } } } }
            }
        }));
    }


    // ========================================================================
    // 6b. COMPARACIÓN LADO A LADO DE LAS MALLAS 3D (GEMELO TERRESTRE vs LUNA/MARTE)
    //     Mismo plano, misma escala vertical, rotación/zoom sincronizados y un
    //     color distinto por cuerpo: verde (Tierra), celeste (Luna), naranja (Marte).
    // ========================================================================
    const COMP_N = 80;
    const COMP_SIZE = 6;
    const COMP_TILT = -Math.PI / 2.5;
    const COMP_THEME = {
        earth: { css: '#10b981', hex: 0x10b981, low: 0x064e3b, high: 0xa7f3d0, label: 'Gemelo terrestre' },
        LUNA: { css: '#38bdf8', hex: 0x38bdf8, low: 0x0c4a6e, high: 0xbae6fd, label: 'Luna' },
        MARTE: { css: '#f97316', hex: 0xf97316, low: 0x7c2d12, high: 0xfed7aa, label: 'Marte' }
    };

    function compSeed(str) {
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    function compNoise(seed) {
        let a = seed;
        const rnd = () => {
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        const G = 64;
        const grid = new Float32Array(G * G);
        for (let i = 0; i < grid.length; i++) grid[i] = rnd() * 2 - 1;
        const at = (i, j) => grid[((j % G + G) % G) * G + ((i % G + G) % G)];
        const sm = (t) => t * t * (3 - 2 * t);
        const base = (x, y) => {
            const i = Math.floor(x);
            const j = Math.floor(y);
            const tx = sm(x - i);
            const ty = sm(y - j);
            return (at(i, j) * (1 - tx) + at(i + 1, j) * tx) * (1 - ty)
                + (at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx) * ty;
        };
        return (x, y) => {
            let amp = 0.5;
            let f = 1;
            let sum = 0;
            for (let o = 0; o < 5; o++) {
                sum += amp * base(x * f, y * f);
                amp *= 0.5;
                f *= 2.03;
            }
            return sum;
        };
    }

    // Forma base de cada gemelo terrestre (modelo procedural determinista por sitio)
    const EARTH_LANDFORM = {
        licancabur: 'cone', maunaloa: 'cone',
        haughton: 'crater', krafla: 'crater',
        mcmurdo: 'valleys', wadirum: 'valleys', taltal: 'valleys',
        stillwater: 'strata', pilbara: 'strata', riotinto: 'strata', axelheiberg: 'strata',
        pajonales: 'flat', racetrack: 'flat'
    };

    function earthRawHeight(cand, noise, x, y) {
        const d = Math.sqrt(x * x + y * y);
        const n = noise(x * 0.9 + 7.1, y * 0.9 + 3.3);
        switch (EARTH_LANDFORM[cand.id] || 'rolling') {
            case 'cone':
                return 1.6 * Math.exp(-0.5 * d * d) - (d < 0.4 ? 0.3 * (1 - (d / 0.4) ** 2) : 0) + 0.35 * n;
            case 'crater': {
                const bowl = d < 2.0 ? -1.0 * (1 - (d / 2.0) ** 2) : 0;
                const rim = 0.35 * Math.exp(-((d - 2.0) ** 2) / 0.18);
                return bowl + rim + 0.22 * n;
            }
            case 'valleys':
                return 0.55 * (1 - 2 * Math.abs(Math.sin(1.15 * y + 1.6 * noise(x * 0.45, y * 0.45)))) + 0.3 * n;
            case 'strata': {
                const b = 0.7 * noise(x * 0.5 + 2, y * 0.5 + 9) + 0.3 * Math.sin(x * 1.1);
                return Math.round(b * 5) / 5 + 0.1 * n;
            }
            case 'flat':
                return 0.25 * n + 0.08 * Math.sin(x * 2.2 + y * 1.4);
            default:
                return 0.9 * n + 0.25 * Math.sin(x * 1.3) * Math.cos(y * 1.1);
        }
    }

    function compStats(h) {
        let mn = Infinity;
        let mx = -Infinity;
        let sum = 0;
        for (let i = 0; i < h.length; i++) {
            if (h[i] < mn) mn = h[i];
            if (h[i] > mx) mx = h[i];
            sum += h[i];
        }
        const mean = sum / h.length;
        let v = 0;
        for (let i = 0; i < h.length; i++) v += (h[i] - mean) ** 2;
        return { mn, mx, mean, relief: mx - mn, sigma: Math.sqrt(v / h.length) };
    }

    function buildComparisonData(M) {
        if (M.comp) return M.comp;
        const pts = (COMP_N + 1) * (COMP_N + 1);
        const hT = new Float32Array(pts);
        const hE = new Float32Array(pts);
        const noise = compNoise(compSeed(M.winner.id));
        let k = 0;
        for (let j = 0; j <= COMP_N; j++) {
            for (let i = 0; i <= COMP_N; i++) {
                const x = -COMP_SIZE / 2 + (COMP_SIZE * i) / COMP_N;
                const y = COMP_SIZE / 2 - (COMP_SIZE * j) / COMP_N;
                hT[k] = targetHeightAt(M.targetKey, x, y);
                hE[k] = earthRawHeight(M.winner, noise, x, y);
                k++;
            }
        }
        const sT = compStats(hT);
        const sE0 = compStats(hE);
        // El relieve del gemelo se escala con el eje Topografía del análisis (sitio / objetivo)
        const topoRatio = Math.max(0.5, Math.min(1.15, M.winner.monthlyMetrics[0] / Math.max(1, M.target.targetMetrics[0])));
        const targetRelief = Math.max(0.2, sT.relief);
        const scale = (targetRelief * topoRatio) / Math.max(0.05, sE0.relief);
        for (let i = 0; i < pts; i++) {
            hT[i] -= sT.mean;
            hE[i] = (hE[i] - sE0.mean) * scale;
        }
        M.comp = { hT, hE, sT: compStats(hT), sE: compStats(hE), topoRatio };
        return M.comp;
    }

    let repComp = null;

    function disposeTerrainComparison() {
        if (!repComp) return;
        repComp.alive = false;
        cancelAnimationFrame(repComp.raf);
        repComp.items.forEach((it) => {
            it.renderer.dispose();
            it.solidGeo.dispose();
            it.solidMat.dispose();
            it.wireMat.dispose();
            if (it.renderer.domElement.parentNode) it.renderer.domElement.parentNode.removeChild(it.renderer.domElement);
        });
        repComp = null;
    }

    function mountTerrainComparison(M) {
        disposeTerrainComparison();
        const data = buildComparisonData(M);
        const specs = [
            { hostId: 'rep3d-earth', h: data.hE, theme: COMP_THEME.earth },
            { hostId: 'rep3d-target', h: data.hT, theme: COMP_THEME[M.planetKey === 'LUNA' ? 'LUNA' : 'MARTE'] }
        ];
        // Misma escala vertical para ambos: la diferencia de relieve se ve tal cual
        const state = { rz: 0, rx: COMP_TILT, dist: 7.2, auto: true, drag: null };
        const items = [];

        specs.forEach((sp) => {
            const host = $(sp.hostId);
            if (!host) return;
            const w = host.clientWidth || 320;
            const hgt = host.clientHeight || 260;

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(45, w / hgt, 0.1, 100);
            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setSize(w, hgt);
            host.appendChild(renderer.domElement);

            scene.add(new THREE.AmbientLight(0xffffff, 0.75));
            const dl = new THREE.DirectionalLight(0xffffff, 1.3);
            dl.position.set(5, 10, 7);
            scene.add(dl);
            const pl = new THREE.PointLight(sp.theme.hex, 1.6, 50);
            pl.position.set(-5, 5, -5);
            scene.add(pl);

            const geo = new THREE.PlaneGeometry(COMP_SIZE, COMP_SIZE, COMP_N, COMP_N);
            const pos = geo.attributes.position;
            const cols = new Float32Array(pos.count * 3);
            const lo = new THREE.Color(sp.theme.low);
            const hi = new THREE.Color(sp.theme.high);
            const c = new THREE.Color();
            const mn = Math.min(data.sT.mn, data.sE.mn);
            const mx = Math.max(data.sT.mx, data.sE.mx);
            const span = Math.max(0.05, mx - mn);
            for (let i = 0; i < pos.count; i++) {
                pos.setZ(i, sp.h[i]);
                c.copy(lo).lerp(hi, (sp.h[i] - mn) / span);
                cols[i * 3] = c.r;
                cols[i * 3 + 1] = c.g;
                cols[i * 3 + 2] = c.b;
            }
            geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
            geo.computeVertexNormals();

            const solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.05 });
            const wireMat = new THREE.MeshBasicMaterial({ color: sp.theme.hex, wireframe: true, transparent: true, opacity: 0.32 });
            const group = new THREE.Group();
            group.add(new THREE.Mesh(geo, solidMat));
            group.add(new THREE.Mesh(geo, wireMat));
            scene.add(group);

            items.push({ host, scene, camera, renderer, group, solidGeo: geo, solidMat, wireMat, wire: group.children[1] });
        });

        const apply = () => {
            items.forEach((it) => {
                it.group.rotation.set(state.rx, 0, state.rz);
                it.camera.position.set(0, state.dist * 0.55, state.dist);
                it.camera.lookAt(0, 0, 0);
            });
        };
        const renderAll = () => { apply(); items.forEach((it) => it.renderer.render(it.scene, it.camera)); };

        items.forEach((it) => {
            it.host.addEventListener('pointerdown', (e) => {
                state.drag = { x: e.clientX, y: e.clientY };
                it.host.setPointerCapture(e.pointerId);
            });
            it.host.addEventListener('pointermove', (e) => {
                if (!state.drag) return;
                state.rz -= (e.clientX - state.drag.x) * 0.008;
                state.rx = Math.max(-1.45, Math.min(-0.25, state.rx + (e.clientY - state.drag.y) * 0.005));
                state.drag = { x: e.clientX, y: e.clientY };
            });
            const end = () => { state.drag = null; };
            it.host.addEventListener('pointerup', end);
            it.host.addEventListener('pointercancel', end);
            it.host.addEventListener('wheel', (e) => {
                e.preventDefault();
                state.dist = Math.max(4, Math.min(14, state.dist * Math.exp(e.deltaY * 0.001)));
            }, { passive: false });
        });

        const wireCk = $('rep3d-wire');
        const rotCk = $('rep3d-rot');
        const resetBtn = $('rep3d-reset');
        if (wireCk) wireCk.addEventListener('change', (e) => items.forEach((it) => { it.wire.visible = e.target.checked; }));
        if (rotCk) rotCk.addEventListener('change', (e) => { state.auto = e.target.checked; });
        if (resetBtn) resetBtn.addEventListener('click', () => { state.rz = 0; state.rx = COMP_TILT; state.dist = 7.2; });

        repComp = { items, state, alive: true, raf: 0, renderAll };
        const loop = () => {
            if (!repComp || !repComp.alive) return;
            repComp.raf = requestAnimationFrame(loop);
            if (state.auto && !state.drag) state.rz += 0.004;
            renderAll();
        };
        loop();
    }


    // ------------------------------------------------------------------------
    // Fotos de ambos terrenos (debajo de las mallas 3D del informe)
    //   · Tierra: imagen satelital Esri World Imagery centrada en el sitio (misma fuente del mapa).
    //   · Luna/Marte: foto del sitio buscada en Wikipedia (NASA y otras fuentes), igual que los
    //     simuladores; si no hay, imagen global de referencia del cuerpo.
    // ------------------------------------------------------------------------
    let repPhotoToken = 0;
    const PHOTO_FALLBACK = {
        LUNA: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/FullMoon2010.jpg',
        MARTE: 'https://upload.wikimedia.org/wikipedia/commons/0/02/OSIRIS_Mars_true_color.jpg'
    };
    const PHOTO_PRESET_QUERY = {
        shackleton: 'Shackleton crater Moon',
        marius: 'Marius Hills Moon',
        jezero: 'Jezero crater Mars',
        arcadia: 'Arcadia Planitia Mars'
    };

    function earthSatelliteUrl(lat, lon, w, h) {
        const latSpan = 0.22;
        const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
        const lonSpan = (latSpan * (w / h)) / cosLat;
        const bbox = [lon - lonSpan / 2, lat - latSpan / 2, lon + lonSpan / 2, lat + latSpan / 2].map((v) => v.toFixed(5)).join(',');
        return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=3857&size=${w},${h}&format=jpg&f=image`;
    }

    function targetPhotoQuery(M) {
        const t = M.target;
        if (t.lunarFeatureObj) {
            const f = t.lunarFeatureObj;
            return f.k === 'mar' ? f.lat : (f.k === 'sitio' ? `${f.lat} mission Moon` : (f.k === 'cuenca' ? `${f.lat} lunar basin` : `${f.lat} lunar crater`));
        }
        if (t.marsFeatureObj) {
            const f = t.marsFeatureObj;
            return (f.k === 'mar' || f.k === 'volcan' || f.k === 'canon' || f.k === 'sitio') ? `${f.lat} Mars` : f.lat;
        }
        return PHOTO_PRESET_QUERY[M.targetKey] || `${t.title} ${M.planetName}`;
    }

    function withTimeout(promise, ms) {
        return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
    }

    function showPhoto(hostId, capId, url, caption, onFail) {
        const host = $(hostId);
        const cap = $(capId);
        if (!host) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.alt = caption;
        img.onload = () => {
            if (!$(hostId)) return;
            host.innerHTML = '';
            host.appendChild(img);
            if (cap) cap.textContent = caption;
        };
        img.onerror = () => { if (onFail) onFail(); else { host.innerHTML = '<span>No se pudo cargar la imagen (¿sin conexión?).</span>'; if (cap) cap.textContent = ' '; } };
        img.src = url;
    }

    async function loadReportPhotos(M) {
        const token = ++repPhotoToken;
        const alive = () => token === repPhotoToken && $('rep-photo-earth');

        // Tierra: imagen satelital del sitio
        const wi = M.winner;
        showPhoto(
            'rep-photo-earth',
            'rep-cap-earth',
            earthSatelliteUrl(wi.lat, wi.lon, 640, 420),
            `Imagen satelital · Esri World Imagery · ${Math.abs(wi.lat).toFixed(2)}° ${wi.lat < 0 ? 'S' : 'N'}, ${Math.abs(wi.lon).toFixed(2)}° ${wi.lon < 0 ? 'O' : 'E'} (≈ 25 km de ancho)`
        );

        // Luna / Marte: foto del sitio desde Wikipedia, con respaldo global
        const fallback = () => {
            if (!alive()) return;
            showPhoto(
                'rep-photo-target',
                'rep-cap-target',
                PHOTO_FALLBACK[M.planetKey === 'LUNA' ? 'LUNA' : 'MARTE'],
                `Imagen global de referencia de ${M.planetName} (no se encontró una foto específica del sitio)`
            );
        };
        try {
            const j = await withTimeout(fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrlimit=8&prop=pageimages&piprop=thumbnail&pithumbsize=640&gsrsearch=${encodeURIComponent(targetPhotoQuery(M))}`).then((r) => r.json()), 8000);
            if (!alive()) return;
            const hit = Object.values((j.query || {}).pages || {})
                .filter((pg) => pg.thumbnail)
                .sort((a, b) => a.index - b.index)[0];
            if (!hit) { fallback(); return; }
            showPhoto('rep-photo-target', 'rep-cap-target', hit.thumbnail.source, `${hit.title} · Wikipedia (NASA y otras fuentes)`, fallback);
        } catch (err) {
            fallback();
        }
    }

    // Los <canvas> WebGL deben tener un cuadro vigente al imprimir / exportar a PDF
    window.addEventListener('beforeprint', () => { if (repComp) repComp.renderAll(); });

    function openAnalysisReport() {
        const M = buildReportModel();
        lastReportModel = M;
        $('report-content').innerHTML = renderAnalysisReport(M);
        $('report-overlay').classList.remove('hidden');
        $('report-overlay').scrollTop = 0;
        drawReportCharts(M);
        mountTerrainComparison(M);
        loadReportPhotos(M);
    }

    function closeAnalysisReport() {
        repPhotoToken++;
        disposeTerrainComparison();
        $('report-overlay').classList.add('hidden');
    }

    function downloadReportText() {
        const M = lastReportModel || buildReportModel();
        const w = M.winner;
        const T = reportTexts(M);
        const line = '━'.repeat(36);
        const thin = '─'.repeat(36);
        const pad = (s, n) => String(s).padEnd(n);
        const medals = ['🥇', '🥈', '🥉', '  '];

        const out = [
            line, '       PLANETARY ANALOG ANALYSIS', line,
            'OBJETIVO', `${M.planetName} — ${M.target.title}`,
            'SITIO RECOMENDADO', w.name,
            'PERÍODO ANALIZADO', M.monthName,
            'SIMILITUD GLOBAL', `${fmt(w.currentScore)}%`,
            'RANKING', `🥇 #1 de ${M.total} candidatos`, '',
            '1. RESUMEN', thin, T.summary, '',
            `2. ¿POR QUÉ ${fmt(w.currentScore)}%?`, thin,
            pad('Variable', 16) + pad('Peso', 8) + pad('Similitud', 12) + 'Aporte',
            ...M.rows.map((r) => pad(r.name, 16) + pad(`${Math.round(r.weight * 100)}%`, 8) + pad(`${fmt(r.sim)}%`, 12) + fmt(r.contrib)),
            `Proximidad L1: ${fmt(M.prox)} | Coseno: ${fmt(w.mathDetails.cosine)} | Índice = 0,85·Prox + 0,15·Cos = ${fmt(w.currentScore)}`, '',
            '3. COMPARACIÓN DEL TERRENO: MALLA 3D Y FOTOGRAFÍA', thin, T.compText,
            `Relieve relativo: gemelo terrestre ${fmt(buildComparisonData(M).sE.relief, 2)} u. | ${M.planetName} ${fmt(buildComparisonData(M).sT.relief, 2)} u.`,
            `Rugosidad (σ): gemelo terrestre ${fmt(buildComparisonData(M).sE.sigma, 2)} | ${M.planetName} ${fmt(buildComparisonData(M).sT.sigma, 2)}`, T.compNote, '',
            '4. ANÁLISIS TEMPORAL', thin,
            ...MONTHS_FULL.map((m, i) => pad(m, 12) + `${fmt(M.series.find((s) => s.isWinner).data[i])}%`),
            `🏆 MES ÓPTIMO: ${w.peakInfo.monthName.toUpperCase()} — ${fmt(w.peakInfo.score)}%`, '',
            '5. RANKING DE CANDIDATOS', thin,
            ...allRankedCandidates.map((c, i) => `${medals[Math.min(i, 3)]} ${pad(c.name, 36)} ${fmt(c.currentScore)}%`), '',
            '6. FORTALEZAS Y LIMITACIONES', thin,
            '✅ Principales fortalezas', ...T.strengthLines.map((l) => ` - ${l}`),
            '⚠️ Principales limitaciones', ...T.limitLines.map((l) => ` - ${l}`), '',
            '7. REALITY GAP', thin, `Nivel: ${M.gapLevel} (índice ${fmt(M.gapIndex)})`, T.gapText, '',
            '8. CONCLUSIÓN', thin, T.conclusion, '',
            'METODOLOGÍA', thin,
            `Variables: ${AXIS_FULL.join(', ')}`,
            `Pesos (${M.modeName}): ${AXIS_FULL.map((n, i) => `${n} ${Math.round(M.weights[i] * 100)}%`).join(', ')}`,
            'Método: similitud por eje = máx(0, 100 − 1,35·|obj − sitio|); Índice = 0,85·Proximidad ponderada + 0,15·Coseno ponderado; ajuste estacional mensual por sitio.',
            `Fuente de datos: ${M.target.dataset} • ${w.datasets}`,
            `Fecha de generación: ${M.generated}`, line
        ].join('\n');

        const blob = new Blob([out], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `analisis-${M.targetKey}-${M.modeKey}-${M.monthName.toLowerCase()}.txt`;
        a.click();
    }

    async function downloadReportPDF() {
        const M = lastReportModel || buildReportModel();
        const btn = $('btn-print-report');
        const reportEl = $('report-content');
        if (!reportEl) return;

        // Asegurar que los canvas WebGL 3D tengan el frame actual renderizado
        if (repComp) repComp.renderAll();

        const filename = `analisis-${M.targetKey}-${M.modeKey}-${M.monthName.toLowerCase()}.pdf`;
        const originalText = btn ? btn.textContent : '⬇ Descargar PDF';

        if (typeof html2pdf === 'undefined') {
            alert('La librería html2pdf aún se está cargando. Por favor, intenta de nuevo en unos segundos.');
            return;
        }

        try {
            if (btn) {
                btn.disabled = true;
                btn.textContent = '⏳ Generando PDF…';
            }

            const opt = {
                margin: [8, 8, 8, 8],
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#0f1626',
                    logging: false,
                    ignoreElements: (el) => el.classList && el.classList.contains('no-print')
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };

            await html2pdf().set(opt).from(reportEl).save();
        } catch (err) {
            console.error('Error al generar el PDF:', err);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }
    }

    $('report-btn').addEventListener('click', openAnalysisReport);
    $('btn-close-report').addEventListener('click', closeAnalysisReport);
    $('btn-download-txt').addEventListener('click', downloadReportText);
    $('btn-print-report').addEventListener('click', downloadReportPDF);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAnalysisReport();
    });

    $('target-select').addEventListener('change', () => updateDashboard(true));
    $('mission-mode').addEventListener('change', () => updateDashboard(true));
    $('month-slider').addEventListener('input', (e) => {
        selectedMonthIndex = parseInt(e.target.value, 10);
        updateDashboard(false);
    });

    // ========================================================================
    // 7. MOTOR CARTOGRÁFICO LUNAR EQUIRRECTANGULAR (LOLA / LROC)
    // ========================================================================
    const { W, H, KM, STEP, GW, GH, RM } = LUNAR_CONSTANTS;
    const PPD = W / 360;
    const S = W / GW;
    const rad = Math.PI / 180;

    const cv = $('c');
    const g = cv.getContext('2d');
    const ro = $('ro');
    const st = $('st');

    const X = (o) => (o + 180) * PPD;
    const Y = (a) => (90 - a) * PPD;
    const cl = (v, a, b) => Math.max(a, Math.min(b, v));
    const sm = (t) => t * t * (3 - 2 * t);

    const MR = LUNAR_MARIA.map((m, i) => ({
        n: m[0],
        es: m[1],
        u: m[1].toUpperCase(),
        a: m[2],
        o: m[3],
        ew: m[4],
        rx: m[4] / (KM * Math.max(0.25, Math.cos(m[2] * rad))),
        ry: m[5] / KM,
        s: (i + 1) * 1.3,
        D: m[6],
        f: m[7]
    }));

    const E = new Float32Array(GW * GH);
    const M_MASK = new Float32Array(GW * GH);
    let realDEM = false;
    let hs = null;
    let cont = [];
    let photoLROC = null;
    let selLunar = null;

    // Malla 3D del DEM lunar (se actualiza al seleccionar un terreno)
    const lunarDEM3D = createDEM3DViewer({
        hostId: 'dem3d-lunar',
        color: 0x38bdf8,
        low: 0x1e293b,
        high: 0xe2e8f0,
        arr: E,
        GW,
        GH,
        STEP,
        KM,
        radius: (f) => R0(f),
        csn: (f) => csn(f),
        isActive: () => activeView === 'lunar',
        isReal: () => realDEM,
        realName: 'DEM LOLA cargado'
    });

    function rng(a) {
        return function () {
            a |= 0;
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const hsh = (x, y) => {
        let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
    };

    function vn(x, y, w) {
        const xi = Math.floor(x);
        const yi = Math.floor(y);
        const fx = sm(x - xi);
        const fy = sm(y - yi);
        const x0 = ((xi % w) + w) % w;
        const x1 = (x0 + 1) % w;
        const a = hsh(x0, yi);
        const b = hsh(x1, yi);
        const c = hsh(x0, yi + 1);
        const d = hsh(x1, yi + 1);
        return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    }

    function fbm(lon, lat) {
        let s = 0;
        let amp = 0.5;
        let f = 1;
        for (let o = 0; o < 5; o++) {
            s += amp * vn(((lon + 180) / 22.5) * f, ((lat + 90) / 22.5) * f + o * 17, 16 * f);
            amp *= 0.5;
            f *= 2;
        }
        return s;
    }

    function mask(lon, lat) {
        let m = 0;
        for (const q of MR) {
            const dl = ((lon - q.o + 540) % 360) - 180;
            const da = lat - q.a;
            if (Math.abs(da) > q.ry * 1.5 || Math.abs(dl) > q.rx * 1.5) continue;
            const u = dl / q.rx;
            const v = da / q.ry;
            const an = Math.atan2(v, u);
            const f = 1 + 0.2 * (0.5 * Math.sin(2 * an + q.s) + 0.3 * Math.sin(3 * an + q.s * 1.7) + 0.2 * Math.sin(5 * an + q.s * 2.3));
            const d = Math.hypot(u, v);
            m = Math.max(m, cl((f - d) / (0.12 * f), 0, 1));
        }
        return m;
    }

    function dist(a, b, c, d) {
        const p = a * rad;
        const q = c * rad;
        return RM * Math.acos(cl(Math.sin(p) * Math.sin(q) + Math.cos(p) * Math.cos(q) * Math.cos((b - d) * rad), -1, 1));
    }

    function bowl(la, lo, D) {
        const R = D / 2;
        const dp = Math.min(5, 0.07 * Math.pow(D, 0.9));
        const cs = Math.max(0.12, Math.cos(la * rad));
        const hw = Math.min(GW / 2, Math.ceil((R * 1.4) / (KM * cs) / STEP));
        const hh = Math.ceil((R * 1.4) / KM / STEP);
        const j0 = Math.floor((90 - la) / STEP);
        const i0 = Math.floor((lo + 180) / STEP);

        for (let dj = -hh; dj <= hh; dj++) {
            const j = j0 + dj;
            if (j < 0 || j >= GH) continue;
            const lat = 90 - (j + 0.5) * STEP;
            for (let di = -hw; di <= hw; di++) {
                const i = (((i0 + di) % GW) + GW) % GW;
                const lon = -180 + (i + 0.5) * STEP;
                const u = dist(lat, lon, la, lo) / R;
                if (u > 1.4) continue;
                let v = u < 1 ? -dp * (1 - u * u) : 0;
                v += 0.3 * dp * Math.exp(-(((u - 1.02) / 0.12) ** 2));
                if (D > 40) v += 0.25 * dp * Math.exp(-((u / 0.1) ** 2));
                E[j * GW + i] += v;
            }
        }
    }

    function synth() {
        realDEM = false;
        for (let j = 0; j < GH; j++) {
            const lat = 90 - (j + 0.5) * STEP;
            for (let i = 0; i < GW; i++) {
                const lon = -180 + (i + 0.5) * STEP;
                const k = j * GW + i;
                const e = (fbm(lon, lat) - 0.48) * 3.2 + 1.8 * sm(cl((Math.abs(lon) - 70) / 60, 0, 1));
                const m = mask(lon, lat);
                M_MASK[k] = m;
                E[k] = e * (1 - 0.8 * m) - 2.4 * m;
            }
        }
        LUNAR_CRATERS.forEach((c) => bowl(c[1], c[2], c[3]));
        const r = rng(7);
        for (let n = 0; n < 450; n++) {
            bowl(Math.asin(2 * r() - 1) / rad, r() * 360 - 180, Math.min(70, 12 * Math.pow(1 - r(), -1 / 1.8)));
        }
    }

    function shade() {
        hs = hs || document.createElement('canvas');
        hs.width = GW;
        hs.height = GH;
        const x = hs.getContext('2d');
        const im = x.createImageData(GW, GH);
        const d = im.data;
        const ca = Math.cos(35 * rad);
        const sa = Math.sin(35 * rad);
        const lx = -0.7071 * ca;
        const ly = 0.7071 * ca;

        for (let j = 0; j < GH; j++) {
            const lat = 90 - (j + 0.5) * STEP;
            const dx = 2 * KM * STEP * Math.max(0.25, Math.cos(lat * rad));
            const dy = 2 * KM * STEP;
            for (let i = 0; i < GW; i++) {
                const k = j * GW + i;
                const zx = ((E[j * GW + Math.min(i + 1, GW - 1)] - E[j * GW + Math.max(i - 1, 0)]) / dx) * 6;
                const zy = (-(E[Math.min(j + 1, GH - 1) * GW + i] - E[Math.max(j - 1, 0) * GW + i]) / dy) * 6;
                const nn = Math.hypot(zx, zy, 1);
                const sh = Math.max(0, (-zx * lx - zy * ly + sa) / nn);
                const b = cl(0.55 + 1.5 * (sh - sa), 0.15, 1.3);
                const t = realDEM ? cl((E[k] + 3) / 4, 0, 1) : 1 - M_MASK[k];
                const al = 62 + 66 * t;
                const o = k * 4;
                d[o] = al * b * 0.97;
                d[o + 1] = al * b * 0.99;
                d[o + 2] = al * b * 1.05;
                d[o + 3] = 255;
            }
        }
        x.putImageData(im, 0, 0);
    }

    function contours() {
        cont = [];
        let mn = 1e9;
        let mx = -1e9;
        for (const v of E) {
            if (v < mn) mn = v;
            if (v > mx) mx = v;
        }
        const T4 = [[], [3, 0], [0, 1], [3, 1], [1, 2], [3, 0, 1, 2], [0, 2], [3, 2], [2, 3], [0, 2], [0, 1, 2, 3], [2, 1], [3, 1], [0, 1], [3, 0], []];
        for (let L = Math.ceil(mn); L <= mx; L++) {
            const p = new Path2D();
            for (let j = 0; j < GH - 1; j++) {
                for (let i = 0; i < GW - 1; i++) {
                    const a = E[j * GW + i];
                    const b = E[j * GW + i + 1];
                    const c = E[(j + 1) * GW + i + 1];
                    const d = E[(j + 1) * GW + i];
                    const m = (a > L ? 1 : 0) | (b > L ? 2 : 0) | (c > L ? 4 : 0) | (d > L ? 8 : 0);
                    if (m === 0 || m === 15) continue;
                    const P = (e) => (e === 0 ? [i + (L - a) / (b - a), j] : e === 1 ? [i + 1, j + (L - b) / (c - b)] : e === 2 ? [i + (L - d) / (c - d), j + 1] : [i, j + (L - a) / (d - a)]);
                    const t = T4[m];
                    for (let q = 0; q < t.length; q += 2) {
                        const u = P(t[q]);
                        const v = P(t[q + 1]);
                        p.moveTo((u[0] + 0.5) * S, (u[1] + 0.5) * S);
                        p.lineTo((v[0] + 0.5) * S, (v[1] + 0.5) * S);
                    }
                }
            }
            cont.push({ p, idx: L % 5 === 0 });
        }
    }

    function F(sz, it, ls) {
        g.font = `${it ? 'italic ' : ''}500 ${sz}px system-ui,"Segoe UI",Roboto,sans-serif`;
        if ('letterSpacing' in g) g.letterSpacing = `${ls}px`;
    }

    function T(s, x, y, sz, col, al, ls, it) {
        F(sz, it, ls || 0);
        g.textAlign = al || 'center';
        g.textBaseline = 'middle';
        g.lineWidth = sz / 4;
        g.lineJoin = 'round';
        g.strokeStyle = 'rgba(10,12,15,.88)';
        g.strokeText(s, x, y);
        g.fillStyle = col;
        g.fillText(s, x, y);
    }

    function drawGrid() {
        g.lineWidth = 1.2;
        for (let o = -180; o <= 180; o += 15) {
            g.strokeStyle = o === 0 ? 'rgba(170,195,220,.6)' : o % 30 ? 'rgba(170,195,220,.16)' : 'rgba(170,195,220,.32)';
            g.beginPath();
            g.moveTo(X(o), 0);
            g.lineTo(X(o), H);
            g.stroke();
        }
        for (let a = -90; a <= 90; a += 15) {
            g.strokeStyle = a === 0 ? 'rgba(170,195,220,.6)' : a % 30 ? 'rgba(170,195,220,.16)' : 'rgba(170,195,220,.32)';
            g.beginPath();
            g.moveTo(0, Y(a));
            g.lineTo(W, Y(a));
            g.stroke();
        }
        for (let o = -150; o <= 150; o += 30) T(o === 0 ? '0°' : o > 0 ? `${o}° E` : `${-o}° O`, X(o), 18, 18, '#C9D6E4');
        for (let a = -60; a <= 60; a += 30) {
            const s = a === 0 ? '0°' : a > 0 ? `${a}° N` : `${-a}° S`;
            T(s, 8, Y(a) - 12, 18, '#C9D6E4', 'left');
            T(s, W - 8, Y(a) - 12, 18, '#C9D6E4', 'right');
        }
    }

    function drawMaria() {
        for (const q of MR) {
            const x = X(q.o);
            const y = Y(q.a);
            const ry = q.ry * PPD;
            const small = q.ew < 200;
            let sz = small ? 20 : 34;
            const ls = small ? 1 : 8;
            const mw = q.rx * PPD * 1.8;
            if (!small) {
                for (; sz > 16; sz -= 2) {
                    F(sz, false, ls);
                    if (g.measureText(q.u).width <= mw) break;
                }
            }
            T(q.u, x, small ? y + ry + 16 : y, sz, 'rgba(238,242,247,.95)', 'center', ls);
        }
        T('Cuenca Polo Sur–Aitken', X(-169), Y(-53), 26, 'rgba(222,228,235,.8)', 'center', 4, true);
    }

    function drawCraters() {
        const col = '#BFE0FF';
        for (const c of LUNAR_CRATERS) {
            const [n, la, lo, D, sd] = c;
            const x = X(lo);
            const y = Y(la);
            if (sd === 'p') {
                g.fillStyle = col;
                g.beginPath();
                g.moveTo(x, y - 11);
                g.lineTo(x - 9, y + 4);
                g.lineTo(x + 9, y + 4);
                g.closePath();
                g.fill();
                T(n, x, y - 30, 22, col);
                continue;
            }
            const rx = Math.max(5, (D / 2 / (KM * Math.max(0.15, Math.cos(la * rad)))) * PPD);
            const ry = Math.max(5, (D / 2 / KM) * PPD);
            g.strokeStyle = 'rgba(210,235,255,.9)';
            g.lineWidth = 2.4;
            g.beginPath();
            g.ellipse(x, y, rx, ry, 0, 0, 7);
            g.stroke();
            if (sd === 'r') T(n, x + rx + 10, y, 22, col, 'left');
            else if (sd === 'l') T(n, x - rx - 10, y, 22, col, 'right');
            else if (sd === 't') T(n, x, y - ry - 16, 22, col);
            else T(n, x, y + ry + 16, 22, col);
        }
    }

    const FT = [
        ...MR.map((m) => ({ k: 'mar', es: m.es, lat: m.n, la: m.a, lo: m.o, D: m.D, f: m.f, rx: m.rx, ry: m.ry })),
        ...LUNAR_CRATERS.map((c) => ({ k: c[3] >= 300 ? 'cuenca' : 'crater', es: c[0], lat: c[6], la: c[1], lo: c[2], D: c[3], f: c[5] })),
        ...LUNAR_EXTRA_BASINS,
        ...LUNAR_SITES.map((a) => ({ k: 'sitio', es: a[0], lat: a[1], la: a[2], lo: a[3], y: a[4], ag: a[5], sd: a[6], D: 60, f: a[7] }))
    ];

    function drawSites() {
        for (const f of FT) {
            if (f.k !== 'sitio') continue;
            const x = X(f.lo);
            const y = Y(f.la);
            g.beginPath();
            for (let i = 0; i < 10; i++) {
                const r = i % 2 ? 5 : 12;
                const a = -Math.PI / 2 + (i * Math.PI) / 5;
                g[i ? 'lineTo' : 'moveTo'](x + r * Math.cos(a), y + r * Math.sin(a));
            }
            g.closePath();
            g.fillStyle = '#FFD166';
            g.strokeStyle = '#14171B';
            g.lineWidth = 2.5;
            g.stroke();
            g.fill();
            const l = f.sd === 'l';
            T(f.es, x + (l ? -18 : 18), y, 20, '#FFD166', l ? 'right' : 'left');
        }
    }

    function drawFrame() {
        g.strokeStyle = 'rgba(255,255,255,.5)';
        g.lineWidth = 4;
        g.strokeRect(2, 2, W - 4, H - 4);
        const x0 = 60;
        const y0 = H - 70;
        const len = (1000 / KM) * PPD;
        g.strokeStyle = '#fff';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x0 + len, y0);
        [0, 0.5, 1].forEach((f) => {
            g.moveTo(x0 + len * f, y0 - 9);
            g.lineTo(x0 + len * f, y0 + 9);
        });
        g.stroke();
        T('0', x0, y0 - 24, 18, '#fff');
        T('500', x0 + len / 2, y0 - 24, 18, '#fff');
        T('1000 km (ecuador)', x0 + len, y0 - 24, 18, '#fff', 'left');
        T('PROYECCIÓN EQUIRRECTANGULAR · R = 1737,4 km · COORDENADAS SELENOGRÁFICAS', W / 2, H - 24, 18, '#C9D6E4', 'center', 2);
    }

    const csn = (f) => Math.max(0.15, Math.cos(f.la * rad));
    const R0 = (f) => (f.k === 'mar' ? Math.max(f.rx * KM * csn(f), f.ry * KM) : f.D / 2);

    function highlightSelectedLunar() {
        if (!selLunar) return;
        const f = selLunar;
        const x = X(f.lo);
        const y = Y(f.la);
        g.strokeStyle = '#FFD166';
        g.lineWidth = 5;
        g.beginPath();
        if (f.k === 'mar') {
            g.ellipse(x, y, f.rx * PPD, f.ry * PPD, 0, 0, 7);
        } else {
            g.ellipse(
                x,
                y,
                Math.max(14, (f.D / 2 / (KM * csn(f))) * PPD) * 1.15,
                Math.max(14, (f.D / 2 / KM) * PPD) * 1.15,
                0,
                0,
                7
            );
        }
        g.stroke();
    }

    function drawLunarMap() {
        const on = (id) => $(id).checked;
        g.fillStyle = '#14171B';
        g.fillRect(0, 0, W, H);
        if (on('lr')) {
            g.imageSmoothingEnabled = true;
            g.imageSmoothingQuality = 'high';
            g.drawImage(photoLROC || hs, 0, 0, W, H);
        }
        if (on('lc')) {
            for (const c of cont) {
                g.strokeStyle = c.idx ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.5)';
                g.lineWidth = c.idx ? 2.2 : 1.1;
                g.stroke(c.p);
            }
        }
        if (on('lg')) drawGrid();
        if (on('lm')) drawMaria();
        if (on('lk')) drawCraters();
        if (on('ls')) drawSites();
        highlightSelectedLunar();
        drawFrame();
    }

    function rebuildLunar(msg) {
        shade();
        contours();
        drawLunarMap();
        st.textContent = msg;
        if (selLunar) renderLunarPanel(selLunar);
    }

    ['lr', 'lc', 'lg', 'lm', 'lk', 'ls'].forEach((id) => $(id).addEventListener('change', drawLunarMap));

    $('syn').addEventListener('click', () => {
        st.textContent = 'Calculando relieve…';
        setTimeout(() => {
            synth();
            rebuildLunar('Mostrando relieve y curvas sintéticos.');
        }, 30);
    });

    $('dem').addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        st.textContent = 'Procesando DEM…';
        try {
            const bm = await createImageBitmap(f);
            const oc = document.createElement('canvas');
            oc.width = GW;
            oc.height = GH;
            const x = oc.getContext('2d');
            x.drawImage(bm, 0, 0, GW, GH);
            const d = x.getImageData(0, 0, GW, GH).data;
            for (let k = 0; k < GW * GH; k++) {
                E[k] = -9.1 + (d[k * 4] / 255) * 19.9;
            }
            realDEM = true;
            rebuildLunar('DEM LOLA cargado: curvas y relieve calculados con tus datos.');
        } catch (err) {
            st.textContent = 'No pude leer esa imagen. Usa un PNG o JPG de 8 bits en proyección equirrectangular.';
        }
    });

    $('pho').addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
            photoLROC = await createImageBitmap(f);
            st.textContent = 'Mosaico LROC cargado.';
            drawLunarMap();
            if (selLunar) renderLROCCrop(selLunar);
        } catch (err) {
            st.textContent = 'No pude leer esa foto. Usa JPG o PNG (los TIFF no funcionan en el navegador).';
        }
    });

    const formatLunarCoords = (la, lo) =>
        `${Math.abs(la).toFixed(2).replace('.', ',')}° ${la >= 0 ? 'N' : 'S'}, ${Math.abs(lo).toFixed(2).replace('.', ',')}° ${lo >= 0 ? 'E' : 'O'}`;

    function computeLunarStats(f) {
        let fp;
        if (f.k === 'mar') {
            fp = {
                t: (la, lo) => {
                    const u = (((lo - f.lo + 540) % 360) - 180) / (f.rx * 0.8);
                    const v = (la - f.la) / (f.ry * 0.8);
                    return u * u + v * v <= 1;
                },
                hw: Math.ceil(f.rx / STEP),
                hh: Math.ceil(f.ry / STEP)
            };
        } else {
            const R = f.D / 2;
            fp = {
                t: (la, lo) => dist(la, lo, f.la, f.lo) <= R,
                hw: Math.min(GW / 2, Math.ceil(R / (KM * csn(f)) / STEP)),
                hh: Math.ceil(R / KM / STEP)
            };
        }

        const j0 = Math.floor((90 - f.la) / STEP);
        const i0 = Math.floor((f.lo + 180) / STEP);
        let mn = 1e9;
        let mx = -1e9;
        let sm0 = 0;
        let n = 0;
        let sl = 0;

        for (let dj = -fp.hh; dj <= fp.hh; dj++) {
            const j = j0 + dj;
            if (j < 1 || j >= GH - 1) continue;
            const lat = 90 - (j + 0.5) * STEP;
            const dx = 2 * KM * STEP * Math.max(0.25, Math.cos(lat * rad));
            const dy = 2 * KM * STEP;
            for (let di = -fp.hw; di <= fp.hw; di++) {
                const i = (((i0 + di) % GW) + GW) % GW;
                const lon = -180 + (i + 0.5) * STEP;
                if (!fp.t(lat, lon)) continue;
                const e = E[j * GW + i];
                mn = Math.min(mn, e);
                mx = Math.max(mx, e);
                sm0 += e;
                n++;
                sl += Math.atan(
                    Math.hypot(
                        (E[j * GW + ((i + 1) % GW)] - E[j * GW + ((i + GW - 1) % GW)]) / dx,
                        (E[(j + 1) * GW + i] - E[(j - 1) * GW + i]) / dy
                    )
                ) / rad;
            }
        }
        return n ? { mn, mx, me: sm0 / n, sl: sl / n } : null;
    }

    function renderElevationProfile(f) {
        const c = $('pf');
        const x = c.getContext('2d');
        const w = c.width;
        const h = c.height;
        const R = R0(f) * 1.5;
        const N = 140;
        const cs = csn(f);

        const at = (dx, dy) => {
            const la = f.la + dy / KM;
            const lo = f.lo + dx / (KM * cs);
            const i = (((Math.floor((lo + 180) / STEP) % GW) + GW) % GW);
            const j = cl(Math.floor((90 - la) / STEP), 0, GH - 1);
            return E[j * GW + i];
        };

        const A = [];
        const B = [];
        let mn = 1e9;
        let mx = -1e9;
        for (let k = 0; k <= N; k++) {
            const t = -R + (2 * R * k) / N;
            const a = at(t, 0);
            const b = at(0, t);
            A.push(a);
            B.push(b);
            mn = Math.min(mn, a, b);
            mx = Math.max(mx, a, b);
        }

        x.fillStyle = '#0E1013';
        x.fillRect(0, 0, w, h);
        const px = (k) => 44 + ((w - 58) * k) / N;
        const py = (v) => h - 28 - ((h - 50) * (v - mn)) / Math.max(0.1, mx - mn);

        x.strokeStyle = '#2A3038';
        x.lineWidth = 1;
        x.beginPath();
        x.moveTo(44, 26);
        x.lineTo(44, h - 28);
        x.lineTo(w - 14, h - 28);
        x.stroke();

        [[A, '#7FD0FF'], [B, '#FFB86B']].forEach((p) => {
            x.strokeStyle = p[1];
            x.lineWidth = 2.5;
            x.beginPath();
            p[0].forEach((v, k) => (k ? x.lineTo(px(k), py(v)) : x.moveTo(px(k), py(v))));
            x.stroke();
        });

        x.fillStyle = '#C9D6E4';
        x.font = '13px system-ui,sans-serif';
        x.textAlign = 'left';
        x.fillText(`${fmt(mx)} km`, 4, 36);
        x.fillText(`${fmt(mn)} km`, 4, h - 32);
        x.textAlign = 'center';
        x.fillText(`−${Math.round(R)} km`, 70, h - 8);
        x.fillText('0', px(N / 2), h - 8);
        x.fillText(`+${Math.round(R)} km`, w - 50, h - 8);
        x.textAlign = 'left';
        x.fillStyle = '#7FD0FF';
        x.fillText('Oeste → Este', 50, 14);
        x.fillStyle = '#FFB86B';
        x.fillText('Sur → Norte', 180, 14);
    }

    function renderLROCCrop(f) {
        const c = $('ph');
        const x = c.getContext('2d');
        const w = c.width;
        const h = c.height;
        if (!photoLROC) {
            c.style.display = 'none';
            $('pn0').hidden = false;
            return;
        }
        c.style.display = 'block';
        $('pn0').hidden = true;
        const half = (R0(f) * 1.5) / KM;
        const hx = half / csn(f);
        const iw = photoLROC.width;
        const ih = photoLROC.height;
        x.fillStyle = '#000';
        x.fillRect(0, 0, w, h);
        x.drawImage(
            photoLROC,
            ((f.lo - hx + 180) / 360) * iw,
            ((90 - f.la - half) / 180) * ih,
            ((2 * hx) / 360) * iw,
            ((2 * half) / 180) * ih,
            0,
            0,
            w,
            h
        );
    }

    const WK_CACHE = {};

    async function loadWikimediaImages(f) {
        const gl = $('gl');
        const gs = $('gs');
        gl.innerHTML = '';
        gs.textContent = 'Buscando imágenes reales…';
        try {
            let r = WK_CACHE[f.es];
            if (!r) {
                const q = f.k === 'mar'
                    ? f.lat
                    : f.k === 'sitio'
                        ? `${f.lat} mission Moon`
                        : f.k === 'cuenca'
                            ? `${f.lat} lunar basin`
                            : `${f.lat} lunar crater`;
                const j = await (
                    await fetch(
                        `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrlimit=8&prop=pageimages&piprop=thumbnail&pithumbsize=480&gsrsearch=${encodeURIComponent(q)}`
                    )
                ).json();
                r = Object.values((j.query || {}).pages || {})
                    .filter((p) => p.thumbnail)
                    .sort((a, b) => a.index - b.index)
                    .slice(0, 3);
                WK_CACHE[f.es] = r;
            }
            if (selLunar !== f) return;
            gl.innerHTML = '';
            r.forEach((p) => {
                const fg = document.createElement('figure');
                const a = document.createElement('a');
                const im = document.createElement('img');
                const c = document.createElement('figcaption');
                a.href = `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`;
                a.target = '_blank';
                a.rel = 'noopener';
                im.src = p.thumbnail.source;
                im.alt = p.title;
                im.loading = 'lazy';
                im.onerror = () => fg.remove();
                c.textContent = p.title;
                a.append(im);
                fg.append(a, c);
                gl.append(fg);
            });
            gs.textContent = r.length
                ? 'Imágenes reales de Wikipedia (NASA y otras fuentes). Clic para abrir el artículo.'
                : 'No encontré imágenes para este lugar; usa los enlaces de abajo.';
        } catch (err) {
            if (selLunar === f) {
                gs.textContent = 'No pude cargar las imágenes (¿sin conexión?). Usa los enlaces de abajo.';
            }
        }
    }

    function estimateLunarTemp(la) {
        const absLat = Math.abs(la);
        if (absLat >= 82) return '-183 °C (PSR)';
        if (absLat >= 60) return '-110 °C';
        return '-20 °C (media)';
    }

    function renderLunarPanel(f) {
        $('pn').hidden = false;
        $('pe').textContent = f.es;
        $('pl').textContent = `${f.lat} · ${LUNAR_TYPE_LABELS[f.k]}`;

        const s = computeLunarStats(f);
        const d = $('pd');
        d.innerHTML = '';

        const row = (label, value) => {
            const box = document.createElement('div');
            box.className = 'telemetry-item';
            const t = document.createElement('dt');
            const v = document.createElement('dd');
            t.textContent = label;
            v.textContent = value;
            box.append(t, v);
            d.append(box);
        };

        row('Coordenadas', formatLunarCoords(f.la, f.lo));
        if (f.k === 'sitio') {
            row('Misión', `${f.ag} · ${f.y}`);
            row('Terreno analizado', 'radio ≈ 30 km');
        } else {
            row('Diámetro (catálogo)', `≈ ${f.D.toLocaleString('es-CL')} km`);
        }
        if (s) {
            row('Elevación mínima', `${fmt(s.mn)} km`);
            row('Elevación máxima', `${fmt(s.mx)} km`);
            row('Elevación media', `${fmt(s.me)} km`);
            row('Relieve (máx − mín)', `${fmt(s.mx - s.mn)} km`);
            row('Pendiente media (≈12 km)', `${s.sl.toFixed(1).replace('.', ',')}°`);
        }
        row('Referencia de alturas', 'esfera de 1737,4 km');

        $('moon-view-temp').textContent = `TEMP. ESTIMADA ${estimateLunarTemp(f.la).toUpperCase()}`;
        $('pf2').textContent = f.f;
        $('pw').textContent = realDEM
            ? 'Elevaciones calculadas con tu DEM LOLA.'
            : 'Elevaciones y perfil del modelo sintético: carga un DEM LOLA para cifras reales.';

        renderElevationProfile(f);
        lunarDEM3D.update(f);
        renderLROCCrop(f);
        loadWikimediaImages(f);

        const q = encodeURIComponent(f.lat + (f.k === 'mar' ? ' Moon' : ' lunar'));
        $('lnk').innerHTML = `Fotos reales y mapas: <a href="https://commons.wikimedia.org/w/index.php?search=${q}" target="_blank" rel="noopener" class="text-sky-400 hover:underline">Wikimedia Commons</a> · <a href="https://quickmap.lroc.asu.edu/" target="_blank" rel="noopener" class="text-sky-400 hover:underline">LROC QuickMap</a> · <a href="https://trek.nasa.gov/moon/" target="_blank" rel="noopener" class="text-sky-400 hover:underline">NASA Moon Trek</a>`;
    }

    function flyToLunarFeature(f) {
        const m = $('lunar-map-scroll');
        m.scrollTo({
            left: (X(f.lo) / W) * cv.clientWidth - m.clientWidth / 2,
            behavior: 'smooth'
        });
    }

    function showLunarFeature(f, mode) {
        selLunar = f;
        drawLunarMap();
        renderLunarPanel(f);
        if (mode) flyToLunarFeature(f);
        if (mode !== 'tour') {
            $('pn').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    const sl0 = $('sel');
    FT.forEach((f, i) => {
        const o = document.createElement('option');
        o.value = i;
        o.textContent = `${f.es} (${LUNAR_TYPE_LABELS[f.k].split(' (')[0]})`;
        sl0.appendChild(o);
    });

    sl0.addEventListener('change', () => {
        if (sl0.value !== '') {
            stopTour();
            showLunarFeature(FT[+sl0.value], 'fly');
        }
    });

    const ov = $('ov');
    const oCtx = ov.getContext('2d');
    const tip = $('tip');
    let hov = null;
    let dirty = false;
    let tid = null;

    function hitLunarFeature(e) {
        const r = cv.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * W;
        const py = ((e.clientY - r.top) / r.height) * H;
        let best = null;
        let bd = 1e9;

        for (const f of FT) {
            let d;
            if (f.k === 'mar') {
                const u = (((px / PPD - 180 - f.lo + 540) % 360) - 180) / f.rx;
                const v = (90 - py / PPD - f.la) / f.ry;
                d = u * u + v * v;
                if (d > 1) continue;
                d += 0.5;
            } else if (f.k === 'sitio') {
                if (!$('ls').checked) continue;
                const u = (px - X(f.lo)) / 26;
                const v = (py - Y(f.la)) / 26;
                d = u * u + v * v;
                if (d > 1) continue;
                d *= 0.05;
            } else {
                const u = (px - X(f.lo)) / Math.max(14, (f.D / 2 / (KM * csn(f))) * PPD);
                const v = (py - Y(f.la)) / Math.max(14, (f.D / 2 / KM) * PPD);
                d = u * u + v * v;
                if (d > 1.2) continue;
                d *= 0.2;
            }
            if (d < bd) {
                bd = d;
                best = f;
            }
        }
        return best;
    }

    cv.addEventListener('pointermove', (e) => {
        const r = cv.getBoundingClientRect();
        const lo = ((e.clientX - r.left) / r.width) * 360 - 180;
        const la = 90 - ((e.clientY - r.top) / r.height) * 180;
        const i = cl(Math.floor((lo + 180) / STEP), 0, GW - 1);
        const j = cl(Math.floor((90 - la) / STEP), 0, GH - 1);
        ro.textContent = `Lat ${la.toFixed(1)}° · Lon ${lo.toFixed(1)}° · elevación ${E[j * GW + i].toFixed(1)} km${realDEM ? ' (DEM LOLA)' : ' (sintética)'}`;

        const f = hitLunarFeature(e);
        hov = f;
        cv.style.cursor = f ? 'pointer' : 'default';
        if (f) {
            tip.style.display = 'block';
            tip.textContent = `${f.k === 'sitio' ? '★ ' : ''}${f.es} · ${LUNAR_TYPE_LABELS[f.k].split(' (')[0]}`;
            tip.style.left = `${e.clientX + 14}px`;
            tip.style.top = `${e.clientY + 14}px`;
        } else {
            tip.style.display = 'none';
        }
    });

    cv.addEventListener('pointerleave', () => {
        hov = null;
        tip.style.display = 'none';
    });

    cv.addEventListener('click', (e) => {
        stopTour();
        const b = hitLunarFeature(e);
        if (b) {
            sl0.value = FT.indexOf(b);
            showLunarFeature(b);
        }
    });

    function drawRing(f, col, w, k, fill) {
        const x = X(f.lo);
        const y = Y(f.la);
        let rx;
        let ry;
        if (f.k === 'mar') {
            rx = f.rx * PPD;
            ry = f.ry * PPD;
        } else if (f.k === 'sitio') {
            rx = ry = 22;
        } else {
            rx = Math.max(14, (f.D / 2 / (KM * csn(f))) * PPD) * 1.15;
            ry = Math.max(14, (f.D / 2 / KM) * PPD) * 1.15;
        }
        oCtx.beginPath();
        oCtx.ellipse(x, y, rx * k, ry * k, 0, 0, 7);
        if (fill) {
            oCtx.fillStyle = fill;
            oCtx.fill();
        }
        oCtx.strokeStyle = col;
        oCtx.lineWidth = w;
        oCtx.stroke();
    }

    function animateLunarOverlay(t) {
        if (activeView === 'lunar') {
            const act = hov || selLunar;
            if (act || dirty) {
                oCtx.clearRect(0, 0, W, H);
                dirty = !!act;
                if (hov) drawRing(hov, '#fff', 4, 1, 'rgba(255,209,102,.22)');
                if (selLunar) {
                    const p = (t / 1400) % 1;
                    drawRing(selLunar, `rgba(255,209,102,${(1 - p).toFixed(2)})`, 5, 1 + 0.4 * p);
                }
            }
        }
        requestAnimationFrame(animateLunarOverlay);
    }

    const tb = $('tour');
    function stopTour() {
        if (tid) {
            clearInterval(tid);
            tid = null;
            tb.textContent = '▶ Tour de misiones';
        }
    }

    tb.addEventListener('click', () => {
        if (tid) {
            stopTour();
            return;
        }
        const L_SITES = FT.filter((f) => f.k === 'sitio');
        let n = 0;
        const go = () => {
            const f = L_SITES[n++ % L_SITES.length];
            sl0.value = FT.indexOf(f);
            showLunarFeature(f, 'tour');
        };
        go();
        tid = setInterval(go, 6000);
        tb.textContent = '■ Detener tour';
    });

    // ========================================================================
    // 8. MOTOR CARTOGRÁFICO MARCIANO EQUIRRECTANGULAR (MOLA / VIKING MDIM)
    // ========================================================================
    const {
        W: MW,
        H: MH,
        KM: MKM,
        STEP: MSTEP,
        GW: MGW,
        GH: MGH,
        RM: MRM
    } = MARS_CONSTANTS;
    const MPPD = MW / 360;
    const MS = MW / MGW;

    const mCv = $('mars-c');
    const mg = mCv.getContext('2d');
    const mRo = $('mars-ro');
    const mSt = $('mars-st');

    const MX = (o) => (o + 180) * MPPD;
    const MY = (a) => (90 - a) * MPPD;

    const MMR = MARS_MARIA.map((m, i) => ({
        n: m[0],
        es: m[1],
        u: m[1].toUpperCase(),
        a: m[2],
        o: m[3],
        ew: m[4],
        rx: m[4] / (MKM * Math.max(0.25, Math.cos(m[2] * rad))),
        ry: m[5] / MKM,
        s: (i + 1) * 1.3,
        D: m[6],
        f: m[7]
    }));

    const ME = new Float32Array(MGW * MGH);
    const MM_MASK = new Float32Array(MGW * MGH);
    let marsRealDEM = false;
    let mHs = null;
    let mCont = [];
    let photoMars = null;
    let selMars = null;

    // Malla 3D del DEM marciano (se actualiza al seleccionar un terreno)
    const marsDEM3D = createDEM3DViewer({
        hostId: 'dem3d-mars',
        color: 0xf97316,
        low: 0x3b1a0f,
        high: 0xf3d5c1,
        arr: ME,
        GW: MGW,
        GH: MGH,
        STEP: MSTEP,
        KM: MKM,
        radius: (f) => mR0(f),
        csn: (f) => csn(f),
        isActive: () => activeView === 'mars',
        isReal: () => marsRealDEM,
        realName: 'DEM MOLA cargado'
    });

    function marsMask(lon, lat) {
        let m = 0;
        for (const q of MMR) {
            const dl = ((lon - q.o + 540) % 360) - 180;
            const da = lat - q.a;
            if (Math.abs(da) > q.ry * 1.5 || Math.abs(dl) > q.rx * 1.5) continue;
            const u = dl / q.rx;
            const v = da / q.ry;
            const an = Math.atan2(v, u);
            const f = 1 + 0.18 * (0.5 * Math.sin(2 * an + q.s) + 0.3 * Math.sin(3 * an + q.s * 1.7) + 0.2 * Math.sin(5 * an + q.s * 2.3));
            const d = Math.hypot(u, v);
            m = Math.max(m, cl((f - d) / (0.15 * f), 0, 1));
        }
        return m;
    }

    function marsDist(a, b, c, d) {
        const p = a * rad;
        const q = c * rad;
        return MRM * Math.acos(cl(Math.sin(p) * Math.sin(q) + Math.cos(p) * Math.cos(q) * Math.cos((b - d) * rad), -1, 1));
    }

    function marsBowl(la, lo, D, dpOverride) {
        const R = D / 2;
        const dp = dpOverride || Math.min(4.2, 0.05 * Math.pow(D, 0.82));
        const cs = Math.max(0.12, Math.cos(la * rad));
        const hw = Math.min(MGW / 2, Math.ceil((R * 1.4) / (MKM * cs) / MSTEP));
        const hh = Math.ceil((R * 1.4) / MKM / MSTEP);
        const j0 = Math.floor((90 - la) / MSTEP);
        const i0 = Math.floor((lo + 180) / MSTEP);

        for (let dj = -hh; dj <= hh; dj++) {
            const j = j0 + dj;
            if (j < 0 || j >= MGH) continue;
            const lat = 90 - (j + 0.5) * MSTEP;
            for (let di = -hw; di <= hw; di++) {
                const i = (((i0 + di) % MGW) + MGW) % MGW;
                const lon = -180 + (i + 0.5) * MSTEP;
                const u = marsDist(lat, lon, la, lo) / R;
                if (u > 1.4) continue;
                let v = u < 1 ? -dp * (1 - u * u) : 0;
                v += 0.28 * dp * Math.exp(-(((u - 1.03) / 0.13) ** 2));
                if (D > 80 && D < 500) v += 0.2 * dp * Math.exp(-((u / 0.11) ** 2));
                ME[j * MGW + i] += v;
            }
        }
    }

    function marsCone(la, lo, D, peakH) {
        const R = D / 2;
        const cs = Math.max(0.12, Math.cos(la * rad));
        const hw = Math.min(MGW / 2, Math.ceil((R * 1.5) / (MKM * cs) / MSTEP));
        const hh = Math.ceil((R * 1.5) / MKM / MSTEP);
        const j0 = Math.floor((90 - la) / MSTEP);
        const i0 = Math.floor((lo + 180) / MSTEP);

        for (let dj = -hh; dj <= hh; dj++) {
            const j = j0 + dj;
            if (j < 0 || j >= MGH) continue;
            const lat = 90 - (j + 0.5) * MSTEP;
            for (let di = -hw; di <= hw; di++) {
                const i = (((i0 + di) % MGW) + MGW) % MGW;
                const lon = -180 + (i + 0.5) * MSTEP;
                const u = marsDist(lat, lon, la, lo) / R;
                if (u > 1.45) continue;
                const base = ME[j * MGW + i];
                const dh = Math.max(2, peakH - base);
                let v = u < 1.35 ? dh * Math.exp(-2.1 * u * u) * (1 - 0.15 * u) : 0;
                if (u < 0.16) v -= dh * 0.14 * (1 - (u / 0.16) ** 2);
                ME[j * MGW + i] += v;
            }
        }
    }

    function marsSynth() {
        marsRealDEM = false;
        for (let j = 0; j < MGH; j++) {
            const lat = 90 - (j + 0.5) * MSTEP;
            for (let i = 0; i < MGW; i++) {
                const lon = -180 + (i + 0.5) * MSTEP;
                const k = j * MGW + i;
                // Dicotomía global marciana
                const dicLat = 12 - 22 * Math.cos((lon - 35) * rad) - 8 * Math.sin(2 * (lon + 20) * rad);
                const dic = sm(cl((lat - dicLat + 22) / 44, 0, 1));
                let e = (1 - dic) * 2.1 + dic * (-4.1) + (fbm(lon, lat) - 0.48) * 2.6;

                // Abultamiento de Tharsis
                const dTh = marsDist(lat, lon, -2, -112) / 2800;
                if (dTh < 1.4) e += 5.2 * Math.exp(-1.8 * dTh * dTh);

                // Levantamiento volcánico de Elysium
                const dEl = marsDist(lat, lon, 23, 148) / 1400;
                if (dEl < 1.3) e += 3.1 * Math.exp(-2.1 * dEl * dEl);

                // Meseta de Syrtis Major
                const dSy = marsDist(lat, lon, 8.4, 69.5) / 750;
                if (dSy < 1.2) e += 1.6 * Math.exp(-2.0 * dSy * dSy);

                // Valles Marineris
                if (lon > -98 && lon < -32 && lat > -24 && lat < 2) {
                    const axisLat = -12.5 + 2.8 * Math.sin((lon + 65) * 3.2 * rad) - 1.5 * ((lon + 65) / 30);
                    const wLat = 2.6 + 1.4 * Math.exp(-(((lon + 68) / 14) ** 2));
                    const dy = Math.abs(lat - axisLat) / wLat;
                    const xEnv = sm(cl((lon + 96) / 8, 0, 1)) * sm(cl((-34 - lon) / 8, 0, 1));
                    if (dy < 1.4) e -= 6.8 * xEnv * Math.exp(-1.9 * dy * dy);
                }

                // Casquetes polares
                if (lat > 80) e += 2.4 * sm((lat - 80) / 10);
                if (lat < -80) e += 2.2 * sm((-lat - 80) / 10);

                MM_MASK[k] = marsMask(lon, lat);
                ME[k] = e;
            }
        }

        // Grandes cuencas de impacto profundas
        marsBowl(-42.4, 70.5, 2200, 8.4);
        marsBowl(-49.7, -43.4, 1300, 5.6);
        marsBowl(12.9, 87.0, 1150, 3.4);
        marsBowl(46.7, 117.5, 3200, 2.2);
        marsBowl(28.4, -39.7, 1500, 2.0);

        MARS_CRATERS.forEach((c) => {
            if (c[4] === 'v') marsCone(c[1], c[2], c[3], c[6]);
            else marsBowl(c[1], c[2], c[3]);
        });
        marsCone(72.8, 164.5, 68, -2.2);

        const r = rng(42);
        for (let n = 0; n < 480; n++) {
            const u = r();
            const la = Math.asin(2 * Math.pow(u, 1.35) - 1) / rad;
            const lo = r() * 360 - 180;
            const D = Math.min(140, 16 * Math.pow(1 - r(), -1 / 1.85));
            marsBowl(la, lo, D);
        }
    }

    function marsShade() {
        mHs = mHs || document.createElement('canvas');
        mHs.width = MGW;
        mHs.height = MGH;
        const x = mHs.getContext('2d');
        const im = x.createImageData(MGW, MGH);
        const d = im.data;
        const ca = Math.cos(35 * rad);
        const sa = Math.sin(35 * rad);
        const lx = -0.7071 * ca;
        const ly = 0.7071 * ca;

        for (let j = 0; j < MGH; j++) {
            const lat = 90 - (j + 0.5) * MSTEP;
            const dx = 2 * MKM * MSTEP * Math.max(0.25, Math.cos(lat * rad));
            const dy = 2 * MKM * MSTEP;
            for (let i = 0; i < MGW; i++) {
                const k = j * MGW + i;
                const e = ME[k];
                const zx = ((ME[j * MGW + Math.min(i + 1, MGW - 1)] - ME[j * MGW + Math.max(i - 1, 0)]) / dx) * 9;
                const zy = (-(ME[Math.min(j + 1, MGH - 1) * MGW + i] - ME[Math.max(j - 1, 0) * MGW + i]) / dy) * 9;
                const nn = Math.hypot(zx, zy, 1);
                const sh = Math.max(0, (-zx * lx - zy * ly + sa) / nn);
                const b = cl(0.52 + 1.48 * (sh - sa), 0.16, 1.32);

                const t = cl((e + 6.5) / 16, 0, 1);
                const hi = cl((e - 7) / 14, 0, 1);
                const dk = marsRealDEM ? 0 : 0.22 * MM_MASK[k];
                let R = (116 + 86 * t + 28 * hi) * (1 - dk);
                let G = (58 + 54 * t + 46 * hi) * (1 - dk);
                let B = (40 + 32 * t + 48 * hi) * (1 - dk);

                const pol = sm(cl((Math.abs(lat) - 81) / 8, 0, 1));
                if (pol > 0) {
                    R = R * (1 - pol) + 228 * pol;
                    G = G * (1 - pol) + 224 * pol;
                    B = B * (1 - pol) + 230 * pol;
                }

                const o = k * 4;
                d[o] = cl(R * b, 0, 255);
                d[o + 1] = cl(G * b, 0, 255);
                d[o + 2] = cl(B * b, 0, 255);
                d[o + 3] = 255;
            }
        }
        x.putImageData(im, 0, 0);
    }

    function marsContours() {
        mCont = [];
        let mn = 1e9;
        let mx = -1e9;
        for (const v of ME) {
            if (v < mn) mn = v;
            if (v > mx) mx = v;
        }
        const T4 = [[], [3, 0], [0, 1], [3, 1], [1, 2], [3, 0, 1, 2], [0, 2], [3, 2], [2, 3], [0, 2], [0, 1, 2, 3], [2, 1], [3, 1], [0, 1], [3, 0], []];
        for (let L = Math.ceil(mn / 2) * 2; L <= mx; L += 2) {
            const p = new Path2D();
            for (let j = 0; j < MGH - 1; j++) {
                for (let i = 0; i < MGW - 1; i++) {
                    const a = ME[j * MGW + i];
                    const b = ME[j * MGW + i + 1];
                    const c = ME[(j + 1) * MGW + i + 1];
                    const d = ME[(j + 1) * MGW + i];
                    const m = (a > L ? 1 : 0) | (b > L ? 2 : 0) | (c > L ? 4 : 0) | (d > L ? 8 : 0);
                    if (m === 0 || m === 15) continue;
                    const P = (e) => (e === 0 ? [i + (L - a) / (b - a), j] : e === 1 ? [i + 1, j + (L - b) / (c - b)] : e === 2 ? [i + (L - d) / (c - d), j + 1] : [i, j + (L - a) / (d - a)]);
                    const t = T4[m];
                    for (let q = 0; q < t.length; q += 2) {
                        const u = P(t[q]);
                        const v = P(t[q + 1]);
                        p.moveTo((u[0] + 0.5) * MS, (u[1] + 0.5) * MS);
                        p.lineTo((v[0] + 0.5) * MS, (v[1] + 0.5) * MS);
                    }
                }
            }
            mCont.push({ p, idx: L % 6 === 0 });
        }
    }

    function mF(sz, it, ls) {
        mg.font = `${it ? 'italic ' : ''}500 ${sz}px system-ui,"Segoe UI",Roboto,sans-serif`;
        if ('letterSpacing' in mg) mg.letterSpacing = `${ls}px`;
    }

    function mT(s, x, y, sz, col, al, ls, it) {
        mF(sz, it, ls || 0);
        mg.textAlign = al || 'center';
        mg.textBaseline = 'middle';
        mg.lineWidth = sz / 4;
        mg.lineJoin = 'round';
        mg.strokeStyle = 'rgba(12,9,7,.88)';
        mg.strokeText(s, x, y);
        mg.fillStyle = col;
        mg.fillText(s, x, y);
    }

    function drawMarsGrid() {
        mg.lineWidth = 1.2;
        for (let o = -180; o <= 180; o += 15) {
            mg.strokeStyle = o === 0 ? 'rgba(255,215,185,.6)' : o % 30 ? 'rgba(255,215,185,.15)' : 'rgba(255,215,185,.3)';
            mg.beginPath();
            mg.moveTo(MX(o), 0);
            mg.lineTo(MX(o), MH);
            mg.stroke();
        }
        for (let a = -90; a <= 90; a += 15) {
            mg.strokeStyle = a === 0 ? 'rgba(255,215,185,.6)' : a % 30 ? 'rgba(255,215,185,.15)' : 'rgba(255,215,185,.3)';
            mg.beginPath();
            mg.moveTo(0, MY(a));
            mg.lineTo(MW, MY(a));
            mg.stroke();
        }
        for (let o = -150; o <= 150; o += 30) mT(o === 0 ? '0°' : o > 0 ? `${o}° E` : `${-o}° O`, MX(o), 18, 18, '#F3D5C1');
        for (let a = -60; a <= 60; a += 30) {
            const s = a === 0 ? '0°' : a > 0 ? `${a}° N` : `${-a}° S`;
            mT(s, 8, MY(a) - 12, 18, '#F3D5C1', 'left');
            mT(s, MW - 8, MY(a) - 12, 18, '#F3D5C1', 'right');
        }
    }

    function drawMarsMaria() {
        for (const q of MMR) {
            const x = MX(q.o === 180 ? 0 : q.o);
            const y = MY(q.a);
            const ry = q.ry * MPPD;
            const small = q.ew < 650;
            let sz = small ? 20 : 32;
            const ls = small ? 1 : 7;
            const mw = q.rx * MPPD * 1.8;
            if (!small) {
                for (; sz > 16; sz -= 2) {
                    mF(sz, false, ls);
                    if (mg.measureText(q.u).width <= mw) break;
                }
            }
            mT(q.u, x, small ? y + ry + 16 : y, sz, 'rgba(255,244,234,.94)', 'center', ls);
        }
        mT('VALLES MARINERIS', MX(-59.2), MY(-13.9), 28, 'rgba(255,228,196,.95)', 'center', 5, true);
        mT('THARSIS MONTES', MX(-112), MY(2), 24, 'rgba(255,220,185,.78)', 'center', 4, true);
    }

    function drawMarsCraters() {
        for (const c of MARS_CRATERS) {
            const [n, la, lo, D, sd] = c;
            const x = MX(lo);
            const y = MY(la);
            if (sd === 'p') {
                const col = '#BFE0FF';
                mg.fillStyle = col;
                mg.beginPath();
                mg.moveTo(x, y - 11);
                mg.lineTo(x - 9, y + 4);
                mg.lineTo(x + 9, y + 4);
                mg.closePath();
                mg.fill();
                mT(n, x, y - 30, 22, col);
                continue;
            }
            const rx = Math.max(6, (D / 2 / (MKM * Math.max(0.15, Math.cos(la * rad)))) * MPPD);
            const ry = Math.max(6, (D / 2 / MKM) * MPPD);
            if (sd === 'v') {
                const col = '#FFAD75';
                mg.strokeStyle = 'rgba(255,173,117,.92)';
                mg.lineWidth = 2.8;
                mg.beginPath();
                mg.ellipse(x, y, rx, ry, 0, 0, 7);
                mg.stroke();
                mg.fillStyle = col;
                mg.beginPath();
                mg.moveTo(x, y - 10);
                mg.lineTo(x - 9, y + 7);
                mg.lineTo(x + 9, y + 7);
                mg.closePath();
                mg.fill();
                mT(`▲ ${n}`, x + rx + 10, y, 22, col, 'left');
                continue;
            }
            const col = '#BFE0FF';
            mg.strokeStyle = 'rgba(210,235,255,.9)';
            mg.lineWidth = 2.4;
            mg.beginPath();
            mg.ellipse(x, y, rx, ry, 0, 0, 7);
            mg.stroke();
            if (sd === 'r') mT(n, x + rx + 10, y, 22, col, 'left');
            else if (sd === 'l') mT(n, x - rx - 10, y, 22, col, 'right');
            else if (sd === 't') mT(n, x, y - ry - 16, 22, col);
            else mT(n, x, y + ry + 16, 22, col);
        }
    }

    const MFT = [
        ...MMR.map((m) => ({ k: 'mar', es: m.es, lat: m.n, la: m.a, lo: m.o === 180 ? 0 : m.o, D: m.D, f: m.f, rx: m.rx, ry: m.ry })),
        ...MARS_CRATERS.map((c) => ({ k: c[4] === 'v' ? 'volcan' : c[3] >= 300 ? 'cuenca' : 'crater', es: c[0], lat: c[7], la: c[1], lo: c[2], D: c[3], f: c[5] })),
        ...MARS_EXTRA_FEATURES,
        ...MARS_SITES.map((a) => ({ k: 'sitio', es: a[0], lat: a[1], la: a[2], lo: a[3], y: a[4], ag: a[5], sd: a[6], D: 90, f: a[7] }))
    ];

    function drawMarsSites() {
        for (const f of MFT) {
            if (f.k !== 'sitio') continue;
            const x = MX(f.lo);
            const y = MY(f.la);
            mg.beginPath();
            for (let i = 0; i < 10; i++) {
                const r = i % 2 ? 5 : 12;
                const a = -Math.PI / 2 + (i * Math.PI) / 5;
                mg[i ? 'lineTo' : 'moveTo'](x + r * Math.cos(a), y + r * Math.sin(a));
            }
            mg.closePath();
            mg.fillStyle = '#FFD166';
            mg.strokeStyle = '#14171B';
            mg.lineWidth = 2.5;
            mg.stroke();
            mg.fill();
            const l = f.sd === 'l';
            mT(f.es, x + (l ? -18 : 18), y, 20, '#FFD166', l ? 'right' : 'left');
        }
    }

    function drawMarsFrame() {
        mg.strokeStyle = 'rgba(255,255,255,.5)';
        mg.lineWidth = 4;
        mg.strokeRect(2, 2, MW - 4, MH - 4);
        const x0 = 60;
        const y0 = MH - 70;
        const len = (2000 / MKM) * MPPD;
        mg.strokeStyle = '#fff';
        mg.lineWidth = 3;
        mg.beginPath();
        mg.moveTo(x0, y0);
        mg.lineTo(x0 + len, y0);
        [0, 0.5, 1].forEach((f) => {
            mg.moveTo(x0 + len * f, y0 - 9);
            mg.lineTo(x0 + len * f, y0 + 9);
        });
        mg.stroke();
        mT('0', x0, y0 - 24, 18, '#fff');
        mT('1000', x0 + len / 2, y0 - 24, 18, '#fff');
        mT('2000 km (ecuador)', x0 + len, y0 - 24, 18, '#fff', 'left');
        mT('PROYECCIÓN EQUIRRECTANGULAR · R = 3389,5 km · COORDENADAS AREOGRÁFICAS', MW / 2, MH - 24, 18, '#F3D5C1', 'center', 2);
    }

    const mR0 = (f) => (f.k === 'mar' ? Math.max(f.rx * MKM * csn(f), f.ry * MKM) : f.D / 2);

    function highlightSelectedMars() {
        if (!selMars) return;
        const f = selMars;
        const x = MX(f.lo);
        const y = MY(f.la);
        mg.strokeStyle = '#FFD166';
        mg.lineWidth = 5;
        mg.beginPath();
        if (f.k === 'mar') {
            mg.ellipse(x, y, f.rx * MPPD, f.ry * MPPD, 0, 0, 7);
        } else {
            mg.ellipse(
                x,
                y,
                Math.max(14, (f.D / 2 / (MKM * csn(f))) * MPPD) * 1.15,
                Math.max(14, (f.D / 2 / MKM) * MPPD) * 1.15,
                0,
                0,
                7
            );
        }
        mg.stroke();
    }

    function drawMarsMap() {
        const on = (id) => $(id).checked;
        mg.fillStyle = '#1A0E0A';
        mg.fillRect(0, 0, MW, MH);
        if (on('mars-lr')) {
            mg.imageSmoothingEnabled = true;
            mg.imageSmoothingQuality = 'high';
            mg.drawImage(photoMars || mHs, 0, 0, MW, MH);
        }
        if (on('mars-lc')) {
            for (const c of mCont) {
                mg.strokeStyle = c.idx ? 'rgba(255,245,235,.85)' : 'rgba(255,245,235,.42)';
                mg.lineWidth = c.idx ? 2.2 : 1.1;
                mg.stroke(c.p);
            }
        }
        if (on('mars-lg')) drawMarsGrid();
        if (on('mars-lm')) drawMarsMaria();
        if (on('mars-lk')) drawMarsCraters();
        if (on('mars-ls')) drawMarsSites();
        highlightSelectedMars();
        drawMarsFrame();
    }

    function rebuildMars(msg) {
        marsShade();
        marsContours();
        drawMarsMap();
        mSt.textContent = msg;
        if (selMars) renderMarsPanel(selMars);
    }

    ['mars-lr', 'mars-lc', 'mars-lg', 'mars-lm', 'mars-lk', 'mars-ls'].forEach((id) => $(id).addEventListener('change', drawMarsMap));

    $('mars-syn').addEventListener('click', () => {
        mSt.textContent = 'Calculando relieve marciano…';
        setTimeout(() => {
            marsSynth();
            rebuildMars('Mostrando relieve y curvas sintéticos de Marte.');
        }, 30);
    });

    $('mars-dem').addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        mSt.textContent = 'Procesando DEM MOLA…';
        try {
            const bm = await createImageBitmap(f);
            const oc = document.createElement('canvas');
            oc.width = MGW;
            oc.height = MGH;
            const x = oc.getContext('2d');
            x.drawImage(bm, 0, 0, MGW, MGH);
            const d = x.getImageData(0, 0, MGW, MGH).data;
            for (let k = 0; k < MGW * MGH; k++) {
                ME[k] = -8.2 + (d[k * 4] / 255) * 29.4;
            }
            marsRealDEM = true;
            rebuildMars('DEM MOLA cargado: curvas y relieve calculados con tus datos.');
        } catch (err) {
            mSt.textContent = 'No pude leer esa imagen. Usa un PNG o JPG de 8 bits en proyección equirrectangular.';
        }
    });

    $('mars-pho').addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
            photoMars = await createImageBitmap(f);
            mSt.textContent = 'Mosaico global de Marte cargado.';
            drawMarsMap();
            if (selMars) renderMarsCrop(selMars);
        } catch (err) {
            mSt.textContent = 'No pude leer esa foto. Usa JPG o PNG (los TIFF no funcionan en el navegador).';
        }
    });

    function computeMarsStats(f) {
        let fp;
        if (f.k === 'mar') {
            fp = {
                t: (la, lo) => {
                    const u = (((lo - f.lo + 540) % 360) - 180) / (f.rx * 0.8);
                    const v = (la - f.la) / (f.ry * 0.8);
                    return u * u + v * v <= 1;
                },
                hw: Math.ceil(f.rx / MSTEP),
                hh: Math.ceil(f.ry / MSTEP)
            };
        } else {
            const R = f.D / 2;
            fp = {
                t: (la, lo) => marsDist(la, lo, f.la, f.lo) <= R,
                hw: Math.min(MGW / 2, Math.ceil(R / (MKM * csn(f)) / MSTEP)),
                hh: Math.ceil(R / MKM / MSTEP)
            };
        }

        const j0 = Math.floor((90 - f.la) / MSTEP);
        const i0 = Math.floor((f.lo + 180) / MSTEP);
        let mn = 1e9;
        let mx = -1e9;
        let sm0 = 0;
        let n = 0;
        let sl = 0;

        for (let dj = -fp.hh; dj <= fp.hh; dj++) {
            const j = j0 + dj;
            if (j < 1 || j >= MGH - 1) continue;
            const lat = 90 - (j + 0.5) * MSTEP;
            const dx = 2 * MKM * MSTEP * Math.max(0.25, Math.cos(lat * rad));
            const dy = 2 * MKM * MSTEP;
            for (let di = -fp.hw; di <= fp.hw; di++) {
                const i = (((i0 + di) % MGW) + MGW) % MGW;
                const lon = -180 + (i + 0.5) * MSTEP;
                if (!fp.t(lat, lon)) continue;
                const e = ME[j * MGW + i];
                mn = Math.min(mn, e);
                mx = Math.max(mx, e);
                sm0 += e;
                n++;
                sl += Math.atan(
                    Math.hypot(
                        (ME[j * MGW + ((i + 1) % MGW)] - ME[j * MGW + ((i + MGW - 1) % MGW)]) / dx,
                        (ME[(j + 1) * MGW + i] - ME[(j - 1) * MGW + i]) / dy
                    )
                ) / rad;
            }
        }
        return n ? { mn, mx, me: sm0 / n, sl: sl / n } : null;
    }

    function renderMarsProfile(f) {
        const c = $('mars-pf');
        const x = c.getContext('2d');
        const w = c.width;
        const h = c.height;
        const R = Math.min(2800, mR0(f) * 1.5);
        const N = 140;
        const cs = csn(f);

        const at = (dx, dy) => {
            const la = cl(f.la + dy / MKM, -89.8, 89.8);
            const lo = f.lo + dx / (MKM * cs);
            const i = (((Math.floor((lo + 180) / MSTEP) % MGW) + MGW) % MGW);
            const j = cl(Math.floor((90 - la) / MSTEP), 0, MGH - 1);
            return ME[j * MGW + i];
        };

        const A = [];
        const B = [];
        let mn = 1e9;
        let mx = -1e9;
        for (let k = 0; k <= N; k++) {
            const t = -R + (2 * R * k) / N;
            const a = at(t, 0);
            const b = at(0, t);
            A.push(a);
            B.push(b);
            mn = Math.min(mn, a, b);
            mx = Math.max(mx, a, b);
        }

        x.fillStyle = '#0E1013';
        x.fillRect(0, 0, w, h);
        const px = (k) => 44 + ((w - 58) * k) / N;
        const py = (v) => h - 28 - ((h - 50) * (v - mn)) / Math.max(0.1, mx - mn);

        x.strokeStyle = '#2A3038';
        x.lineWidth = 1;
        x.beginPath();
        x.moveTo(44, 26);
        x.lineTo(44, h - 28);
        x.lineTo(w - 14, h - 28);
        x.stroke();

        [[A, '#7FD0FF'], [B, '#FFB86B']].forEach((p) => {
            x.strokeStyle = p[1];
            x.lineWidth = 2.5;
            x.beginPath();
            p[0].forEach((v, k) => (k ? x.lineTo(px(k), py(v)) : x.moveTo(px(k), py(v))));
            x.stroke();
        });

        x.fillStyle = '#C9D6E4';
        x.font = '13px system-ui,sans-serif';
        x.textAlign = 'left';
        x.fillText(`${fmt(mx)} km`, 4, 36);
        x.fillText(`${fmt(mn)} km`, 4, h - 32);
        x.textAlign = 'center';
        x.fillText(`−${Math.round(R)} km`, 70, h - 8);
        x.fillText('0', px(N / 2), h - 8);
        x.fillText(`+${Math.round(R)} km`, w - 50, h - 8);
        x.textAlign = 'left';
        x.fillStyle = '#7FD0FF';
        x.fillText('Oeste → Este', 50, 14);
        x.fillStyle = '#FFB86B';
        x.fillText('Sur → Norte', 180, 14);
    }

    function renderMarsCrop(f) {
        const c = $('mars-ph');
        const x = c.getContext('2d');
        const w = c.width;
        const h = c.height;
        if (!photoMars) {
            c.style.display = 'none';
            $('mars-pn0').hidden = false;
            return;
        }
        c.style.display = 'block';
        $('mars-pn0').hidden = true;
        const half = (mR0(f) * 1.5) / MKM;
        const hx = half / csn(f);
        const iw = photoMars.width;
        const ih = photoMars.height;
        x.fillStyle = '#000';
        x.fillRect(0, 0, w, h);
        x.drawImage(
            photoMars,
            ((f.lo - hx + 180) / 360) * iw,
            ((90 - f.la - half) / 180) * ih,
            ((2 * hx) / 360) * iw,
            ((2 * half) / 180) * ih,
            0,
            0,
            w,
            h
        );
    }

    const MWK_CACHE = {};

    async function loadMarsWikimediaImages(f) {
        const gl = $('mars-gl');
        const gs = $('mars-gs');
        gl.innerHTML = '';
        gs.textContent = 'Buscando imágenes reales de Marte…';
        try {
            let r = MWK_CACHE[f.es];
            if (!r) {
                const q = f.k === 'mar' || f.k === 'volcan' || f.k === 'canon'
                    ? `${f.lat} Mars`
                    : f.k === 'sitio'
                        ? `${f.lat} Mars`
                        : f.lat;
                const j = await (
                    await fetch(
                        `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrlimit=8&prop=pageimages&piprop=thumbnail&pithumbsize=480&gsrsearch=${encodeURIComponent(q)}`
                    )
                ).json();
                r = Object.values((j.query || {}).pages || {})
                    .filter((p) => p.thumbnail)
                    .sort((a, b) => a.index - b.index)
                    .slice(0, 3);
                MWK_CACHE[f.es] = r;
            }
            if (selMars !== f) return;
            gl.innerHTML = '';
            r.forEach((p) => {
                const fg = document.createElement('figure');
                const a = document.createElement('a');
                const im = document.createElement('img');
                const c = document.createElement('figcaption');
                a.href = `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`;
                a.target = '_blank';
                a.rel = 'noopener';
                im.src = p.thumbnail.source;
                im.alt = p.title;
                im.loading = 'lazy';
                im.onerror = () => fg.remove();
                c.textContent = p.title;
                a.append(im);
                fg.append(a, c);
                gl.append(fg);
            });
            gs.textContent = r.length
                ? 'Imágenes reales de Wikipedia (NASA/ESA y otras fuentes). Clic para abrir el artículo.'
                : 'No encontré imágenes para este lugar; usa los enlaces de abajo.';
        } catch (err) {
            if (selMars === f) {
                gs.textContent = 'No pude cargar las imágenes (¿sin conexión?). Usa los enlaces de abajo.';
            }
        }
    }

    function estimateMarsTemp(la) {
        const absLat = Math.abs(la);
        if (absLat >= 75) return '-110 °C';
        if (absLat >= 45) return '-75 °C';
        return '-63 °C';
    }

    function renderMarsPanel(f) {
        $('mars-pn').hidden = false;
        $('mars-pe').textContent = f.es;
        $('mars-pl').textContent = `${f.lat} · ${MARS_TYPE_LABELS[f.k]}`;

        const s = computeMarsStats(f);
        const d = $('mars-pd');
        d.innerHTML = '';

        const row = (label, value) => {
            const box = document.createElement('div');
            box.className = 'telemetry-item';
            const t = document.createElement('dt');
            const v = document.createElement('dd');
            t.textContent = label;
            v.textContent = value;
            box.append(t, v);
            d.append(box);
        };

        row('Coordenadas', formatLunarCoords(f.la, f.lo));
        if (f.k === 'sitio') {
            row('Misión', `${f.ag} · ${f.y}`);
            row('Terreno analizado', 'radio ≈ 45 km');
        } else {
            row('Extensión / Diámetro', `≈ ${f.D.toLocaleString('es-CL')} km`);
        }
        if (s) {
            row('Elevación mínima', `${fmt(s.mn)} km`);
            row('Elevación máxima', `${fmt(s.mx)} km`);
            row('Elevación media', `${fmt(s.me)} km`);
            row('Relieve (máx − mín)', `${fmt(s.mx - s.mn)} km`);
            row('Pendiente media (≈24 km)', `${s.sl.toFixed(1).replace('.', ',')}°`);
        }
        row('Referencia de alturas', 'areoide / esfera de 3389,5 km');

        $('mars-view-temp').textContent = `TEMP. MEDIA ${estimateMarsTemp(f.la).toUpperCase()}`;
        $('mars-pf2').textContent = f.f;
        $('mars-pw').textContent = marsRealDEM
            ? 'Elevaciones calculadas con tu DEM MOLA.'
            : 'Elevaciones y perfil del modelo sintético marciano: carga un DEM MOLA para cifras reales.';

        renderMarsProfile(f);
        marsDEM3D.update(f);
        renderMarsCrop(f);
        loadMarsWikimediaImages(f);

        const q = encodeURIComponent(`${f.lat} Mars`);
        $('mars-lnk').innerHTML = `Fotos reales y mapas: <a href="https://commons.wikimedia.org/w/index.php?search=${q}" target="_blank" rel="noopener" class="text-orange-400 hover:underline">Wikimedia Commons</a> · <a href="https://mars.nasa.gov/maps/" target="_blank" rel="noopener" class="text-orange-400 hover:underline">NASA Mars Maps</a> · <a href="https://trek.nasa.gov/mars/" target="_blank" rel="noopener" class="text-orange-400 hover:underline">NASA Mars Trek</a>`;
    }

    function flyToMarsFeature(f) {
        const m = $('mars-map-scroll');
        m.scrollTo({
            left: (MX(f.lo) / MW) * mCv.clientWidth - m.clientWidth / 2,
            behavior: 'smooth'
        });
    }

    function showMarsFeature(f, mode) {
        selMars = f;
        drawMarsMap();
        renderMarsPanel(f);
        if (mode) flyToMarsFeature(f);
        if (mode !== 'tour') {
            $('mars-pn').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    const mSl0 = $('mars-sel');
    MFT.forEach((f, i) => {
        const o = document.createElement('option');
        o.value = i;
        o.textContent = `${f.es} (${MARS_TYPE_LABELS[f.k].split(' (')[0]})`;
        mSl0.appendChild(o);
    });

    mSl0.addEventListener('change', () => {
        if (mSl0.value !== '') {
            stopMarsTour();
            showMarsFeature(MFT[+mSl0.value], 'fly');
        }
    });

    const mOv = $('mars-ov');
    const mOCtx = mOv.getContext('2d');
    const mTip = $('mars-tip');
    let mHov = null;
    let mDirty = false;
    let mTid = null;

    function hitMarsFeature(e) {
        const r = mCv.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * MW;
        const py = ((e.clientY - r.top) / r.height) * MH;
        let best = null;
        let bd = 1e9;

        for (const f of MFT) {
            let d;
            if (f.k === 'mar') {
                const u = (((px / MPPD - 180 - f.lo + 540) % 360) - 180) / f.rx;
                const v = (90 - py / MPPD - f.la) / f.ry;
                d = u * u + v * v;
                if (d > 1) continue;
                d += 0.5;
            } else if (f.k === 'sitio') {
                if (!$('mars-ls').checked) continue;
                const u = (px - MX(f.lo)) / 26;
                const v = (py - MY(f.la)) / 26;
                d = u * u + v * v;
                if (d > 1) continue;
                d *= 0.05;
            } else {
                const u = (px - MX(f.lo)) / Math.max(14, (f.D / 2 / (MKM * csn(f))) * MPPD);
                const v = (py - MY(f.la)) / Math.max(14, (f.D / 2 / MKM) * MPPD);
                d = u * u + v * v;
                if (d > 1.2) continue;
                d *= 0.2;
            }
            if (d < bd) {
                bd = d;
                best = f;
            }
        }
        return best;
    }

    mCv.addEventListener('pointermove', (e) => {
        const r = mCv.getBoundingClientRect();
        const lo = ((e.clientX - r.left) / r.width) * 360 - 180;
        const la = 90 - ((e.clientY - r.top) / r.height) * 180;
        const i = cl(Math.floor((lo + 180) / MSTEP), 0, MGW - 1);
        const j = cl(Math.floor((90 - la) / MSTEP), 0, MGH - 1);
        mRo.textContent = `Lat ${la.toFixed(1)}° · Lon ${lo.toFixed(1)}° · elevación ${ME[j * MGW + i].toFixed(1)} km${marsRealDEM ? ' (DEM MOLA)' : ' (sintética)'}`;

        const f = hitMarsFeature(e);
        mHov = f;
        mCv.style.cursor = f ? 'pointer' : 'default';
        if (f) {
            mTip.style.display = 'block';
            mTip.textContent = `${f.k === 'sitio' ? '★ ' : f.k === 'volcan' ? '▲ ' : ''}${f.es} · ${MARS_TYPE_LABELS[f.k].split(' (')[0]}`;
            mTip.style.left = `${e.clientX + 14}px`;
            mTip.style.top = `${e.clientY + 14}px`;
        } else {
            mTip.style.display = 'none';
        }
    });

    mCv.addEventListener('pointerleave', () => {
        mHov = null;
        mTip.style.display = 'none';
    });

    mCv.addEventListener('click', (e) => {
        stopMarsTour();
        const b = hitMarsFeature(e);
        if (b) {
            mSl0.value = MFT.indexOf(b);
            showMarsFeature(b);
        }
    });

    function drawMarsRing(f, col, w, k, fill) {
        const x = MX(f.lo);
        const y = MY(f.la);
        let rx;
        let ry;
        if (f.k === 'mar') {
            rx = f.rx * MPPD;
            ry = f.ry * MPPD;
        } else if (f.k === 'sitio') {
            rx = ry = 22;
        } else {
            rx = Math.max(14, (f.D / 2 / (MKM * csn(f))) * MPPD) * 1.15;
            ry = Math.max(14, (f.D / 2 / MKM) * MPPD) * 1.15;
        }
        mOCtx.beginPath();
        mOCtx.ellipse(x, y, rx * k, ry * k, 0, 0, 7);
        if (fill) {
            mOCtx.fillStyle = fill;
            mOCtx.fill();
        }
        mOCtx.strokeStyle = col;
        mOCtx.lineWidth = w;
        mOCtx.stroke();
    }

    function animateMarsOverlay(t) {
        if (activeView === 'mars') {
            const act = mHov || selMars;
            if (act || mDirty) {
                mOCtx.clearRect(0, 0, MW, MH);
                mDirty = !!act;
                if (mHov) drawMarsRing(mHov, '#fff', 4, 1, 'rgba(255,209,102,.22)');
                if (selMars) {
                    const p = (t / 1400) % 1;
                    drawMarsRing(selMars, `rgba(255,209,102,${(1 - p).toFixed(2)})`, 5, 1 + 0.4 * p);
                }
            }
        }
        requestAnimationFrame(animateMarsOverlay);
    }

    const mTb = $('mars-tour');
    function stopMarsTour() {
        if (mTid) {
            clearInterval(mTid);
            mTid = null;
            mTb.textContent = '▶ Tour de misiones';
        }
    }

    mTb.addEventListener('click', () => {
        if (mTid) {
            stopMarsTour();
            return;
        }
        const M_SITES = MFT.filter((f) => f.k === 'sitio');
        let n = 0;
        const go = () => {
            const f = M_SITES[n++ % M_SITES.length];
            mSl0.value = MFT.indexOf(f);
            showMarsFeature(f, 'tour');
        };
        go();
        mTid = setInterval(go, 6000);
        mTb.textContent = '■ Detener tour';
    });

    // ========================================================================
    // 9. PUENTE BIDIRECCIONAL ENTRE CARTOGRAFÍA (LUNA/MARTE) Y TWIN MATCHER
    // ========================================================================
    $('btn-open-lunar-map').addEventListener('click', () => {
        const targetKey = $('target-select').value;
        const target = analogDatabase[targetKey];
        if (!target) return;

        switchView('lunar');

        const featureToFind = target.lunarFeatureObj
            || FT.find((f) => f.es.toLowerCase() === (target.lunarFeatureName || '').toLowerCase());

        if (featureToFind) {
            const idx = FT.indexOf(featureToFind);
            if (idx >= 0) sl0.value = idx;
            showLunarFeature(featureToFind, 'fly');
        }
    });

    $('btn-open-mars-map').addEventListener('click', () => {
        const targetKey = $('target-select').value;
        const target = analogDatabase[targetKey];
        if (!target) return;

        switchView('mars');

        const featureToFind = target.marsFeatureObj
            || MFT.find((f) => f.es.toLowerCase() === (target.marsFeatureName || '').toLowerCase());

        if (featureToFind) {
            const idx = MFT.indexOf(featureToFind);
            if (idx >= 0) mSl0.value = idx;
            showMarsFeature(featureToFind, 'fly');
        }
    });

    function buildTargetFromLunarFeature(f) {
        const stats = computeLunarStats(f);
        const absLat = Math.abs(f.la);
        const slopeDeg = stats ? Number(stats.sl.toFixed(1)) : (f.k === 'mar' ? 3.5 : 14.0);
        const reliefKm = stats ? Number((stats.mx - stats.mn).toFixed(2)) : 1.5;

        const topoScore = cl(Math.round(72 + slopeDeg * 1.35 + reliefKm * 1.2), 65, 98);
        const mineralScore = f.k === 'mar' ? 94 : (f.k === 'cuenca' ? 92 : 90);
        const thermalScore = absLat >= 75 ? 95 : (absLat >= 45 ? 88 : 82);
        const illumScore = absLat >= 80 ? 92 : (absLat >= 50 ? 82 : 76);
        const subsurfaceScore = f.k === 'mar' ? 95 : (absLat >= 75 ? 90 : 84);

        const mineralLabel = f.k === 'mar'
            ? 'Basalto rico en Ti'
            : (f.k === 'cuenca' ? 'Norita / KREEP' : 'Anortosita');

        const datasetSource = realDEM
            ? 'DEM LOLA Usuario + LROC + M3'
            : 'Modelo Selenográfico LOLA/LROC';

        return {
            planet: `LUNA • ${LUNAR_TYPE_LABELS[f.k].split(' (')[0].toUpperCase()}`,
            body: 'LUNA',
            lunarFeatureName: f.es,
            lunarFeatureObj: f,
            title: f.es,
            coords: formatLunarCoords(f.la, f.lo),
            desc: `${f.f} (Diámetro catálogo ≈ ${f.D.toLocaleString('es-CL')} km, relieve analizado ${fmt(reliefKm)} km).`,
            dataset: datasetSource,
            temp: estimateLunarTemp(f.la),
            slope: `${slopeDeg.toFixed(1)}°`,
            mineral: mineralLabel,
            gravity: '1.62 m/s²',
            color: f.k === 'mar' ? 0x818cf8 : 0x38bdf8,
            reliefFactor: cl(reliefKm / 5, 0.25, 0.9),
            targetMetrics: [topoScore, mineralScore, thermalScore, illumScore, subsurfaceScore],
            candidates: LUNAR_ANALOG_CANDIDATES
        };
    }

    function buildTargetFromMarsFeature(f) {
        const stats = computeMarsStats(f);
        const absLat = Math.abs(f.la);
        const slopeDeg = stats ? Number(stats.sl.toFixed(1)) : (f.k === 'mar' ? 2.5 : f.k === 'volcan' ? 11.0 : 9.0);
        const reliefKm = stats ? Number((stats.mx - stats.mn).toFixed(2)) : 3.5;

        const topoScore = cl(Math.round(74 + slopeDeg * 1.4 + reliefKm * 0.9), 65, 98);
        const mineralScore = f.k === 'volcan' ? 95 : (f.k === 'crater' ? 94 : 91);
        const thermalScore = absLat >= 65 ? 93 : (absLat >= 40 ? 89 : 84);
        const illumScore = absLat >= 70 ? 78 : 86;
        const subsurfaceScore = absLat >= 42 ? 95 : (f.k === 'volcan' ? 90 : 85);

        const mineralLabel = f.k === 'volcan'
            ? 'Basalto / Olivino'
            : (f.k === 'crater' ? 'Esmectitas / Carbonatos' : (absLat >= 42 ? 'Basalto + Hielo H2O' : 'Sulfatos / Hematita'));

        const datasetSource = marsRealDEM
            ? 'DEM MOLA Usuario + Viking MDIM'
            : 'Modelo Areográfico MOLA/HiRISE';

        return {
            planet: `MARTE • ${MARS_TYPE_LABELS[f.k].split(' (')[0].toUpperCase()}`,
            body: 'MARTE',
            marsFeatureName: f.es,
            marsFeatureObj: f,
            title: f.es,
            coords: formatLunarCoords(f.la, f.lo),
            desc: `${f.f} (Extensión ≈ ${f.D.toLocaleString('es-CL')} km, relieve analizado ${fmt(reliefKm)} km).`,
            dataset: datasetSource,
            temp: estimateMarsTemp(f.la),
            slope: `${slopeDeg.toFixed(1)}°`,
            mineral: mineralLabel,
            gravity: '3.72 m/s²',
            color: 0xf43f5e,
            reliefFactor: cl(reliefKm / 12, 0.25, 0.95),
            targetMetrics: [topoScore, mineralScore, thermalScore, illumScore, subsurfaceScore],
            candidates: MARS_ANALOG_CANDIDATES
        };
    }

    $('btn-send-to-matcher').addEventListener('click', () => {
        if (!selLunar) return;

        if (selLunar.es === 'Shackleton') {
            $('target-select').value = 'shackleton';
            switchView('matcher');
            updateDashboard(true);
            return;
        }

        const slug = `lunar_${selLunar.es.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        analogDatabase[slug] = buildTargetFromLunarFeature(selLunar);

        const customGroup = $('custom-lunar-targets-group');
        customGroup.hidden = false;

        let option = customGroup.querySelector(`option[value="${slug}"]`);
        if (!option) {
            option = document.createElement('option');
            option.value = slug;
            customGroup.appendChild(option);
        }
        option.textContent = `Luna: ${selLunar.es} (${formatLunarCoords(selLunar.la, selLunar.lo)})`;

        $('target-select').value = slug;
        switchView('matcher');
        updateDashboard(true);
    });

    $('btn-send-mars-to-matcher').addEventListener('click', () => {
        if (!selMars) return;

        if (selMars.es === 'Jezero') {
            $('target-select').value = 'jezero';
            switchView('matcher');
            updateDashboard(true);
            return;
        }
        if (selMars.es === 'Arcadia Planitia' || selMars.es === 'Llanura de Arcadia') {
            $('target-select').value = 'arcadia';
            switchView('matcher');
            updateDashboard(true);
            return;
        }

        const slug = `mars_${selMars.es.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        analogDatabase[slug] = buildTargetFromMarsFeature(selMars);

        const customGroup = $('custom-mars-targets-group');
        customGroup.hidden = false;

        let option = customGroup.querySelector(`option[value="${slug}"]`);
        if (!option) {
            option = document.createElement('option');
            option.value = slug;
            customGroup.appendChild(option);
        }
        option.textContent = `Marte: ${selMars.es} (${formatLunarCoords(selMars.la, selMars.lo)})`;

        $('target-select').value = slug;
        switchView('matcher');
        updateDashboard(true);
    });

    // ========================================================================
    // 10. INICIALIZACIÓN GLOBAL
    // ========================================================================
    updateDashboard(true);
    animate3D();

    setTimeout(() => {
        synth();
        rebuildLunar('Mostrando relieve y curvas sintéticos.');
    }, 30);

    setTimeout(() => {
        marsSynth();
        rebuildMars('Mostrando relieve y curvas sintéticos de Marte.');
    }, 60);

    requestAnimationFrame(animateLunarOverlay);
    requestAnimationFrame(animateMarsOverlay);

    window.addEventListener('resize', () => {
        resize3DViewer();
        lunarDEM3D.resize();
        marsDEM3D.resize();
        if (activeView === 'matcher') {
            map.invalidateSize();
        }
    });
})();

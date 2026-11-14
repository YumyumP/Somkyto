<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Planetary Twin Matcher | NASA Space Apps 2026</title>
    
    <!-- Tailwind CSS para estilos rápidos y limpios -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- Leaflet CSS & JS para mapas satelitales interactivos -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    
    <!-- Chart.js para el gráfico de radar científico -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

    <style>
        body {
            background-color: #0b0f19;
            color: #e2e8f0;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        }
        .glass-panel {
            background: rgba(17, 24, 39, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(56, 189, 248, 0.2);
        }
        #earth-map {
            height: 100%;
            min-height: 360px;
            border-radius: 0.75rem;
            z-index: 1;
        }
        /* Simulación visual de terreno planetario con grillas topográficas */
        .planetary-viewport {
            background-size: cover;
            background-position: center;
            position: relative;
            overflow: hidden;
        }
        .topo-grid {
            background-image: 
                linear-gradient(to right, rgba(56, 189, 248, 0.12) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(56, 189, 248, 0.12) 1px, transparent 1px);
            background-size: 30px 30px;
        }
    </style>
</head>
<body class="min-h-screen flex flex-col">

    <!-- Navbar Superior -->
    <header class="glass-panel border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50">
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-sky-500/20">
                PTM
            </div>
            <div>
                <h1 class="text-lg font-bold tracking-wide text-white">PLANETARY TWIN MATCHER</h1>
                <p class="text-xs text-sky-400">Motor de Análogos Terrestres • NASA Space Apps 2026</p>
            </div>
        </div>

        <!-- Controles de Misión -->
        <div class="flex flex-wrap items-center gap-3">
            <div>
                <label class="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Objetivo Espacial</label>
                <select id="target-select" class="bg-slate-900 border border-slate-700 text-sm rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500">
                    <option value="shackleton">Luna: Cráter Shackleton (Polo Sur)</option>
                    <option value="marius">Luna: Colinas Marius (Tubos de Lava)</option>
                    <option value="jezero">Marte: Cráter Jezero (Delta Antiguo)</option>
                    <option value="arcadia">Marte: Arcadia Planitia (Hielo Subsuperficial)</option>
                </select>
            </div>

            <div>
                <label class="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Prioridad de Prueba</label>
                <select id="mission-mode" class="bg-slate-900 border border-slate-700 text-sm rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500">
                    <option value="balanced">Equilibrado (Base Permanente)</option>
                    <option value="mobility">Movilidad y Navegación de Rovers</option>
                    <option value="isru">Geología y Extracción (ISRU)</option>
                    <option value="subsurface">Hábitats Subterráneos y Radiación</option>
                </select>
            </div>
        </div>
    </header>

    <!-- Contenido Principal -->
    <main class="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1600px] w-full mx-auto">

        <!-- Columna Izquierda: Objetivo Espacial (4 cols) -->
        <section class="lg:col-span-4 glass-panel rounded-2xl p-5 flex flex-col justify-between">
            <div>
                <div class="flex items-center justify-between mb-3">
                    <span id="planet-badge" class="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        LUNA • ARTEMIS ZONE
                    </span>
                    <span id="target-coords" class="text-xs font-mono text-slate-400">89.9° S, 0.0° E</span>
                </div>
                
                <h2 id="target-title" class="text-xl font-bold text-white mb-2">Cráter Shackleton</h2>
                <p id="target-desc" class="text-sm text-slate-300 leading-relaxed mb-4">
                    Región de luz eterna en los bordes y sombra permanente (PSR) en el interior con altas reservas de hielo de agua y pendientes pronunciadas.
                </p>

                <!-- Visor Topográfico Simulado -->
                <div id="planet-visual" class="planetary-viewport h-52 rounded-xl border border-slate-700 mb-4 flex items-end p-4" style="background-image: url('https://images.unsplash.com/photo-1522030299830-16b8d3d049fe?auto=format&fit=crop&w=800&q=80');">
                    <div class="topo-grid absolute inset-0"></div>
                    <div class="relative z-10 bg-slate-950/80 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-700/80 w-full flex justify-between items-center">
                        <div>
                            <p class="text-[10px] text-slate-400 uppercase">Dataset Fuente</p>
                            <p id="target-dataset" class="text-xs font-mono text-sky-300">LRO LOLA + M3 + Diviner</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[10px] text-slate-400 uppercase">Temp. Media</p>
                            <p id="target-temp" class="text-xs font-mono text-amber-300">-183 °C</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Telemetría Física Base -->
            <div class="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-center">
                <div class="bg-slate-900/70 p-2.5 rounded-lg">
                    <p class="text-[10px] text-slate-400 uppercase">Pendiente</p>
                    <p id="target-slope" class="text-sm font-bold text-white mt-0.5">18.5°</p>
                </div>
                <div class="bg-slate-900/70 p-2.5 rounded-lg">
                    <p class="text-[10px] text-slate-400 uppercase">Mineralogía</p>
                    <p id="target-mineral" class="text-sm font-bold text-white mt-0.5">Anortosita</p>
                </div>
                <div class="bg-slate-900/70 p-2.5 rounded-lg">
                    <p class="text-[10px] text-slate-400 uppercase">Gravedad</p>
                    <p id="target-gravity" class="text-sm font-bold text-white mt-0.5">1.62 m/s²</p>
                </div>
            </div>
        </section>

        <!-- Columna Central: Motor de Similitud & Radar (4 cols) -->
        <section class="lg:col-span-4 glass-panel rounded-2xl p-5 flex flex-col justify-between">
            <div>
                <div class="flex items-center justify-between mb-2">
                    <h3 class="text-sm font-semibold uppercase tracking-wider text-slate-400">Índice de Similitud Física</h3>
                    <span class="text-xs text-emerald-400 font-mono">Algoritmo: Cosine + Weighted</span>
                </div>

                <!-- Score Principal -->
                <div class="flex items-baseline gap-3 mb-4">
                    <span id="match-score" class="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-sky-400">
                        91.4%
                    </span>
                    <span class="text-xs text-slate-400">de compatibilidad para esta misión</span>
                </div>

                <!-- Gráfico de Radar -->
                <div class="bg-slate-900/60 rounded-xl p-3 border border-slate-800 mb-4">
                    <canvas id="radarChart" height="220"></canvas>
                </div>
            </div>

            <!-- Alerta de Brecha de Realidad (Reality Gap) -->
            <div class="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3.5">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-amber-400 text-sm">⚠️</span>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-amber-300">Reality Gap (Brecha de Ingeniería)</h4>
                </div>
                <p id="reality-gap-text" class="text-xs text-amber-100/90 leading-relaxed">
                    Excelente análogo topográfico y térmico criogénico, pero la presión atmosférica terrestre (1 atm) exige compensar la convección térmica en pruebas de trajes y rovers.
                </p>
            </div>
        </section>

        <!-- Columna Derecha: Análogo Terrestre en Mapa Real (4 cols) -->
        <section class="lg:col-span-4 glass-panel rounded-2xl p-5 flex flex-col justify-between">
            <div>
                <div class="flex items-center justify-between mb-3">
                    <span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        ANÁLOGO TERRESTRE ÓPTIMO
                    </span>
                    <span id="earth-coords" class="text-xs font-mono text-slate-400">77.85° S, 166.67° E</span>
                </div>

                <h2 id="earth-title" class="text-xl font-bold text-white mb-1">Valles Secos de McMurdo</h2>
                <p id="earth-location" class="text-xs text-sky-400 font-medium mb-3">Antártida • Joya de Investigación Polar</p>
            </div>

            <!-- Mapa Satelital Interactivo -->
            <div class="flex-1 my-2 rounded-xl overflow-hidden border border-slate-700 relative">
                <div id="earth-map"></div>
            </div>

            <!-- Datasets Terrestres Cruzados -->
            <div class="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <div>
                    <span class="text-slate-400 block text-[10px] uppercase">Capas NASA / Abiertas</span>
                    <span id="earth-datasets" class="font-mono text-emerald-300">ASTER GDEM • MODIS LST • SMAP</span>
                </div>
                <button onclick="exportReport()" class="px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg transition text-xs shadow-lg shadow-sky-600/20">
                    Exportar Ficha JSON
                </button>
            </div>
        </section>

    </main>

    <script>
        // Base de datos estructurada (luego esto vendrá de tu backend en Python / FastAPI)
        const analogDatabase = {
            shackleton: {
                planet: "LUNA • ARTEMIS ZONE",
                title: "Cráter Shackleton",
                coords: "89.90° S, 0.00° E",
                desc: "Bordes con iluminación casi continua y fondo en sombra permanente (PSR) con hielo de agua y pendientes críticas para descenso.",
                image: "https://images.unsplash.com/photo-1522030299830-16b8d3d049fe?auto=format&fit=crop&w=800&q=80",
                dataset: "LRO LOLA + M3 + Diviner",
                temp: "-183 °C",
                slope: "18.5°",
                mineral: "Anortosita",
                gravity: "1.62 m/s²",
                targetMetrics: [90, 65, 95, 88, 40], // Topografía, Mineralogía, Temp Extrema, Iluminación, Subsuelo
                analogs: {
                    balanced: {
                        name: "Valles Secos de McMurdo",
                        location: "Tierra de Victoria, Antártida",
                        lat: -77.47, lon: 162.52,
                        score: "91.4%",
                        earthMetrics: [85, 62, 92, 85, 35],
                        datasets: "ASTER GDEM • MODIS LST • SMAP",
                        gap: "Simula de forma excepcional la aridez extrema, permafrost y ángulos solares bajos, pero requiere compensar gravedad (1/6 g) y vacío."
                    },
                    mobility: {
                        name: "Volcán Licancabur (Ladera Alta)",
                        location: "Altiplano de Atacama, Chile",
                        lat: -22.83, lon: -67.88,
                        score: "94.2%",
                        earthMetrics: [93, 70, 75, 90, 30],
                        datasets: "SRTM 30m • Sentinel-2 • EMIT",
                        gap: "Pendientes de regolito suelto y radiación UV extrema ideales para rovers, aunque la temperatura es mucho más templada que el polo lunar."
                    },
                    isru: {
                        name: "Complejo Ígneo de Stillwater",
                        location: "Montana, Estados Unidos",
                        lat: 45.38, lon: -109.88,
                        score: "89.7%",
                        earthMetrics: [60, 95, 45, 50, 40],
                        datasets: "ASTER Mineral • USGS Geo",
                        gap: "Contiene anortositas ricas en plagioclasa casi idénticas a las tierras altas lunares para probar extracción de oxígeno, pero con vegetación y clima templado."
                    },
                    subsurface: {
                        name: "Cráter Haughton",
                        location: "Isla Devon, Nunavut, Canadá",
                        lat: 75.38, lon: -89.68,
                        score: "88.5%",
                        earthMetrics: [82, 78, 86, 80, 72],
                        datasets: "ArcticDEM • RADARSAT • MODIS",
                        gap: "Estructura de impacto con brechas congeladas ideal para perforación subsuperficial y aislamiento de tripulación."
                    }
                }
            },
            marius: {
                planet: "LUNA • OCEANUS PROCELLARUM",
                title: "Colinas Marius (Clarivoyance Pit)",
                coords: "14.09° N, 56.77° W",
                desc: "Domos volcánicos con tragaluces naturales que dan acceso a tubos de lava subterráneos protegidos contra radiación cósmica.",
                image: "https://images.unsplash.com/photo-1532693322450-2cb5c511067d?auto=format&fit=crop&w=800&q=80",
                dataset: "LROC NAC + GRAIL + Kaguya",
                temp: "-20 °C (interior)",
                slope: "12.0°",
                mineral: "Basalto rico en Ti",
                gravity: "1.62 m/s²",
                targetMetrics: [70, 88, 60, 55, 98],
                analogs: {
                    balanced: {
                        name: "Cueva de los Verdes / Corona",
                        location: "Lanzarote, Islas Canarias",
                        lat: 29.16, lon: -13.43,
                        score: "93.8%",
                        earthMetrics: [72, 90, 58, 55, 96],
                        datasets: "LiDAR Terrestre • ASTER • Sentinel-1",
                        gap: "Tubos de lava basálticos de dimensiones comparables para hábitats inflables, pero en la Luna las cavernas pueden ser 10 veces más anchas por la baja gravedad."
                    },
                    mobility: {
                        name: "Campo Volcánico Krafla",
                        location: "Norte de Islandia",
                        lat: 65.71, lon: -16.75,
                        score: "91.0%",
                        earthMetrics: [85, 86, 68, 60, 80],
                        datasets: "ArcticDEM • EMIT • MODIS",
                        gap: "Flujos de lava recientes y ceniza basáltica ideales para probar tracción de rovers y rappel en claraboyas."
                    },
                    isru: {
                        name: "Meseta Basáltica de Paraná / Atacama Sur",
                        location: "Antofagasta / Taltal, Chile",
                        lat: -25.12, lon: -69.85,
                        score: "90.5%",
                        earthMetrics: [75, 92, 65, 70, 60],
                        datasets: "EMIT Hyperspectral • ASTER",
                        gap: "Basaltos hiperáridos sin alteración acuosa reciente, óptimos para sinterización láser de ladrillos lunares."
                    },
                    subsurface: {
                        name: "Tubos de Lava de Mauna Loa",
                        location: "Hawái, Estados Unidos",
                        lat: 19.47, lon: -155.60,
                        score: "95.1%",
                        earthMetrics: [68, 91, 55, 50, 98],
                        datasets: "NASA GEDI • USGS LiDAR",
                        gap: "Referencia mundial para navegación SLAM sin GPS dentro de túneles volcánicos oscuros y complejos."
                    }
                }
            },
            jezero: {
                planet: "MARTE • ISIDIS PLANITIA",
                title: "Cráter Jezero (Delta Occidental)",
                coords: "18.38° N, 77.58° E",
                desc: "Antiguo paleolago marciano con abanico deltaico rico en esmectitas, carbonatos y sílice hidratada.",
                image: "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=800&q=80",
                dataset: "MRO HiRISE + CRISM + MOLA",
                temp: "-63 °C",
                slope: "9.4°",
                mineral: "Esmectitas / Carbonatos",
                gravity: "3.72 m/s²",
                targetMetrics: [80, 95, 78, 75, 50],
                analogs: {
                    balanced: {
                        name: "Salar de Pajonales / Atacama",
                        location: "Región de Antofagasta, Chile",
                        lat: -25.14, lon: -68.82,
                        score: "94.6%",
                        earthMetrics: [82, 94, 74, 80, 48],
                        datasets: "EMIT • ASTER • Landsat 9",
                        gap: "Presencia de sulfatos, carbonatos y estromatolitos fósiles bajo radiación UV extrema; atmósfera terrestre es 100 veces más densa."
                    },
                    mobility: {
                        name: "Wadi Rum (Valle de la Luna)",
                        location: "Gobernación de Aqaba, Jordania",
                        lat: 29.57, lon: 35.42,
                        score: "89.3%",
                        earthMetrics: [88, 75, 65, 75, 45],
                        datasets: "SRTM • Sentinel-2",
                        gap: "Dunas de arena fina combinadas con afloramientos de arenisca para probar atrapamiento de ruedas."
                    },
                    isru: {
                        name: "Pilbara Craton (North Pole Dome)",
                        location: "Australia Occidental",
                        lat: -21.18, lon: 119.45,
                        score: "92.8%",
                        earthMetrics: [76, 96, 62, 70, 50],
                        datasets: "ASTER Geoscience • Hyperspectral",
                        gap: "Rocas hidrotermales de 3.500 millones de años idénticas a las del Noeico marciano para calibrar espectrómetros Raman."
                    },
                    subsurface: {
                        name: "Río Tinto (Subsuelo Pirítico)",
                        location: "Huelva, España",
                        lat: 37.70, lon: -6.55,
                        score: "86.4%",
                        earthMetrics: [65, 89, 55, 50, 88],
                        datasets: "ESA Sentinel • ESA Borehole Data",
                        gap: "Química ácida rica en hierro y microorganismos quimiolitótrofos subsuperficiales análogos a posibles biosferas marcianas."
                    }
                }
            },
            arcadia: {
                planet: "MARTE • LATITUDES MEDIAS",
                title: "Arcadia Planitia",
                coords: "46.70° N, 192.00° E",
                desc: "Llanura volcánica suave con glaciares enterrados a poca profundidad (<1-2 metros), candidata top para bases humanas SpaceX/NASA.",
                image: "https://images.unsplash.com/photo-1614313913007-2b4ae8ce32d6?auto=format&fit=crop&w=800&q=80",
                dataset: "MRO SHARAD + CTX + THEMIS",
                temp: "-75 °C",
                slope: "2.1°",
                mineral: "Basalto + Hielo H2O",
                gravity: "3.72 m/s²",
                targetMetrics: [96, 80, 88, 70, 85],
                analogs: {
                    balanced: {
                        name: "Meseta de Axel Heiberg",
                        location: "Ártico Canadiense",
                        lat: 79.41, lon: -90.75,
                        score: "92.1%",
                        earthMetrics: [92, 78, 86, 72, 84],
                        datasets: "SMAP • ArcticDEM • MODIS",
                        gap: "Permafrost poligonal y hielo masivo enterrado bajo regolito seco ideal para probar taladros de extracción de agua."
                    },
                    mobility: {
                        name: "Playa Racetrack (Valle de la Muerte)",
                        location: "California, Estados Unidos",
                        lat: 36.67, lon: -117.56,
                        score: "90.8%",
                        earthMetrics: [97, 74, 60, 75, 40],
                        datasets: "USGS LiDAR • Landsat 8",
                        gap: "Planicie ultra-plana con polígonos de desecación para probar aterrizajes de precisión y convoyes autónomos."
                    },
                    isru: {
                        name: "Campo Geotérmico El Tatio / Puna",
                        location: "Antofagasta, Chile",
                        lat: -22.33, lon: -68.01,
                        score: "89.9%",
                        earthMetrics: [84, 86, 80, 78, 75],
                        datasets: "ASTER • EMIT • MODIS LST",
                        gap: "Combinación única de hielo nocturno, baja presión atmosférica y sílice amorfa para sistemas de procesamiento de agua."
                    },
                    subsurface: {
                        name: "Túneles de Permafrost de Fox",
                        location: "Fairbanks, Alaska",
                        lat: 64.95, lon: -147.62,
                        score: "91.5%",
                        earthMetrics: [80, 75, 85, 65, 92],
                        datasets: "NASA ABoVE • SMAP",
                        gap: "Permite ensayar excavación y estabilización térmica de túneles en hielo-suelo sin derretir la estructura."
                    }
                }
            }
        };

        // Inicializar Mapa Leaflet con vista satelital Esri
        const map = L.map('earth-map').setView([-77.47, 162.52], 9);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; NASA/USGS Data Layers'
        }).addTo(map);
        let marker = L.marker([-77.47, 162.52]).addTo(map);

        // Inicializar Gráfico Radar
        const ctx = document.getElementById('radarChart').getContext('2d');
        const radarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Topografía/Pendiente', 'Mineralogía', 'Estrés Térmico', 'Iluminación', 'Acceso Subsuelo'],
                datasets: [
                    {
                        label: 'Objetivo Espacial',
                        data: [90, 65, 95, 88, 40],
                        borderColor: '#818cf8',
                        backgroundColor: 'rgba(129, 140, 248, 0.2)',
                        borderWidth: 2
                    },
                    {
                        label: 'Análogo Terrestre',
                        data: [85, 62, 92, 85, 35],
                        borderColor: '#34d399',
                        backgroundColor: 'rgba(52, 211, 153, 0.2)',
                        borderWidth: 2
                    }
                ]
            },
            options: {
                scales: {
                    r: {
                        min: 0,
                        max: 100,
                        ticks: { display: false },
                        grid: { color: 'rgba(148, 163, 184, 0.15)' },
                        angleLines: { color: 'rgba(148, 163, 184, 0.15)' },
                        pointLabels: { color: '#cbd5e1', font: { size: 11 } }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#e2e8f0', font: { size: 11 } } }
                }
            }
        });

        // Función para actualizar toda la interfaz dinámicamente
        function updateDashboard() {
            const targetKey = document.getElementById('target-select').value;
            const modeKey = document.getElementById('mission-mode').value;
            
            const target = analogDatabase[targetKey];
            const analog = target.analogs[modeKey];

            // Actualizar panel izquierdo (Planeta)
            document.getElementById('planet-badge').textContent = target.planet;
            document.getElementById('target-coords').textContent = target.coords;
            document.getElementById('target-title').textContent = target.title;
            document.getElementById('target-desc').textContent = target.desc;
            document.getElementById('planet-visual').style.backgroundImage = `url('${target.image}')`;
            document.getElementById('target-dataset').textContent = target.dataset;
            document.getElementById('target-temp').textContent = target.temp;
            document.getElementById('target-slope').textContent = target.slope;
            document.getElementById('target-mineral').textContent = target.mineral;
            document.getElementById('target-gravity').textContent = target.gravity;

            // Actualizar panel central (Similitud y Radar)
            document.getElementById('match-score').textContent = analog.score;
            document.getElementById('reality-gap-text').textContent = analog.gap;

            radarChart.data.datasets[0].data = target.targetMetrics;
            radarChart.data.datasets[1].data = analog.earthMetrics;
            radarChart.update();

            // Actualizar panel derecho (Tierra y Mapa)
            document.getElementById('earth-title').textContent = analog.name;
            document.getElementById('earth-location').textContent = analog.location;
            document.getElementById('earth-coords').textContent = `${analog.lat.toFixed(2)}°, ${analog.lon.toFixed(2)}°`;
            document.getElementById('earth-datasets').textContent = analog.datasets;

            map.flyTo([analog.lat, analog.lon], 10, { duration: 1.2 });
            marker.setLatLng([analog.lat, analog.lon]).bindPopup(`<b>${analog.name}</b><br>Similitud: ${analog.score}`).openPopup();
        }

        // Exportar datos para demostrar uso científico
        function exportReport() {
            const targetKey = document.getElementById('target-select').value;
            const modeKey = document.getElementById('mission-mode').value;
            const data = {
                timestamp: new Date().toISOString(),
                target: analogDatabase[targetKey].title,
                missionProfile: modeKey,
                recommendedAnalog: analogDatabase[targetKey].analogs[modeKey]
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analog-report-${targetKey}-${modeKey}.json`;
            a.click();
        }

        document.getElementById('target-select').addEventListener('change', updateDashboard);
        document.getElementById('mission-mode').addEventListener('change', updateDashboard);
    </script>
</body>
</html>
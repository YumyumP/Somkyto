/**
 * ============================================================================
 * PLANETARY TWIN MATCHER & CARTOGRAFÍA LUNAR — BASE DE DATOS UNIFICADA
 * NASA Space Apps 2026
 * ============================================================================
 * Contiene:
 *  1. Parámetros temporales, ejes físicos y vectores de peso W (Twin Matcher).
 *  2. Base de datos de objetivos espaciales (Luna y Marte) y análogos terrestres.
 *  3. Pool global de sitios análogos terrestres para evaluación dinámica de
 *     terrenos importados desde el Mapa Lunar Equirrectangular.
 *  4. Catálogos selenográficos IAU/NASA (Mares, Cráteres, Cuencas y Misiones).
 * ============================================================================
 */

window.PTM_DATA = (() => {
    // ------------------------------------------------------------------------
    // 1. CONSTANTES TEMPORALES Y MODELO MATEMÁTICO (TWIN MATCHER)
    // ------------------------------------------------------------------------
    const MONTHS_FULL = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const MONTHS_SHORT = [
        'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
        'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'
    ];

    const AXIS_NAMES = ['Topo/Pend', 'Mineralogía', 'Térmico', 'Iluminación', 'Subsuelo'];
    const AXIS_FULL = ['Topografía', 'Mineralogía', 'Estrés térmico', 'Iluminación', 'Subsuelo'];

    // Orden de ejes: [0: Topografía/Pendiente, 1: Mineralogía, 2: Estrés Térmico, 3: Iluminación, 4: Acceso Subsuelo]
    const MISSION_WEIGHTS = {
        balanced: {
            name: 'Equilibrado (Base)',
            weights: [0.20, 0.20, 0.20, 0.20, 0.20]
        },
        mobility: {
            name: 'Movilidad Rovers',
            weights: [0.40, 0.15, 0.15, 0.25, 0.05]
        },
        isru: {
            name: 'Geología / ISRU',
            weights: [0.10, 0.50, 0.15, 0.10, 0.15]
        },
        subsurface: {
            name: 'Hábitats / Subsuelo',
            weights: [0.10, 0.15, 0.25, 0.05, 0.45]
        }
    };

    const PLANET_NOTES = {
        LUNA: 'La Luna no tiene atmósfera (vacío casi total), su gravedad es ~1/6 de la terrestre (1,62 vs 9,81 m/s²), el regolito es extremadamente abrasivo y la radiación cósmica llega sin filtro. Un análogo terrestre solo reproduce parte de estas condiciones: hay que compensar presión, convección térmica, gravedad y polvo mediante simulación o pruebas complementarias.',
        MARTE: 'Marte tiene una atmósfera muy tenue (~0,6% de la presión terrestre, dominada por CO₂), gravedad de 3,72 m/s² (~38% de la terrestre), suelos con percloratos y mayor radiación en superficie. Un análogo terrestre reproduce bien geología y clima, pero no presión, composición atmosférica ni gravedad: estas diferencias deben compensarse en el diseño de las pruebas.'
    };

    // ------------------------------------------------------------------------
    // 2. OBJETIVOS ESPACIALES Y ANÁLOGOS TERRESTRES PRECONFIGURADOS
    // ------------------------------------------------------------------------
    const analogDatabase = {
        shackleton: {
            planet: 'LUNA • ARTEMIS ZONE',
            body: 'LUNA',
            lunarFeatureName: 'Shackleton',
            title: 'Cráter Shackleton',
            coords: '89.90° S, 0.00° E',
            desc: 'Bordes con iluminación casi continua y fondo en sombra permanente (PSR) con hielo de agua y pendientes críticas para descenso.',
            dataset: 'LRO LOLA + M3 + Diviner',
            temp: '-183 °C',
            slope: '18.5°',
            mineral: 'Anortosita',
            gravity: '1.62 m/s²',
            color: 0x38bdf8,
            reliefFactor: 0.8,
            targetMetrics: [94, 92, 95, 92, 88],
            candidates: [
                {
                    id: 'mcmurdo',
                    name: 'Valles Secos de McMurdo',
                    shortName: 'McMurdo',
                    country: 'Antártida',
                    location: 'Tierra de Victoria, Antártida',
                    lat: -77.47,
                    lon: 162.52,
                    earthMetrics: [86, 80, 91, 86, 81],
                    seasonalCurve: [0, -1, -5, -11, -16, -20, -21, -18, -12, -6, -2, -1],
                    offSeasonReason: 'Noche polar antártica (oscuridad total y vientos catabáticos extremos en invierno austral).',
                    datasets: 'ASTER GDEM • MODIS LST • SMAP',
                    gap: 'Simula de forma excepcional la aridez extrema, permafrost y ángulos solares bajos, pero requiere compensar gravedad (1/6 g) y vacío.'
                },
                {
                    id: 'licancabur',
                    name: 'Volcán Licancabur (Ladera Alta)',
                    shortName: 'V. Licancabur',
                    country: 'Chile',
                    location: 'Altiplano de Atacama, Chile',
                    lat: -22.83,
                    lon: -67.88,
                    earthMetrics: [94, 80, 79, 92, 65],
                    seasonalCurve: [-14, -15, -8, -4, -2, -1, 0, -1, -1, -2, -4, -9],
                    offSeasonReason: 'Invierno Altiplánico estival aporta nubosidad, nieve y humedad que alteran la tracción y aridez.',
                    datasets: 'SRTM 30m • Sentinel-2 • EMIT',
                    gap: 'Pendientes de regolito suelto y radiación UV extrema ideales para rovers, aunque la temperatura es más templada que el polo lunar.'
                },
                {
                    id: 'stillwater',
                    name: 'Complejo Ígneo de Stillwater',
                    shortName: 'Stillwater',
                    country: 'EE. UU.',
                    location: 'Montana, Estados Unidos',
                    lat: 45.38,
                    lon: -109.88,
                    earthMetrics: [75, 92, 80, 76, 80],
                    seasonalCurve: [-14, -13, -9, -5, -3, -1, -1, 0, -1, -4, -10, -13],
                    offSeasonReason: 'Cobertura de nieve y congelamiento superficial invernal dificulta excavación ISRU.',
                    datasets: 'ASTER Mineral • USGS Geo',
                    gap: 'Contiene anortositas ricas en plagioclasa casi idénticas a las tierras altas lunares para probar extracción de oxígeno, pero con vegetación y clima templado.'
                },
                {
                    id: 'haughton',
                    name: 'Cráter Haughton',
                    shortName: 'C. Haughton',
                    country: 'Canadá',
                    location: 'Isla Devon, Nunavut, Canadá',
                    lat: 75.38,
                    lon: -89.68,
                    earthMetrics: [81, 80, 93, 78, 88],
                    seasonalCurve: [-18, -18, -14, -8, -4, -1, 0, -1, -5, -10, -15, -18],
                    offSeasonReason: 'Noche polar ártica y congelamiento severo reducen la viabilidad de pruebas solares en superficie.',
                    datasets: 'ArcticDEM • RADARSAT • MODIS',
                    gap: 'Estructura de impacto con brechas congeladas ideal para perforación subsuperficial y aislamiento de tripulación.'
                }
            ]
        },

        marius: {
            planet: 'LUNA • OCEANUS PROCELLARUM',
            body: 'LUNA',
            lunarFeatureName: 'Océano de las Tormentas',
            title: 'Colinas Marius (Skylight Pit)',
            coords: '14.09° N, 56.77° W',
            desc: 'Domos volcánicos con tragaluces naturales que dan acceso a tubos de lava subterráneos protegidos contra radiación cósmica.',
            dataset: 'LROC NAC + GRAIL + Kaguya',
            temp: '-20 °C (interior)',
            slope: '12.0°',
            mineral: 'Basalto rico en Ti',
            gravity: '1.62 m/s²',
            color: 0x818cf8,
            reliefFactor: 0.5,
            targetMetrics: [88, 94, 80, 76, 98],
            candidates: [
                {
                    id: 'lanzarote',
                    name: 'Cueva de los Verdes / Corona',
                    shortName: 'C. Los Verdes',
                    country: 'España',
                    location: 'Lanzarote, Islas Canarias',
                    lat: 29.16,
                    lon: -13.43,
                    earthMetrics: [83, 88, 78, 74, 90],
                    seasonalCurve: [-5, -4, -2, -1, -1, -1, -1, -1, 0, -1, -3, -5],
                    offSeasonReason: 'Lluvias atlánticas ocasionales y mayor humedad ambiental durante el invierno boreal.',
                    datasets: 'LiDAR Terrestre • ASTER • Sentinel-1',
                    gap: 'Tubos de lava basálticos de dimensiones comparables para hábitats inflables, pero en la Luna las cavernas pueden ser 10 veces más anchas por la baja gravedad.'
                },
                {
                    id: 'krafla',
                    name: 'Campo Volcánico Krafla',
                    shortName: 'Krafla',
                    country: 'Islandia',
                    location: 'Norte de Islandia',
                    lat: 65.71,
                    lon: -16.75,
                    earthMetrics: [88, 85, 77, 76, 76],
                    seasonalCurve: [-16, -15, -12, -7, -3, -1, 0, -1, -4, -8, -13, -16],
                    offSeasonReason: 'Tormentas subárticas, nieve profunda y baja iluminación solar fuera del verano boreal.',
                    datasets: 'ArcticDEM • EMIT • MODIS',
                    gap: 'Flujos de lava recientes y ceniza basáltica ideales para probar tracción de rovers y descenso por cable en claraboyas.'
                },
                {
                    id: 'taltal',
                    name: 'Meseta Basáltica Atacama Sur',
                    shortName: 'Atacama Sur',
                    country: 'Chile',
                    location: 'Antofagasta / Taltal, Chile',
                    lat: -25.12,
                    lon: -69.85,
                    earthMetrics: [79, 94, 78, 72, 80],
                    seasonalCurve: [-1, -1, -1, -1, -2, -4, -4, -3, -1, 0, -1, -1],
                    offSeasonReason: 'Ingreso ocasional de nubosidad costera (camanchaca invernal) reduce ligeramente la insolación.',
                    datasets: 'EMIT Hyperspectral • ASTER',
                    gap: 'Basaltos hiperáridos sin alteración acuosa reciente, óptimos para sinterización láser de ladrillos lunares.'
                },
                {
                    id: 'maunaloa',
                    name: 'Tubos de Lava de Mauna Loa',
                    shortName: 'Mauna Loa',
                    country: 'EE. UU.',
                    location: 'Hawái, Estados Unidos',
                    lat: 19.47,
                    lon: -155.60,
                    earthMetrics: [75, 86, 80, 64, 98],
                    seasonalCurve: [-8, -9, -5, -3, -1, -1, -1, 0, -1, -2, -4, -7],
                    offSeasonReason: 'Frentes invernales de alta montaña en Hawái generan nieve y viento en cotas altas.',
                    datasets: 'NASA GEDI • USGS LiDAR',
                    gap: 'Referencia mundial para navegación SLAM sin GPS dentro de túneles volcánicos oscuros y complejos.'
                }
            ]
        },

        jezero: {
            planet: 'MARTE • ISIDIS PLANITIA',
            body: 'MARTE',
            lunarFeatureName: null,
            title: 'Cráter Jezero (Delta Occidental)',
            coords: '18.38° N, 77.58° E',
            desc: 'Antiguo paleolago marciano con abanico deltaico rico en esmectitas, carbonatos y sílice hidratada.',
            dataset: 'MRO HiRISE + CRISM + MOLA',
            temp: '-63 °C',
            slope: '9.4°',
            mineral: 'Esmectitas / Carbonatos',
            gravity: '3.72 m/s²',
            color: 0xf43f5e,
            reliefFactor: 0.6,
            targetMetrics: [90, 96, 84, 86, 88],
            candidates: [
                {
                    id: 'pajonales',
                    name: 'Salar de Pajonales / Atacama',
                    shortName: 'S. Pajonales',
                    country: 'Chile',
                    location: 'Región de Antofagasta, Chile',
                    lat: -25.14,
                    lon: -68.82,
                    earthMetrics: [84, 91, 82, 82, 82],
                    seasonalCurve: [-12, -13, -6, -3, -2, -2, -2, -1, 0, -1, -2, -6],
                    offSeasonReason: 'Precipitaciones y humedad del Invierno Altiplánico alteran temporalmente las costras salinas.',
                    datasets: 'EMIT • ASTER • Landsat 9',
                    gap: 'Presencia de sulfatos, carbonatos y estromatolitos fósiles bajo radiación UV extrema; atmósfera terrestre es 100 veces más densa.'
                },
                {
                    id: 'wadirum',
                    name: 'Wadi Rum (Valle de la Luna)',
                    shortName: 'Wadi Rum',
                    country: 'Jordania',
                    location: 'Gobernación de Aqaba, Jordania',
                    lat: 29.57,
                    lon: 35.42,
                    earthMetrics: [90, 84, 80, 86, 68],
                    seasonalCurve: [-7, -6, -2, 0, -1, -3, -5, -5, -1, -1, -3, -6],
                    offSeasonReason: 'Lluvias invernales o tormentas térmicas de polvo en pleno verano boreal.',
                    datasets: 'SRTM • Sentinel-2',
                    gap: 'Dunas de arena fina combinadas con afloramientos de arenisca para probar atrapamiento de ruedas.'
                },
                {
                    id: 'pilbara',
                    name: 'Pilbara Craton (North Pole Dome)',
                    shortName: 'Pilbara',
                    country: 'Australia',
                    location: 'Australia Occidental',
                    lat: -21.18,
                    lon: 119.45,
                    earthMetrics: [78, 96, 80, 78, 80],
                    seasonalCurve: [-14, -15, -10, -4, -2, -1, 0, -1, -1, -2, -5, -11],
                    offSeasonReason: 'Temporada ciclónica húmeda y calor extremo estival inunda accesos y altera sensores.',
                    datasets: 'ASTER Geoscience • Hyperspectral',
                    gap: 'Rocas hidrotermales de 3.500 millones de años idénticas a las del Noeico marciano para calibrar espectrómetros Raman.'
                },
                {
                    id: 'riotinto',
                    name: 'Río Tinto (Subsuelo Pirítico)',
                    shortName: 'Río Tinto',
                    country: 'España',
                    location: 'Huelva, España',
                    lat: 37.70,
                    lon: -6.55,
                    earthMetrics: [74, 88, 84, 72, 88],
                    seasonalCurve: [-9, -8, -6, -4, -2, 0, -1, -1, -1, -4, -8, -10],
                    offSeasonReason: 'Lluvias otoñales e invernales diluyen las costras minerales ácidas superficiales.',
                    datasets: 'ESA Sentinel • ESA Borehole Data',
                    gap: 'Química ácida rica en hierro y microorganismos quimiolitótrofos subsuperficiales análogos a posibles biosferas marcianas.'
                }
            ]
        },

        arcadia: {
            planet: 'MARTE • LATITUDES MEDIAS',
            body: 'MARTE',
            lunarFeatureName: null,
            title: 'Arcadia Planitia',
            coords: '46.70° N, 192.00° E',
            desc: 'Llanura volcánica suave con glaciares enterrados a poca profundidad (<1-2 metros), candidata top para bases humanas.',
            dataset: 'MRO SHARAD + CTX + THEMIS',
            temp: '-75 °C',
            slope: '2.1°',
            mineral: 'Basalto + Hielo H2O',
            gravity: '3.72 m/s²',
            color: 0x10b981,
            reliefFactor: 0.3,
            targetMetrics: [96, 90, 92, 82, 95],
            candidates: [
                {
                    id: 'axelheiberg',
                    name: 'Meseta de Axel Heiberg',
                    shortName: 'Axel Heiberg',
                    country: 'Canadá',
                    location: 'Ártico Canadiense, Nunavut',
                    lat: 79.41,
                    lon: -90.75,
                    earthMetrics: [88, 84, 89, 78, 88],
                    seasonalCurve: [-18, -17, -13, -7, -3, -1, 0, -1, -4, -10, -15, -18],
                    offSeasonReason: 'Oscuridad polar e inaccesibilidad logística extrema fuera del verano ártico.',
                    datasets: 'SMAP • ArcticDEM • MODIS',
                    gap: 'Permafrost poligonal y hielo masivo enterrado bajo regolito seco ideal para probar taladros de extracción de agua.'
                },
                {
                    id: 'racetrack',
                    name: 'Playa Racetrack (Valle de la Muerte)',
                    shortName: 'Racetrack',
                    country: 'EE. UU.',
                    location: 'California, Estados Unidos',
                    lat: 36.67,
                    lon: -117.56,
                    earthMetrics: [96, 80, 80, 82, 70],
                    seasonalCurve: [-12, -13, -6, -2, 0, -1, -3, -3, -1, -1, -4, -10],
                    offSeasonReason: 'Lluvias invernales inundan la planicie arcillosa formando barro que impide el rodaje de rovers.',
                    datasets: 'USGS LiDAR • Landsat 8',
                    gap: 'Planicie ultra-plana con polígonos de desecación para probar aterrizajes de precisión y convoyes autónomos.'
                },
                {
                    id: 'eltatio',
                    name: 'Campo Geotérmico El Tatio / Puna',
                    shortName: 'El Tatio',
                    country: 'Chile',
                    location: 'Antofagasta, Chile',
                    lat: -22.33,
                    lon: -68.01,
                    earthMetrics: [82, 90, 88, 78, 84],
                    seasonalCurve: [-13, -14, -6, -3, -2, -1, -1, 0, -1, -1, -2, -7],
                    offSeasonReason: 'Invierno Altiplánico estival aporta lluvias y nubosidad convectiva sobre el campo geotérmico.',
                    datasets: 'ASTER • EMIT • MODIS LST',
                    gap: 'Combinación única de hielo nocturno, baja presión atmosférica y sílice amorfa para sistemas de procesamiento de agua.'
                },
                {
                    id: 'foxtunnel',
                    name: 'Túneles de Permafrost de Fox',
                    shortName: 'Fox Permafrost',
                    country: 'EE. UU.',
                    location: 'Fairbanks, Alaska',
                    lat: 64.95,
                    lon: -147.62,
                    earthMetrics: [78, 82, 92, 70, 95],
                    seasonalCurve: [-9, -8, -5, -3, -1, 0, -1, -1, -2, -4, -7, -9],
                    offSeasonReason: 'Tormentas subárticas en superficie durante el invierno boreal.',
                    datasets: 'NASA ABoVE • SMAP',
                    gap: 'Permite ensayar excavación y estabilización térmica de túneles en hielo-suelo sin derretir la estructura.'
                }
            ]
        }
    };

    // Pool global de candidatos análogos lunares/terrestres para terrenos importados desde el Mapa Lunar
    const LUNAR_ANALOG_CANDIDATES = [
        ...analogDatabase.shackleton.candidates,
        ...analogDatabase.marius.candidates
    ];

    // ------------------------------------------------------------------------
    // 3. CATÁLOGOS SELENOGRÁFICOS (MAPA LUNAR EQUIRRECTANGULAR)
    // ------------------------------------------------------------------------
    const LUNAR_CONSTANTS = {
        W: 2880,
        H: 1440,
        KM: 30.32,
        STEP: 0.4,
        GW: 900,
        GH: 450,
        RM: 1737.4
    };

    // [nombre_latin, nombre_es, lat, lon, ancho_ew, alto_ns, diametro_km, descripcion]
    const LUNAR_MARIA = [
        ['Mare Imbrium', 'Mar de las Lluvias', 32.8, -15.6, 560, 520, 1123, 'Gran cuenca de impacto rellena de lava basáltica. Apolo 15 aterrizó en su borde, junto a los Apeninos.'],
        ['Mare Serenitatis', 'Mar de la Serenidad', 28, 17.5, 350, 340, 707, 'Mar circular rodeado de montañas; Apolo 17 aterrizó en el valle Taurus–Littrow, en su borde.'],
        ['Mare Tranquillitatis', 'Mar de la Tranquilidad', 8.5, 31.4, 440, 400, 873, 'Sitio del alunizaje del Apolo 11, en 1969.'],
        ['Mare Crisium', 'Mar de las Crisis', 17, 59.1, 240, 190, 418, 'Mar aislado cerca del borde oriental; la sonda soviética Luna 24 aterrizó aquí en 1976.'],
        ['Mare Fecunditatis', 'Mar de la Fecundidad', -7.8, 51.3, 460, 360, 909, 'Extenso mar del este; la sonda Luna 16 recogió muestras aquí en 1970.'],
        ['Mare Nectaris', 'Mar del Néctar', -15.2, 35.5, 165, 165, 333, 'Cuenca antigua cuya formación marca el inicio del período Nectárico de la historia lunar.'],
        ['Mare Frigoris', 'Mar del Frío', 56, 1.4, 780, 140, 1596, 'Larga franja de lava al norte de la cara visible.'],
        ['Oceanus Procellarum', 'Océano de las Tormentas', 18.4, -57.4, 760, 950, 2568, 'La mayor llanura de lava de la cara visible. Apolo 12 aterrizó aquí en 1969 y Chang’e 5 en 2020.'],
        ['Mare Nubium', 'Mar de las Nubes', -21.3, -16.6, 350, 330, 715, 'Mar del hemisferio sur de la cara visible, cerca del cráter Ptolomeo.'],
        ['Mare Humorum', 'Mar de las Humedades', -24.4, -38.6, 190, 190, 389, 'Cuenca circular; el cráter Gassendi está en su borde norte.'],
        ['Mare Cognitum', 'Mar Conocido', -10, -23.1, 180, 180, 376, 'Recibió su nombre tras el impacto de la sonda Ranger 7 en 1964.'],
        ['Mare Vaporum', 'Mar de los Vapores', 13.3, 3.6, 120, 120, 245, 'Pequeño mar cerca de los Apeninos; el sitio de Apolo 15 queda al norte.'],
        ['Mare Insularum', 'Mar de las Islas', 7.5, -30.9, 250, 220, 513, 'Mar entre el Océano de las Tormentas y el Mar Conocido, cerca del cráter Copérnico.'],
        ['Mare Smythii', 'Mar de Smyth', 1.3, 87.5, 190, 160, 373, 'Mar junto al borde oriental; se ve de canto desde la Tierra.'],
        ['Mare Marginis', 'Mar del Borde', 13.3, 86.1, 180, 140, 358, 'Mar del borde oriental, visible solo con libración favorable.'],
        ['Mare Moscoviense', 'Mar de Moscú', 27.3, 147.9, 135, 135, 277, 'Mar de la cara oculta, conocido gracias a imágenes de sondas soviéticas.'],
        ['Mare Ingenii', 'Mar del Ingenio', -33.7, 163.5, 150, 150, 318, 'Mar de la cara oculta con remolinos brillantes asociados a anomalías magnéticas.'],
        ['Mare Australe', 'Mar Austral', -38.9, 93, 300, 220, 603, 'Mar irregular del borde suroriental.'],
        ['Mare Orientale', 'Mar Oriental', -19.4, -92.8, 160, 160, 327, 'Centro de la cuenca de impacto Orientale, la mejor conservada de la Luna.']
    ];

    // [nombre_es, lat, lon, diametro_km, posicion_etiqueta, descripcion, nombre_en]
    const LUNAR_CRATERS = [
        ['Copérnico', 9.62, -20.08, 96, 'r', 'Cráter joven (unos 800 millones de años) con terrazas, picos centrales y rayos brillantes.', 'Copernicus'],
        ['Tycho', -43.31, -11.36, 85, 'r', 'Cráter joven (unos 108 millones de años) con el sistema de rayos más llamativo de la cara visible.', 'Tycho'],
        ['Platón', 51.62, -9.38, 101, 't', 'Cráter de suelo oscuro y plano, inundado de lava, en el borde norte del Mar de las Lluvias.', 'Plato'],
        ['Shackleton', -89.9, 129.78, 21, 'p', 'Cráter junto al polo sur con el interior en sombra permanente; candidato a albergar hielo de agua y región de interés para Artemis.', 'Shackleton'],
        ['Aristarco', 23.73, -47.49, 40, 'r', 'Uno de los cráteres más brillantes de la cara visible.', 'Aristarchus'],
        ['Kepler', 8.12, -38.01, 31, 'l', 'Cráter joven con rayos, en el Océano de las Tormentas.', 'Kepler'],
        ['Clavius', -58.8, -14.4, 225, 'r', 'Uno de los mayores cráteres de la cara visible; su suelo tiene un arco de cráteres menores.', 'Clavius'],
        ['Grimaldi', -5.5, -68.3, 172, 'l', 'Cuenca de suelo oscuro cerca del borde occidental.', 'Grimaldi'],
        ['Langrenus', -8.9, 61.1, 132, 'r', 'Cráter con terrazas y pico central, junto al Mar de la Fecundidad.', 'Langrenus'],
        ['Teófilo', -11.4, 26.4, 100, 'r', 'Cráter con picos centrales; forma un trío con Cirilo y Catalina.', 'Theophilus'],
        ['Ptolomeo', -9.3, -1.9, 153, 'l', 'Cráter de suelo plano y oscuro, cerca del centro de la cara visible.', 'Ptolemaeus'],
        ['Arquímedes', 29.7, -4, 83, 't', 'Cráter de suelo liso inundado de lava, entre los Apeninos y el Mar de las Lluvias.', 'Archimedes'],
        ['Aristóteles', 50.2, 17.3, 87, 'r', 'Cráter con terrazas, al norte del Mar de la Serenidad.', 'Aristoteles'],
        ['Petavius', -25.1, 60.4, 177, 'r', 'Cráter con pico central y una gran grieta en el suelo.', 'Petavius'],
        ['Tsiolkovski', -20.4, 129.1, 180, 'r', 'Cráter de la cara oculta con suelo oscuro y un pico central muy marcado.', 'Tsiolkovskiy'],
        ['Hertzsprung', 2.6, -128.7, 591, 'b', 'Cuenca de impacto de anillos múltiples en la cara oculta.', 'Hertzsprung'],
        ['Korolev', -4, -157.4, 437, 'b', 'Gran cuenca de impacto en la cara oculta.', 'Korolev'],
        ['Schrödinger', -75, 132.4, 316, 't', 'Cuenca con anillo de picos cerca del polo sur, en la cara oculta.', 'Schrödinger'],
        ['Cabeus', -84.9, -35.5, 98, 'p', 'Cráter cerca del polo sur donde la misión LCROSS (2009) detectó agua.', 'Cabeus']
    ];

    // [nombre_es, nombre_en, lat, lon, año, agencia, lado_etiqueta, descripcion]
    const LUNAR_SITES = [
        ['Apolo 11', 'Apollo 11', 0.67, 23.47, 1969, 'NASA', 'r', 'Primer alunizaje tripulado (20 de julio): Armstrong y Aldrin en el Mar de la Tranquilidad.'],
        ['Apolo 12', 'Apollo 12', -3.01, -23.42, 1969, 'NASA', 'l', 'Segundo alunizaje tripulado, a unos 180 m de la sonda Surveyor 3, en el Océano de las Tormentas.'],
        ['Apolo 14', 'Apollo 14', -3.65, -17.47, 1971, 'NASA', 'r', 'Aterrizó en la región de Fra Mauro; Alan Shepard golpeó pelotas de golf en la superficie.'],
        ['Apolo 15', 'Apollo 15', 26.13, 3.63, 1971, 'NASA', 'r', 'Primer uso del rover lunar, junto a los Apeninos y la grieta Hadley.'],
        ['Apolo 16', 'Apollo 16', -8.97, 15.5, 1972, 'NASA', 'l', 'Único alunizaje del programa en las tierras altas (región de Descartes).'],
        ['Apolo 17', 'Apollo 17', 20.19, 30.77, 1972, 'NASA', 'r', 'Última misión tripulada a la Luna, en el valle Taurus–Littrow.'],
        ['Luna 9', 'Luna 9', 7.08, -64.37, 1966, 'URSS', 'l', 'Primer aterrizaje suave en la Luna; transmitió las primeras fotos desde la superficie.'],
        ['Luna 16', 'Luna 16', -0.68, 56.3, 1970, 'URSS', 'r', 'Primera sonda robótica que devolvió muestras lunares a la Tierra.'],
        ['Lunojod 1', 'Lunokhod 1', 38.24, -35, 1970, 'URSS', 'l', 'Primer rover robótico en otro mundo, en el Mar de las Lluvias.'],
        ['Luna 24', 'Luna 24', 12.75, 62.2, 1976, 'URSS', 'r', 'Última misión de muestras soviética, en el Mar de las Crisis.'],
        ['Surveyor 1', 'Surveyor 1', -2.47, -43.34, 1966, 'NASA', 'l', 'Primer aterrizaje suave de EE. UU., precursor del programa Apolo.'],
        ['Chang’e 3', 'Chang\'e 3', 44.12, -19.51, 2013, 'China', 'r', 'Primer alunizaje suave chino; desplegó el rover Yutu en el norte del Mar de las Lluvias.'],
        ['Chang’e 4', 'Chang\'e 4', -45.46, 177.59, 2019, 'China', 'l', 'Primer aterrizaje en la cara oculta, dentro del cráter Von Kármán.'],
        ['Chang’e 5', 'Chang\'e 5', 43.06, -51.92, 2020, 'China', 'l', 'Trajo unos 1,7 kg de muestras del Océano de las Tormentas.'],
        ['Chang’e 6', 'Chang\'e 6', -41.64, -153.99, 2024, 'China', 'r', 'Primeras muestras de la cara oculta, cuenca Polo Sur–Aitken.'],
        ['Chandrayaan-3', 'Chandrayaan-3', -69.37, 32.32, 2023, 'India (ISRO)', 'r', 'Primer alunizaje cerca del polo sur lunar.']
    ];

    const LUNAR_EXTRA_BASINS = [
        {
            k: 'cuenca',
            es: 'Cuenca Polo Sur–Aitken',
            lat: 'South Pole–Aitken basin',
            la: -53,
            lo: -169,
            D: 2500,
            f: 'La mayor y más antigua cuenca de impacto de la Luna. Chang’e 4 aterrizó dentro de ella en 2019.'
        }
    ];

    const LUNAR_TYPE_LABELS = {
        mar: 'Mar lunar (llanura de lava basáltica)',
        crater: 'Cráter de impacto',
        cuenca: 'Cuenca de impacto',
        sitio: 'Sitio de misión espacial'
    };

    return {
        MONTHS_FULL,
        MONTHS_SHORT,
        AXIS_NAMES,
        AXIS_FULL,
        MISSION_WEIGHTS,
        PLANET_NOTES,
        analogDatabase,
        LUNAR_ANALOG_CANDIDATES,
        LUNAR_CONSTANTS,
        LUNAR_MARIA,
        LUNAR_CRATERS,
        LUNAR_SITES,
        LUNAR_EXTRA_BASINS,
        LUNAR_TYPE_LABELS
    };

    // ------------------------------------------------------------------------
    // 5. CATÁLOGOS AREOGRÁFICOS DE MARTE (MAPA MARCIANO EQUIRRECTANGULAR)
    // ------------------------------------------------------------------------
    const MARS_CONSTANTS = {
        W: 2880,
        H: 1440,
        KM: 59.16, // Factor de escala para Marte (Radio R = 3389.5 km)
        STEP: 0.4,
        RM: 3389.5
    };

    // [nombre_latin, nombre_es, lat, lon, ancho_ew, alto_ns, diametro_km, descripcion]
    const MARS_FEATURES = [
        ['Olympus Mons', 'Monte Olimpo', 18.65, 226.2, 550, 550, 624, 'El volcán más alto del Sistema Solar y de todo el planeta, con casi 22 km de altura.'],
        ['Valles Marineris', 'Valles Marineris', -14.0, 300.0, 950, 300, 4000, 'Gigantesco sistema de cañones ecuatoriales que se extiende por casi una cuarta parte del planeta.'],
        ['Tharsis', 'Abovedamiento de Tharsis', 0.0, 250.0, 700, 700, 3000, 'Vasta meseta volcánica que alberga a los mayores volcanes de Marte (Ascraeus, Pavonis, Arsia).'],
        ['Elysium Planitia', 'Planicie de Elysium', 3.0, 154.0, 500, 400, 1700, 'Segunda región volcánica más grande, sitio de aterrizaje de la misión InSight.'],
        ['Arcadia Planitia', 'Arcadia Planitia', 46.7, 188.0, 600, 350, 1800, 'Llanura volcánica suave con glaciares de agua subsuperficial; candidata clave para asentamientos humanos.'],
        ['Isidis Planitia', 'Planicie de Isidis', 12.9, 87.0, 350, 350, 1500, 'Antigua cuenca de impacto circular situada en el hemisferio oriental.'],
        ['Utopia Planitia', 'Planicie de Utopía', 46.7, 117.5, 700, 400, 3300, 'La mayor cuenca de impacto de Marte; sitio de aterrizaje de Viking 2 y del rover Zhurong.'],
        ['Hellas Planitia', 'Cuenca de Hellas', -42.4, 70.0, 500, 450, 2300, 'Una de las estructuras de impacto más grandes del sistema solar, con un fondo muy profundo y atmosférico.']
    ];

    // [nombre_es, lat, lon, diametro_km, posicion_etiqueta, descripcion, nombre_en]
    const MARS_CRATERS = [
        ['Jezero', 18.38, 77.58, 49, 'r', 'Antiguo paleolago con un delta fluvial bien conservado; sitio de exploración del rover Perseverance.', 'Jezero'],
        ['Gale', -5.4, 137.2, 154, 'r', 'Cráter de impacto con un pico central masivo (Monte Sharp) explorado por el rover Curiosity.', 'Gale'],
        ['Schiaparelli', -2.7, 343.8, 461, 'b', 'Gran cráter de impacto ecuatorial con terreno complejo en su interior.', 'Schiaparelli'],
        ['Endeavour', -2.3, 5.1, 22, 'l', 'Cráter explorado extensamente por el rover Opportunity de la NASA.', 'Endeavour'],
        ['Mojave', 7.5, 33.0, 60, 'r', 'Cráter joven con eyecciones y dunas bien preservadas.', 'Mojave'],
        ['Gusev', -14.57, 175.47, 166, 'l', 'Cráter rellenado de sedimentos volcánicos y fluviales, explorado por el rover Spirit.', 'Gusev'],
        ['Knobel', 6.7, 222.8, 86, 't', 'Cráter situado en los flancos de la región volcánica de Tharsis.', 'Knobel']
    ];

    // [nombre_es, nombre_en, lat, lon, año, agencia, lado_etiqueta, descripcion]
    const MARS_SITES = [
        ['Viking 1', 'Viking 1', 22.48, 47.95, 1976, 'NASA', 'r', 'Primer aterrizaje exitoso y transmisión de datos desde la superficie marciana (Chryse Planitia).'],
        ['Viking 2', 'Viking 2', 48.27, 134.26, 1976, 'NASA', 'l', 'Segundo aterrizaje en Utopía Planitia, realizando análisis biológicos y meteorológicos.'],
        ['Pathfinder', 'Mars Pathfinder', 19.33, 326.45, 1997, 'NASA', 'r', 'Primer despliegue de un vehículo rodante (Sojourner) en Ares Vallis.'],
        ['Spirit', 'MER-A Spirit', -14.57, 175.47, 2004, 'NASA', 'l', 'Rover explorador que operó en el cráter Gusev durante más de 6 años.'],
        ['Opportunity', 'MER-B Opportunity', -1.94, 354.47, 2004, 'NASA', 'r', 'Rover gemelo que batió récords de distancia explorando Meridiani Planum.'],
        ['Curiosity', 'MSL Curiosity', -4.59, 137.44, 2012, 'NASA', 'l', 'Laboratorio móvil propulsado por plutonio que investiga el clima y la habitabilidad en el cráter Gale.'],
        ['Perseverance', 'Mars 2020', 18.38, 77.58, 2021, 'NASA', 'r', 'Rover avanzado recolector de muestras para retorno a la Tierra en el cráter Jezero.'],
        ['Zhurong', 'Tianwen-1', 25.06, 109.92, 2021, 'CNSA (China)', 'l', 'Primer rover chino en la superficie marciana, operando en Utopia Planitia.']
    ];

    const MARS_TYPE_LABELS = {
        mar: 'Región volcánica / Valles masivos',
        crater: 'Cráter de impacto',
        cuenca: 'Cuenca de impacto',
        sitio: 'Sitio de misión espacial marciana'
    };
    
})();
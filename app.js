// Configuración Global
let state = {
    view: 'dashboard',
    mode: 'nominal',
    startYear: 2020,
    endYear: 2026,
    baseYear: 2026,
    activeChart: 'Total' // Controla qué gráfico se ve
};

let trendChartInstance = null;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initFilters();
    renderDashboard();     
    renderTrendChart(state.activeChart);    
    renderTable();         
    
    document.getElementById('searchInput').addEventListener('keyup', (e) => renderTable(e.target.value));
    document.getElementById('themeToggle').addEventListener('click', () => {
        document.body.dataset.theme = document.body.dataset.theme === 'dark' ? '' : 'dark';
    });
});

// --- LÓGICA DE DATOS ---
function getValor(item, year, tipo='obs') {
    if (!item || !item.datos[year]) return 0;
    // Prioridad: Tipo específico > Obs > Prog > 0
    let val = item.datos[year][tipo] !== undefined ? item.datos[year][tipo] : (item.datos[year]['obs'] || item.datos[year]['prog'] || 0);
    
    if (state.mode === 'real') {
        const deflactorActual = datosDeflactores[year] || 100;
        const deflactorBase = datosDeflactores[state.baseYear] || 100;
        val = val * (deflactorBase / deflactorActual);
    }
    return val;
}

function getValorNominal(item, year, tipo='obs') {
    if (!item || !item.datos[year]) return 0;
    return item.datos[year][tipo] !== undefined ? item.datos[year][tipo] : (item.datos[year]['obs'] || item.datos[year]['prog'] || 0);
}

// --- RENDER DASHBOARD (Tarjetas Interactivas y Tabla) ---
function renderDashboard() {
    const tableBody = document.querySelector('#resumen-table tbody');
    const kpiContainer = document.getElementById('kpi-container');
    tableBody.innerHTML = '';
    kpiContainer.innerHTML = ''; 
    
    const currentYear = 2026; 
    const prevYear = 2025;
    
    // Validación anti-crash: Si no has cargado la base macro aun, usamos objeto vacío
    const macroData = (typeof datosMacro !== 'undefined' && datosMacro[currentYear]) ? datosMacro[currentYear] : {};

    // 1. Obtener Items Principales
    const itemTotal = datosHacendarios.find(d => d.nivel === 1);
    const itemPetroleros = datosHacendarios.find(d => d.concepto.toLowerCase().includes('petroleros') && d.nivel <= 2);
    const itemTributarios = datosHacendarios.find(d => d.concepto.toLowerCase().includes('tributarios') && d.nivel <= 4);

    // --- TARJETA 1: TOTAL ---
    if (itemTotal) {
        const totalCurr = getValor(itemTotal, currentYear, 'prog');
        const totalPrev = getValor(itemTotal, prevYear, 'obs');
        crearTarjeta({
            id: 'Total',
            titulo: "Ingresos Totales",
            valor: totalCurr,
            valorPrev: totalPrev,
            subtexto: "vs año anterior",
            icono: "fas fa-sack-dollar",
            isActive: state.activeChart === 'Total',
            macros: [] // El total no suele llevar detalle macro específico
        }, kpiContainer);
    }

    // --- TARJETA 2: PETROLEROS ---
    if (itemPetroleros) {
        const petroCurr = getValor(itemPetroleros, currentYear, 'prog');
        const petroPrev = getValor(itemPetroleros, prevYear, 'obs');
        crearTarjeta({
            id: 'Petroleros',
            titulo: "Petroleros",
            valor: petroCurr,
            valorPrev: petroPrev,
            subtexto: "vs año anterior",
            icono: "fas fa-oil-well",
            isActive: state.activeChart === 'Petroleros',
            // DATOS MACRO INTEGRADOS AQUÍ
            macros: [
                { label: "Mezcla", val: macroData.petroleo_precio ? `$${macroData.petroleo_precio}` : '-' },
                { label: "Prod.", val: macroData.petroleo_prod ? `${macroData.petroleo_prod}` : '-' },
                { label: "Gas", val: macroData.gas_precio ? `$${macroData.gas_precio}` : '-' }
            ]
        }, kpiContainer);
    }

    // --- TARJETA 3: TRIBUTARIOS ---
    if (itemTributarios) {
        const tribCurr = getValor(itemTributarios, currentYear, 'prog');
        const tribPrev = getValor(itemTributarios, prevYear, 'obs');
        crearTarjeta({
            id: 'Tributarios',
            titulo: "Tributarios",
            valor: tribCurr,
            valorPrev: tribPrev,
            subtexto: "vs año anterior",
            icono: "fas fa-file-invoice-dollar",
            isActive: state.activeChart === 'Tributarios',
            // DATOS MACRO INTEGRADOS AQUÍ
            macros: [
                { label: "Tasa Int.", val: macroData.tasa_interes ? `${macroData.tasa_interes}%` : '-' },
                { label: "Tipo Cambio", val: macroData.tipo_cambio ? `$${macroData.tipo_cambio}` : '-' }
            ]
        }, kpiContainer);
    }

    // 2. TABLA RESUMEN (Nivel <= 4)
    const resumenItems = datosHacendarios.filter(d => d.nivel <= 4);
    resumenItems.forEach(item => {
        const valNomPrev = getValorNominal(item, prevYear, 'obs');
        const valNomCurr = getValorNominal(item, currentYear, 'prog');
        
        // Calculo Variación Real para la columna %
        const defPrev = datosDeflactores[prevYear] || 100;
        const defCurr = datosDeflactores[currentYear] || 100;
        const factorInflacion = (defCurr / defPrev) - 1;
        
        let varNominal = (valNomCurr / valNomPrev) - 1;
        let varReal = ((1 + varNominal) / (1 + factorInflacion)) - 1;
        
        if(valNomPrev === 0 || isNaN(varReal)) varReal = 0;

        const row = document.createElement('tr');
        const padding = `${(item.nivel - 1) * 20}px`;
        const weight = item.nivel <= 2 ? '700' : '400';
        const color = item.nivel === 1 ? 'var(--primary)' : 'var(--text)';
        const trendClass = varReal >= 0 ? 'trend-up' : 'trend-down';
        const trendIcon = varReal >= 0 ? '▲' : '▼';

        row.innerHTML = `
            <td style="padding-left:${padding}; font-weight:${weight}; color:${color};">${item.concepto}</td>
            <td>${formatMoney(valNomPrev)}</td>
            <td>${formatMoney(valNomCurr)}</td>
            <td><span class="${trendClass}">${trendIcon} ${(varReal * 100).toFixed(1)}%</span></td>
        `;
        tableBody.appendChild(row);
    });
}

// --- CREAR TARJETA (HELPER) ---
function crearTarjeta(data, container) {
    const diff = data.valor - data.valorPrev;
    const varPct = data.valorPrev > 0 ? (data.valor / data.valorPrev) - 1 : 0;
    
    const trendClass = varPct >= 0 ? 'positive' : 'negative';
    const trendIcon = varPct >= 0 ? '▲' : '▼';
    const trendColor = varPct >= 0 ? '#27ae60' : '#c0392b';
    
    // HTML Mini Tabla Macro
    let macrosHTML = '';
    if(data.macros && data.macros.length > 0) {
        macrosHTML = `<div class="kpi-macro-list">`;
        data.macros.forEach(m => {
            macrosHTML += `
                <div class="macro-item">
                    <span class="macro-label">${m.label}</span>
                    <span class="macro-val">${m.val}</span>
                </div>`;
        });
        macrosHTML += `</div>`;
    }

    const activeClass = data.isActive ? 'active-card' : '';

    const html = `
        <div class="kpi-card-pro ${activeClass}" onclick="cambiarGrafico('${data.id}')">
            <div class="kpi-content-top">
                <div class="kpi-header">
                    <span class="kpi-title"><i class="${data.icono}"></i> ${data.titulo}</span>
                    <span class="kpi-badge ${trendClass}">${trendIcon} ${(varPct * 100).toFixed(1)}%</span>
                </div>
                <div class="kpi-body">
                    <div class="kpi-main-value">${formatMoney(data.valor)}</div>
                    <div class="kpi-subtext">
                        <span style="color: ${trendColor}; font-weight:bold;">${diff >= 0 ? '+' : ''}${formatMoney(diff)}</span> ${data.subtexto}
                    </div>
                </div>
            </div>
            ${macrosHTML}
        </div>
    `;
    container.innerHTML += html;
}

// --- INTERACCIÓN CLICK ---
function cambiarGrafico(conceptoId) {
    state.activeChart = conceptoId;
    renderDashboard(); // Actualiza bordes de tarjetas
    renderTrendChart(conceptoId); // Actualiza gráfico
}

// --- RENDER GRÁFICO DINÁMICO (REAL 2026) ---
function renderTrendChart(filtroConcepto) {
    const ctx = document.getElementById('trendChart');
    if(!ctx) return;

    let itemGraficar;
    if (filtroConcepto === 'Total') {
        itemGraficar = datosHacendarios.find(d => d.nivel === 1);
    } else if (filtroConcepto === 'Petroleros') {
        itemGraficar = datosHacendarios.find(d => d.concepto.toLowerCase().includes('petroleros') && d.nivel <= 2);
    } else if (filtroConcepto === 'Tributarios') {
        itemGraficar = datosHacendarios.find(d => d.concepto.toLowerCase().includes('tributarios') && d.nivel <= 4);
    }

    const tituloEl = document.getElementById('chart-title');
    if(tituloEl) tituloEl.innerText = itemGraficar ? `Tendencia: ${itemGraficar.concepto}` : 'Tendencia';

    if(!itemGraficar) return;

    const years = ['2020', '2021', '2022', '2023', '2024', '2025', '2026'];
    const dataPoints = [];
    const defBase = datosDeflactores[2026] || 100;

    years.forEach(y => {
        const valNom = getValorNominal(itemGraficar, parseInt(y), 'obs');
        const defYear = datosDeflactores[y] || 100;
        const valReal = valNom * (defBase / defYear); // Conversión a pesos constantes 2026
        dataPoints.push(valReal);
    });

    if (trendChartInstance) {
        trendChartInstance.destroy();
    }

    // Color según tema
    let chartColor = '#d4c19c'; // Dorado
    if (filtroConcepto === 'Petroleros') chartColor = '#2c3e50'; // Negro/Azul
    if (filtroConcepto === 'Tributarios') chartColor = '#27ae60'; // Verde

    trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [{
                label: 'Monto Real (Precios 2026)',
                data: dataPoints,
                borderColor: chartColor,
                backgroundColor: chartColor + '33', // Transparencia
                borderWidth: 3,
                pointBackgroundColor: '#fff',
                pointBorderColor: chartColor,
                pointRadius: 5,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { borderDash: [5, 5], color: '#eee' },
                    ticks: { callback: function(value) { return '$' + (value/1000000).toFixed(1) + 'M'; } }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

// --- UTILS (TABLA HISTÓRICA) ---
function renderTable(filterText = '') {
    const thead = document.getElementById('table-header');
    const tbody = document.getElementById('table-body');
    const tfoot = document.getElementById('table-footer');
    
    let headersHTML = '<th>Concepto</th>';
    const years = [];
    for(let y = state.startYear; y <= state.endYear; y++) years.push(y);
    years.forEach(y => headersHTML += `<th>${y}</th>`);
    thead.innerHTML = headersHTML;

    tbody.innerHTML = '';
    let totalesColumna = new Array(years.length).fill(0);
    
    const itemsVisibles = datosHacendarios.filter(item => {
        if(filterText === '') return true;
        return item.concepto.toLowerCase().includes(filterText.toLowerCase());
    });

    itemsVisibles.forEach(item => {
        const tr = document.createElement('tr');
        const padding = `${(item.nivel-1)*20}px`;
        const weight = item.nivel === 1 ? '700' : '400';
        
        tr.innerHTML = `<td style="padding-left:${padding}; font-weight:${weight}">${item.concepto}</td>`;
        
        years.forEach((y, index) => {
            const val = getValor(item, y, 'obs');
            tr.innerHTML += `<td>${formatMoney(val)}</td>`;
            if (item.nivel === 1) totalesColumna[index] += val; 
            else if (itemsVisibles.length < datosHacendarios.length) totalesColumna[index] += val;
        });
        tbody.appendChild(tr);
    });

    let footerHTML = '<td>TOTAL</td>';
    const itemTotalBD = datosHacendarios.find(d => d.nivel === 1);
    years.forEach((y, index) => {
        let valorFooter = (filterText === '' && itemTotalBD) ? getValor(itemTotalBD, y, 'obs') : totalesColumna[index];
        footerHTML += `<td>${formatMoney(valorFooter)}</td>`;
    });
    tfoot.innerHTML = footerHTML;
}

function initFilters() {
    const startSel = document.getElementById('startYear');
    const endSel = document.getElementById('endYear');
    const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
    years.forEach(y => {
        startSel.add(new Option(y, y, false, y === state.startYear));
        endSel.add(new Option(y, y, false, y === state.endYear));
    });
    startSel.addEventListener('change', (e) => { state.startYear = parseInt(e.target.value); renderTable(); });
    endSel.addEventListener('change', (e) => { state.endYear = parseInt(e.target.value); renderTable(); });
}

function switchView(viewName) {
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('historico-view').classList.add('hidden');
    document.getElementById(`${viewName}-view`).classList.remove('hidden');
}

function setMode(newMode) {
    state.mode = newMode;
    document.getElementById('btn-nom').classList.toggle('active');
    document.getElementById('btn-real').classList.toggle('active');
    renderTable(document.getElementById('searchInput').value);
}

function formatMoney(amount) {
    if (amount === null || amount === undefined) return "-";
    return amount.toLocaleString('es-MX', { style: 'decimal', minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function exportExcel() {
    const table = document.getElementById('main-table');
    const wb = XLSX.utils.table_to_book(table, {sheet: "Consulta"});
    XLSX.writeFile(wb, `Consulta_Hacendaria_${new Date().toISOString().slice(0,10)}.xlsx`);

}


/* ==========================================
   MÓDULO DE ACCESIBILIDAD Y NAVEGACIÓN
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    initAccessibility();
});

function initAccessibility() {
    // 1. CONTROL DE TAMAÑO DE TEXTO
    let currentFontSize = 100; // Porcentaje base
    const body = document.body;
    
    document.getElementById('btnIncreaseFont').addEventListener('click', () => {
        if (currentFontSize < 130) { // Límite máximo
            currentFontSize += 5;
            body.style.fontSize = `${currentFontSize}%`;
        }
    });

    document.getElementById('btnDecreaseFont').addEventListener('click', () => {
        if (currentFontSize > 85) { // Límite mínimo
            currentFontSize -= 5;
            body.style.fontSize = `${currentFontSize}%`;
        }
    });

    // 2. SISTEMA DE LECTURA DE VOZ (TTS)
    const btnTTS = document.getElementById('btnTTS');
    let isSpeaking = false;
    let synth = window.speechSynthesis;
    let utterance = null;

    btnTTS.addEventListener('click', () => {
        if (isSpeaking) {
            // Si está hablando, callar
            synth.cancel();
            isSpeaking = false;
            btnTTS.classList.remove('speaking-active');
            btnTTS.innerHTML = '<i class="fas fa-volume-up"></i>';
        } else {
            // Iniciar lectura
            leerContenidoVisible();
        }
    });

    function leerContenidoVisible() {
        // Detener cualquier audio previo
        synth.cancel();

        // Detectar qué vista está activa (Dashboard o Histórico)
        const dashboardView = document.getElementById('dashboard-view');
        const historicoView = document.getElementById('historico-view');
        let textoALeer = "";

        if (!dashboardView.classList.contains('hidden')) {
            textoALeer = "Estás en el Panorama General. " + limpiarTexto(dashboardView.innerText);
        } else if (!historicoView.classList.contains('hidden')) {
            textoALeer = "Estás en el Análisis Histórico. " + limpiarTexto(historicoView.innerText);
        }

        if (textoALeer) {
            utterance = new SpeechSynthesisUtterance(textoALeer);
            utterance.lang = 'es-MX'; // Español de México
            utterance.rate = 1; // Velocidad normal
            
            // Eventos visuales
            utterance.onstart = () => {
                isSpeaking = true;
                btnTTS.classList.add('speaking-active');
                btnTTS.innerHTML = '<i class="fas fa-stop"></i>'; // Cambiar icono a Stop
            };

            utterance.onend = () => {
                isSpeaking = false;
                btnTTS.classList.remove('speaking-active');
                btnTTS.innerHTML = '<i class="fas fa-volume-up"></i>';
            };

            synth.speak(utterance);
        }
    }

    // Función auxiliar para limpiar el texto de saltos de línea excesivos
    function limpiarTexto(texto) {
        // Reemplaza múltiples espacios y saltos de línea por un punto y coma para pausa natural
        return texto.replace(/\s+/g, ' ').replace(/(\r\n|\n|\r)/gm, ". ");
    }
}

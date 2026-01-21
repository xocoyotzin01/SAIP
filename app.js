// ==========================================
// 1. CONFIGURACIÓN GLOBAL
// ==========================================
let state = {
    view: 'dashboard',
    mode: 'nominal',
    startYear: 2020,
    endYear: 2026,
    baseYear: 2026,
    activeChart: 'Total',
    expandedRows: new Set(),
    selectedRows: new Set()
};

let trendChartInstance = null;
let currentUtterance = null;

// ==========================================
// 2. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Verificación de seguridad
    if (typeof datosHacendarios === 'undefined') {
        console.error("Error: data.js no se ha cargado.");
        return;
    }

    initFilters();
    initAccessibility();
    renderDashboard();     
    renderTrendChart(state.activeChart);    
    renderTable();         
    
    // Estilos dinámicos para selección y tour
    const style = document.createElement('style');
    style.innerHTML = `
        .selected-row td { background-color: rgba(212, 193, 156, 0.4) !important; border-bottom: 1px solid var(--gold); }
        .clickable-cell { cursor: pointer; }
        .clickable-cell:hover { background-color: rgba(0,0,0,0.05); }
    `;
    document.head.appendChild(style);

    const searchInput = document.getElementById('searchInput');
    if(searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            renderTable(e.target.value);
        });
    }

    const themeToggle = document.getElementById('themeToggle');
    if(themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.dataset.theme = document.body.dataset.theme === 'dark' ? '' : 'dark';
        });
    }

    // INICIAR TOUR SI ES NECESARIO
    initTourSystem();
});

// ==========================================
// 3. LÓGICA DE INTERACCIÓN
// ==========================================

function toggleRow(id) {
    if (state.expandedRows.has(id)) {
        state.expandedRows.delete(id);
    } else {
        state.expandedRows.add(id);
    }
    // Renderizamos manteniendo el filtro actual para ver los hijos
    const searchText = document.getElementById('searchInput').value;
    renderTable(searchText);
}

function toggleSelection(id) {
    if (state.selectedRows.has(id)) {
        state.selectedRows.delete(id);
    } else {
        state.selectedRows.add(id);
    }
    const searchText = document.getElementById('searchInput').value;
    renderTable(searchText);
}

function getValor(item, year, tipo='obs') {
    if (!item || !item.datos[year]) return 0;
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

// ==========================================
// 4. RENDER DASHBOARD
// ==========================================
function renderDashboard() {
    const tableBody = document.querySelector('#resumen-table tbody');
    const kpiContainer = document.getElementById('kpi-container');
    
    if(!tableBody || !kpiContainer) return;

    tableBody.innerHTML = '';
    kpiContainer.innerHTML = ''; 
    
    const currentYear = 2026; 
    const prevYear = 2025;
    const macroData = (typeof datosMacro !== 'undefined' && datosMacro[currentYear]) ? datosMacro[currentYear] : {};

    const itemTotal = datosHacendarios.find(d => d.nivel === 1);
    const itemPetroleros = datosHacendarios.find(d => d.concepto.toLowerCase().includes('petroleros') && d.nivel <= 2);
    const itemTributarios = datosHacendarios.find(d => d.concepto.toLowerCase().includes('tributarios') && d.nivel <= 4);

    if (itemTotal) crearTarjeta({ id: 'Total', titulo: "Ingresos Totales", valor: getValor(itemTotal, currentYear, 'prog'), valorPrev: getValor(itemTotal, prevYear, 'obs'), subtexto: "vs año anterior", icono: "fas fa-sack-dollar", isActive: state.activeChart === 'Total', macros: [] }, kpiContainer);
    
    if (itemPetroleros) crearTarjeta({ id: 'Petroleros', titulo: "Petroleros", valor: getValor(itemPetroleros, currentYear, 'prog'), valorPrev: getValor(itemPetroleros, prevYear, 'obs'), subtexto: "vs año anterior", icono: "fas fa-oil-well", isActive: state.activeChart === 'Petroleros', macros: [{ label: "Mezcla", val: macroData.petroleo_precio ? `$${macroData.petroleo_precio}` : '-' }, { label: "Prod.", val: macroData.petroleo_prod ? `${macroData.petroleo_prod}` : '-' }] }, kpiContainer);

    if (itemTributarios) crearTarjeta({ id: 'Tributarios', titulo: "Tributarios", valor: getValor(itemTributarios, currentYear, 'prog'), valorPrev: getValor(itemTributarios, prevYear, 'obs'), subtexto: "vs año anterior", icono: "fas fa-file-invoice-dollar", isActive: state.activeChart === 'Tributarios', macros: [{ label: "Tasa Int.", val: macroData.tasa_interes ? `${macroData.tasa_interes}%` : '-' }, { label: "Tipo Cambio", val: macroData.tipo_cambio ? `$${macroData.tipo_cambio}` : '-' }] }, kpiContainer);

    // Tabla Resumen
    const resumenItems = datosHacendarios.filter(d => d.nivel <= 3); 
    resumenItems.forEach(item => {
        const valNomPrev = getValorNominal(item, prevYear, 'obs');
        const valNomCurr = getValorNominal(item, currentYear, 'prog');
        const defPrev = datosDeflactores[prevYear] || 100;
        const defCurr = datosDeflactores[currentYear] || 100;
        const factorInflacion = (defCurr / defPrev) - 1;
        let varNominal = (valNomCurr / valNomPrev) - 1;
        let varReal = ((1 + varNominal) / (1 + factorInflacion)) - 1;
        if(valNomPrev === 0 || isNaN(varReal)) varReal = 0;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding-left:${(item.nivel - 1) * 20}px; font-weight:700;">${item.concepto}</td>
            <td>${formatMoney(valNomPrev)}</td>
            <td>${formatMoney(valNomCurr)}</td>
            <td><span class="${varReal >= 0 ? 'trend-up' : 'trend-down'}">${varReal >= 0 ? '▲' : '▼'} ${(varReal * 100).toFixed(1)}%</span></td>
        `;
        tableBody.appendChild(row);
    });
}

function crearTarjeta(data, container) {
    const diff = data.valor - data.valorPrev;
    const varPct = data.valorPrev > 0 ? (data.valor / data.valorPrev) - 1 : 0;
    let macrosHTML = '';
    if(data.macros && data.macros.length > 0) {
        macrosHTML = `<div class="kpi-macro-list">`;
        data.macros.forEach(m => { macrosHTML += `<div class="macro-item"><span class="macro-label">${m.label}</span><span class="macro-val">${m.val}</span></div>`; });
        macrosHTML += `</div>`;
    }
    container.innerHTML += `
        <div class="kpi-card-pro ${data.isActive ? 'active-card' : ''}" onclick="cambiarGrafico('${data.id}')">
            <div class="kpi-content-top">
                <div class="kpi-header"><span class="kpi-title"><i class="${data.icono}"></i> ${data.titulo}</span><span class="kpi-badge ${varPct >= 0 ? 'positive' : 'negative'}">${varPct >= 0 ? '▲' : '▼'} ${(varPct * 100).toFixed(1)}%</span></div>
                <div class="kpi-body"><div class="kpi-main-value">${formatMoney(data.valor)}</div><div class="kpi-subtext"><span style="color: ${varPct >= 0 ? '#27ae60' : '#c0392b'}; font-weight:bold;">${diff >= 0 ? '+' : ''}${formatMoney(diff)}</span> ${data.subtexto}</div></div>
            </div>${macrosHTML}
        </div>`;
}

// ==========================================
// 5. GRÁFICOS
// ==========================================
function cambiarGrafico(conceptoId) {
    state.activeChart = conceptoId;
    renderDashboard();
    renderTrendChart(conceptoId);
}

function renderTrendChart(filtroConcepto) {
    const ctx = document.getElementById('trendChart');
    if(!ctx) return;
    let itemGraficar = datosHacendarios.find(d => d.nivel === 1); 
    
    if (filtroConcepto === 'Petroleros') itemGraficar = datosHacendarios.find(d => d.concepto.toLowerCase().includes('petroleros') && d.nivel <= 2);
    else if (filtroConcepto === 'Tributarios') itemGraficar = datosHacendarios.find(d => d.concepto.toLowerCase().includes('tributarios') && d.nivel <= 4);

    const years = ['2020', '2021', '2022', '2023', '2024', '2025', '2026'];
    const dataPoints = [];
    const defBase = datosDeflactores[2026] || 100;

    if(itemGraficar) {
        document.getElementById('chart-title').innerText = `Tendencia: ${itemGraficar.concepto}`;
        years.forEach(y => {
            const valNom = getValorNominal(itemGraficar, parseInt(y), 'obs');
            const defYear = datosDeflactores[y] || 100;
            dataPoints.push(valNom * (defBase / defYear));
        });
    }

    if (trendChartInstance) trendChartInstance.destroy();
    
    trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [{
                label: 'Monto Real (2026)',
                data: dataPoints,
                borderColor: '#d4c19c',
                backgroundColor: '#d4c19c33',
                fill: true, tension: 0.4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: v => '$' + (v/1000000).toFixed(1) + 'M' } } } }
    });
}

// ==========================================
// 6. TABLA HISTÓRICA (FILTRADO JERÁRQUICO ARREGLADO)
// ==========================================
function renderTable(filterText = '') {
    const thead = document.getElementById('table-header');
    const tbody = document.getElementById('table-body');
    const tfoot = document.getElementById('table-footer');
    
    if(!thead || !tbody) return;

    let headersHTML = '<th>Concepto</th>';
    const years = [];
    for(let y = state.startYear; y <= state.endYear; y++) years.push(y);
    years.forEach(y => headersHTML += `<th>${y}</th>`);
    thead.innerHTML = headersHTML;

    tbody.innerHTML = '';
    if(tfoot) tfoot.innerHTML = ''; 

    // --- LÓGICA DE FILTRADO INTELIGENTE ---
    let itemsVisibles = [];
    let lastLevel4Id = null;
    let lastLevel5Id = null;
    
    // Banderas para saber si los padres coinciden con la búsqueda
    let parentLevel4Matches = false;
    let parentLevel5Matches = false;

    datosHacendarios.forEach(item => {
        const matchesSelf = filterText === '' || item.concepto.toLowerCase().includes(filterText.toLowerCase());

        // --- NIVEL 4 (PADRE PRINCIPAL) ---
        if (item.nivel === 4) {
            lastLevel4Id = item.id;
            lastLevel5Id = null; // Reset sub-niveles
            parentLevel4Matches = matchesSelf; // Guardamos si el padre coincide
            
            // Mostrar si coincide él mismo (o si no hay filtro)
            if (matchesSelf) {
                itemsVisibles.push(item);
            }
        } 

        // --- NIVEL 5 (HIJO) ---
        else if (item.nivel === 5) {
            lastLevel5Id = item.id;
            parentLevel5Matches = matchesSelf;

            const isExpanded = lastLevel4Id && state.expandedRows.has(lastLevel4Id);
            
            // REGLA DE ORO: 
            // 1. Si el padre está expandido -> MOSTRAR SIEMPRE (comportamiento normal).
            // 2. Si el padre NO está expandido:
            //    - Solo mostrar si el hijo coincide Y EL PADRE NO.
            //    - Si el padre ya coincide (ej. buscaste "Tributarios"), ocultamos al hijo 
            //      para que quede dentro de la carpeta y no duplicado afuera.
            
            if (isExpanded) {
                itemsVisibles.push(item);
            } else {
                if (matchesSelf && !parentLevel4Matches && filterText !== '') {
                    // Muestra hijos "huérfanos" (ej. buscas "IEPS", pero el padre es "Tributarios")
                    itemsVisibles.push(item);
                }
                // Si matchesSelf es true PERO parentLevel4Matches es true, NO lo agregamos.
                // El usuario debe expandir el padre.
            }
        } 

        // --- NIVEL 6 (NIETO) ---
        else if (item.nivel === 6) {
            const isParentExpanded = lastLevel5Id && state.expandedRows.has(lastLevel5Id);
            const isGrandParentExpanded = lastLevel4Id && state.expandedRows.has(lastLevel4Id);
            
            if (isGrandParentExpanded && isParentExpanded) {
                itemsVisibles.push(item);
            } else {
                // Misma lógica: mostrar solo si es coincidencia única
                if (matchesSelf && !parentLevel5Matches && filterText !== '') {
                    itemsVisibles.push(item);
                }
            }
        }
        
        // --- NIVEL 1, 2, 3 (SUPERIORES) ---
        else if (item.nivel < 4) {
             if (matchesSelf) itemsVisibles.push(item);
        }
    });

    // --- RENDERIZADO ---
    itemsVisibles.forEach(item => {
        const tr = document.createElement('tr');
        const isSelected = state.selectedRows.has(item.id);
        const isExpanded = state.expandedRows.has(item.id);

        if (isSelected) tr.classList.add('selected-row');

        const padding = `${(item.nivel-1)*20}px`;
        const fontWeight = item.nivel <= 4 ? '700' : '400';
        const color = item.nivel === 1 ? 'var(--primary)' : 'var(--text)';
        
        let conceptoHTML = '';
        // Mostramos ícono [+] para niveles 4 y 5
        if (item.nivel === 4 || item.nivel === 5) {
            const icon = isExpanded ? 'fa-minus-square' : 'fa-plus-square';
            const iconColor = isExpanded ? 'var(--gold)' : '#ccc';
            conceptoHTML = `
                <div style="cursor:pointer; display:flex; align-items:center;">
                    <i class="fas ${icon}" style="margin-right:8px; color:${iconColor};" onclick="toggleRow(${item.id})"></i>
                    <span onclick="toggleSelection(${item.id})">${item.concepto}</span>
                </div>`;
        } else {
            conceptoHTML = `<span style="cursor:pointer" onclick="toggleSelection(${item.id})">${item.concepto}</span>`;
        }

        tr.innerHTML = `<td style="padding-left:${padding}; font-weight:${fontWeight}; color:${color}">${conceptoHTML}</td>`;
        
        years.forEach(y => {
            const val = getValor(item, y, 'obs');
            tr.innerHTML += `<td class="clickable-cell" onclick="toggleSelection(${item.id})">${formatMoney(val)}</td>`;
        });
        tbody.appendChild(tr);
    });
}

// ==========================================
// 7. UTILS & SISTEMA DE TOUR (DEMO)
// ==========================================
function initFilters() {
    const startSel = document.getElementById('startYear');
    const endSel = document.getElementById('endYear');
    if(!startSel || !endSel) return;
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

    // ACTIVAR TOUR SI ENTRA A HISTÓRICO Y NO LO HA VISTO
    if (viewName === 'historico') {
        checkAndStartTour();
    }
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

function initAccessibility() {
    let currentFontSize = 100;
    const btnInc = document.getElementById('btnIncreaseFont');
    const btnDec = document.getElementById('btnDecreaseFont');
    if(btnInc) btnInc.addEventListener('click', () => { if(currentFontSize<130){currentFontSize+=5;document.body.style.fontSize=`${currentFontSize}%`;}});
    if(btnDec) btnDec.addEventListener('click', () => { if(currentFontSize>85){currentFontSize-=5;document.body.style.fontSize=`${currentFontSize}%`;}});

    const btnTTS = document.getElementById('btnTTS');
    const synth = window.speechSynthesis;
    if (!btnTTS) return;

    btnTTS.addEventListener('click', () => {
        if (synth.speaking) { synth.cancel(); resetBotonTTS(); return; }
        
        let texto = "";
        if(!document.getElementById('dashboard-view').classList.contains('hidden')) {
             texto = "Panorama. " + document.getElementById('dashboard-view').innerText;
        } else {
             const seleccionadas = Array.from(state.selectedRows).length;
             texto = `Tabla Histórica. Hay ${seleccionadas} filas seleccionadas.`;
        }

        currentUtterance = new SpeechSynthesis

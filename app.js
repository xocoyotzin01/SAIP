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
    expandedRows: new Set() // NUEVO: Para guardar qué filas están abiertas
};

let trendChartInstance = null;
let currentUtterance = null;

// ==========================================
// 2. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (typeof datosHacendarios === 'undefined') {
        console.error("Error: data.js no se ha cargado.");
        return;
    }

    initFilters();
    initAccessibility();
    renderDashboard();     
    renderTrendChart(state.activeChart);    
    renderTable();         
    
    const searchInput = document.getElementById('searchInput');
    if(searchInput) {
        // Modificado para reiniciar expansión al buscar
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
});

// ==========================================
// 3. LÓGICA DE DATOS Y EXPANSIÓN
// ==========================================

// NUEVA FUNCIÓN: Abrir/Cerrar niveles
function toggleRow(id) {
    if (state.expandedRows.has(id)) {
        state.expandedRows.delete(id);
    } else {
        state.expandedRows.add(id);
    }
    // Renderizamos de nuevo para aplicar cambios
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
// 4. RENDER DASHBOARD (Sin cambios mayores)
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

    // Items Principales (Ajusta los niveles según tu Excel real si es necesario)
    const itemTotal = datosHacendarios.find(d => d.nivel === 1);
    const itemPetroleros = datosHacendarios.find(d => d.concepto.toLowerCase().includes('petroleros') && d.nivel <= 2);
    // Buscamos tributarios genéricos para la tarjeta
    const itemTributarios = datosHacendarios.find(d => d.concepto.toLowerCase().includes('tributarios') && d.nivel <= 4);

    if (itemTotal) crearTarjeta({ id: 'Total', titulo: "Ingresos Totales", valor: getValor(itemTotal, currentYear, 'prog'), valorPrev: getValor(itemTotal, prevYear, 'obs'), subtexto: "vs año anterior", icono: "fas fa-sack-dollar", isActive: state.activeChart === 'Total', macros: [] }, kpiContainer);
    
    if (itemPetroleros) crearTarjeta({ id: 'Petroleros', titulo: "Petroleros", valor: getValor(itemPetroleros, currentYear, 'prog'), valorPrev: getValor(itemPetroleros, prevYear, 'obs'), subtexto: "vs año anterior", icono: "fas fa-oil-well", isActive: state.activeChart === 'Petroleros', macros: [{ label: "Mezcla", val: macroData.petroleo_precio ? `$${macroData.petroleo_precio}` : '-' }, { label: "Prod.", val: macroData.petroleo_prod ? `${macroData.petroleo_prod}` : '-' }] }, kpiContainer);

    if (itemTributarios) crearTarjeta({ id: 'Tributarios', titulo: "Tributarios", valor: getValor(itemTributarios, currentYear, 'prog'), valorPrev: getValor(itemTributarios, prevYear, 'obs'), subtexto: "vs año anterior", icono: "fas fa-file-invoice-dollar", isActive: state.activeChart === 'Tributarios', macros: [{ label: "Tasa Int.", val: macroData.tasa_interes ? `${macroData.tasa_interes}%` : '-' }, { label: "Tipo Cambio", val: macroData.tipo_cambio ? `$${macroData.tipo_cambio}` : '-' }] }, kpiContainer);

    // Tabla Resumen pequeña
    const resumenItems = datosHacendarios.filter(d => d.nivel <= 3); // Solo mostramos niveles altos en resumen
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
    let itemGraficar = datosHacendarios.find(d => d.nivel === 1); // Default Total
    
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
// 6. TABLA HISTÓRICA CON DRIL-DOWN (MEJORADA)
// ==========================================
function renderTable(filterText = '') {
    const thead = document.getElementById('table-header');
    const tbody = document.getElementById('table-body');
    const tfoot = document.getElementById('table-footer');
    
    if(!thead || !tbody) return;

    // Encabezados
    let headersHTML = '<th>Concepto</th>';
    const years = [];
    for(let y = state.startYear; y <= state.endYear; y++) years.push(y);
    years.forEach(y => headersHTML += `<th>${y}</th>`);
    thead.innerHTML = headersHTML;

    tbody.innerHTML = '';
    let totalesColumna = new Array(years.length).fill(0);
    
    // --- LÓGICA DE FILTRADO INTELIGENTE ---
    // Si buscas "Tributarios" (Nivel 4), queremos traer también a sus hijos (Nivel 5)
    // aunque sus hijos no tengan la palabra "Tributarios" en el nombre.
    
    let itemsVisibles = [];
    let captureChildren = false; // Bandera para saber si estamos capturando hijos de un padre encontrado
    let currentParentLevel = 0;

    datosHacendarios.forEach(item => {
        const match = item.concepto.toLowerCase().includes(filterText.toLowerCase());

        // Regla: Si es Nivel 4 y coincide con la búsqueda
        if (item.nivel === 4) {
            if (match) {
                itemsVisibles.push(item);
                captureChildren = true; // Activar captura de hijos
                currentParentLevel = 4;
            } else {
                captureChildren = false; // Si el padre no coincide, no capturamos hijos (a menos que el hijo coincida por sí solo)
                // Pero si NO hay filtro, mostramos todo
                if (filterText === '') itemsVisibles.push(item);
            }
        } 
        // Regla: Si es Nivel 5 (Hijo)
        else if (item.nivel === 5) {
            // Lo mostramos si: 
            // 1. Su padre fue encontrado (captureChildren)
            // 2. O el usuario buscó "ISR" directamente (match)
            // 3. O no hay filtro activo
            if (captureChildren || match || filterText === '') {
                itemsVisibles.push(item);
            }
        } 
        // Otros niveles (1, 2, 3)
        else {
            if (match || filterText === '') itemsVisibles.push(item);
            captureChildren = false; // Reset al salir del grupo
        }
    });

    // --- RENDERIZADO CON EXPANSION ---
    let lastLevel4Id = null; // Para saber a quién pertenecen los nivel 5

    itemsVisibles.forEach(item => {
        // Control de Estado del Padre
        if (item.nivel === 4) {
            lastLevel4Id = item.id;
        }

        // Determinar si debemos mostrar la fila
        let isVisible = true;
        let isExpanded = false;

        // Si es nivel 5, solo se ve si su padre (lastLevel4Id) está en expandedRows
        if (item.nivel === 5) {
            if (lastLevel4Id && !state.expandedRows.has(lastLevel4Id)) {
                isVisible = false;
            }
        }

        if (state.expandedRows.has(item.id)) isExpanded = true;

        if (isVisible) {
            const tr = document.createElement('tr');
            
            // Estilos dinámicos
            const padding = `${(item.nivel-1)*20}px`;
            const fontWeight = item.nivel <= 4 ? '700' : '400';
            const color = item.nivel === 1 ? 'var(--primary)' : 'var(--text)';
            
            // Construir celda de Concepto con Botón Toggle si es Nivel 4
            let conceptoHTML = '';
            if (item.nivel === 4) {
                const icon = isExpanded ? 'fa-minus-square' : 'fa-plus-square';
                const iconColor = isExpanded ? 'var(--gold)' : '#ccc';
                // Añadimos el evento onclick solo al icono y texto
                conceptoHTML = `
                    <div style="cursor:pointer; display:flex; align-items:center;" onclick="toggleRow(${item.id})">
                        <i class="fas ${icon}" style="margin-right:8px; color:${iconColor};"></i>
                        <span>${item.concepto}</span>
                    </div>`;
            } else {
                conceptoHTML = item.concepto;
            }

            // Inyectar HTML
            tr.innerHTML = `<td style="padding-left:${padding}; font-weight:${fontWeight}; color:${color}">${conceptoHTML}</td>`;
            
            years.forEach((y, index) => {
                const val = getValor(item, y, 'obs');
                tr.innerHTML += `<td>${formatMoney(val)}</td>`;
                if (item.nivel === 1) totalesColumna[index] += val; 
            });
            tbody.appendChild(tr);
        }
    });

    // Footer totales
    let footerHTML = '<td>TOTAL</td>';
    years.forEach((y, index) => {
        footerHTML += `<td>${formatMoney(totalesColumna[index])}</td>`;
    });
    tfoot.innerHTML = footerHTML;
}

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
        let texto = document.getElementById('dashboard-view').classList.contains('hidden') 
            ? "Histórico. " + document.getElementById('historico-view').innerText 
            : "Panorama. " + document.getElementById('dashboard-view').innerText;
        
        currentUtterance = new SpeechSynthesisUtterance(texto.replace(/\s+/g, ' ').substring(0,4000));
        currentUtterance.rate = 1;
        currentUtterance.onstart = () => { btnTTS.innerHTML = '<i class="fas fa-stop"></i>'; btnTTS.classList.add('speaking-active'); };
        currentUtterance.onend = resetBotonTTS;
        synth.speak(currentUtterance);
    });
    function resetBotonTTS() { btnTTS.innerHTML = '<i class="fas fa-volume-up"></i>'; btnTTS.classList.remove('speaking-active'); }
}

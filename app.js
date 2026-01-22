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
// 2. MAPA JERÁRQUICO (PADRES)
// ==========================================
const parentMap = {};
(function buildParentMap() {
    let stack = {};
    datosHacendarios.forEach(item => {
        stack[item.nivel] = item.id;
        for (let i = item.nivel + 1; i <= 6; i++) delete stack[i];
        parentMap[item.id] = stack[item.nivel - 1] ?? null;
    });
})();

// ==========================================
// 3. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (typeof datosHacendarios === 'undefined') {
        console.error("Error: data.js no se ha cargado.");
        return;
    }

    // Estado inicial (sin búsqueda)
    datosHacendarios.forEach(item => {
        if (item.nivel <= 3) state.expandedRows.add(item.id);
    });

    initFilters?.();
    initAccessibility?.();
    renderDashboard();
    renderTrendChart(state.activeChart);
    renderTable();

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', e => {
            renderTable(e.target.value.trim());
        });
    }

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.dataset.theme =
                document.body.dataset.theme === 'dark' ? '' : 'dark';
        });
    }
});

// ==========================================
// 4. UTILIDADES
// ==========================================
function toggleRow(id) {
    if (state.expandedRows.has(id)) state.expandedRows.delete(id);
    else state.expandedRows.add(id);
    renderTable(document.getElementById('searchInput').value.trim());
}

function getValor(item, year, tipo = 'obs') {
    if (!item || !item.datos[year]) return 0;
    let val = item.datos[year][tipo] ?? item.datos[year].obs ?? 0;
    if (state.mode === 'real') {
        const dA = datosDeflactores[year] || 100;
        const dB = datosDeflactores[state.baseYear] || 100;
        val *= (dB / dA);
    }
    return val;
}

function formatMoney(v) {
    return '$' + (v / 1_000_000).toLocaleString('es-MX', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    }) + ' M';
}

// ==========================================
// 5. TABLA HISTÓRICA — LÓGICA CORRECTA
// ==========================================
function renderTable(filterText = '') {
    const thead = document.getElementById('table-header');
    const tbody = document.getElementById('table-body');
    const tfoot = document.getElementById('table-footer');
    if (!thead || !tbody) return;

    // Encabezados
    let headers = '<th>Concepto</th>';
    const years = [];
    for (let y = state.startYear; y <= state.endYear; y++) {
        years.push(y);
        headers += `<th>${y}</th>`;
    }
    thead.innerHTML = headers;
    tbody.innerHTML = '';
    if (tfoot) tfoot.innerHTML = '';

    const term = filterText.toLowerCase();
    let visibleIds = new Set();

    // ======================================
    // A. SIN BÚSQUEDA (NO SE TOCA)
    // ======================================
    if (!filterText) {
        let parentIds = {};
        datosHacendarios.forEach(item => {
            parentIds[item.nivel] = item.id;
            for (let i = item.nivel + 1; i <= 6; i++) delete parentIds[i];

            let show = false;
            if (item.nivel === 1) show = true;
            else {
                const pid = parentIds[item.nivel - 1];
                if (pid && state.expandedRows.has(pid)) show = true;
            }
            if (show) visibleIds.add(item.id);
        });
    }

    // ======================================
    // B. CON BÚSQUEDA (LÓGICA JERÁRQUICA)
    // ======================================
    else {
        state.expandedRows.clear(); // todo cerrado

        const matches = datosHacendarios.filter(d =>
            d.concepto.toLowerCase().includes(term)
        );

        matches.forEach(m => {
            let current = m;
            let parent = parentMap[current.id];

            while (parent !== null) {
                const pItem = datosHacendarios.find(d => d.id === parent);
                if (!pItem.concepto.toLowerCase().includes(term)) {
                    visibleIds.add(parent);
                    return;
                }
                current = pItem;
                parent = parentMap[current.id];
            }
            visibleIds.add(current.id);
        });
    }

    // ======================================
    // C. RENDER
    // ======================================
    datosHacendarios.forEach(item => {
        if (!visibleIds.has(item.id)) return;

        const hasChildren = datosHacendarios.some(d => parentMap[d.id] === item.id);
        const isOpen = state.expandedRows.has(item.id);

        let row = `<tr>
            <td style="padding-left:${(item.nivel - 1) * 20}px; font-weight:${item.nivel <= 3 ? 700 : 400}">
                ${hasChildren ? `<span class="indent-icon" onclick="toggleRow(${item.id})">${isOpen ? '▾' : '▸'}</span>` : '<span class="indent-icon"></span>'}
                ${item.concepto}
            </td>`;

        years.forEach(y => {
            row += `<td>${formatMoney(getValor(item, y))}</td>`;
        });

        row += '</tr>';
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

// ==========================================
// 6. DASHBOARD + GRÁFICA (SIN CAMBIOS)
// ==========================================
function renderDashboard() { /* TU CÓDIGO ORIGINAL SIN CAMBIOS */ }
function renderTrendChart() { /* TU CÓDIGO ORIGINAL SIN CAMBIOS */ }

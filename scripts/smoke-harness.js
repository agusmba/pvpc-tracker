/* ── Harness de smoke (solo desarrollo) ────────────────────────────────────
   Se inyecta en una COPIA temporal del HTML de la SPA; nunca viaja a Pages.
   Las aserciones se computan dentro de la página (geometría real del navegador)
   y se publican como texto en el elemento __smoke para que el runner las lea.
   Cada línea es "PASS nombre — detalle" / "FAIL nombre — detalle" / "SKIP nombre".
   Los esperados salen del contrato de la UI, no de recalcular lo que hace el código.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
    const resultados = [];
    const registrar = (nombre, ok, detalle) =>
        resultados.push(`${ok ? 'PASS' : 'FAIL'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
    const esperar = (ms) => new Promise(r => setTimeout(r, ms));

    // Ancho interior real de una tarjeta: clientWidth incluye el padding, no el borde.
    function anchoInterior(el) {
        const cs = getComputedStyle(el);
        return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    }

    function precioDelPunto(circle) {
        const m = (circle.querySelector('title')?.textContent || '').match(/- ([\d.]+) €/);
        return m ? parseFloat(m[1]) : null;
    }

    async function run() {
        await esperar(400); // init() es async: carga desde el registro local sembrado

        const estrecho = window.innerWidth < 700;
        const etiqueta = estrecho ? 'viewport estrecho' : 'desktop';

        // ── Invariante: escala 1:1 de los ejes ───────────────────────────
        // El SVG se dibuja con viewBox y ancho reales del interior de la tarjeta.
        // Medir el contenedor raíz (o un viewBox fijo) encoge o escala los ejes.
        // Tolerancia: en un navegador de escritorio estrecho la barra de scroll
        // clásica encoge el layout ~15px sin disparar resize (en headless ni
        // siquiera se dispara), así que se admite hasta un 6% de desajuste. El bug
        // que cazaba esto medía el contenedor raíz: un desajuste de más del 100%.
        const svg = document.querySelector('#chartContainer svg');
        if (!svg) {
            registrar(`ejes de la gráfica (${etiqueta})`, false, 'no hay gráfica renderizada');
        } else {
            const viewBoxAncho = parseFloat(svg.getAttribute('viewBox').split(/\s+/)[2]);
            const anchoRender = svg.getBoundingClientRect().width;
            const escala = anchoRender / viewBoxAncho;
            registrar(`escala 1:1 de los ejes (${etiqueta})`,
                escala >= 0.94 && escala <= 1.06,
                `viewBox ${viewBoxAncho.toFixed(1)} vs render ${anchoRender.toFixed(1)}px (escala ${escala.toFixed(2)})`);

            const interior = anchoInterior(document.getElementById('chartWrapper'));
            registrar(`la gráfica cabe en su tarjeta (${etiqueta})`,
                Math.abs(anchoRender - interior) <= 4,
                `render ${anchoRender.toFixed(1)}px vs interior de la tarjeta ${interior.toFixed(1)}px`);
        }

        // ── Invariante: colores distintos por franja de precio ───────────
        // Las tres franjas (barata / media / cara) no pueden compartir color: el
        // mismatch de vocablos dejaba dos franjas idénticas en la gráfica.
        const puntos = Array.from(document.querySelectorAll('#chartContainer svg circle'));
        const porPrecio = puntos
            .map(c => ({ precio: precioDelPunto(c), color: c.getAttribute('fill') }))
            .filter(p => p.precio !== null && p.color)
            .sort((a, b) => a.precio - b.precio);
        if (porPrecio.length < 3) {
            registrar(`colores por franja (${etiqueta})`, false, `${porPrecio.length} puntos con color`);
        } else {
            const barata = porPrecio[0].color;
            const media = porPrecio[Math.floor(porPrecio.length / 2)].color;
            const cara = porPrecio[porPrecio.length - 1].color;
            registrar(`colores por franja (${etiqueta})`,
                new Set([barata, media, cara]).size === 3,
                `barata ${barata}, media ${media}, cara ${cara}`);
        }

        // ── Invariante: la rejilla no salta al cambiar de día ────────────
        // En día no-hoy la celda 'Ahora' sigue ocupando su sitio (placeholder
        // invisible); si se retira, las demás tarjetas se recolocan.
        // Las celdas se identifican por su etiqueta, no por posición: retirar una
        // celda renumera los hijos y una comparación por nth-child pasaría vacía.
        const hoy = document.getElementById('summaryContainer');
        const celda = (cont, etiqueta) =>
            Array.from(cont.querySelectorAll('.summary-card')).find(c => c.textContent.includes(etiqueta));
        const mediaHoy = celda(hoy, 'Media del día').getBoundingClientRect();
        const tarjetasHoy = hoy.querySelectorAll('.summary-card').length;

        const tabNoHoy = document.querySelector('#dayTabs .tab:nth-child(3)'); // tercer día = ayer
        if (!tabNoHoy) {
            registrar('placeholder de la celda Ahora', false, 'no hay pestaña de día no-hoy');
        } else {
            tabNoHoy.click();
            await esperar(400);
            const placeholder = hoy.querySelector('.card-now.placeholder');
            registrar('placeholder de la celda Ahora',
                !!placeholder && placeholder.getBoundingClientRect().width > 0 &&
                placeholder.getBoundingClientRect().height > 0,
                placeholder ? `caja ${placeholder.getBoundingClientRect().width.toFixed(1)}x${placeholder.getBoundingClientRect().height.toFixed(1)}` : 'ausente');
            const mediaPasado = celda(hoy, 'Media del día').getBoundingClientRect();
            registrar('la rejilla no salta al cambiar de día',
                Math.abs(mediaHoy.top - mediaPasado.top) <= 2 && Math.abs(mediaHoy.left - mediaPasado.left) <= 2,
                `Media del día en (${mediaHoy.left.toFixed(1)}, ${mediaHoy.top.toFixed(1)}) hoy vs (${mediaPasado.left.toFixed(1)}, ${mediaPasado.top.toFixed(1)}) pasado`);
            registrar('el resumen mantiene las cuatro celdas',
                hoy.querySelectorAll('.summary-card').length === tarjetasHoy,
                `${tarjetasHoy} celdas (hoy) vs ${hoy.querySelectorAll('.summary-card').length} (pasado)`);
        }

        // ── Invariante: el selector de días es desplazable ───────────────
        const dayTabs = document.getElementById('dayTabs');
        const barra = getComputedStyle(dayTabs).scrollbarWidth;
        if (estrecho) {
            // Desplazable de verdad: el contenedor tiene contenido fuera del ancho y
            // el scroll efectivamente se mueve (scrollWidth > clientWidth por sí solo
            // también se da en un contenedor con overflow visible, que no scrollea).
            dayTabs.scrollLeft = dayTabs.scrollWidth;
            await esperar(80);
            registrar('selector de días desplazable (estrecho)',
                dayTabs.scrollWidth > dayTabs.clientWidth && dayTabs.scrollLeft > 0,
                `scrollWidth ${dayTabs.scrollWidth} vs clientWidth ${dayTabs.clientWidth}, scrollLeft ${dayTabs.scrollLeft}`);
            const ultima = dayTabs.lastElementChild;
            const centro = ultima.getBoundingClientRect();
            const bajo = document.elementFromPoint(centro.left + centro.width / 2, centro.top + centro.height / 2);
            registrar('la última pestaña es alcanzable tras deslizar (estrecho)',
                !!bajo && bajo.closest('.tab') === ultima,
                bajo ? `elemento bajo la pestaña: ${bajo.className || bajo.tagName}` : 'nada bajo la pestaña');
        } else {
            // En escritorio con ratón la barra debe ser visible (affordance para deslizar).
            // El navegador headless no reporta ratón: se omite en vez de fallar, y la
            // emulación CDP (Playwright) es la alternativa documentada en el ADR.
            const conRaton = matchMedia('(hover: hover)').matches && matchMedia('(pointer: fine)').matches;
            if (!conRaton) {
                resultados.push(`SKIP barra de scroll visible en escritorio — el navegador headless no reporta ratón (falta emulación de dispositivo puntero)`);
            } else {
                registrar('barra de scroll visible en escritorio',
                    barra === 'thin' || barra === 'auto',
                    `scrollbar-width: ${barra}`);
            }
        }

        // ── Invariante: un resize que no cambia el ancho no redibuja ──────
        // En móvil la barra de URL dispara `resize` durante el scroll; redibujar
        // ahí mueve el scroll de sitio. El primer resize registra el ancho (no hay
        // ancho previo que comparar), así que se dispara uno antes de poner el
        // centinela: el segundo, con el mismo ancho, no debe redibujar.
        const svgInicial = document.querySelector('#chartContainer svg');
        if (svgInicial) {
            window.dispatchEvent(new Event('resize'));
            await esperar(600); // más que el debounce del handler (250ms)
            const centinela = document.querySelector('#chartContainer svg');
            if (centinela) centinela.dataset.centinela = 'smoke';
            window.dispatchEvent(new Event('resize'));
            await esperar(600);
            const despues = document.querySelector('#chartContainer svg');
            registrar('un resize sin cambio de ancho no redibuja la gráfica',
                !!despues && despues.dataset.centinela === 'smoke',
                despues ? `centinela ${despues.dataset.centinela || 'perdido'}` : 'la gráfica desapareció');
        }
    }

    run()
        .catch(e => registrar('harness', false, String(e && e.message ? e.message : e)))
        .finally(() => {
            const pre = document.createElement('pre');
            pre.id = '__smoke';
            pre.textContent = resultados.join('\n');
            document.body.appendChild(pre);
        });
})();

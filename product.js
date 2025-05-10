// Este es el archivo producto.js
console.log("¡producto.js ha sido cargado y está listo para funcionar!");

document.addEventListener('DOMContentLoaded', async function() { // Convertida a async para poder usar await al cargar el JSON
    console.log("DOMContentLoaded evento disparado. Iniciando la carga de detalles del producto.");

    const productContentDiv = document.getElementById('product-content');
    const langSelect = document.getElementById('lang-select');
    
    // ---- REEMPLAZA ESTE NÚMERO CON TU NÚMERO DE WHATSAPP ----
    // Debe incluir el código de país, sin el signo '+', espacios, o ceros iniciales innecesarios.
    // Ejemplo para Paraguay: 595991414172
    const miNumeroWhatsapp = "595991414172"; 
    // -------------------------------------------------------------

    let catalogoCompleto = null; // Variable para almacenar los datos cargados del JSON

    // Función para cargar los datos del catálogo desde el archivo JSON
    async function cargarCatalogo() {
        if (catalogoCompleto) { // Si ya se cargó una vez, devuelve los datos almacenados
            console.log("Catálogo ya estaba cargado, usando datos almacenados.");
            return catalogoCompleto;
        }
        try {
            console.log("Intentando cargar catalogo_data.json...");
            const response = await fetch('catalogo_data.json'); 
            if (!response.ok) { // Verifica si la respuesta de la red fue exitosa
                throw new Error(`Error HTTP! estado: ${response.status} - ${response.statusText}`);
            }
            catalogoCompleto = await response.json();
            console.log("Datos del catálogo cargados exitosamente:", catalogoCompleto);
            return catalogoCompleto;
        } catch (error) {
            console.error("No se pudo cargar el catálogo de productos:", error);
            if (productContentDiv) {
                productContentDiv.innerHTML = "<p class='product-description'>Error al cargar la información de productos. Por favor, intente más tarde o contacte al administrador.</p>";
            }
            return null; // Devuelve null si hay un error para que otras funciones lo manejen
        }
    }

    // Función para generar y mostrar el contenido del producto en la página
    function generarContenidoProducto(tipo, idParam, idioma = 'es') {
        console.log(`generarContenidoProducto llamado con: tipo='${tipo}', idParam='${idParam}', idioma='${idioma}'`);

        if (!catalogoCompleto) {
            console.error("El catálogo no está cargado todavía. No se puede generar contenido del producto.");
            if (productContentDiv) {
                // Podrías poner un mensaje de "cargando..." si el catálogo aún no está listo
                productContentDiv.innerHTML = "<p class='product-description'>Cargando datos del producto...</p>";
            }
            return;
        }
        if (!productContentDiv) {
            console.error("Elemento #product-content no encontrado en el DOM. No se puede mostrar el producto.");
            return;
        }

        let itemData;
        // El ID de la URL es un string, lo convertimos a número para usarlo como índice del array
        const id = parseInt(idParam, 10); 

        if (catalogoCompleto[tipo] && 
            catalogoCompleto[tipo][idioma] && 
            catalogoCompleto[tipo][idioma][id] !== undefined) {
            itemData = catalogoCompleto[tipo][idioma][id];
        } else if (catalogoCompleto[tipo] && 
                   catalogoCompleto[tipo]['es'] && // Fallback al español si el idioma actual no tiene el item
                   catalogoCompleto[tipo]['es'][id] !== undefined) {
            itemData = catalogoCompleto[tipo]['es'][id]; 
            console.warn(`Contenido para idioma '${idioma}' no encontrado para el producto tipo '${tipo}' con ID '${id}'. Mostrando en español.`);
        } else {
            console.error(`No se encontraron datos para el producto tipo '${tipo}' con ID '${id}' en idioma '${idioma}' (ni en español como fallback).`);
            productContentDiv.innerHTML = `<p class="product-description">Lo sentimos, la información para este producto no está disponible actualmente. (Debug: tipo=${tipo}, id=${id}, idioma=${idioma})</p>`;
            return;
        }

        if (!itemData) { // Doble chequeo por si acaso
            console.error("itemData es undefined después de los chequeos. Algo inesperado ocurrió.");
            productContentDiv.innerHTML = `<p class="product-description">Error interno al procesar los datos del producto.</p>`;
            return;
        }

        // Construir el HTML para el producto
        let html = '';
        if (itemData.imagenUrl) {
            html += `<div class="product-image-container">`;
            html += `<img src="${itemData.imagenUrl}" alt="Imagen de ${itemData.nombre}" class="product-image">`;
            html += `</div>`;
        }

        html += `<h1 class="product-title">${itemData.nombre}</h1>`;
        if (itemData.descripcion) {
            html += `<p class="product-description">${itemData.descripcion}</p>`;
        }
        
        if (itemData.caracteristicas && itemData.caracteristicas.length > 0) {
            html += `<div class="product-features">`;
            html += `<h3>Características Destacadas:</h3>`;
            html += `<ul>`;
            itemData.caracteristicas.forEach(function(caracteristica) {
                html += `<li>${caracteristica}</li>`;
            });
            html += `</ul>`;
            html += `</div>`;
        }

        if (itemData.precio) {
            html += `<div class="product-price">`;
            html += `<p><strong>${itemData.precio}</strong></p>`; // Muestra el precio tal cual del JSON
            html += `</div>`;
        }

        // Generar el enlace de WhatsApp
        const mensajeWhatsappBase = `Hola, quiero adquirir "${itemData.nombre}". Me gustaría agendar una cita para la instalación.`;
        const mensajeWhatsappUrl = encodeURIComponent(mensajeWhatsappBase); // Codifica el mensaje para la URL
        const enlaceWhatsapp = `https://wa.me/${miNumeroWhatsapp}?text=${mensajeWhatsappUrl}`;

        html += `<div style="text-align: center; margin-top: 2rem;">`; // Contenedor para centrar el botón
        html += `<a href="${enlaceWhatsapp}" class="whatsapp-product-button" target="_blank">`;
        // Icono de WhatsApp (SVG incrustado para no depender de enlaces externos que pueden romperse)
        html += `<svg viewBox="0 0 896 896" style="width: 20px; height: 20px; vertical-align: middle; margin-right: 8px; fill: white;" xmlns="http://www.w3.org/2000/svg"><path d="M779.9 136.5q-83.2-83.2-197.9-83.2-116.1 0-200.2 84.2-83.2 83.2-84.2 198.6v3.3q0 40.2 10.6 79.1l-10.6 10.6-32.6 126.2 129.5-33.9q19.8 8.3 40.2 12.6h4.7q37.6 8.3 74.4 8.3h1.6q114.8 0 198.6-84.2t83.2-197.9q0-116.1-83.2-200.2z m-199.3 547.9h-1.6q-32.6 0-63.9-8.3h-3.3q-16.6-5.3-33.9-11.9L351.5 731.9l-65.2 16.6L271 682.9q-26.5-40.2-26.5-86.5v-3.3q0-98.2 69.6-167.8t167.8-69.6q96.9 0 167.8 69.6t69.6 167.8q1.6 98.2-69.6 167.8z m132.8-216.1q-8.3-16.6-29.8-26.5l-16.6-8.3q-16.6-6.6-24.9-5.3-16.6 1.6-24.9 16.6-6.6 13.3-23.2 31.5-16.6 16.6-31.5 19.9-23.2 5.3-43.5-3.3-55.9-21.6-104.8-73.7t-73.7-103.5q-3.3-13.3 5.3-24.9t19.9-23.2q5.3-5.3 11.9-13.3 13.3-13.3 16.6-26.5 1.6-16.6-5.3-24.9l-8.3-16.6q-10.6-21.6-26.5-29.8-16.6-8.3-35.2-8.3h-24.9q-16.6 0-39.2 16.6-16.6 13.3-26.5 33.9-16.6 31.5-16.6 71.1 0 37.6 16.6 72.4 26.5 55.9 76.4 106.1t107.4 76.4q33.9 16.6 71.1 16.6 40.2 0 69.6-21.6 21.6-16.6 32.6-26.5t16.6-39.2v-23.2q0-19.9-8.3-36.5z"></path></svg>`;
        html += `Contactar por WhatsApp para Adquirir`;
        html += `</a>`;
        html += `</div>`;
        
        productContentDiv.innerHTML = html;
        console.log("Contenido del producto renderizado en productContentDiv.");
    }

    // Función principal para inicializar la página de detalle
    async function inicializarPaginaDetalle() {
        console.log("Inicializando página de detalle...");
        // Intenta cargar el catálogo primero
        const datosCargados = await cargarCatalogo();
        
        if (!datosCargados) { // Si el catálogo no se pudo cargar, no hacer nada más.
            console.error("No se continuará con la inicialización porque el catálogo no se cargó.");
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const tipoProducto = urlParams.get('tipo'); 
        const idProductoRaw = urlParams.get('id');
        
        console.log(`Parámetros de URL leídos: tipo='${tipoProducto}', id (raw)='${idProductoRaw}'`);

        let idiomaActual = langSelect ? langSelect.value : 'es';
        console.log("Idioma actual inicial detectado:", idiomaActual);

        if (tipoProducto && (tipoProducto === 'servicio' || tipoProducto === 'licencia') && idProductoRaw !== null && !isNaN(parseInt(idProductoRaw, 10))) {
            const idProducto = parseInt(idProductoRaw, 10);
            console.log("Parámetros válidos. Llamando a generarContenidoProducto desde la carga inicial.");
            generarContenidoProducto(tipoProducto, idProducto, idiomaActual);
        } else {
            console.error("Condición para carga inicial NO cumplida. Tipo o ID no válidos o faltantes. Tipo:", tipoProducto, "ID(raw):", idProductoRaw);
            if (productContentDiv) {
                productContentDiv.innerHTML = `<p class="product-description">No se ha especificado un producto para mostrar o los parámetros son incorrectos. Por favor, selecciona un producto o servicio desde la página principal.</p>`;
            }
        }

        // Configurar el listener para el cambio de idioma
        if (langSelect) {
            langSelect.addEventListener('change', function() {
                idiomaActual = this.value;
                console.log('Selector de idioma cambiado. Nuevo idioma:', idiomaActual);
                // Volver a cargar el contenido con el nuevo idioma si los parámetros son válidos
                 if (tipoProducto && (tipoProducto === 'servicio' || tipoProducto === 'licencia') && idProductoRaw !== null && !isNaN(parseInt(idProductoRaw, 10))) {
                    const idProducto = parseInt(idProductoRaw, 10);
                    generarContenidoProducto(tipoProducto, idProducto, idiomaActual);
                }
            });
        } else {
            console.warn("Elemento langSelect no encontrado. El cambio de idioma no funcionará.");
        }
    }

    inicializarPaginaDetalle(); // Llama a la función principal para iniciar el proceso
});
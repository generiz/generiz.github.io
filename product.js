// Este es el archivo producto.js
console.log("¡producto.js ha sido cargado y está listo para funcionar!");

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOMContentLoaded evento disparado.");

    const productContentDiv = document.getElementById('product-content');
    const langSelect = document.getElementById('lang-select');

    console.log("productContentDiv:", productContentDiv);
    console.log("langSelect:", langSelect);

    const datos = {
        servicio: { 
            es: [
                { 
                    nombre: "Helpdesk y Soporte Remoto Profesional", 
                    descripcion: "Solucionamos tus incidencias informáticas con rapidez y eficacia. Nuestro equipo de expertos te ofrece asistencia remota para diagnósticos, reparación de software, configuración de sistemas y mucho más, minimizando el tiempo de inactividad.", 
                    caracteristicas: ["Diagnóstico y resolución de problemas de software/hardware.", "Configuración de periféricos (impresoras, scanners, etc.).", "Asistencia en aplicaciones ofimáticas y de productividad.", "Soporte para sistemas operativos Windows y macOS.", "Conexión remota segura y confiable."],
                    precio: "Planes flexibles o por hora. ¡Consultanos!",
                    imagenUrl: "https://placehold.co/600x400/7F8C8D/FFFFFF?text=Soporte+Remoto&font=roboto"
                },
                { 
                    nombre: "Reparación Avanzada de Placas Electrónicas", 
                    descripcion: "Servicio técnico especializado en la reparación a nivel componente de placas madre de portátiles, tarjetas gráficas, consolas y otros dispositivos electrónicos. Contamos con laboratorio propio y técnicos con alta experiencia en microsoldadura.", 
                    caracteristicas: ["Diagnóstico preciso de fallas en placa.", "Reparación de cortos, fallas de alimentación, problemas de video.", "Reballing y reemplazo de chips (CPU, GPU, PCH).", "Uso de componentes de alta calidad.", "Presupuestos sin compromiso."],
                    precio: "Evaluación requerida. Desde $[PRECIO_BASE_REPARACION]",
                    imagenUrl: "https://placehold.co/600x400/2ECC71/FFFFFF?text=Placas+Electrónicas&font=roboto"
                },
                { 
                    nombre: "Diseño e Instalación de Redes y Cableado Estructurado", 
                    descripcion: "Implementamos soluciones de conectividad robustas y escalables para tu hogar u oficina. Desde el diseño inicial hasta la certificación final, garantizamos una red eficiente y optimizada para tus necesidades.", 
                    caracteristicas: ["Planificación y diseño de infraestructura de red.", "Instalación de cableado UTP/FTP Cat 6, 6A, 7.", "Montaje y configuración de racks, switches y routers.", "Instalación y optimización de redes Wi-Fi.", "Certificación de puntos de red."],
                    precio: "Proyectos a medida. Solicita tu cotización.",
                    imagenUrl: "https://placehold.co/600x400/3498DB/FFFFFF?text=Redes+y+Cableado&font=roboto"
                },
                {
                    nombre: "Desarrollo Web Moderno y Aplicaciones a Medida",
                    descripcion: "Transformamos tus ideas en soluciones digitales impactantes. Creamos sitios web corporativos, tiendas online, landing pages y aplicaciones web personalizadas, enfocados en la experiencia de usuario y resultados.",
                    caracteristicas: ["Diseño web responsivo y atractivo (UI/UX).", "Desarrollo frontend y backend con tecnologías actuales.", "Integración con pasarelas de pago y APIs.", "Optimización para motores de búsqueda (SEO).", "Mantenimiento y soporte evolutivo."],
                    precio: "Desde $[PRECIO_BASE_WEB]. ¡Contanos tu proyecto!",
                    imagenUrl: "https://placehold.co/600x400/9B59B6/FFFFFF?text=Desarrollo+Web&font=roboto"
                },
                {
                    nombre: "Gestión Integral de Correos Empresariales",
                    descripcion: "Optimiza la comunicación de tu empresa con nuestros servicios de configuración, migración y administración de correo electrónico profesional (Google Workspace, Microsoft 365). Seguridad, fiabilidad y soporte continuo.",
                    caracteristicas: ["Configuración de dominios y cuentas de correo.", "Migración de datos desde otros proveedores.", "Políticas de seguridad y filtros anti-spam/phishing.", "Soporte técnico para administradores y usuarios.", "Integración con calendario y herramientas colaborativas."],
                    precio: "Planes mensuales por usuario. ¡Consultanos!",
                    imagenUrl: "https://placehold.co/600x400/F1C40F/000000?text=Correo+Empresarial&font=roboto"
                },
                {
                    nombre: "Automatización de Procesos y Desarrollo de APIs",
                    descripcion: "Mejora la eficiencia de tu negocio automatizando tareas repetitivas e integrando tus sistemas. Desarrollamos scripts, bots y APIs personalizadas para optimizar tus flujos de trabajo y conectar tus aplicaciones.",
                    caracteristicas: ["Análisis y consultoría de procesos automatizables.", "Desarrollo de scripts en Python, Node.js, etc.", "Creación y consumo de APIs REST/GraphQL.", "Integración de aplicaciones SaaS y plataformas de terceros.", "Ahorro de tiempo y reducción de errores."],
                    precio: "Proyectos personalizados. ¡Exploramos tus necesidades!",
                    imagenUrl: "https://placehold.co/600x400/E74C3C/FFFFFF?text=Automatización+APIs&font=roboto"
                }
            ],
            en: [ /* Recuerda añadir traducciones aquí si las necesitas */
                { nombre: "Professional Remote Helpdesk & Support", descripcion: "We solve your IT issues quickly and effectively...", caracteristicas: ["Diagnosis and resolution...", "Peripheral setup...", "Support for Windows and macOS systems."], precio: "Flexible plans or per hour. Contact us!", imagenUrl: "https://placehold.co/600x400/7F8C8D/FFFFFF?text=Remote+Support&font=roboto" },
                { nombre: "Advanced Electronic Board Repair", descripcion: "Specialized technical service for component-level repair...", caracteristicas: ["Accurate fault diagnosis...", "Reballing and chip replacement..."], precio: "Evaluation required. From $[BASE_REPAIR_PRICE]", imagenUrl: "https://placehold.co/600x400/2ECC71/FFFFFF?text=Electronic+Boards&font=roboto" },
                // ... Más servicios en inglés
            ]
        },
        licencia: { 
            es: [
                { 
                    nombre: "Microsoft Office Profesional Plus 2019", 
                    descripcion: "La suite ofimática esencial para la productividad empresarial y personal. Incluye versiones completas de Word, Excel, PowerPoint, Outlook, Publisher y Access. Licencia perpetua para un único PC.", 
                    caracteristicas: ["Word: creación y edición de documentos profesionales.", "Excel: análisis de datos y hojas de cálculo avanzadas.", "PowerPoint: presentaciones impactantes.", "Outlook: gestión de correo, calendario y contactos.", "Publisher y Access: para publicaciones y bases de datos.", "Activación única, sin suscripciones."],
                    precio: "Precio especial: $[PRECIO_OFFICE_2019_DETALLE]",
                    imagenUrl: "https://placehold.co/600x400/0078D4/FFFFFF?text=Office+2019+Pro&font=oswald"
                },
                { 
                    nombre: "Microsoft Office Profesional Plus 2024", 
                    descripcion: "Descubre la potencia de la última generación de Office. Con herramientas mejoradas por IA, funciones de colaboración avanzadas y una interfaz moderna para impulsar tu eficiencia al máximo. Licencia perpetua.", 
                    caracteristicas: ["Todas las aplicaciones de Office 2019 Pro Plus, actualizadas.", "Nuevas capacidades de Inteligencia Artificial.", "Colaboración en tiempo real mejorada.", "Seguridad y rendimiento optimizados.", "Compatible con las últimas versiones de Windows."],
                    precio: "Oferta de lanzamiento: $[PRECIO_OFFICE_2024_DETALLE]",
                    imagenUrl: "https://placehold.co/600x400/0078D4/FFFFFF?text=Office+2024+Pro&font=oswald"
                },
                // ... (completar los demás productos con descripciones mejoradas e imagenUrl)
                { 
                    nombre: "Office Standard 2024", 
                    descripcion: "Las herramientas fundamentales de Office para usuarios que necesitan lo esencial: Word, Excel, PowerPoint y Outlook. Productividad garantizada con esta licencia perpetua.", 
                    caracteristicas: ["Word, Excel, PowerPoint, Outlook.", "Interfaz intuitiva y funciones clave.", "Ideal para estudiantes y pequeñas empresas.", "Un solo pago, uso ilimitado."],
                    precio: "Precio: $[PRECIO_OFFICE_STD_2024_DETALLE]",
                    imagenUrl: "https://placehold.co/600x400/0078D4/FFFFFF?text=Office+Std+2024&font=oswald"
                },
                {
                    nombre: "McAfee Internet Security - 1 Año",
                    descripcion: "Protección integral y confiable contra virus, malware, ransomware y amenazas online. Navega, compra y realiza transacciones bancarias de forma segura durante un año.",
                    caracteristicas: ["Antivirus premiado.", "Protección web y anti-phishing.", "Firewall inteligente.", "Optimización de rendimiento del PC.", "Soporte para 1 dispositivo."],
                    precio: "Precio: $[PRECIO_MCAFEE_DETALLE]",
                    imagenUrl: "https://placehold.co/600x400/C1272D/FFFFFF?text=McAfee+IS&font=oswald"
                },
                {
                    nombre: "Kaspersky Internet Security (Última Versión) - 1 Dispositivo, 1 Año",
                    descripcion: "Defensa multicapa contra todo tipo de ciberamenazas. Protege tu privacidad, identidad y datos con una de las soluciones de seguridad más robustas del mercado.",
                    caracteristicas: ["Antivirus en tiempo real.", "Protección de pagos online.", "VPN Segura (limitada).", "Bloqueo de software espía y rastreadores.", "Fácil de usar e instalar."],
                    precio: "Precio: $[PRECIO_KASPERSKY_DETALLE]",
                    imagenUrl: "https://placehold.co/600x400/00AEEF/FFFFFF?text=Kaspersky+IS&font=oswald"
                },
                {
                    nombre: "Windows 11 Profesional OEM/Retail",
                    descripcion: "Experimenta el futuro de Windows con un diseño elegante, funciones de productividad innovadoras y seguridad de nivel empresarial. Ideal para profesionales y empresas que buscan lo último en rendimiento.",
                    caracteristicas: ["Interfaz de usuario rediseñada y widgets.", "Snap Layouts y Snap Groups para multitarea.", "Seguridad mejorada con TPM 2.0 y arranque seguro.", "Windows Autopilot y Azure AD Join (para empresas).", "Soporte para aplicaciones Android (próximamente)."],
                    precio: "Precio: $[PRECIO_W11_PRO_DETALLE]",
                    imagenUrl: "https://placehold.co/600x400/0067C6/FFFFFF?text=Windows+11+Pro&font=oswald"
                },
                {
                    nombre: "Windows 11 Home OEM/Retail",
                    descripcion: "La puerta de entrada al nuevo Windows, perfecto para el hogar, estudiantes y uso diario. Disfruta de una experiencia visual renovada, mayor velocidad y herramientas para conectar y crear.",
                    caracteristicas: ["Diseño moderno y centrado.", "Integración nativa con Microsoft Teams.", "Microsoft Store rediseñada con más aplicaciones.", "Modo juego optimizado.", "Seguridad esencial de Windows."],
                    precio: "Precio: $[PRECIO_W11_HOME_DETALLE]",
                    imagenUrl: "https://placehold.co/600x400/0067C6/FFFFFF?text=Windows+11+Home&font=oswald"
                },
                // ... (Seguir con los demás Windows y Windows Server)
                { 
                    nombre: "Windows 10 Profesional OEM/Retail", 
                    descripcion: "El sistema operativo probado y confiable para profesionales y empresas que necesitan potencia, seguridad y flexibilidad. Amplia compatibilidad de hardware y software.",
                    caracteristicas: ["Estabilidad y rendimiento sólidos.", "Funciones de escritorio remoto.", "BitLocker para cifrado de disco.", "Unión a dominio y gestión de políticas de grupo."],
                    precio: "Precio: $[PRECIO_W10_PRO_DETALLE]",
                    imagenUrl: "https://placehold.co/600x400/0067C6/FFFFFF?text=Windows+10+Pro&font=oswald"
                },
                { 
                    nombre: "Windows 10 Home OEM/Retail", 
                    descripcion: "Ideal para el uso diario en el hogar, Windows 10 Home ofrece una experiencia familiar y productiva con todas las características esenciales que necesitas.",
                    caracteristicas: ["Asistente Cortana.", "Navegador Microsoft Edge.", "Windows Hello para inicio de sesión seguro.", "Continuas actualizaciones de seguridad."],
                    precio: "Precio: $[PRECIO_W10_HOME_DETALLE]",
                    imagenUrl: "https://placehold.co/600x400/0067C6/FFFFFF?text=Windows+10+Home&font=oswald"
                },
                { 
                    nombre: "Windows Server 2025 (Licencia Perpetua)", 
                    descripcion: "La vanguardia en sistemas operativos para servidores. Windows Server 2025 ofrece innovaciones en seguridad, infraestructura hiperconvergente y capacidades híbridas con Azure.",
                    caracteristicas: ["Seguridad avanzada y protección contra amenazas.", "Plataforma para aplicaciones nativas de la nube y tradicionales.", "Mejoras en almacenamiento y redes.", "Gestión simplificada."],
                    precio: "Consultar cotización personalizada",
                    imagenUrl: "https://placehold.co/600x400/00188F/FFFFFF?text=Windows+Server+2025&font=oswald"
                },
                { 
                    nombre: "Windows Server 2022 (Licencia Perpetua)", 
                    descripcion: "Una plataforma robusta y segura para construir y ejecutar tus aplicaciones y servicios críticos. Windows Server 2022 introduce seguridad multicapa avanzada y una mayor integración con Azure.",
                    caracteristicas: ["Secured-core server.", "Conectividad híbrida con Azure Arc.", "Mejoras en contenedores de Windows.", "Administración moderna con Windows Admin Center."],
                    precio: "Consultar cotización personalizada",
                    imagenUrl: "https://placehold.co/600x400/00188F/FFFFFF?text=Windows+Server+2022&font=oswald"
                }
            ],
            en: [ /* Recuerda añadir traducciones aquí si las necesitas */
                { nombre: "Microsoft Office Professional Plus 2019", descripcion: "The essential office suite for business and personal productivity...", caracteristicas: ["Word: professional document creation...", "Excel: advanced data analysis..."], precio: "Special Price: $[PRICE_OFFICE_2019_DETAIL]", imagenUrl: "https://placehold.co/600x400/0078D4/FFFFFF?text=Office+2019+Pro&font=oswald" },
                // ... Más licencias en inglés
            ]
        }
    };

    function cargarContenidoProducto(tipo, id, idioma = 'es') {
        console.log(`cargarContenidoProducto llamado con: tipo='${tipo}', id='${id}', idioma='${idioma}'`);

        if (!productContentDiv) {
            console.error("Dentro de cargarContenidoProducto: No se encontró el div #product-content");
            return;
        }

        let itemData;
        if (datos[tipo] && datos[tipo][idioma] && datos[tipo][idioma][id] !== undefined) {
            itemData = datos[tipo][idioma][id];
        } else if (datos[tipo] && datos[tipo]['es'] && datos[tipo]['es'][id] !== undefined) {
            itemData = datos[tipo]['es'][id];
            console.warn(`Contenido para idioma '${idioma}' no encontrado para ${tipo} ID ${id}. Mostrando en español.`);
        } else {
            console.error(`No se encontraron datos para tipo: ${tipo}, id: ${id}, idioma: ${idioma}`);
            productContentDiv.innerHTML = `<p class="product-description">Lo sentimos, la información para este producto no está disponible actualmente. (Debug: tipo=${tipo}, id=${id}, idioma=${idioma})</p>`;
            return;
        }

        if (!itemData) {
            console.error("itemData es undefined DESPUÉS de los chequeos. Algo está mal.");
            productContentDiv.innerHTML = `<p class="product-description">Error interno al procesar los datos del producto. (itemData undefined)</p>`;
            return;
        }

        let html = '';
        // Añadir imagen primero si existe
        if (itemData.imagenUrl) {
            html += `<div class="product-image-container">`;
            html += `<img src="${itemData.imagenUrl}" alt="Imagen de ${itemData.nombre}" class="product-image">`;
            html += `</div>`;
        }

        html += `<h1 class="product-title">${itemData.nombre}</h1>`;
        html += `<p class="product-description">${itemData.descripcion}</p>`;
        
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
            html += `<div class="product-price">`; // Clase para estilizar el precio
            html += `<p><strong>${itemData.precio.includes('$[') ? itemData.precio.replace('$[', 'Precio: ').replace(']', '') : itemData.precio}</strong></p>`;
            html += `</div>`;
        }
        
        productContentDiv.innerHTML = html;
        console.log("Contenido renderizado en productContentDiv.");
    }

    const urlParams = new URLSearchParams(window.location.search);
    const tipoProducto = urlParams.get('tipo'); 
    const idProductoRaw = urlParams.get('id');
    const idProducto = parseInt(idProductoRaw, 10);

    console.log(`Parámetros URL: tipo='${tipoProducto}', id (raw)='${idProductoRaw}', id (parsed)='${idProducto}'`);

    let idiomaActual = langSelect ? langSelect.value : 'es';
    console.log("Idioma actual inicial:", idiomaActual);

    if (tipoProducto && (tipoProducto === 'servicio' || tipoProducto === 'licencia') && !isNaN(idProducto)) {
        console.log("Llamando a cargarContenidoProducto desde la carga inicial.");
        cargarContenidoProducto(tipoProducto, idProducto, idiomaActual);
    } else {
        console.error("Condición para carga inicial NO cumplida. Faltan parámetros 'tipo' o 'id' en la URL, o no son válidos. Tipo recibido:", tipoProducto, "ID (raw):", idProductoRaw);
        if (productContentDiv) {
            productContentDiv.innerHTML = `<p class="product-description">No se ha especificado un producto para mostrar o los parámetros son incorrectos. Por favor, selecciona un producto o servicio desde la página principal.</p>`;
        }
    }

    if (langSelect) {
        langSelect.addEventListener('change', function() {
            idiomaActual = this.value;
            console.log('Selector de idioma cambiado. Nuevo idioma:', idiomaActual);
            if (tipoProducto && (tipoProducto === 'servicio' || tipoProducto === 'licencia') && !isNaN(idProducto)) {
                console.log("Llamando a cargarContenidoProducto desde el cambio de idioma.");
                cargarContenidoProducto(tipoProducto, idProducto, idiomaActual);
            }
        });
    }
});
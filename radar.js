process.env.TZ = 'America/Lima'; 
const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Radar Cusco Operativo 🚀');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de Render escuchando en el puerto ${PORT}`);
});

const {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    downloadMediaMessage
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
// Lector de texto de imágenes y comandas.
let createWorkerOCR = null;
let workerOCRPromise = null;

try {
    ({ createWorker: createWorkerOCR } = require('tesseract.js'));
} catch (error) {
    console.warn(
        'Falta tesseract.js: no se podrá leer el texto de las imágenes.'
    );
}

// ==========================================
// ⚙️ CONFIGURACIÓN Y ESTADO
// ==========================================
const MI_NUMERO_LIMPIO = "51930100974"; 
const MI_JID = `${MI_NUMERO_LIMPIO}@s.whatsapp.net`;

const GRUPOS_EXCLUIDOS = [
    "🏍️Wayqui Delivery🏍️",
    "Wayqui Delivery" // Por si acaso sin emojis
];

let zonaPrioritaria = 'sanjeronimo'; 
let modoTodos = false;
let botActivo = true;

let generacionEstadoBot = 0;

const mensajesProcesados = new Set();
const ultimasRespuestasGrupo = new Map(); // Para cooldown de grupos (Timestamps)
const ultimasRespuestasEmisor = new Map(); // Para cooldown de emisores (Objetos)
const nombresGruposCache = new Map();
const bloqueosGrupo = new Map(); // 🔒 Candado directo por Grupo

// Limpieza automática de memoria RAM (Cada 30 min)
setInterval(() => {
    mensajesProcesados.clear();
    nombresGruposCache.clear();
    ultimasRespuestasEmisor.clear();
}, 30 * 60 * 1000);

// Configuración de Zonas
const ZONAS_CONFIG = {
    'centro': { nombre: 'CENTRO', icono: '🏙️' },
    'wanchaq': { nombre: 'WANCHAQ', icono: '🟦' },
    'marcavalle': { nombre: 'MARCAVALLE', icono: '🟪' },
    'sansebastian': { nombre: 'SAN SEBASTIÁN', icono: '🟨' },
    'sanjeronimo': { nombre: 'abajo ', icono: '🟩' },
    'aeropuerto': { nombre: 'AEROPUERTO', icono: '✈️' },
    'todos': { nombre: 'TODOS', icono: '🌎' }
};

// ==========================================
// 📍 BASE DE DATOS DE LOCALES POR ZONA
// ==========================================
const LOCALES = [
    // 🔴 CENTRO
    { nombre: 'sushi cusco wayki', alias: ['sushi cusco wayki', 'sushi wayki', 'wayki sushi', 'mtwup4w9kiyye18vp8'], zona: 'centro' },
    { nombre: 'pollos quillabamba ayacucho', alias: ['quillabamba ayacucho', 'quillabamba centro'], zona: 'centro' },
    { nombre: 'chifa taypa', alias: ['taypa', 'chifa taypa'], zona: 'centro' },
    { nombre: 'la bodega 138', alias: ['bodega 138', 'la bodega'], zona: 'centro' },
    { nombre: 'limbus', alias: ['limbus', 'limbus restobar'], zona: 'centro' },
    { nombre: 'pachapapa', alias: ['pachapapa'], zona: 'centro' },
    { nombre: 'la bodeguita cubana', alias: ['bodeguita cubana'], zona: 'centro' },
    { nombre: 'inka burger', alias: ['inka burger'], zona: 'centro' },
    { nombre: 'de bocca', alias: ['de bocca'], zona: 'centro' },
    { nombre: 'fuego', alias: ['fuego'], zona: 'centro' },
    { nombre: 'nuna raymi', alias: ['nuna raymi'], zona: 'centro' },
    { nombre: 'el truco del sabor', alias: ['el truco del sabor', 'deliv el truco', 'truco del sabor'], zona: 'centro' },
    { nombre: 'wing peru', alias: ['wing peru', 'deliverys wing'], zona: 'centro' },
    { nombre: 'parada vegana', alias: ['parada vegana', 'vegana'], zona: 'centro' },
    { nombre: 'cicciolina café', alias: ['cicciolina', 'cicciolina cafe', 'deliverys cicciolina'], zona: 'centro' },
    { nombre: 'vacho sanguchería', alias: ['vacho', 'vacho sangucheria', 'deliv vacho'], zona: 'centro' },
    { nombre: 'hayaku recoleta', alias: ['hayaku', 'hayaku recoleta', 'deliv hayaku recoleta', 'hayaku centro'], zona: 'centro' },
    { nombre: 'pardo misky factory', alias: ['pardo misky factory', 'misky factory', 'pardo misky', 'deliv pardo miskyfactory'], zona: 'centro' },

    // 🟦 WANCHAQ
    { nombre: 'cevichería reymar', alias: ['reymar', 'reymar garcilaso', 'cevicheria reymar'], zona: 'wanchaq' },
    { nombre: 'don gato', alias: ['don gato', 'gato'], zona: 'wanchaq' },
    { nombre: 'punto acai', alias: ['punto acai', 'acai'], zona: 'wanchaq' },
    { nombre: 'empanadas y punto', alias: ['empanadas y punto'], zona: 'wanchaq' },
    { nombre: 'zona logística', alias: ['zona logistica', 'zona log'], zona: 'wanchaq' },
    { nombre: 'punto fit wanchaq', alias: ['punto fit wanchaq'], zona: 'wanchaq' },
    { nombre: 'roly quillabamba', alias: ['roly quillabamba'], zona: 'wanchaq' },
    { nombre: 'pollería atípico', alias: ['polleria atipico', 'atipico'], zona: 'wanchaq' },
    { nombre: 'óvalo pachacútec', alias: ['ovalo pachacutec', 'pachacutec'], zona: 'wanchaq' },
    { nombre: 'el bijao', alias: ['el bijao', 'bijao'], zona: 'wanchaq' },
    { nombre: 'pizza hogar', alias: ['pizza hogar'], zona: 'wanchaq' },
    { nombre: 'delivery las donas', alias: ['delivery las donas', 'las donas'], zona: 'wanchaq' },
    { nombre: 'delicias del carmen', alias: ['delicias del carmen'], zona: 'wanchaq' },
    { nombre: 'cangrejo d piura', alias: ['cangrejo d piura', 'cangrejo de piura', 'cangrejodpiura', 'delivs cangrejodpiura'], zona: 'wanchaq' },
    { nombre: 'pizza aventura garcilaso', alias: ['pizza aventura', 'aventura', 'pizza aventura garcilazo', 'deliv pizza aventura'], zona: 'wanchaq' },
    { nombre: 'punto y coma', alias: ['punto y coma', 'punto y coma wanchaq', 'deliverys punto y coma'], zona: 'wanchaq' },
    { nombre: 'llatan anticuchos y parrillas', alias: ['llatan', 'llatan anticuchos', 'deliv llatan anticuchos'], zona: 'wanchaq' },
    { nombre: 'cevicheria popeye', alias: ['popeye', 'cevicheria popeye', 'popeye collasuyo'], zona: 'wanchaq' },
    { nombre: 'la andinita', alias: ['la andinita', 'andinita'], zona: 'wanchaq' },
    { nombre: 'librería pacha huáscar', alias: ['pacha', 'libreria pacha', 'pacha huascar'], zona: 'wanchaq' },

    // 🟪 MARCAVALLE
    { nombre: 'DELIV. ALA QUE DELI', alias: ['deliv ala que deli', 'ala que deli', 'delivery ala que deli'], zona: 'marcavalle' },
    { nombre: 'Pollería Felipes', alias: ['deliv polleria felipes', 'polleria felipes', 'felipes'], zona: 'marcavalle' },
    { nombre: 'Delivery Akatsuka', alias: ['delivery akatsuka', 'akatsuka', 'deliverys akatsuka', '⭐🍱delivery akatsuka🍱⭐'], zona: 'marcavalle' },
    { nombre: 'DELIVERYS DE OLY', alias: ['deliverys de oly', 'delivery de oly', 'oly', 'deliv erys de oly'], zona: 'marcavalle' },
    { nombre: 'et-sushi marcavalle', alias: ['et sushi', 'et-sushi', 'et sushi marcavalle', 'et-sushi marcavalle'], zona: 'marcavalle' },
    { nombre: 'takibi sushi bar', alias: ['takibi', 'takibi sushi', 'takibi sushi bar', 'deliv takibi sushi bar'], zona: 'marcavalle' },
    { nombre: 'pecas de sol', alias: ['pecas de sol', 'pecas', 'deliverys pecas de sol'], zona: 'marcavalle' },
    { nombre: 'punto mar cevichería', alias: ['punto mar', 'punto mar cevicheria', 'cevicheria punto mar', 'deliv punto mar'], zona: 'marcavalle' },
    { nombre: 'bandejazos', alias: ['bandejazos', 'deliverys bandejazos', 'bandejazo'], zona: 'marcavalle' },
    { nombre: 'jaku sushi', alias: ['jaku', 'jaku sushi', 'magisterio', 'magis'], zona: 'marcavalle' },
    { nombre: 'karitos', alias: ['karitos'], zona: 'marcavalle' },
    { nombre: 'taytas', alias: ['taytas', 'taytas pizzeria', 'deliv taytas pizzeria'], zona: 'marcavalle' },
    { nombre: 'qori sara', alias: ['qori sara', 'qorisara'], zona: 'marcavalle' },
    { nombre: 'mister carni voron', alias: ['mister carni voron', 'carni voron'], zona: 'marcavalle' },
    { nombre: 'paloma imbis', alias: ['paloma imbis', 'paloma'], zona: 'marcavalle' },
    { nombre: 'florencia y fortunata', alias: ['florencia y fortunata'], zona: 'marcavalle' },
    { nombre: 'bodega italiana', alias: ['bodega italiana'], zona: 'marcavalle' },
    { nombre: 'heladería freskito', alias: ['heladeria freskito', 'freskito'], zona: 'marcavalle' },
    { nombre: 'pizza car', alias: ['pizza car'], zona: 'marcavalle' },
    { nombre: '7 caldos', alias: ['7 caldos', 'siete caldos'], zona: 'marcavalle' },
    { nombre: 'taco kombi', alias: ['taco kombi', 'tacos kombi', 'deliverys taco kombi'], zona: 'marcavalle' },
    { nombre: 'pez limon santa úrsula', alias: ['pez limon', 'pez limon santa ursula', 'deliv pez limon'], zona: 'marcavalle' },
    { nombre: 'chifa kung food panda', alias: ['kung food panda', 'food panda', 'kung food', 'deliv kung food panda'], zona: 'marcavalle' },
    { nombre: 'Deliverys Sazon de Karo', alias: ['deliverys sazon de karo', 'delivery sazon de karo', 'sazon de karo', 'sazón de karo'], zona: 'marcavalle' },

    // 🟨 SAN SEBASTIÁN
    { nombre: 'mr sushi cusco', alias: ['mr sushi cusco', 'mr. sushi cusco', 'deliv mr sushi'], zona: 'sansebastian' },
    { nombre: 'maki mania', alias: ['maki mania', 'makimania', 'porton', 'paradero porton'], zona: 'sansebastian' },
    { nombre: 'wayqui', alias: ['wayqui san sebastian', 'huayqui'], zona: 'sansebastian' },
    { nombre: 'ichiban sushi', alias: ['ichiban', 'ichiban sushi'], zona: 'sansebastian' },
    { nombre: 'supermasa', alias: ['supermasa'], zona: 'sansebastian' },
    { nombre: 'las alicias', alias: ['las alicias', 'alicias'], zona: 'sansebastian' },
    { nombre: 'otera sushi', alias: ['otera sushi', 'otera'], zona: 'sansebastian' },
    { nombre: 'pizza wao', alias: ['pizza wao', 'wao'], zona: 'sansebastian' },
    { nombre: 'quinta peña don luis', alias: ['quinta peña don luis', 'quinta don luis', 'don luis'], zona: 'sansebastian' },
    { nombre: 'croocantpizzas', alias: ['croocantpizzas', 'croocant'], zona: 'sansebastian' },
    { nombre: 'katsu sushi', alias: ['katsu', 'katsu sushi', 'deliverys katsu sushi'], zona: 'sansebastian' },
    { nombre: 'DELIVERYS SOL DE MAYO', alias: ['deliverys sol de mayo', 'delivery sol de mayo', 'sol de mayo'], zona: 'sansebastian' },

    // 🟩 SAN JERÓNIMO / LARAPA
    { nombre: 'la avenida', alias: ['la avenida', 'avenida larapa'], zona: 'sanjeronimo' },
    { nombre: 'pizza express larapa', alias: ['pizza express larapa', 'pizzeria express larapa', 'express larapa'], zona: 'sanjeronimo' },
    { nombre: 'el gallito adderly', alias: ['aderly', 'gallito adderly', 'nogales'], zona: 'sanjeronimo' },
    { nombre: 'the burguer box', alias: ['the burguer box', 'burguer box', 'burger box'], zona: 'sanjeronimo' },
    { nombre: 'pollería pikol cachimayo', alias: ['pikol', 'pikol cachimayo', 'polleria pikol', 'deliv pikol cachimayo'], zona: 'sanjeronimo' },

    // ✈️ AEROPUERTO
    { nombre: 'fiorentino', alias: ['fiorentino'], zona: 'aeropuerto' },
    { nombre: 'emily', alias: ['emily'], zona: 'aeropuerto' },
    { nombre: 'shulans', alias: ['shulans'], zona: 'aeropuerto' },
    { nombre: 'morimora', alias: ['morimora'], zona: 'aeropuerto' },
    { nombre: 'el buen sabor', alias: ['el buen sabor', 'deliv el buen sabor', 'buen sabor'], zona: 'aeropuerto' },
    { nombre: 'delivery giaco', alias: ['delivery giaco', 'giaco pizza', 'giaco'], zona: 'aeropuerto' },
    { nombre: 'la mostra', alias: ['la mostra', 'deliv la mostra', 'mostra'], zona: 'aeropuerto' },
    { nombre: 'roly manuel prado', alias: ['roly manuel prado', 'manuel prado'], zona: 'aeropuerto' },
    { nombre: 'wayqui express', alias: ['wayqui express', 'wayqui express pizzeria'], zona: 'aeropuerto' },
    { nombre: 'ricochanchito', alias: ['ricochanchito', 'rico chanchito'], zona: 'aeropuerto' },
    { nombre: 'punto fit molino', alias: ['punto fit molino', 'punto fit el molino'], zona: 'aeropuerto' },
    { nombre: 'tomasa tito', alias: ['tomasa tito', 'tomasa'], zona: 'aeropuerto' },
    { nombre: 'nonna dioni pizzeria', alias: ['nonna dioni', 'dioni'], zona: 'aeropuerto' },
    { nombre: 'chifa baozi', alias: ['baozi', 'chifa baozi'], zona: 'aeropuerto' },
    { nombre: 'Delivery Linaje 33', alias: ['delivery linaje 33', 'linaje 33'], zona: 'aeropuerto' },
];
    // ==========================================
// 🔎 ÍNDICE GLOBAL DE TÉRMINOS (nuevo)
// ==========================================
const TERMINOS_LOCALES = (() => {
    const lista = [];
    for (const local of LOCALES) {
        const vistos = new Set();
        for (const b of [local.nombre, ...local.alias]) {
            const t = limpiarTexto(b);
            if (!t || t.length < 3 || vistos.has(t)) continue;
            vistos.add(t);
            lista.push({ local, termino: t, regex: new RegExp(`(^| )${t}( |$)`) });
        }
    }
    // Descarta términos ambiguos: los que están contenidos dentro de un término
    // más largo de OTRO local (ej. 'sushi cusco' dentro de 'sushi cusco wayki').
    return lista.filter(a => !lista.some(b =>
        b.local !== a.local && b.termino !== a.termino && a.regex.test(b.termino)
    ));
})();

function buscarLocalesEnTexto(textoLimpio) {
    if (!textoLimpio) return [];
    const aciertos = TERMINOS_LOCALES.filter(x => x.regex.test(textoLimpio));
    // Si un acierto está contenido en otro más largo, se queda el más largo
    const finales = aciertos.filter(a => !aciertos.some(b =>
        b !== a && b.termino !== a.termino && a.regex.test(b.termino)
    ));
    return [...new Set(finales.map(x => x.local))];
}

// ==========================================
// 🛠️ FUNCIONES AUXILIARES
// ==========================================
function limpiarTexto(str) {
    if (!str) return "";
    return str.toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^\w\s]/gi, ' ')        
        .replace(/\s+/g, ' ')
        .trim();
}
function limpiarTextoConEmojis(str) {
    if (!str) return "";
    return str.toString().toLowerCase().trim();
}

function desempacarMensaje(m) {
    let msg = m.message;
    if (!msg) return null;
    
    if (msg.editedMessage) {
        msg = msg.editedMessage.message?.protocolMessage?.editedMessage || msg.editedMessage.message;
        if (!msg) return null;
    }
    
    if (msg.stickerMessage || msg.reactionMessage || msg.pollCreationMessage) return null;

    while (msg.ephemeralMessage || msg.viewOnceMessage || msg.viewOnceMessageV2 || msg.viewOnceMessageV2Extension || msg.documentWithCaptionMessage) {
        if (msg.ephemeralMessage) msg = msg.ephemeralMessage.message;
        else if (msg.viewOnceMessage) msg = msg.viewOnceMessage.message;
        else if (msg.viewOnceMessageV2) msg = msg.viewOnceMessageV2.message;
        else if (msg.viewOnceMessageV2Extension) msg = msg.viewOnceMessageV2Extension.message;
        else if (msg.documentWithCaptionMessage) msg = msg.documentWithCaptionMessage.message;
    }
    return msg;
}

function extraerTextoMensaje(msgReal) {
    if (!msgReal) return "";
    return (msgReal.conversation || 
            msgReal.extendedTextMessage?.text || 
            msgReal.imageMessage?.caption || 
            msgReal.documentMessage?.caption || 
            msgReal.videoMessage?.caption || "").trim();
}

function obtenerPuntuacionComanda(texto) {
    const t = limpiarTexto(texto);

    const patrones = [
        /\bcliente\b/,
        /\bcuenta\b/,
        /\btotal\b/,
        /\bmetodo de pago\b/,
        /\bdireccion\b/,
        /\breferencia\b/,
        /\bpedido\b/,
        /\bdelivery\b/,
        /\bproductos?\b/,
        /\borden\b/,
        /\befectivo\b/,
        /\bcobrar\b/,
        /\bboleta\b/,
        /\bfactura\b/,
        /\bs\/\s*\d/,
        /\b9\d{8}\b/
    ];

    return patrones.reduce(
        (suma, patron) => suma + (patron.test(t) ? 1 : 0),
        0
    );
}
    function esComandaLegible(texto) {
    const t = limpiarTexto(texto);
    if (!t) return false;

    const puntos = obtenerPuntuacionComanda(t);
    const tieneTelefono = /\b9\d{8}\b/.test(t);
    const tieneCampos =
        /\b(cliente|cuenta|total|direccion|pedido|delivery|boleta|factura|productos?|orden)\b/.test(t);

    return puntos >= 3 ||
        (puntos >= 2 && (tieneTelefono || tieneCampos));
}

function esEsenciaDePedido(texto, msgReal) {
    const t = limpiarTexto(texto);

    if (msgReal?.locationMessage ||
        msgReal?.liveLocationMessage) {
        return true;
    }

    if (!t) return false;

    if (pareceMapa(t)) return true;

    if (msgReal?.imageMessage ||
    msgReal?.documentMessage) {

    if (esVoucherPago(t)) return false;
    if (esComandaLegible(t)) return true;

    return false;
}

    return esComandaLegible(t);
}

function esVoucherPago(texto) {
    const t = limpiarTexto(texto);
    if (!t) return false;

    const frasesVoucher = [
        'constancia de pago',
        'comprobante de pago',
        'operacion exitosa',
        'transferencia exitosa',
        'pago exitoso',
        'pago realizado',
        'pago recibido',
        'monto transferido',
        'yapeaste',
        'enviaste dinero',
        'dinero enviado',
        'transaccion exitosa',
        'compra aprobada',
        'operacion aprobada',
        'transaccion aprobada',
        'pago con tarjeta',
        'compra realizada',
        'pago confirmado',
        'transferencia realizada'
    ];

    if (frasesVoucher.some(frase => t.includes(frase))) {
        return true;
    }

    const marcaPago =
        /\b(yape|plin|bcp|bbva|interbank|izipay|niubiz|visa|mastercard)\b/.test(t);

    const tieneDatosPedido =
        /\b(cliente|direccion|pedido|delivery|productos?|orden)\b/.test(t);

    if (!marcaPago || tieneDatosPedido) {
        return false;
    }

    const senalesTransaccion = [
        /\boperacion\b/,
        /\btransaccion\b/,
        /\bdestinatario\b/,
        /\bremitente\b/,
        /\btransferencia\b/,
        /\benviado\b/,
        /\bcodigo\b/,
        /\bimporte\b/,
        /\bmonto\b/,
        /\baprobada\b/,
        /\baprobado\b/,
        /\btarjeta\b/
    ].filter(patron => patron.test(t)).length;

    return senalesTransaccion >= 2;
}

function pareceMapa(texto) {
    const t = limpiarTexto(texto);

    if (!t) return false;

    if (/maps\.app\.goo\.gl|goo\.gl\/maps|google maps|maps\.google/.test(t)) {
        return true;
    }

    const indicadores = [
        /\bavenida\b/,
        /\bav\b/,
        /\bcalle\b/,
        /\bjiron\b/,
        /\bjr\b/,
        /\bcostanera\b/,
        /\basoc\b/,
        /\burb\b/,
        /\bsector\b/,
        /\bcoordenadas\b/
    ];

    const cantidad = indicadores.reduce(
        (suma, patron) => suma + (patron.test(t) ? 1 : 0),
        0
    );

    return cantidad >= 2 && !esComandaLegible(t);
}

async function extraerTextoOCR(msgOriginal, mensajeReal, sock) {
    if (!createWorkerOCR || typeof downloadMediaMessage !== 'function') {
        return '';
    }

    const esImagen = Boolean(mensajeReal?.imageMessage);

    const esDocumentoImagen = Boolean(
        mensajeReal?.documentMessage &&
        /^image\//i.test(mensajeReal.documentMessage.mimetype || '')
    );

    if (!esImagen && !esDocumentoImagen) {
        return '';
    }

    try {
        if (!workerOCRPromise) {
            workerOCRPromise = createWorkerOCR(
                'spa+eng',
                1,
                { logger: () => {} }
            ).catch(error => {
                workerOCRPromise = null;
                throw error;
            });
        }

        const worker = await workerOCRPromise;

        const buffer = await downloadMediaMessage(
            msgOriginal,
            'buffer',
            {},
            {
                logger: pino({ level: 'silent' }),
                reuploadRequest: sock.updateMediaMessage
            }
        );

        if (!buffer || !Buffer.isBuffer(buffer)) {
            return '';
        }

        const resultado = await worker.recognize(buffer);

        return (resultado?.data?.text || '').trim();

    } catch (error) {
        console.error(
            'Error al leer la comanda con OCR:',
            error.message || error
        );

        return '';
    }
}

function detectarLocalPorZona(texto, zonaFiltro, nombreGrupo, msgReal) {
    if (!esEsenciaDePedido(texto, msgReal)) return null;

    const localesGrupo = buscarLocalesEnTexto(
        limpiarTexto(nombreGrupo)
    );

    if (localesGrupo.length !== 1) return null;

    const local = localesGrupo[0];


    if (modoTodos !== true) {
        if (!zonaFiltro || local.zona !== zonaFiltro) {
            return null;
        }
    }

    return local;
}

// 🚀 NÚCLEO PRINCIPAL

async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_baileys_v3');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ['Ubuntu', 'Chrome', '110.0.5563.64'],
        syncFullHistory: true,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: undefined
    });

    sock.ev.on('creds.update', saveCreds);

    // 📲 VINCULACIÓN POR CÓDIGO DE TEXTO (Pairing Code)
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const numeroFormateado = MI_NUMERO_LIMPIO.replace(/[^0-9]/g, '');
                const codigo = await sock.requestPairingCode(numeroFormateado);
                console.log('\n==============================================');
                console.log(`🔑 TU CÓDIGO DE VINCULACIÓN ES: ${codigo}`);
                console.log('==============================================\n');
            } catch (err) {
                console.error('Error al solicitar el código de vinculación:', err);
            }
        }, 5000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom) ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true;
            if (shouldReconnect) setTimeout(iniciarBot, 3000);
        } else if (connection === 'open') {
            console.clear();
            const zonaActivaNombre = modoTodos ? 'TODOS' : (ZONAS_CONFIG[zonaPrioritaria]?.nombre || 'ZONA');
            console.log('==============================================');
            console.log('✅ RADAR CUSCO - OPERATIVO Y VINCULADO');
            console.log(`🎯 Zona Activa: ${zonaActivaNombre}`);
            console.log('==============================================\n');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;
        
        for (const msg of m.messages) {
            if (!msg.message) continue;
            
           const jid = msg.key.remoteJid;
            const deMi = msg.key.fromMe;
            const msgId = msg.key.id;
            const esGrupo = jid.endsWith('@g.us');
            const ahora = Date.now();

            if (mensajesProcesados.has(msgId)) continue;
            mensajesProcesados.add(msgId); 

            const mensajeReal = desempacarMensaje(msg);
            if (!mensajeReal) continue;

           let nombreGrupoTemp = nombresGruposCache.get(jid) || '';

if (!nombreGrupoTemp && esGrupo) {
    try {
        const meta = await sock.groupMetadata(jid);
        nombreGrupoTemp = meta?.subject || '';

        if (nombreGrupoTemp) {
            nombresGruposCache.set(jid, nombreGrupoTemp);
        }
    } catch (error) {
        console.error('Error obteniendo nombre del grupo:', error.message);
    }
}

            if (GRUPOS_EXCLUIDOS.some(ex => limpiarTextoConEmojis(nombreGrupoTemp) === limpiarTextoConEmojis(ex))) continue;

            const textoBruto = extraerTextoMensaje(mensajeReal);
            const textoLimpio = limpiarTexto(textoBruto);

            // 1. COMANDOS PRIVADOS
            const esMiChatPrivado = !esGrupo && (deMi || jid.includes(MI_NUMERO_LIMPIO));

            if (esMiChatPrivado) {
                if (textoLimpio === 'wanchaq') {
                    zonaPrioritaria = 'wanchaq'; modoTodos = false; 
                    generacionEstadoBot++;
                    await sock.sendMessage(jid, { text: 'ire a wanchaq' });
                    continue;
                }
                else if (textoLimpio === 'marcavalle' || textoLimpio === 'marca' || textoLimpio === 'magisterio') {
                    zonaPrioritaria = 'marcavalle'; modoTodos = false; 
                    generacionEstadoBot++;
                    await sock.sendMessage(jid, { text: 'camino a marcavalle' });
                    continue;
                }
                
                else if (textoLimpio === 'sansebastian' || textoLimpio === 'sebas' || textoLimpio === 'cultura') {
                    zonaPrioritaria = 'sansebastian'; modoTodos = false; 
                    generacionEstadoBot++;
                    await sock.sendMessage(jid, { text: 'En sansebas' });
                    continue;
                }
                else if (textoLimpio === 'centro') {
                    zonaPrioritaria = 'centro'; modoTodos = false; 
                    generacionEstadoBot++;
                    await sock.sendMessage(jid, { text: 'camino al centro' });
                    continue;
                }
                else if (textoLimpio === 'sanjeronimo' || textoLimpio === 'larapa' || textoLimpio === 'jero') {
                    zonaPrioritaria = 'sanjeronimo'; modoTodos = false; 
                    generacionEstadoBot++;
                    await sock.sendMessage(jid, { text: ' Estoy bajando' });
                    continue;
                }
                else if (textoLimpio === 'aeropuerto' || textoLimpio === 'aero') {
                    zonaPrioritaria = 'aeropuerto'; modoTodos = false; 
                    generacionEstadoBot++;
                    await sock.sendMessage(jid, { text: 'camino para el aeropuerto' });
                    continue;
                }
                else if (textoLimpio === 'todos') {
                    modoTodos = true;
                    generacionEstadoBot++;
                    await sock.sendMessage(jid, { text: 'estare por todos lados' });
                    continue;
                }
                else if (textoLimpio === 'ocupado' || textoLimpio === 'pausa') {
                    botActivo = false;
                    generacionEstadoBot++;
                    await sock.sendMessage(jid, { text: 'un breck' });
                    continue;
                }
                else if (textoLimpio === 'libre' || textoLimpio === 'activo') {
                    botActivo = true;
                    generacionEstadoBot++;
                    const nombreZonaConfirmacion = modoTodos ? 'estare por todos lados' : ZONAS_CONFIG[zonaPrioritaria]?.nombre;
                    await sock.sendMessage(jid, { text: `free en  ${nombreZonaConfirmacion}` });
                    continue;
                }
                else if (textoLimpio === 'estado' || textoLimpio === 'status') {
                    const zonaObj = modoTodos ? ZONAS_CONFIG['todos'] : (ZONAS_CONFIG[zonaPrioritaria] || ZONAS_CONFIG['todos']);
                    const estadoTexto = `📊 *ESTADO DEL RADAR*\nEstado: ${botActivo ? 'Estoy volando' : 'un momento'}\nModo: ${modoTodos ? 'estare por todos lados' : 'solo en esta calle'}\nZona actual: ${zonaObj.icono} ${zonaObj.nombre}`;
                    await sock.sendMessage(jid, { text: estadoTexto });
                    continue;
                }
            }

            // 2. REGISTRAR SI ESCRIBES "YO" MANUALMENTE EN UN GRUPO
            if (esGrupo && deMi) {
                if (textoLimpio === 'yo' || textoLimpio.startsWith('yo ')) {
                    ultimasRespuestasGrupo.set(jid, ahora);
                }
                continue;
            }

            // 3. EVITAR RESPONDER A TUS PROPIOS MENSAJES O MENSAJES FUERA DE GRUPOS
            if (!botActivo || deMi || !esGrupo) continue;
            const generacionAlIniciar = generacionEstadoBot;

            // 🔒 BLOQUEO INMEDIATO PREVIO
            if (bloqueosGrupo.get(jid)) continue;

            const ultimoEnvio = ultimasRespuestasGrupo.get(jid) || 0;
            if (ahora - ultimoEnvio < 180000) {
                continue;
            }

           // EVALUACIÓN Y RESPUESTA EN GRUPOS
            const nombreGrupo = nombreGrupoTemp || nombresGruposCache.get(jid) || '';
            if (!nombreGrupo && jid.endsWith('@g.us')) {
                // Pide los datos al servidor en segundo plano sin congelar la respuesta del bot
                sock.groupMetadata(jid)
                    .then(meta => {
                        if (meta?.subject) nombresGruposCache.set(jid, meta.subject);
                    })
                    .catch(() => {});
            }

            // Detecta el local de inmediato (si el nombre aún no cargó, pasa '' sin trabarse)
            const textoOCR = await extraerTextoOCR(msg, mensajeReal, sock);
            if (!botActivo || generacionAlIniciar !== generacionEstadoBot) {
    continue;
}

const textoParaDetectar = [
    textoBruto,
    textoOCR
].filter(Boolean).join('\n').trim();

const localDetectado = detectarLocalPorZona(
    textoParaDetectar,
    zonaPrioritaria,
    nombreGrupo,
    mensajeReal
);
            if (localDetectado && (modoTodos || localDetectado.zona === zonaPrioritaria)) {
                const emisor = msg.key.participant || jid;
                const claveEmisor = `${jid}_${emisor}`;
                
                // 🔍 ESTRUCTURA DEL MENSAJE ACTUAL
                const esUbicacion = Boolean(mensajeReal.locationMessage || mensajeReal.liveLocationMessage);
                const esTexto = Boolean(mensajeReal.conversation || mensajeReal.extendedTextMessage);

                // 🔍 REGISTRO PREVIO DEL EMISOR
                const registroPrevio = ultimasRespuestasEmisor.get(claveEmisor);

                if (registroPrevio) {
                    const tiempoTranscurrido = ahora - registroPrevio.timestamp;

                    // Si el mismo restaurante vuelve a mandar un mensaje en menos de 12 segundos...
                    if (tiempoTranscurrido < 12000) {
                        // Caso 1: Ya respondimos a su Ubicación y ahora manda el Texto del mismo pedido -> OMITIR
                        if (registroPrevio.esUbicacion && esTexto) {
                            continue;
                        }
                        // Caso 2: Ya respondimos a su Texto y ahora manda la Ubicación del mismo pedido -> OMITIR
                        if (registroPrevio.esTexto && esUbicacion) {
                            continue;
                        }
                        // Caso 3: Es exactamente el mismo tipo de mensaje duplicado en ráfaga -> OMITIR
                        if (registroPrevio.esUbicacion === esUbicacion && registroPrevio.esTexto === esTexto) {
                            continue;
                        }
                    }
                }

                // 🔒 ACTIVACIÓN DE CANDADO SÍNCRONO
                if (!botActivo || generacionAlIniciar !== generacionEstadoBot) {
    continue;
}
                bloqueosGrupo.set(jid, true);

                // Guardamos el tiempo de grupo y los datos estructurados por emisor
                ultimasRespuestasGrupo.set(jid, ahora);
                ultimasRespuestasEmisor.set(claveEmisor, {
                    timestamp: ahora,
                    esUbicacion: esUbicacion,
                    esTexto: esTexto
                });

                try {
                    await sock.sendMessage(jid, { text: 'Yo' });
                    if (!botActivo || generacionAlIniciar !== generacionEstadoBot) {
    continue;
}

                    const miJidDestino = MI_JID;
                    const textoZonaAviso = ZONAS_CONFIG[localDetectado.zona]?.nombre || localDetectado.zona.toUpperCase();
                    const aviso = `🎯 *PEDIDO GANADO* Atento\n Local: Ire a ${localDetectado.nombre.toUpperCase()} Zona: esta calle es ${textoZonaAviso}`;
                    await sock.sendMessage(miJidDestino, { text: aviso });

                } catch (err) {
                    console.error('Error al responder:', err);
                } finally {
                    // Libera el candado del grupo inmediatamente (1.5 segundos) para no bloquear a OTROS restaurantes
                    setTimeout(() => {
                        bloqueosGrupo.delete(jid);
                    }, 1500);
                }
            }
        }
    });
}
if (process.env.RADAR_TEST === '1') {
    const txt = (t) => ({ conversation: t });
    const ficha = (n) => `Pedido ${n}\nCliente: Juan 987654321\nDirección: Av Cultura 123\nTotal s/ 45 efectivo`;
    const casos = [
        ['1  centro + Sushi Cusco Wayki', 'centro', false, txt(ficha('Sushi Cusco Wayki')), '', null],
        ['5b ubicación sola, con grupo Limbus', 'centro', false, { locationMessage: {} }, 'Limbus Delivery', 'limbus'],     
        ['11 sansebastian + Wayki (centro)', 'sansebastian', false, txt(ficha('Sushi Cusco Wayki')), '', null],
        ['12 pedido Giaco + grupo Limbus, centro', 'centro', false, txt(ficha('Delivery Giaco')), 'Limbus Delivery', 'limbus'],
        ['12b pedido Giaco + grupo Limbus, aeropuerto', 'aeropuerto', false, txt(ficha('Delivery Giaco')), 'Limbus Delivery', null],
        ['12c pedido Limbus + grupo Giaco, aeropuerto', 'aeropuerto', false, txt(ficha('Limbus')), 'Delivery Giaco', 'delivery giaco'],
        ['13 texto Giaco citando ubicación, centro', 'centro', false, { extendedTextMessage: { text: ficha('Delivery Giaco'), contextInfo: { quotedMessage: { locationMessage: {} } } } }, '', null],
        ['14 todos + Giaco + grupo Limbus', 'centro', true, txt(ficha('Delivery Giaco')), 'Limbus Delivery', 'limbus'],
        ['1  centro + Sushi Cusco Wayki', 'centro', false, txt(ficha('Sushi Cusco Wayki')), '', null],
        ['2  centro + Delivery Giaco',      'centro',       false, txt(ficha('Delivery Giaco')),    '',  null],
        ['3  sanjeronimo + Mr Sushi Cusco', 'sanjeronimo',  false, txt(ficha('Mr Sushi Cusco')),    '',  null],
        ['4 sanjeronimo + Pikol Cachimayo', 'sanjeronimo', false, { locationMessage: {} }, '🐔Deliv. Pikol Cachimayo🐔', 'pollería pikol cachimayo'],
        ['5  centro + ubicación sola',      'centro',       false, { locationMessage: { degreesLatitude: -13.5, degreesLongitude: -71.9 } }, '', null],
        ['6  centro + local desconocido',   'centro',       false, txt(ficha('Pizzería Los Tres Chanchitos')), '', null],
        ['7  nombre solo en el grupo', 'centro', false, txt(ficha('')), 'Limbus Delivery', 'limbus'],       
        ['8  palabras genéricas',           'centro',       false, txt('Pedido delivery pollería sushi ubicación dirección cliente 987654321'), '', null],
        ['9a todos + desconocido',          'centro',       true,  txt(ficha('Local Inventado')),   '',  null],
        ['9b todos + Giaco', 'centro', true, txt(ficha('Delivery Giaco')), '', null],
    ];
    
    let pruebasFallidas = 0;
    let pruebasAprobadas = 0;

    for (const [nombre, zona, todos, msg, grupo, esperado] of casos) {
        try {
            modoTodos = todos;

            const r = detectarLocalPorZona(
                extraerTextoMensaje(msg),
                zona,
                grupo,
                msg
            );

            const obtenido = r ? r.nombre : null;
            const correcto = obtenido === esperado;

            if (correcto) {
                pruebasAprobadas++;
                console.log(`✅ PASS: ${nombre} -> ${obtenido}`);
            } else {
                pruebasFallidas++;
                console.error(
                    `❌ FAIL: ${nombre} | Esperado: ${esperado} | Obtenido: ${obtenido}`
                );
            }
        } catch (error) {
            pruebasFallidas++;
            console.error(`❌ ERROR: ${nombre}`, error);
        }
    }

    console.log('\n========== RESUMEN RADAR TEST ==========');
    console.log(`✅ Aprobadas: ${pruebasAprobadas}`);
    console.log(`❌ Fallidas: ${pruebasFallidas}`);
    console.log('========================================');

    process.exit(pruebasFallidas > 0 ? 1 : 0);

}
iniciarBot();

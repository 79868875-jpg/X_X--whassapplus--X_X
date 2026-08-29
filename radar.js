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
    DisconnectReason 
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

// ==========================================
// ⚙️ CONFIGURACIÓN Y ESTADO
// ==========================================
const MI_NUMERO_LIMPIO = "51930100974"; 
const MI_JID = `${MI_NUMERO_LIMPIO}@s.whatsapp.net`;

let zonaPrioritaria = 'sanjeronimo'; 
let modoTodos = false;
let botActivo = true;

const mensajesProcesados = new Set();
const ultimasRespuestasYo = new Map();
const nombresGruposCache = new Map();
const bloqueosGrupo = new Map(); // 🔒 Candado directo por Grupo

// Limpieza automática de memoria RAM (Cada 30 min)
setInterval(() => {
    mensajesProcesados.clear();
    nombresGruposCache.clear();
}, 30 * 60 * 1000);

// Configuración de Zonas
const ZONAS_CONFIG = {
    'centro': { nombre: 'CENTRO', icono: '🏙️' },
    'wanchaq': { nombre: 'WANCHAQ', icono: '🟦' },
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
    
    // 🟦 WANCHAQ
    { nombre: 'cevichería reymar', alias: ['reymar', 'reymar garcilaso', 'cevicheria reymar'], zona: 'wanchaq' },
    { nombre: 'don gato', alias: ['don gato', 'gato'], zona: 'wanchaq' },
    { nombre: 'chifa kung food panda', alias: ['kung food panda', 'food panda', 'kung food'], zona: 'wanchaq' },
    { nombre: 'punto acai', alias: ['punto acai', 'acai'], zona: 'wanchaq' },
    { nombre: 'jaku sushi', alias: ['jaku', 'jaku sushi', 'magisterio', 'magis'], zona: 'wanchaq' },
    { nombre: 'empanadas y punto', alias: ['empanadas y punto'], zona: 'wanchaq' },
    { nombre: 'zona logística', alias: ['zona logistica', 'zona log'], zona: 'wanchaq' },
    { nombre: 'karitos', alias: ['karitos'], zona: 'wanchaq' },
    { nombre: 'takibi sushi', alias: ['takibi', 'takibi sushi'], zona: 'wanchaq' },
    { nombre: 'punto fit wanchaq', alias: ['punto fit wanchaq'], zona: 'wanchaq' },
    { nombre: 'roly quillabamba', alias: ['roly quillabamba'], zona: 'wanchaq' },
    { nombre: 'pollería atípico', alias: ['polleria atipico', 'atipico'], zona: 'wanchaq' },
    { nombre: 'óvalo pachacútec', alias: ['ovalo pachacutec', 'pachacutec'], zona: 'wanchaq' },
    { nombre: 'taytas', alias: ['taytas'], zona: 'wanchaq' },
    { nombre: 'el bijao', alias: ['el bijao', 'bijao'], zona: 'wanchaq' },
    { nombre: 'pizza hogar', alias: ['pizza hogar'], zona: 'wanchaq' },
    { nombre: 'delivery las donas', alias: ['delivery las donas', 'las donas'], zona: 'wanchaq' },
    { nombre: 'delicias del carmen', alias: ['delicias del carmen'], zona: 'wanchaq' },
    
    // 🟨 SAN SEBASTIÁN
    { nombre: 'sushi cusco', alias: ['sushi cusco', 'mr. sushi cusco', 'mr sushi cusco', 'mr sushi', 'mr. sushi'], zona: 'sansebastian' },
    { nombre: 'maki mania', alias: ['maki mania', 'makimania', 'porton', 'paradero porton'], zona: 'sansebastian' },
    { nombre: 'wayqui', alias: ['wayqui san sebastian', 'huayqui'], zona: 'sansebastian' },
    { nombre: 'qori sara', alias: ['qori sara', 'qorisara'], zona: 'sansebastian' },
    { nombre: 'la andinita', alias: ['la andinita', 'andinita'], zona: 'sansebastian' },
    { nombre: 'ichiban sushi', alias: ['ichiban', 'ichiban sushi'], zona: 'sansebastian' },
    { nombre: 'supermasa', alias: ['supermasa'], zona: 'sansebastian' },
    { nombre: 'las alicias', alias: ['las alicias', 'alicias'], zona: 'sansebastian' },
    { nombre: 'mister carni voron', alias: ['mister carni voron', 'carni voron'], zona: 'sansebastian' },
    { nombre: 'otera sushi', alias: ['otera sushi', 'otera'], zona: 'sansebastian' },
    { nombre: 'pizza wao', alias: ['pizza wao', 'wao'], zona: 'sansebastian' },
    { nombre: 'paloma imbis', alias: ['paloma imbis', 'paloma'], zona: 'sansebastian' },
    { nombre: 'quinta peña don luis', alias: ['quinta peña don luis', 'quinta don luis', 'don luis'], zona: 'sansebastian' },
    { nombre: 'florencia y fortunata', alias: ['florencia y fortunata'], zona: 'sansebastian' },
    { nombre: 'bodega italiana', alias: ['bodega italiana'], zona: 'sansebastian' },
    { nombre: 'heladería freskito', alias: ['heladeria freskito', 'freskito'], zona: 'sansebastian' },
    { nombre: 'croocantpizzas', alias: ['croocantpizzas', 'croocant'], zona: 'sansebastian' },
    { nombre: 'pizza car', alias: ['pizza car'], zona: 'sansebastian' },
    
    // 🟩 SAN JERÓNIMO / LARAPA
    { nombre: 'pizza express larapa', alias: ['pizza express larapa', 'pizzeria express larapa', 'express larapa'], zona: 'sanjeronimo' },
    { nombre: 'la avenida', alias: ['la avenida', 'avenida larapa', 'av larapa'], zona: 'sanjeronimo' },
    { nombre: 'cevicheria popeye', alias: ['popeye', 'cevicheria popeye'], zona: 'sanjeronimo' },
    { nombre: 'el gallito adderly', alias: ['aderly', 'gallito adderly', 'nogales'], zona: 'sanjeronimo' },
    { nombre: 'the burguer box', alias: ['the burguer box', 'burguer box', 'burger box'], zona: 'sanjeronimo' },
    
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
    { nombre: '7 caldos', alias: ['7 caldos', 'siete caldos'], zona: 'aeropuerto' }
];

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

function esEsenciaDePedido(texto, msgReal) {
    const t = limpiarTexto(texto);

    // 1. SI ES UN MENSAJE DE TEXTO QUE SOLO DICE "YO" O SIMILAR -> IGNORAR DIRECTAMENTE
    const respuestasCompanerosExactas = ['yo', 'mio', 'ya voy', 'tomado', 'voy', 'ya lo tome', 'lo tengo', 'yo puedo'];
    if (respuestasCompanerosExactas.includes(t)) {
        return false;
    }

    // 2. SI EL MENSAJE CONTIENE UNA UBICACIÓN NATIVA DE WHATSAPP (Mapa directo)
    if (msgReal.locationMessage || msgReal.liveLocationMessage) {
        return true;
    }

    // 3. SI EL MENSAJE ES UNA IMAGEN O DOCUMENTO (Capturas, comprobantes o comandas)
    if (msgReal.imageMessage || msgReal.documentMessage) {
        // A) Respuestas directas de compañeros en caption -> Descartar
        const contieneRespCompanero = respuestasCompanerosExactas.some(r => t.includes(r));
        if (contieneRespCompanero) return false;

        // B) Indicadores fuertes de comprobante / voucher de pago bancario
        const palabrasPagoBancario = [
            'yape', 'yapeaste', 'plin', 'bcp', 'izipay', 'niubiz', 'pos',
            'constancia', 'voucher', 'transfiriendo', 'transferencia', 'operacion',
            'titular', 'debito', 'credito', 'banco'
        ];
        
        let puntosPago = 0;
        for (const p of palabrasPagoBancario) {
            if (t.includes(p)) puntosPago++;
        }

        const esPagoEvidente = [
            'constancia de pago', 'numero de operacion', 'codigo de operacion',
            'operacion exitosa', 'transferencia exitosa', 'pago exitoso',
            'pago realizado', 'pago recibido', 'monto transferido', 'pago con tarjeta',
            'comprobante electronico'
        ].some(p => t.includes(p));

        // Si el caption claramente indica que es un voucher/captura bancaria -> IGNORAR
        if (esPagoEvidente || puntosPago >= 2) {
            return false;
        }

        // C) Indicadores de comanda / ficha de delivery legítima
        const patronesComanda = [
            'cliente', 'direccion', 'referencia', 'pedido', 'llevar', 'delivery',
            'productos', 'orden', 'cuenta', 'total', 'cambio', 'efectivo', 'cobrar',
            'soles', 's/', 'motorizado', 'envio', 'maps', 'goo.gl', 'http'
        ];

        let puntosComanda = 0;
        for (const p of patronesComanda) {
            if (t.includes(p)) puntosComanda++;
        }

        const tieneTelefono = /\b9\d{8}\b/.test(t);

        // Si tiene caption con datos claros de comanda o teléfono de cliente -> PERMITIR
        if (puntosComanda >= 1 || tieneTelefono) {
            return true;
        }

        // D) Si no hay suficiente información en la imagen para asegurar que es un pedido -> IGNORAR
        return false;
    }

    // 4. SI ES TEXTO PLANO
    if (!t) return false;

    // Descartar charla o preguntas
    const frasesIgnoradas = [
        'cuanto sale', 'cuanto es', 'quien va', 'quien libre', 'a que hora', 
        'ya salio', 'gracias', 'ok', 'x2', 'buenas', 'hola'
    ];
    for (const f of frasesIgnoradas) {
        if (t.startsWith(f) || t === f) return false;
    }

    // Filtros de ficha técnica o pedido completo por texto
    const patronesClave = [
        'cliente', 'cuenta', 'total', 'metodo', 'comprobante', 'delivery', 
        'cobrar', 'cambio', 'efectivo', 'soles', 's/', 'motorizado',
        'necesito', 'envio', 'pedido', 'llevar', 'maps', 'goo.gl', 'http', 'yape', 'direccion', 'referencia'
    ];
    
    let coincidencias = 0;
    for (const p of patronesClave) {
        if (t.includes(p)) coincidencias++;
    }

    if (coincidencias >= 1 || /\b9\d{8}\b/.test(t)) {
        return true;
    }

    return false;
}


function detectarLocalPorZona(texto, zonaFiltro, nombreGrupo, msgReal) {
    if (!esEsenciaDePedido(texto, msgReal)) {
        return null;
    }

    const textoLimpio = limpiarTexto(texto);
    const grupoLimpio = limpiarTexto(nombreGrupo);

    const localesZona = modoTodos 
        ? LOCALES 
        : LOCALES.filter(l => l.zona === zonaFiltro);

    for (const local of localesZona) {
        const busquedas = [local.nombre, ...local.alias];

        for (const b of busquedas) {
            const bLimpio = limpiarTexto(b);
            if (!bLimpio) continue;

            // Prioriza si el texto menciona explícitamente la marca o si el mapa/captura viene del grupo
            if (textoLimpio.includes(bLimpio) || grupoLimpio.includes(bLimpio)) {
                return local;
            }
        }
    }
    return null;
}

// ==========================================
// 🚀 NÚCLEO PRINCIPAL
// ==========================================
async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_baileys_v3');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ['Radar Cusco V4.4', 'Safari', '3.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.clear();
            console.log('📱 Escanea este QR en WhatsApp Web:\n');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom) ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true;
            if (shouldReconnect) setTimeout(iniciarBot, 3000);
        } else if (connection === 'open') {
            console.clear();
            const zonaActivaNombre = modoTodos ? 'TODOS' : (ZONAS_CONFIG[zonaPrioritaria]?.nombre || 'ZONA');
            console.log('==============================================');
            console.log('✅ RADAR CUSCO - OPERATIVO');
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

            const textoBruto = extraerTextoMensaje(mensajeReal);
            const textoLimpio = limpiarTexto(textoBruto);

            // 1. COMANDOS PRIVADOS
            const esMiChatPrivado = !esGrupo && (deMi || jid.includes(MI_NUMERO_LIMPIO));

            if (esMiChatPrivado) {
                if (textoLimpio === 'wanchaq') {
                    zonaPrioritaria = 'wanchaq'; modoTodos = false; botActivo = true;
                    await sock.sendMessage(jid, { text: 'ire a wanchaq' });
                    continue;
                }
                else if (textoLimpio === 'sansebastian' || textoLimpio === 'sebas' || textoLimpio === 'cultura') {
                    zonaPrioritaria = 'sansebastian'; modoTodos = false; botActivo = true;
                    await sock.sendMessage(jid, { text: 'En sansebas' });
                    continue;
                }
                else if (textoLimpio === 'centro') {
                    zonaPrioritaria = 'centro'; modoTodos = false; botActivo = true;
                    await sock.sendMessage(jid, { text: 'camino al centro' });
                    continue;
                }
                else if (textoLimpio === 'sanjeronimo' || textoLimpio === 'larapa' || textoLimpio === 'jero') {
                    zonaPrioritaria = 'sanjeronimo'; modoTodos = false; botActivo = true;
                    await sock.sendMessage(jid, { text: ' Estoy bajando' });
                    continue;
                }
                else if (textoLimpio === 'aeropuerto' || textoLimpio === 'aero') {
                    zonaPrioritaria = 'aeropuerto'; modoTodos = false; botActivo = true;
                    await sock.sendMessage(jid, { text: 'camino para el aeropuerto' });
                    continue;
                }
                else if (textoLimpio === 'todos') {
                    modoTodos = true; botActivo = true;
                    await sock.sendMessage(jid, { text: 'estare por todos lados' });
                    continue;
                }
                else if (textoLimpio === 'ocupado' || textoLimpio === 'pausa') {
                    botActivo = false;
                    await sock.sendMessage(jid, { text: 'un breck' });
                    continue;
                }
                else if (textoLimpio === 'libre' || textoLimpio === 'activo') {
                    botActivo = true;
                    const nombreZonaConfirmacion = modoTodos ? 'estare por todos lados' : ZONAS_CONFIG[zonaPrioritaria]?.nombre;
                    await sock.sendMessage(jid, { text: `free en  ${nombreZonaConfirmacion}` });
                    continue;
                }
                else if (textoLimpio === 'estado' || textoLimpio === 'status') {
                    const zonaObj = modoTodos ? ZONAS_CONFIG['todos'] : (ZONAS_CONFIG[zonaPrioritaria] || ZONAS_CONFIG['todos']);
                    const estadoTexto = `📊 *ESTADO DEL RADAR*\n• Estado: ${botActivo ? 'Estoy volando' : 'un momento'}\n• Modo: ${modoTodos ? 'estare por todos lados' : 'solo en esta calle'}\n• Zona actual: ${zonaObj.icono} ${zonaObj.nombre}`;
                    await sock.sendMessage(jid, { text: estadoTexto });
                    continue;
                }
            }

            // 2. REGISTRAR SI ESCRIBES "YO" MANUALMENTE EN UN GRUPO
            if (esGrupo && deMi) {
                if (textoLimpio === 'yo' || textoLimpio.startsWith('yo ')) {
                    ultimasRespuestasYo.set(jid, ahora);
                }
                continue;
            }

            // 3. EVITAR RESPONDER A TUS PROPIOS MENSAJES O MENSAJES FUERA DE GRUPOS
            if (!botActivo || deMi || !esGrupo) continue;

            // 🔒 BLOQUEO INMEDIATO PREVIO
            if (bloqueosGrupo.get(jid)) continue;

            const ultimoEnvio = ultimasRespuestasYo.get(jid) || 0;
            if (ahora - ultimoEnvio < 180000) {
                continue;
            }

            // EVALUACIÓN Y RESPUESTA EN GRUPOS
            let nombreGrupo = nombresGruposCache.get(jid) || '';
            if (!nombreGrupo) {
                try {
                    const groupMeta = await sock.groupMetadata(jid);
                    nombreGrupo = groupMeta.subject || '';
                    nombresGruposCache.set(jid, nombreGrupo);
                } catch (e) {}
            }

            const localDetectado = detectarLocalPorZona(textoBruto, zonaPrioritaria, nombreGrupo, mensajeReal);

            if (localDetectado) {
                const emisor = msg.key.participant || jid;
                const claveEmisor = `${jid}_${emisor}`;
                
                // 🔍 ESTRUCTURA DEL MENSAJE ACTUAL
                const esUbicacion = Boolean(mensajeReal.locationMessage || mensajeReal.liveLocationMessage);
                const esTexto = Boolean(mensajeReal.conversation || mensajeReal.extendedTextMessage);

                // 🔍 REGISTRO PREVIO DEL EMISOR
                const registroPrevio = ultimasRespuestasYo.get(claveEmisor);

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
                bloqueosGrupo.set(jid, true);

                // Guardamos el tipo de mensaje y tiempo de este emisor
                ultimasRespuestasYo.set(jid, ahora);
                ultimasRespuestasYo.set(claveEmisor, {
                    timestamp: ahora,
                    esUbicacion: esUbicacion,
                    esTexto: esTexto
                });

                try {
                    await sock.sendMessage(jid, { text: 'Yo' });

                    const miJidDestino = MI_JID;
                    const textoZonaAviso = modoTodos ? 'TODOS' : (ZONAS_CONFIG[zonaPrioritaria]?.nombre || 'ZONA');
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

iniciarBot();
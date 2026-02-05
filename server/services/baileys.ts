import { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, WASocket } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import fs from 'fs';
import path from 'path';
import pino from 'pino';

// Define session storage path
const SESSIONS_DIR = path.resolve(process.cwd(), "server", "sessions");

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

interface ConnectionState {
    status: 'connecting' | 'connected' | 'disconnected' | 'qr_ready';
    qr?: string;
    socket?: WASocket;
}

// In-memory store for active connections
const connections: Map<number, ConnectionState> = new Map();

export const BaileysService = {
    async initializeSession(userId: number, onQrUpdate: (qr: string) => void, onStatusUpdate: (status: string) => void) {
        const sessionName = `session_${userId}`;
        const sessionPath = path.join(SESSIONS_DIR, sessionName);

        // Setup Auth State
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }) as any,
            printQRInTerminal: false,
            auth: state,
            browser: ["Imagine CRM", "Chrome", "10.0"],
            syncFullHistory: false, // Optimisation for VPS
        });

        // Update local state
        connections.set(userId, { status: 'connecting', socket: sock });
        onStatusUpdate('connecting');

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                connections.set(userId, { ...connections.get(userId)!, status: 'qr_ready', qr });
                onQrUpdate(qr);
                onStatusUpdate('qr_ready');
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

                connections.set(userId, { status: 'disconnected' });
                onStatusUpdate('disconnected');

                if (shouldReconnect) {
                    this.initializeSession(userId, onQrUpdate, onStatusUpdate);
                } else {
                    // Logged out - clear session
                    if (fs.existsSync(sessionPath)) {
                        fs.rmSync(sessionPath, { recursive: true, force: true });
                    }
                }
            } else if (connection === 'open') {
                connections.set(userId, { ...connections.get(userId)!, status: 'connected', qr: undefined });
                onStatusUpdate('connected');
            }
        });

        sock.ev.on('messages.upsert', async (m) => {
            console.log("Baileys: messages.upsert received", JSON.stringify(m, null, 2));

            // Sometimes type is 'append' or others, but 'notify' is standard for new messages.
            // Let's process if there are messages, regardless of strict type for now to debug.
            if (m.messages && m.messages.length > 0) {
                for (const msg of m.messages) {
                    console.log("Baileys: Processing message key", msg.key);

                    // Check if it's a message from another user (not us)
                    if (!msg.key.fromMe) {
                        console.log("Baileys: Handing over to MessageHandler");
                        // Import dynamically or use imported service
                        // We should import MessageHandler at top level if possible, but for now specific call:
                        try {
                            const { MessageHandler } = await import("./message-handler");
                            await MessageHandler.handleIncomingMessage(userId, msg);
                        } catch (e) {
                            console.error("Baileys: Error invoking MessageHandler", e);
                        }
                    } else {
                        console.log("Baileys: Ignoring own message");
                    }
                }
            }
        });

        return sock;
    },

    async disconnect(userId: number) {
        const conn = connections.get(userId);
        if (conn?.socket) {
            conn.socket.end(undefined);
            connections.delete(userId);

            // Cleanup session files
            const sessionName = `session_${userId}`;
            const sessionPath = path.join(SESSIONS_DIR, sessionName);
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
            }
        }
    },

    getStatus(userId: number) {
        return connections.get(userId)?.status || 'disconnected';
    },

    async sendMessage(userId: number, to: string, content: any) {
        const conn = connections.get(userId);
        if (!conn?.socket) throw new Error("WhatsApp connection not active");

        const jid = to.includes('@') ? to : `${to.replace('+', '')}@s.whatsapp.net`;
        return await conn.socket.sendMessage(jid, content);
    },

    async sendReadReceipt(userId: number, to: string, messageId: string, participant?: string) {
        const conn = connections.get(userId);
        if (!conn?.socket) return; // Silent fail if not connected

        const jid = to.includes('@') ? to : `${to.replace('+', '')}@s.whatsapp.net`;

        // Correct way to send read receipt in Baileys
        await conn.socket.readMessages([
            {
                remoteJid: jid,
                id: messageId,
                participant: participant // needed for groups, optional for DMs
            }
        ]);
    },

    getQr(userId: number) {
        return connections.get(userId)?.qr;
    }
};

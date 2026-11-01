// ZENO BOT V6 - TOKEN TEST + DISCORD LOGIN DEBUG
// Teste si ton token est valide avant de se connecter

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const https = require('https');

const TOKEN = (process.env.DISCORD_TOKEN || '').trim();
const PORT = process.env.PORT || 10000;
const JNKIE_API_KEY = (process.env.JNKIE_API_KEY || '').trim();
const JNKIE_SCRIPT_ID = (process.env.JNKIE_SCRIPT_ID || 'ZENOFINDER').trim();

console.log(`[ZENO] Starting... Token exists: ${!!TOKEN} length: ${TOKEN.length} trimmed: ${TOKEN.trim().length}`);
console.log(`[ZENO] First 10 chars: ${TOKEN.substring(0,10)}... Last 10: ...${TOKEN.slice(-10)}`);
console.log(`[JNKIE] Key exists: ${!!JNKIE_API_KEY} length: ${JNKIE_API_KEY.length} len 36? ${JNKIE_API_KEY.length}`);
console.log(`[JNKIE] Script ID: ${JNKIE_SCRIPT_ID}`);

if (!TOKEN) {
    console.log("[ERROR] DISCORD_TOKEN manquant dans Environment !");
}

// 1. TEST TOKEN VIA REST API DISCORD (méthode directe, pas websocket)
function testTokenREST(token) {
    return new Promise((resolve, reject) => {
        console.log("[TOKEN TEST] Testing token via REST API https://discord.com/api/v10/users/@me");
        const req = https.request({
            hostname: 'discord.com',
            path: '/api/v10/users/@me',
            method: 'GET',
            headers: { 'Authorization': `Bot ${token}` }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`[TOKEN TEST] Status: ${res.statusCode}`);
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(data);
                        console.log(`[TOKEN TEST] 200 OK - Token valide ! Bot: ${json.username}#${json.discriminator} ID: ${json.id}`);
                        resolve({ valid: true, bot: json });
                    } catch(e) {
                        console.log(`[TOKEN TEST] 200 OK mais JSON invalide: ${data.slice(0,200)}`);
                        resolve({ valid: true });
                    }
                } else if (res.statusCode === 401) {
                    console.log(`[TOKEN TEST] 401 Invalid token - Ton token est faux ou expiré ! Data: ${data.slice(0,300)}`);
                    console.log(`[TOKEN TEST] Va sur Discord Dev Portal > Bot > Reset Token et copie le nouveau`);
                    resolve({ valid: false, error: '401 Invalid token' });
                } else {
                    console.log(`[TOKEN TEST] Erreur ${res.statusCode}: ${data.slice(0,500)}`);
                    resolve({ valid: false, error: `${res.statusCode}: ${data.slice(0,200)}` });
                }
            });
        });
        req.on('error', (e) => {
            console.log(`[TOKEN TEST] Erreur réseau: ${e.message}`);
            resolve({ valid: false, error: e.message });
        });
        req.end();
    });
}

// 2. DISCORD CLIENT
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

let jnkieLinks = {}; // DiscordID -> RobloxName
let whitelist = new Set();
let blacklist = new Set();

// JNKIE SYNC
async function syncJNKIE() {
    if (!JNKIE_API_KEY) {
        console.log("[JNKIE] Pas de clé API, skip sync");
        return;
    }
    try {
        console.log(`[JNKIE] Sync avec script ${JNKIE_SCRIPT_ID}...`);
        // Utilise fetch si dispo, sinon https
        const fetch = require('node-fetch');
        const res = await fetch(`https://api.jnkie.com/v1/scripts/${JNKIE_SCRIPT_ID}/data`, {
            headers: { 'Authorization': `Bearer ${JNKIE_API_KEY}` }
        });
        if (!res.ok) {
            console.log(`[JNKIE] Sync failed ${res.status}: ${await res.text().then(t=>t.slice(0,300))}`);
            return;
        }
        const json = await res.json();
        // json est un tableau de {discordId, robloxUsername, ...}
        let count = 0;
        if (Array.isArray(json)) {
            json.forEach(entry => {
                if (entry.discordId && entry.robloxUsername) {
                    jnkieLinks[entry.discordId] = entry.robloxUsername;
                    count++;
                }
            });
        } else if (json.data && Array.isArray(json.data)) {
            json.data.forEach(entry => {
                if (entry.discordId && entry.robloxUsername) {
                    jnkieLinks[entry.discordId] = entry.robloxUsername;
                    count++;
                }
            });
        }
        console.log(`[JNKIE SYNC] Loaded ${count} liens. Ex: ${Object.entries(jnkieLinks).slice(0,2).map(([k,v])=>`${k} = ${v}`).join(', ')}`);
    } catch(e) {
        console.log(`[JNKIE] Erreur sync: ${e.message}`);
    }
}

client.on('ready', async () => {
    console.log(`[ZENO APP + JNKIE] Connecté en tant que ${client.user.tag} ID: ${client.user.id}`);
    await syncJNKIE();
    // Sync toutes les 5 min
    setInterval(syncJNKIE, 5*60*1000);
});

client.on('error', (e) => console.log(`[DISCORD ERROR] ${e.message}`));
client.on('shardError', (e) => console.log(`[SHARD ERROR] ${e.message}`));

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const content = message.content.trim();
    if (!content.startsWith('!')) return;

    const args = content.slice(1).split(/\s+/);
    const cmd = args.shift().toLowerCase();

    // !botinfo
    if (cmd === 'botinfo') {
        const embed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('ZENO APP Bot')
            .setDescription(`Online ✅\nWhitelist: ${whitelist.size}\nBlacklist: ${blacklist.size}\nJNKIE links: ${Object.keys(jnkieLinks).length}`)
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }

    // !check
    if (cmd === 'check') {
        const target = args[0];
        if (!target) return message.reply("Usage: !check <roblox ou @discord>");
        let robloxName = target;
        // Si mention discord, cherche via JNKIE
        const mentionMatch = target.match(/<@!?(\d+)>/);
        if (mentionMatch) {
            const discordId = mentionMatch[1];
            if (jnkieLinks[discordId]) {
                robloxName = jnkieLinks[discordId];
                message.reply(`Discord <@${discordId}> = Roblox **${robloxName}** (via JNKIE)`);
            } else {
                return message.reply(`Pas de lien JNKIE pour <@${discordId}>`);
            }
        }
        // check via ID direct
        if (jnkieLinks[target]) {
            robloxName = jnkieLinks[target];
        }
        const isWL = whitelist.has(robloxName.toLowerCase());
        const isBL = blacklist.has(robloxName.toLowerCase());
        const embed = new EmbedBuilder()
            .setColor(isBL ? 0xff0000 : isWL ? 0x00ff00 : 0x808080)
            .setTitle(`Check: ${robloxName}`)
            .setDescription(`${isWL ? '✅ Whitelisted' : ''} ${isBL ? '🚫 Blacklisted' : ''} ${!isWL && !isBL ? '❔ Not listed' : ''}`)
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }

    // !whitelist
    if (cmd === 'whitelist') {
        const robloxName = args[0];
        if (!robloxName) return message.reply("Usage: !whitelist <roblox> [reason] [@discord]");
        whitelist.add(robloxName.toLowerCase());
        blacklist.delete(robloxName.toLowerCase());
        const reason = args.slice(1).join(' ') || 'No reason';
        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('✅ Whitelisted')
            .setDescription(`**${robloxName}**\nReason: ${reason}\nTotal Whitelisted: ${whitelist.size}`)
            .setTimestamp();
        // Cherche channel whitelist
        const channel = message.guild.channels.cache.find(c => c.name.toLowerCase().includes('whitelist'));
        if (channel) await channel.send({ embeds: [embed] }).catch(()=>{});
        return message.reply({ embeds: [embed] });
    }

    // !blacklist
    if (cmd === 'blacklist') {
        let robloxName = args[0];
        if (!robloxName) return message.reply("Usage: !blacklist <roblox ou @discord> [reason]");
        // Si mention discord
        const mentionMatch = robloxName.match(/<@!?(\d+)>/);
        if (mentionMatch) {
            const discordId = mentionMatch[1];
            if (jnkieLinks[discordId]) {
                robloxName = jnkieLinks[discordId];
            } else {
                // Si pas trouvé, utilise l'ID comme nom temporaire mais log
                console.log(`[BLACKLIST] Pas de JNKIE link pour ${discordId}, utilisation ID comme nom`);
            }
        } else if (jnkieLinks[robloxName]) {
            robloxName = jnkieLinks[robloxName];
        }
        blacklist.add(robloxName.toLowerCase());
        whitelist.delete(robloxName.toLowerCase());
        const reason = args.slice(1).join(' ') || 'No reason';
        const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('🚫 Blacklisted')
            .setDescription(`**${robloxName}**\nReason: ${reason}\nTotal Blacklisted: ${blacklist.size}`)
            .setTimestamp();
        const channel = message.guild.channels.cache.find(c => c.name.toLowerCase().includes('blacklist') || c.name.toLowerCase().includes('griefer'));
        if (channel) await channel.send({ embeds: [embed] }).catch(()=>{});
        return message.reply({ embeds: [embed] });
    }
});

// LOGIN AVEC DEBUG
(async () => {
    if (!TOKEN) {
        console.log("[ZENO] Pas de token, API seulement");
    } else {
        console.log("[LOGIN] Attempting login with token length", TOKEN.length);
        const test = await testTokenREST(TOKEN);
        if (!test.valid) {
            console.log(`[LOGIN ERROR] Token invalide: ${test.error} - Reset ton token dans Discord Dev Portal`);
        } else {
            console.log("[LOGIN] Token OK, connecting via WebSocket...");
            client.login(TOKEN).then(() => {
                console.log("[LOGIN] login() promise resolved, en attente ready...");
            }).catch(e => {
                console.log(`[LOGIN ERROR] Failed to login: ${e.message}`);
                console.log(e.stack);
            });
        }
    }

    // API EXPRESS pour AJ check
    const app = express();
    app.get('/', (req, res) => {
        res.json({ 
            status: 'ZENO APP + JNKIE Online', 
            whitelist: whitelist.size, 
            blacklist: blacklist.size, 
            jnkie_links: Object.keys(jnkieLinks).length,
            discord: client.user ? `${client.user.tag} Online` : 'Offline',
            timestamp: new Date().toISOString()
        });
    });
    app.get('/check/:username', (req, res) => {
        const name = req.params.username.toLowerCase();
        res.json({
            username: req.params.username,
            whitelisted: whitelist.has(name),
            blacklisted: blacklist.has(name),
            jnkie: jnkieLinks[req.params.username] || jnkieLinks[name] || null
        });
    });
    app.get('/jnkie/:discordId', (req, res) => {
        const id = req.params.discordId;
        res.json({ discordId: id, roblox: jnkieLinks[id] || null });
    });
    app.listen(PORT, () => {
        console.log(`[API] Listening on port ${PORT} len ${JNKIE_API_KEY.length}`);
        console.log(`[API] https://zeno-app-bot.onrender.com`);
    });
})();
    

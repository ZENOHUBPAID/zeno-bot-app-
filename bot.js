// ZENO APP V9.7 - FIX 429 HARD BAN - 5 MIN BACKOFF + NEW TOKEN CHECK
// @MEMBER 1565109940757078108 - @ADMIN 1565109430880706570

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const fetch = require('node-fetch');

const TOKEN = (process.env.DISCORD_TOKEN || '').trim();
const PORT = process.env.PORT || 10000;

const MEMBER_ROLE_ID = '1565109940757078108';
const ADMIN_ROLE_ID = '1565109430880706570';

console.log(`[ZENO V9.7] Starting... Token length=${TOKEN.length} first=${TOKEN.slice(0,12)}...`);
console.log(`[ZENO V9.7] Time: ${new Date().toISOString()}`);

if (!TOKEN) {
    console.log("[FATAL] DISCORD_TOKEN vide ! Va dans Render Environment");
}

let client = null;
let attempt = 0;
let isConnected = false;

function hasAdminRole(member) {
    if (!member) return false;
    return member.permissions.has('Administrator') || member.roles.cache.has(ADMIN_ROLE_ID);
}

async function testToken() {
    try {
        const res = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { 'Authorization': `Bot ${TOKEN}` }
        });
        const text = await res.text();
        console.log(`[TOKEN TEST] Status ${res.status}`);
        
        if (res.status === 200) {
            const data = JSON.parse(text);
            console.log(`[TOKEN TEST] ✅ OK Bot=${data.username}#${data.discriminator} ID=${data.id}`);
            return { ok: true, data, retry: 0 };
        }
        if (res.status === 401) {
            console.log(`[TOKEN TEST] ❌ 401 Invalid token - Le token est mort, reset dans Discord Dev Portal`);
            console.log(`[TOKEN TEST] Body: ${text.slice(0,200)}`);
            return { ok: false, retry: 300000, reason: 'invalid' };
        }
        if (res.status === 429) {
            const json = JSON.parse(text);
            const retry = json.retry_after || 60000;
            console.log(`[TOKEN TEST] ❌ 429 Rate limit - retry_after ${retry}ms - IP ban Render`);
            console.log(`[TOKEN TEST] C'est l'IP Render qui est ban, pas ton token. Attente ${Math.ceil(retry/1000)}s puis retry`);
            return { ok: false, retry: Math.max(retry, 300000), reason: 'rate' }; // min 5 min
        }
        console.log(`[TOKEN TEST] Status ${res.status} Body: ${text.slice(0,200)}`);
        return { ok: false, retry: 120000, reason: 'other' };
    } catch(e) {
        console.log(`[TOKEN TEST] Erreur fetch: ${e.message}`);
        return { ok: false, retry: 120000, reason: 'error' };
    }
}

async function tryLogin() {
    if (isConnected) return;
    attempt++;
    console.log(`\n[ZENO V9.7] Try login #${attempt} - ${new Date().toLocaleTimeString()} - Token length ${TOKEN.length}`);
    
    const test = await testToken();
    
    if (!test.ok) {
        if (test.reason === 'invalid') {
            console.log(`[ANTI 429] Token invalide, reset obligatoire. Ne retry pas.`);
            console.log(`[FIX] Va sur https://discord.com/developers/applications -> Bot -> Reset Token -> copie dans Render ENV`);
            setTimeout(tryLogin, 300000); // retry dans 5 min au cas où tu changes token
            return;
        }
        console.log(`[ANTI 429] Re-retry dans ${Math.ceil(test.retry/1000)} sec... Laisse le bot allumé, il va se connecter tout seul 🟢 - Attempt ${attempt}`);
        setTimeout(tryLogin, test.retry);
        return;
    }

    // Token OK, login discord.js
    console.log(`[START] Token OK, login Discord.js...`);
    
    client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
    });

    client.on('ready', () => {
        isConnected = true;
        console.log(`[ZENO V9.7] ✅ Connecté en tant que ${client.user.tag} - ONLINE 🟢`);
        console.log(`[ZENO V9.7] ID: ${client.user.id}`);
        console.log(`[CONFIG] MEMBER=${MEMBER_ROLE_ID} ADMIN=${ADMIN_ROLE_ID}`);
    });

    client.on('error', e => console.log(`[DISCORD ERROR] ${e.message}`));

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith('!')) return;
        console.log(`[CMD] ${message.author.tag}: ${message.content}`);
        const args = message.content.slice(1).trim().split(/\s+/);
        const cmd = args.shift().toLowerCase();

        if (cmd === 'logsdown' || cmd === 'logs_down') {
            if (!hasAdminRole(message.member)) return message.reply(`❌ Seul <@&${ADMIN_ROLE_ID}> peut faire cette commande`).catch(()=>{});
            const guild = message.guild;
            const channel = guild.channels.cache.find(c => c.name.toLowerCase().includes('update-logs')) || guild.channels.cache.find(c => c.name.toLowerCase().includes('update'));
            if (!channel) return message.reply("❌ Salon #update-logs pas trouvé").catch(()=>{});
            const memberMention = `<@&${MEMBER_ROLE_ID}>`;
            const embed = new EmbedBuilder().setColor(0xff0000).setTitle('⚠️ Logs Down').setDescription('**Logs are down. Slots are paused — timers are frozen.**\n\nLes bots sont en pause, les timers sont figés.').setTimestamp();
            await channel.send({ content: `${memberMention}\nLogs are down. Slots are paused — timers are frozen.`, embeds: [embed], allowedMentions: { roles: [MEMBER_ROLE_ID] } }).catch(e=>console.log(e.message));
            return message.reply(`✅ Logs Down envoyé avec <@&${MEMBER_ROLE_ID}>`).catch(()=>{});
        }
        if (cmd === 'logsback' || cmd === 'logs_up' || cmd === 'botsup') {
            if (!hasAdminRole(message.member)) return message.reply(`❌ Seul <@&${ADMIN_ROLE_ID}> peut`).catch(()=>{});
            const guild = message.guild;
            const channel = guild.channels.cache.find(c => c.name.toLowerCase().includes('update-logs')) || guild.channels.cache.find(c => c.name.toLowerCase().includes('update'));
            if (!channel) return;
            const memberMention = `<@&${MEMBER_ROLE_ID}>`;
            const embed = new EmbedBuilder().setColor(0x00ff00).setTitle('✅ Bots Back Up').setDescription('**Bots are back up. Slots unpaused - timers unfreezed.**').setTimestamp();
            await channel.send({ content: `${memberMention}\nBots are back up. Slots unpaused - timers unfreezed.`, embeds: [embed], allowedMentions: { roles: [MEMBER_ROLE_ID] } }).catch(()=>{});
            return message.reply(`✅ Bots Back Up envoyé`).catch(()=>{});
        }
        if (cmd === 'botinfo') {
            const embed = new EmbedBuilder().setColor(isConnected ? 0x00ff00 : 0xff0000).setTitle('ZENO APP V9.7').setDescription(`Status: ${isConnected ? '🟢 Online' : '🔴 Offline'}\n@MEMBER: <@&${MEMBER_ROLE_ID}>\n@ADMIN: <@&${ADMIN_ROLE_ID}>\n\n!logsdown / !logsback (ADMIN only)`).setTimestamp();
            return message.reply({ embeds: [embed], allowedMentions: { roles: [MEMBER_ROLE_ID, ADMIN_ROLE_ID] } }).catch(()=>{});
        }
    });

    client.login(TOKEN).then(()=>console.log("[LOGIN] Login OK, attente ready...")).catch(e=>{
        console.log(`[LOGIN ERROR] ${e.message}`);
        if (e.message.includes('429') || e.code === 429) {
            console.log(`[LOGIN ERROR] 429 -> retry dans 5 min`);
            setTimeout(tryLogin, 300000);
        } else if (e.message.includes('invalid') || e.message.includes('TOKEN_INVALID')) {
            console.log(`[LOGIN ERROR] Token invalide -> reset token`);
            setTimeout(tryLogin, 300000);
        } else {
            setTimeout(tryLogin, 120000);
        }
    });
}

// Start
tryLogin();

const app = express();
app.get('/', (req, res) => res.json({ 
    status: isConnected ? `Online ${client?.user?.tag}` : `Waiting - Attempt ${attempt} - 429 anti ban 5min`, 
    attempt, 
    isConnected,
    memberRole: MEMBER_ROLE_ID, 
    adminRole: ADMIN_ROLE_ID,
    tokenLength: TOKEN.length,
    time: new Date().toISOString()
}));
app.listen(PORT, () => console.log(`[API] Port ${PORT} - https://zeno-app-bot.onrender.com`));

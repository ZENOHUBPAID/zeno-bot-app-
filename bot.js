// ZENO APP V9.6 - AUTO RETRY 429 + @MEMBER 1565109940757078108 + @ADMIN 1565109430880706570
const Discord = require('discord.js');
const express = require('express');
const fetch = require('node-fetch');

const TOKEN = (process.env.DISCORD_TOKEN || '').trim();
const PORT = process.env.PORT || 10000;
const MEMBER_ROLE_ID = '1565109940757078108';
const ADMIN_ROLE_ID = '1565109430880706570';

console.log('[ZENO V9.6] Starting... Token length=' + TOKEN.length);

const client = new Discord.Client({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.MessageContent,
        Discord.GatewayIntentBits.GuildMembers
    ]
});

let slotsPaused = false;
let loginAttempts = 0;

function hasAdmin(member) {
    if (!member) return false;
    if (member.permissions.has('Administrator')) return true;
    if (member.roles.cache.has(ADMIN_ROLE_ID)) return true;
    return false;
}

async function sendLogs(isDown) {
    const guild = client.guilds.cache.first();
    if (!guild) return;
    let channel = guild.channels.cache.find(c => c.name.includes('update-logs'));
    if (!channel) channel = guild.channels.cache.find(c => c.name.includes('update'));
    if (!channel) return console.log('[LOGS] No channel');
    const mention = '<@&' + MEMBER_ROLE_ID + '>';
    let content, embed;
    if (isDown) {
        content = mention + '\nLogs are down. Slots are paused — timers are frozen.';
        embed = new Discord.EmbedBuilder().setColor(0xff0000).setTitle('⚠️ Logs Down').setDescription('**Logs are down. Slots are paused — timers are frozen.**').setTimestamp();
        slotsPaused = true;
    } else {
        content = mention + '\nBots are back up. Slots unpaused - timers unfreezed.';
        embed = new Discord.EmbedBuilder().setColor(0x00ff00).setTitle('✅ Bots Back Up').setDescription('**Bots are back up. Slots unpaused - timers unfreezed.**').setTimestamp();
        slotsPaused = false;
    }
    try {
        await channel.send({ content: content, embeds: [embed], allowedMentions: { roles: [MEMBER_ROLE_ID] } });
        console.log('[LOGS] Sent ' + (isDown ? 'DOWN' : 'UP'));
    } catch (e) { console.log('[LOGS] Error ' + e.message); }
}

client.on('ready', () => {
    console.log('[ZENO V9.6] Connecté en tant que ' + client.user.tag + ' - ONLINE 🟢');
    console.log('[CONFIG] MEMBER=' + MEMBER_ROLE_ID + ' ADMIN=' + ADMIN_ROLE_ID);
});

client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    if (!msg.content.startsWith('!')) return;
    const cmd = msg.content.slice(1).trim().split(/\s+/)[0].toLowerCase();
    if (cmd === 'logsdown' || cmd === 'logs_down') {
        if (!hasAdmin(msg.member)) return msg.reply('❌ Seul <@&' + ADMIN_ROLE_ID + '> peut');
        await sendLogs(true);
        return msg.reply('✅ Logs Down avec <@&' + MEMBER_ROLE_ID + '>').catch(()=>{});
    }
    if (cmd === 'logsback' || cmd === 'botsup' || cmd === 'backup') {
        if (!hasAdmin(msg.member)) return msg.reply('❌ Seul <@&' + ADMIN_ROLE_ID + '> peut');
        await sendLogs(false);
        return msg.reply('✅ Back Up avec <@&' + MEMBER_ROLE_ID + '>').catch(()=>{});
    }
    if (cmd === 'botinfo') {
        const embed = new Discord.EmbedBuilder().setColor(0x00ff00).setTitle('ZENO APP V9.6 AUTO-RETRY').setDescription('🟢 Online\n@MEMBER: <@&' + MEMBER_ROLE_ID + '>\n@ADMIN: <@&' + ADMIN_ROLE_ID + '>\n\n!logsdown\n!logsback\n!botinfo').setTimestamp();
        return msg.reply({ embeds: [embed], allowedMentions: { roles: [MEMBER_ROLE_ID, ADMIN_ROLE_ID] } }).catch(()=>{});
    }
});

async function tryLogin() {
    loginAttempts++;
    console.log('[ZENO V9.6] Try login #' + loginAttempts + ' - Token length ' + TOKEN.length);
    try {
        const res = await fetch('https://discord.com/api/v10/users/@me', { headers: { 'Authorization': 'Bot ' + TOKEN } });
        console.log('[TOKEN TEST] Status ' + res.status);
        if (res.status === 200) {
            const data = await res.json();
            console.log('[TOKEN TEST] ✅ OK Bot=' + data.username);
            await client.login(TOKEN);
            console.log('[LOGIN] Login sent, waiting ready...');
            return;
        } else if (res.status === 429) {
            const body = await res.json().catch(() => ({}));
            const retryAfter = body.retry_after || 30000;
            console.log('[TOKEN TEST] 429 Rate limit - retry_after ' + retryAfter + 'ms - Attempt ' + loginAttempts);
            console.log('[ANTI 429] Re-retry dans ' + Math.ceil(retryAfter/1000) + ' sec... Laisse le bot allumé, il va se connecter tout seul 🟢');
            setTimeout(tryLogin, retryAfter + 2000);
            return;
        } else if (res.status === 401) {
            console.log('[TOKEN TEST] 401 Invalid token - Reset token sur Discord Dev Portal puis Render Environment');
            return;
        } else {
            const txt = await res.text();
            console.log('[TOKEN TEST] Status ' + res.status + ' ' + txt.slice(0,200));
            console.log('[LOGIN] Tentative quand meme...');
            await client.login(TOKEN);
        }
    } catch (e) {
        console.log('[LOGIN ERROR] ' + e.message + ' - Retry dans 30 sec');
        setTimeout(tryLogin, 30000);
    }
}

tryLogin();

const app = express();
app.get('/', (req, res) => res.json({ status: client.user ? 'Online ' + client.user.tag : 'Retrying login - 429 auto-retry', attempts: loginAttempts, ready: !!client.user }));
app.listen(PORT, () => console.log('[API] Port ' + PORT));

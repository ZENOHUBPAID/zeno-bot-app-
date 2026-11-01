// ZENO APP V9.5 - FIX SYNTAX + @MEMBER 1565109940757078108 + @ADMIN 1565109430880706570
const Discord = require('discord.js');
const express = require('express');
const fetch = require('node-fetch');

const TOKEN = (process.env.DISCORD_TOKEN || '').trim();
const PORT = process.env.PORT || 10000;
const MEMBER_ROLE_ID = '1565109940757078108';
const ADMIN_ROLE_ID = '1565109430880706570';

console.log('[ZENO V9.5] Starting... Token length=' + TOKEN.length);

const client = new Discord.Client({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.MessageContent,
        Discord.GatewayIntentBits.GuildMembers
    ]
});

let slotsPaused = false;

function hasAdmin(member) {
    if (!member) return false;
    if (member.permissions.has('Administrator')) return true;
    if (member.roles.cache.has(ADMIN_ROLE_ID)) return true;
    return false;
}

async function sendLogs(isDown) {
    const guild = client.guilds.cache.first();
    if (!guild) {
        console.log('[LOGS] No guild');
        return;
    }
    let channel = guild.channels.cache.find(c => c.name.includes('update-logs'));
    if (!channel) channel = guild.channels.cache.find(c => c.name.includes('update'));
    if (!channel) {
        console.log('[LOGS] No update-logs channel found');
        console.log('[LOGS] Channels: ' + guild.channels.cache.map(c => c.name).join(', '));
        return;
    }
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
        console.log('[LOGS] Sent ' + (isDown ? 'DOWN' : 'UP') + ' in #' + channel.name);
    } catch (e) {
        console.log('[LOGS] Error: ' + e.message);
    }
}

client.on('ready', () => {
    console.log('[ZENO V9.5] Connecté en tant que ' + client.user.tag + ' - ONLINE 🟢');
    console.log('[CONFIG] MEMBER=' + MEMBER_ROLE_ID + ' ADMIN=' + ADMIN_ROLE_ID);
});

client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    if (!msg.content.startsWith('!')) return;
    const args = msg.content.slice(1).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();
    console.log('[CMD] ' + msg.author.tag + ': ' + msg.content);

    if (cmd === 'logsdown' || cmd === 'logs_down') {
        if (!hasAdmin(msg.member)) return msg.reply('❌ Seul <@&' + ADMIN_ROLE_ID + '> peut faire cette commande');
        await sendLogs(true);
        return msg.reply('✅ Logs Down envoyé avec <@&' + MEMBER_ROLE_ID + '>').catch(() => {});
    }
    if (cmd === 'logsback' || cmd === 'logs_up' || cmd === 'botsup' || cmd === 'backup') {
        if (!hasAdmin(msg.member)) return msg.reply('❌ Seul <@&' + ADMIN_ROLE_ID + '> peut faire cette commande');
        await sendLogs(false);
        return msg.reply('✅ Bots Back Up envoyé avec <@&' + MEMBER_ROLE_ID + '>').catch(() => {});
    }
    if (cmd === 'botinfo') {
        const embed = new Discord.EmbedBuilder()
            .setColor(slotsPaused ? 0xff0000 : 0x00ff00)
            .setTitle('ZENO APP V9.5')
            .setDescription('Status: ' + (slotsPaused ? '🔴 Down' : '🟢 Online') + '\n@MEMBER: <@&' + MEMBER_ROLE_ID + '>\n@ADMIN: <@&' + ADMIN_ROLE_ID + '>\n\n!logsdown - Down + freeze\n!logsback - Up + unfreeze\n!botinfo')
            .setTimestamp();
        return msg.reply({ embeds: [embed], allowedMentions: { roles: [MEMBER_ROLE_ID, ADMIN_ROLE_ID] } }).catch(() => {});
    }
});

console.log('[ZENO V9.5] Testing token...');
fetch('https://discord.com/api/v10/users/@me', { headers: { 'Authorization': 'Bot ' + TOKEN } })
    .then(r => {
        console.log('[TOKEN TEST] Status ' + r.status);
        if (r.status === 200) {
            r.json().then(d => {
                console.log('[TOKEN TEST] OK Bot=' + d.username + ' ID=' + d.id);
                client.login(TOKEN).then(() => console.log('[LOGIN] Login OK')).catch(e => console.log('[LOGIN ERROR] ' + e.message));
            });
        } else if (r.status === 401) {
            console.log('[TOKEN TEST] 401 Invalid token - Reset token sur Discord Dev Portal');
        } else if (r.status === 429) {
            console.log('[TOKEN TEST] 429 Rate limit - Attends 15 min sans deploy');
        } else {
            r.text().then(t => console.log('[TOKEN TEST] Error ' + t));
            client.login(TOKEN).then(() => console.log('[LOGIN] Login OK')).catch(e => console.log('[LOGIN ERROR] ' + e.message));
        }
    })
    .catch(e => {
        console.log('[TOKEN TEST] Fetch error ' + e.message);
        client.login(TOKEN).then(() => console.log('[LOGIN] Login OK')).catch(err => console.log('[LOGIN ERROR] ' + err.message));
    });

const app = express();
app.get('/', (req, res) => {
    res.json({ status: client.user ? 'Online ' + client.user.tag : 'Starting', ready: !!client.user, tokenLength: TOKEN.length });
});
app.listen(PORT, () => console.log('[API] Port ' + PORT));
                

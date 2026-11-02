// ZENO APP NEW V10 - AVEC JNKIE FREEZE REAL
// @MEMBER 1565109940757078108 - @ADMIN 1565109430880706570
// Freeze timers Jnkie pour vrai via API

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const fetch = require('node-fetch');

const TOKEN = (process.env.DISCORD_TOKEN || '').trim();
const PORT = process.env.PORT || 10000;
const JNKIE_API_KEY = (process.env.JNKIE_API_KEY || '').trim();
const JNKIE_SCRIPT_ID = (process.env.JNKIE_SCRIPT_ID || 'ZENOFINDER').trim();

const MEMBER_ROLE_ID = '1565109940757078108';
const ADMIN_ROLE_ID = '1565109430880706570';

if (!TOKEN) {
    console.error("[FATAL] DISCORD_TOKEN vide");
    process.exit(1);
}

console.log(`[ZENO NEW V10] Starting... Token=${TOKEN.length} JnkieKey=${JNKIE_API_KEY ? JNKIE_API_KEY.length+' chars OK' : 'VIDE - Mets JNKIE_API_KEY dans Render'}`);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

function isAdmin(member) {
    if (!member) return false;
    return member.permissions.has('Administrator') || member.roles.cache.has(ADMIN_ROLE_ID);
}

async function freezeTimersJNKIE(freeze = true) {
    if (!JNKIE_API_KEY) {
        console.log("[JNKIE] Pas de JNKIE_API_KEY dans Render ENV, skip freeze");
        return false;
    }
    try {
        const action = freeze ? 'pause' : 'resume';
        const url = `https://api.jnkie.com/v1/scripts/${JNKIE_SCRIPT_ID}/${action}`;
        console.log(`[JNKIE] ${freeze ? 'FREEZE' : 'UNFREEZE'} -> ${url}`);
        
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${JNKIE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const text = await res.text();
        console.log(`[JNKIE] Response ${res.status}: ${text.slice(0,200)}`);
        
        if (res.status === 200 || res.status === 204) {
            console.log(`[JNKIE] ✅ ${freeze ? 'Timers figés pour vrai !' : 'Timers relancés !'}`);
            return true;
        } else {
            console.log(`[JNKIE] ❌ Erreur ${res.status}, vérifie API Key et SCRIPT_ID`);
            return false;
        }
    } catch(e) {
        console.log(`[JNKIE] Erreur: ${e.message}`);
        return false;
    }
}

async function sendLogsDown(guild) {
    const channel = guild.channels.cache.find(c => c.name.includes('update-logs')) || guild.channels.cache.find(c => c.name.includes('update'));
    if (!channel) {
        console.log("[LOGS] Salon update-logs pas trouvé");
        return { sent: false, freezed: false };
    }
    const mention = `<@&${MEMBER_ROLE_ID}>`;
    const freezed = await freezeTimersJNKIE(true);
    
    const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('⚠️ Logs Down - Slots Paused')
        .setDescription(`**Logs are down. Slots are paused — timers are frozen.**\n\nLes bots de logs sont en panne.\n\n${freezed ? '✅ **Timers Jnkie figés pour vrai** - Vous ne perdez pas de jours.' : '⚠️ **Message envoyé mais timers pas figés** - Ajoute JNKIE_API_KEY dans Render.'}\n\n@MEMBER ne perd pas de temps d'abonnement.`)
        .setTimestamp()
        .setFooter({ text: freezed ? 'ZENO - Timers Frozen via Jnkie API' : 'ZENO - Manual freeze needed' });

    await channel.send({
        content: `${mention}\nLogs are down. Slots are paused — timers are frozen.`,
        embeds: [embed],
        allowedMentions: { roles: [MEMBER_ROLE_ID] }
    });
    console.log(`[LOGS] DOWN envoyé + freeze=${freezed}`);
    return { sent: true, freezed };
}

async function sendLogsBack(guild) {
    const channel = guild.channels.cache.find(c => c.name.includes('update-logs')) || guild.channels.cache.find(c => c.name.includes('update'));
    if (!channel) return { sent: false, freezed: false };
    const mention = `<@&${MEMBER_ROLE_ID}>`;
    const unfreezed = await freezeTimersJNKIE(false);
    
    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Bots Back Up - Slots Unpaused')
        .setDescription(`**Bots are back up. Slots unpaused - timers unfreezed.**\n\nLes bots sont de retour !\n\n${unfreezed ? '✅ **Timers Jnkie relancés pour vrai**.' : '⚠️ **Message envoyé mais timers pas relancés**.'}`)
        .setTimestamp()
        .setFooter({ text: unfreezed ? 'ZENO - Timers Unfreezed via Jnkie' : 'ZENO - Manual unfreeze needed' });

    await channel.send({
        content: `${mention}\nBots are back up. Slots unpaused - timers unfreezed.`,
        embeds: [embed],
        allowedMentions: { roles: [MEMBER_ROLE_ID] }
    });
    console.log(`[LOGS] UP envoyé + unfreeze=${unfreezed}`);
    return { sent: true, freezed: unfreezed };
}

client.once('ready', () => {
    console.log(`[ZENO NEW V10] ✅ Connecté en tant que ${client.user.tag} - ONLINE 🟢`);
    console.log(`[ZENO NEW V10] Jnkie: ${JNKIE_API_KEY ? 'OK' : 'MANQUE JNKIE_API_KEY'} Script=${JNKIE_SCRIPT_ID}`);
    console.log(`[CONFIG] MEMBER=${MEMBER_ROLE_ID} ADMIN=${ADMIN_ROLE_ID}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();

    console.log(`[CMD] ${message.author.tag}: ${message.content}`);

    if (cmd === 'logsdown' || cmd === 'logs_down') {
        if (!isAdmin(message.member)) return message.reply(`❌ Seul <@&${ADMIN_ROLE_ID}> peut faire cette commande`).catch(()=>{});
        const result = await sendLogsDown(message.guild);
        if (!result.sent) return message.reply("❌ Salon #update-logs pas trouvé").catch(()=>{});
        return message.reply(result.freezed 
            ? `✅ Logs Down envoyé avec <@&${MEMBER_ROLE_ID}> + **timers figés pour vrai via Jnkie** 🧊` 
            : `⚠️ Logs Down envoyé avec <@&${MEMBER_ROLE_ID}> mais **timers PAS figés** - Ajoute JNKIE_API_KEY dans Render Environment`).catch(()=>{});
    }

    if (cmd === 'logsback' || cmd === 'logs_up' || cmd === 'botsup' || cmd === 'backup') {
        if (!isAdmin(message.member)) return message.reply(`❌ Seul <@&${ADMIN_ROLE_ID}> peut`).catch(()=>{});
        const result = await sendLogsBack(message.guild);
        if (!result.sent) return message.reply("❌ Salon pas trouvé").catch(()=>{});
        return message.reply(result.freezed 
            ? `✅ Bots Back Up envoyé avec <@&${MEMBER_ROLE_ID}> + **timers relancés pour vrai** ✅` 
            : `⚠️ Bots Back Up envoyé mais **timers PAS relancés**`).catch(()=>{});
    }

    if (cmd === 'botinfo' || cmd === 'info') {
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('ZENO APP NEW V10 - JNKIE FREEZE')
            .setDescription(`**Status:** 🟢 Online\n**Bot:** ${client.user.tag}\n**Jnkie:** ${JNKIE_API_KEY ? `✅ Connecté (${JNKIE_SCRIPT_ID})` : '❌ Pas de JNKIE_API_KEY dans Render'}\n\n**@MEMBER:** <@&${MEMBER_ROLE_ID}>\n**@ADMIN:** <@&${ADMIN_ROLE_ID}>\n\n**Commandes ADMIN:**\n\`!logsdown\` - Logs down + **freeze timers Jnkie pour vrai**\n\`!logsback\` - Bots back up + **unfreeze timers Jnkie**\n\`!botinfo\``)
            .setTimestamp();
        return message.reply({ embeds: [embed], allowedMentions: { roles: [MEMBER_ROLE_ID, ADMIN_ROLE_ID] } }).catch(()=>{});
    }
});

client.login(TOKEN).then(()=>console.log("[LOGIN] OK")).catch(e=>console.error(`[LOGIN ERROR] ${e.message}`));

const app = express();
app.get('/', (req, res) => res.json({
    status: client.user ? `Online ${client.user.tag} 🟢` : 'Starting...',
    jnkie: JNKIE_API_KEY ? `Connected ${JNKIE_SCRIPT_ID}` : 'Missing JNKIE_API_KEY',
    memberRole: MEMBER_ROLE_ID,
    adminRole: ADMIN_ROLE_ID
}));
app.listen(PORT, () => console.log(`[API] Port ${PORT}`));

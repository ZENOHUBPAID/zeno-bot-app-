// ZENO APP V9.3 - LOGFIX + @MEMBER 1565109940757078108 + @ADMIN 1565109430880706570
// Fix: affiche l'erreur de login dans les logs Render

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const fetch = require('node-fetch');

const TOKEN = (process.env.DISCORD_TOKEN || '').trim();
const PORT = process.env.PORT || 10000;
const JNKIE_API_KEY = (process.env.JNKIE_API_KEY || '').trim();
const JNKIE_SCRIPT_ID = (process.env.JNKIE_SCRIPT_ID || 'ZENOFINDER').trim();

const MEMBER_ROLE_ID = '1565109940757078108';
const ADMIN_ROLE_ID = '1565109430880706570';

console.log(`[ZENO APP V9.3] Tentative login... Token length=${TOKEN.length} first=${TOKEN.slice(0,10)}...`);
if (!TOKEN) console.log("[ERREUR CRITIQUE] DISCORD_TOKEN vide dans Render Environment !");

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

let slotsPaused = false;

function hasAdminRole(member) {
    if (!member) return false;
    const has = member.permissions.has('Administrator') || member.roles.cache.has(ADMIN_ROLE_ID);
    console.log(`[PERM] ${member.user.tag} Admin=${member.permissions.has('Administrator')} HasRoleAdmin=${member.roles.cache.has(ADMIN_ROLE_ID)} -> ${has}`);
    return has;
}

async function freezeTimersJNKIE(freeze = true) {
    if (!JNKIE_API_KEY) {
        console.log("[JNKIE] Pas de JNKIE_API_KEY, skip freeze");
        return false;
    }
    try {
        const url = `https://api.jnkie.com/v1/scripts/${JNKIE_SCRIPT_ID}/${freeze ? 'pause' : 'resume'}`;
        const res = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${JNKIE_API_KEY}`, 'Content-Type': 'application/json' } });
        console.log(`[JNKIE] ${freeze ? 'FREEZE' : 'UNFREEZE'} -> ${res.status}`);
        return true;
    } catch(e) {
        console.log(`[JNKIE] Erreur: ${e.message}`);
        return false;
    }
}

async function sendUpdateLogs(isDown) {
    const guild = client.guilds.cache.first();
    if (!guild) {
        console.log("[UPDATE-LOGS] Pas de serveur trouvé");
        return;
    }
    console.log(`[UPDATE-LOGS] Serveur: ${guild.name} - Roles: ${guild.roles.cache.size}`);

    let channel = guild.channels.cache.find(c => c.name.toLowerCase().includes('update-logs'));
    if (!channel) channel = guild.channels.cache.find(c => c.name.toLowerCase().includes('update'));
    if (!channel) {
        console.log("[UPDATE-LOGS] Aucun salon update-logs trouvé");
        console.log(`[UPDATE-LOGS] Salons dispo: ${guild.channels.cache.map(c=>c.name).join(', ')}`);
        return;
    }

    const memberMention = `<@&${MEMBER_ROLE_ID}>`;

    let content, embed;
    if (isDown) {
        content = `${memberMention}\nLogs are down. Slots are paused — timers are frozen.`;
        embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('⚠️ Logs Down')
            .setDescription('**Logs are down. Slots are paused — timers are frozen.**\n\nLes bots sont en pause, les timers sont figés pour tous les membres.\n@MEMBER ne perd pas de jours.')
            .setTimestamp()
            .setFooter({ text: 'ZENO NOTIFIER - Slots Paused' });
        slotsPaused = true;
        await freezeTimersJNKIE(true);
    } else {
        content = `${memberMention}\nBots are back up. Slots unpaused - timers unfreezed.`;
        embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('✅ Bots Back Up')
            .setDescription('**Bots are back up. Slots unpaused - timers unfreezed.**\n\nLes bots sont de retour, les timers sont relancés !')
            .setTimestamp()
            .setFooter({ text: 'ZENO NOTIFIER - Slots Unpaused' });
        slotsPaused = false;
        await freezeTimersJNKIE(false);
    }

    try {
        await channel.send({ 
            content, 
            embeds: [embed],
            allowedMentions: { roles: [MEMBER_ROLE_ID] }
        });
        console.log(`[UPDATE-LOGS] Message ${isDown ? 'DOWN' : 'UP'} envoyé avec <@&${MEMBER_ROLE_ID}> dans #${channel.name}`);
    } catch(e) {
        console.log(`[UPDATE-LOGS] Erreur envoi: ${e.message}`);
    }
}

client.on('ready', () => {
    console.log(`[ZENO APP V9.3] Connecté en tant que ${client.user.tag} - ONLINE 🟢`);
    console.log(`[ZENO APP V9.3] ID: ${client.user.id}`);
    console.log(`[CONFIG] @MEMBER ID: ${MEMBER_ROLE_ID} - @ADMIN ID: ${ADMIN_ROLE_ID}`);
    console.log(`[SERVERS] ${client.guilds.cache.map(g=>`${g.name} (${g.id})`).join(', ')}`);
});

client.on('error', (e) => console.log(`[DISCORD ERROR] ${e.message}`));
client.on('shardError', (e) => console.log(`[SHARD ERROR] ${e.message}`));

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;
    
    console.log(`[CMD] ${message.author.tag}: ${message.content}`);
    
    const args = message.content.slice(1).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();

    if (cmd === 'logsdown' || cmd === 'logs_down') {
        if (!hasAdminRole(message.member)) return message.reply(`❌ Seul <@&${ADMIN_ROLE_ID}> peut faire cette commande`);
        await sendUpdateLogs(true);
        return message.reply(`✅ Message Logs Down envoyé avec <@&${MEMBER_ROLE_ID}> + timers frozen`).catch(()=>{});
    }
    
    if (cmd === 'logsback' || cmd === 'logs_up' || cmd === 'botsup' || cmd === 'backup') {
        if (!hasAdminRole(message.member)) return message.reply(`❌ Seul <@&${ADMIN_ROLE_ID}> peut faire cette commande`);
        await sendUpdateLogs(false);
        return message.reply(`✅ Message Bots Back Up envoyé avec <@&${MEMBER_ROLE_ID}> + timers unfreezed`).catch(()=>{});
    }

    if (cmd === 'botinfo') {
        const embed = new EmbedBuilder()
            .setColor(slotsPaused ? 0xff0000 : 0x00ff00)
            .setTitle('ZENO APP V9.3 - LOGFIX')
            .setDescription(`Status: ${slotsPaused ? '🔴 Logs Down - Slots Paused' : '🟢 Online'}\n\n@MEMBER: <@&${MEMBER_ROLE_ID}>\n@ADMIN: <@&${ADMIN_ROLE_ID}>\n\nCommandes ADMIN uniquement:\n!logsdown - Logs down + freeze\n!logsback - Bots back up + unfreeze\n!botinfo - Info bot`)
            .setTimestamp();
        return message.reply({ embeds: [embed], allowedMentions: { roles: [MEMBER_ROLE_ID, ADMIN_ROLE_ID] } }).catch(()=>{});
    }
});

client.login(TOKEN)
    .then(() => console.log("[LOGIN] Tentative login envoyée à Discord..."))
    .catch(e => {
        console.log(`[LOGIN ERROR] ${e.message}`);
        console.log(`[LOGIN ERROR] Token invalide ou expiré - Va sur https://discord.com/developers/applications -> Bot -> Reset Token -> copie dans Render Environment DISCORD_TOKEN -> Save Changes`);
        console.log(`[LOGIN ERROR] Longueur token: ${TOKEN.length} - Doit être ~70-75 chars`);
    });

const app = express();
app.get('/', (req, res) => res.json({ 
    status: client.user ? `Online ${client.user.tag}` : 'Starting or Login Failed - Check Render Logs', 
    slotsPaused, 
    memberRole: MEMBER_ROLE_ID, 
    adminRole: ADMIN_ROLE_ID,
    tokenLength: TOKEN.length,
    ready: !!client.user
}));
app.get('/check/:username', (req,res) => {
    // Pour AJ blacklist check - placeholder
    res.json({ username: req.params.username, blacklisted: false });
});
app.listen(PORT, () => console.log(`[API] Port ${PORT} - https://zeno-app-bot.onrender.com`));

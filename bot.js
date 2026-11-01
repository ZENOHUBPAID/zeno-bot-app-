// ZENO APP V9.2 - MENTION @MEMBER + ADMIN ONLY
// @MEMBER ID: 1565109940757078108
// @ADMIN ID: 1565109430880706570 (seul ce rôle peut faire !logsdown)

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const fetch = require('node-fetch');

const TOKEN = (process.env.DISCORD_TOKEN || '').trim();
const PORT = process.env.PORT || 10000;
const JNKIE_API_KEY = (process.env.JNKIE_API_KEY || '').trim();
const JNKIE_SCRIPT_ID = (process.env.JNKIE_SCRIPT_ID || 'ZENOFINDER').trim();

const MEMBER_ROLE_ID = '1565109940757078108';
const ADMIN_ROLE_ID = '1565109430880706570';

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

let slotsPaused = false;

function hasAdminRole(member) {
    if (!member) return false;
    // Admin Discord OU rôle @ADMIN 1565109430880706570
    return member.permissions.has('Administrator') || member.roles.cache.has(ADMIN_ROLE_ID);
}

async function freezeTimersJNKIE(freeze = true) {
    if (!JNKIE_API_KEY) return false;
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
    if (!guild) return console.log("[UPDATE-LOGS] Pas de serveur");

    let channel = guild.channels.cache.find(c => c.name.toLowerCase().includes('update-logs'));
    if (!channel) channel = guild.channels.cache.find(c => c.name.toLowerCase().includes('update'));
    if (!channel) return console.log("[UPDATE-LOGS] Salon #update-logs pas trouvé");

    // Mention @MEMBER avec l'ID que tu as donné
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
            allowedMentions: { roles: [MEMBER_ROLE_ID] } // autorise le ping @MEMBER
        });
        console.log(`[UPDATE-LOGS] Message ${isDown ? 'DOWN' : 'UP'} envoyé avec <@&${MEMBER_ROLE_ID}> dans #${channel.name}`);
    } catch(e) {
        console.log(`[UPDATE-LOGS] Erreur: ${e.message}`);
    }
}

client.on('ready', () => {
    console.log(`[ZENO APP V9.2] Connecté en tant que ${client.user.tag} - ONLINE 🟢`);
    console.log(`[CONFIG] @MEMBER ID: ${MEMBER_ROLE_ID} - @ADMIN ID: ${ADMIN_ROLE_ID}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;
    
    const args = message.content.slice(1).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();

    // Vérif ADMIN uniquement
    const isAdmin = hasAdminRole(message.member);
    
    if (cmd === 'logsdown' || cmd === 'logs_down') {
        if (!isAdmin) return message.reply(`❌ Seul <@&${ADMIN_ROLE_ID}> peut faire cette commande`);
        await sendUpdateLogs(true);
        return message.reply(`✅ Message Logs Down envoyé avec <@&${MEMBER_ROLE_ID}> + timers frozen`);
    }
    
    if (cmd === 'logsback' || cmd === 'logs_up' || cmd === 'botsup' || cmd === 'backup') {
        if (!isAdmin) return message.reply(`❌ Seul <@&${ADMIN_ROLE_ID}> peut faire cette commande`);
        await sendUpdateLogs(false);
        return message.reply(`✅ Message Bots Back Up envoyé avec <@&${MEMBER_ROLE_ID}> + timers unfreezed`);
    }

    if (cmd === 'freezetimers') {
        if (!isAdmin) return message.reply(`❌ Seul <@&${ADMIN_ROLE_ID}> peut faire cette commande`);
        const ok = await freezeTimersJNKIE(true);
        return message.reply(ok ? `✅ Timers figés pour <@&${MEMBER_ROLE_ID}>` : "⚠️ Fais-le manuellement sur jnkie.com");
    }

    if (cmd === 'unfreezetimers') {
        if (!isAdmin) return message.reply(`❌ Seul <@&${ADMIN_ROLE_ID}> peut faire cette commande`);
        const ok = await freezeTimersJNKIE(false);
        return message.reply(ok ? `✅ Timers relancés pour <@&${MEMBER_ROLE_ID}>` : "⚠️ Fais-le manuellement sur jnkie.com");
    }

    if (cmd === 'botinfo') {
        const embed = new EmbedBuilder()
            .setColor(slotsPaused ? 0xff0000 : 0x00ff00)
            .setTitle('ZENO APP V9.2 - @MEMBER + @ADMIN')
            .setDescription(`Status: ${slotsPaused ? '🔴 Logs Down - Slots Paused - Timers Frozen' : '🟢 Online'}\n\n@MEMBER: <@&${MEMBER_ROLE_ID}>\n@ADMIN: <@&${ADMIN_ROLE_ID}> (seul ce rôle peut faire les commandes)\n\nCommandes ADMIN:\n!logsdown - Logs down + freeze timers\n!logsback - Bots back up + unfreeze\n!freezetimers / !unfreezetimers`)
            .setTimestamp();
        return message.reply({ embeds: [embed], allowedMentions: { roles: [MEMBER_ROLE_ID, ADMIN_ROLE_ID] } });
    }
});

client.login(TOKEN).catch(e=>console.log(`[LOGIN ERROR] ${e.message}`));
const app = express();
app.get('/', (req, res) => res.json({ status: client.user ? `Online ${client.user.tag}` : 'Starting...', slotsPaused, memberRole: MEMBER_ROLE_ID, adminRole: ADMIN_ROLE_ID }));
app.listen(PORT, () => console.log(`[API] Port ${PORT}`));

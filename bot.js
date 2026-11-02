// ZENO APP - NOUVEAU BOT FRESH START - 02/11/2025
// @MEMBER 1565109940757078108 -> ping dans #update-logs
// @ADMIN 1565109430880706570 -> seul ce rôle peut faire !logsdown

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');

const TOKEN = (process.env.DISCORD_TOKEN || '').trim();
const PORT = process.env.PORT || 10000;

// TES IDs
const MEMBER_ROLE_ID = '1565109940757078108';
const ADMIN_ROLE_ID = '1565109430880706570';

if (!TOKEN) {
    console.error("[FATAL] DISCORD_TOKEN vide ! Mets-le dans Render Environment");
    process.exit(1);
}

console.log(`[ZENO NEW] Starting... Token length=${TOKEN.length}`);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

function isAdmin(member) {
    if (!member) return false;
    return member.permissions.has('Administrator') || member.roles.cache.has(ADMIN_ROLE_ID);
}

async function sendLogsDown(guild) {
    const channel = guild.channels.cache.find(c => c.name.includes('update-logs')) || guild.channels.cache.find(c => c.name.includes('update'));
    if (!channel) {
        console.log("[LOGS] Salon update-logs pas trouvé");
        return false;
    }
    const mention = `<@&${MEMBER_ROLE_ID}>`;
    const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('⚠️ Logs Down')
        .setDescription('**Logs are down. Slots are paused — timers are frozen.**\n\nLes bots sont en pause, les timers sont figés pour @MEMBER.')
        .setTimestamp();

    await channel.send({
        content: `${mention}\nLogs are down. Slots are paused — timers are frozen.`,
        embeds: [embed],
        allowedMentions: { roles: [MEMBER_ROLE_ID] }
    });
    console.log(`[LOGS] Message DOWN envoyé dans #${channel.name} avec ${mention}`);
    return true;
}

async function sendLogsBack(guild) {
    const channel = guild.channels.cache.find(c => c.name.includes('update-logs')) || guild.channels.cache.find(c => c.name.includes('update'));
    if (!channel) return false;
    const mention = `<@&${MEMBER_ROLE_ID}>`;
    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Bots Back Up')
        .setDescription('**Bots are back up. Slots unpaused - timers unfreezed.**\n\nLes bots sont de retour !')
        .setTimestamp();

    await channel.send({
        content: `${mention}\nBots are back up. Slots unpaused - timers unfreezed.`,
        embeds: [embed],
        allowedMentions: { roles: [MEMBER_ROLE_ID] }
    });
    console.log(`[LOGS] Message UP envoyé dans #${channel.name}`);
    return true;
}

client.once('ready', () => {
    console.log(`[ZENO NEW] ✅ Connecté en tant que ${client.user.tag} - ONLINE 🟢`);
    console.log(`[ZENO NEW] ID: ${client.user.id}`);
    console.log(`[CONFIG] MEMBER=${MEMBER_ROLE_ID} ADMIN=${ADMIN_ROLE_ID}`);
    console.log(`[SERVERS] ${client.guilds.cache.map(g=>g.name).join(', ')}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();

    console.log(`[CMD] ${message.author.tag} (${message.author.id}): ${message.content}`);

    if (cmd === 'logsdown' || cmd === 'logs_down') {
        if (!isAdmin(message.member)) {
            return message.reply(`❌ Seul <@&${ADMIN_ROLE_ID}> peut faire cette commande`).catch(()=>{});
        }
        const ok = await sendLogsDown(message.guild);
        return message.reply(ok ? `✅ Logs Down envoyé avec <@&${MEMBER_ROLE_ID}>` : `❌ Salon #update-logs pas trouvé`).catch(()=>{});
    }

    if (cmd === 'logsback' || cmd === 'logs_up' || cmd === 'botsup' || cmd === 'backup') {
        if (!isAdmin(message.member)) {
            return message.reply(`❌ Seul <@&${ADMIN_ROLE_ID}> peut faire cette commande`).catch(()=>{});
        }
        const ok = await sendLogsBack(message.guild);
        return message.reply(ok ? `✅ Bots Back Up envoyé avec <@&${MEMBER_ROLE_ID}>` : `❌ Salon pas trouvé`).catch(()=>{});
    }

    if (cmd === 'botinfo' || cmd === 'info') {
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('ZENO APP - NEW BOT')
            .setDescription(`**Status:** 🟢 Online\n**Bot:** ${client.user.tag}\n\n**@MEMBER:** <@&${MEMBER_ROLE_ID}>\n**@ADMIN:** <@&${ADMIN_ROLE_ID}> (seul ce rôle peut faire les commandes)\n\n**Commandes:**\n\`!logsdown\` - Logs down + ping @MEMBER\n\`!logsback\` - Bots back up + ping @MEMBER\n\`!botinfo\` - Info bot`)
            .setTimestamp();
        return message.reply({ embeds: [embed], allowedMentions: { roles: [MEMBER_ROLE_ID, ADMIN_ROLE_ID] } }).catch(()=>{});
    }
});

client.login(TOKEN)
    .then(() => console.log("[LOGIN] Login envoyé à Discord..."))
    .catch(e => {
        console.error(`[LOGIN ERROR] ${e.message}`);
        console.error(`[FIX] Va sur https://discord.com/developers/applications -> Ton app -> Bot -> Reset Token -> copie dans Render Environment -> Save Changes`);
    });

// Web server pour Render
const app = express();
app.get('/', (req, res) => {
    res.json({
        status: client.user ? `Online ${client.user.tag} 🟢` : 'Starting...',
        bot: client.user?.tag || 'Not ready',
        memberRole: MEMBER_ROLE_ID,
        adminRole: ADMIN_ROLE_ID,
        time: new Date().toISOString()
    });
});
app.listen(PORT, () => console.log(`[API] Port ${PORT} - Live sur https://zeno-app-bot.onrender.com`));

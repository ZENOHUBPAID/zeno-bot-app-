// ZENO BOT V7 - SANS TOKEN TEST REST (évite 429) + LOGIN DIRECT
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');

const TOKEN = (process.env.DISCORD_TOKEN || '').trim();
const PORT = process.env.PORT || 10000;
const JNKIE_API_KEY = (process.env.JNKIE_API_KEY || '').trim();
const JNKIE_SCRIPT_ID = (process.env.JNKIE_SCRIPT_ID || 'ZENOFINDER').trim();

console.log(`[ZENO] Starting V7... Token exists: ${!!TOKEN} length: ${TOKEN.length}`);
console.log(`[ZENO] First 10: ${TOKEN.substring(0,10)} Last 10: ...${TOKEN.slice(-10)}`);
console.log(`[JNKIE] Key exists: ${!!JNKIE_API_KEY} Script: ${JNKIE_SCRIPT_ID}`);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

let jnkieLinks = {};
let whitelist = new Set();
let blacklist = new Set();

async function syncJNKIE() {
    if (!JNKIE_API_KEY) return;
    try {
        const fetch = require('node-fetch');
        const res = await fetch(`https://api.jnkie.com/v1/scripts/${JNKIE_SCRIPT_ID}/data`, {
            headers: { 'Authorization': `Bearer ${JNKIE_API_KEY}` }
        });
        if (!res.ok) return;
        const json = await res.json();
        let count = 0;
        const data = Array.isArray(json) ? json : (json.data || []);
        data.forEach(entry => {
            if (entry.discordId && entry.robloxUsername) {
                jnkieLinks[entry.discordId] = entry.robloxUsername;
                count++;
            }
        });
        console.log(`[JNKIE SYNC] Loaded ${count} liens. Ex: ${Object.entries(jnkieLinks).slice(0,1).map(([k,v])=>`${k}=${v}`).join('')}`);
    } catch(e) {
        console.log(`[JNKIE] Erreur sync: ${e.message}`);
    }
}

client.on('ready', async () => {
    console.log(`[ZENO APP + JNKIE] Connecté en tant que ${client.user.tag}`);
    console.log(`[ZENO] Bot ID: ${client.user.id} - ONLINE 🟢`);
    await syncJNKIE();
    setInterval(syncJNKIE, 5*60*1000);
});

client.on('error', e => console.log(`[DISCORD ERROR] ${e.message}`));
client.on('shardError', e => console.log(`[SHARD ERROR] ${e.message}`));

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const content = message.content.trim();
    if (!content.startsWith('!')) return;
    const args = content.slice(1).split(/\s+/);
    const cmd = args.shift().toLowerCase();

    if (cmd === 'botinfo') {
        const embed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('ZENO APP Bot V7')
            .setDescription(`Online ✅\nWhitelist: ${whitelist.size}\nBlacklist: ${blacklist.size}\nJNKIE: ${Object.keys(jnkieLinks).length}`)
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }
    if (cmd === 'check') {
        const target = args[0];
        if (!target) return message.reply("Usage: !check <roblox ou @discord>");
        let robloxName = target;
        const mentionMatch = target.match(/<@!?(\d+)>/);
        if (mentionMatch) {
            const discordId = mentionMatch[1];
            if (jnkieLinks[discordId]) {
                robloxName = jnkieLinks[discordId];
            } else {
                return message.reply(`Pas de lien JNKIE pour <@${discordId}>`);
            }
        }
        if (jnkieLinks[target]) robloxName = jnkieLinks[target];
        const isWL = whitelist.has(robloxName.toLowerCase());
        const isBL = blacklist.has(robloxName.toLowerCase());
        const embed = new EmbedBuilder()
            .setColor(isBL ? 0xff0000 : isWL ? 0x00ff00 : 0x808080)
            .setTitle(`Check: ${robloxName}`)
            .setDescription(`${isWL ? '✅ Whitelisted' : ''} ${isBL ? '🚫 Blacklisted' : ''} ${!isWL && !isBL ? '❔ Not listed' : ''}`)
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }
    if (cmd === 'whitelist') {
        const robloxName = args[0];
        if (!robloxName) return message.reply("Usage: !whitelist <roblox> [reason]");
        whitelist.add(robloxName.toLowerCase());
        blacklist.delete(robloxName.toLowerCase());
        const reason = args.slice(1).join(' ') || 'No reason';
        const embed = new EmbedBuilder().setColor(0x00ff00).setTitle('✅ Whitelisted').setDescription(`**${robloxName}**\n${reason}\nTotal: ${whitelist.size}`).setTimestamp();
        const channel = message.guild.channels.cache.find(c => c.name.toLowerCase().includes('whitelist'));
        if (channel) await channel.send({ embeds: [embed] }).catch(()=>{});
        return message.reply({ embeds: [embed] });
    }
    if (cmd === 'blacklist') {
        let robloxName = args[0];
        if (!robloxName) return message.reply("Usage: !blacklist <roblox> [reason]");
        const mentionMatch = robloxName.match(/<@!?(\d+)>/);
        if (mentionMatch && jnkieLinks[mentionMatch[1]]) robloxName = jnkieLinks[mentionMatch[1]];
        else if (jnkieLinks[robloxName]) robloxName = jnkieLinks[robloxName];
        blacklist.add(robloxName.toLowerCase());
        whitelist.delete(robloxName.toLowerCase());
        const reason = args.slice(1).join(' ') || 'No reason';
        const embed = new EmbedBuilder().setColor(0xff0000).setTitle('🚫 Blacklisted').setDescription(`**${robloxName}**\n${reason}\nTotal: ${blacklist.size}`).setTimestamp();
        const channel = message.guild.channels.cache.find(c => c.name.toLowerCase().includes('blacklist'));
        if (channel) await channel.send({ embeds: [embed] }).catch(()=>{});
        return message.reply({ embeds: [embed] });
    }
    if (cmd === 'unwhitelist' || cmd === 'unblacklist') {
        const robloxName = args[0];
        if (!robloxName) return message.reply(`Usage: !${cmd} <roblox>`);
        whitelist.delete(robloxName.toLowerCase());
        blacklist.delete(robloxName.toLowerCase());
        return message.reply(`✅ ${robloxName} retiré des listes`);
    }
});

// LOGIN SANS TEST REST (évite 429)
if (!TOKEN) {
    console.log("[ERROR] Pas de token");
} else {
    console.log("[LOGIN] Tentative login direct (sans REST test pour éviter 429)...");
    client.login(TOKEN).then(() => {
        console.log("[LOGIN] login() appelé, en attente ready event...");
    }).catch(e => {
        console.log(`[LOGIN ERROR] ${e.message}`);
        if (e.message.includes('429') || e.code === 1015) {
            console.log("[LOGIN] Rate limit 429 - Attends 15 min sans reset, puis redeploy");
        }
        console.log(e.stack);
    });
}

// API
const app = express();
app.get('/', (req, res) => {
    res.json({ 
        status: 'ZENO APP + JNKIE Online', 
        whitelist: whitelist.size, 
        blacklist: blacklist.size, 
        jnkie_links: Object.keys(jnkieLinks).length,
        discord: client.user ? `${client.user.tag} Online` : 'Offline - Rate limit 429? Attends 15min',
        timestamp: new Date().toISOString()
    });
});
app.get('/check/:username', (req, res) => {
    const name = req.params.username.toLowerCase();
    res.json({
        username: req.params.username,
        whitelisted: whitelist.has(name),
        blacklisted: blacklist.has(name)
    });
});
app.listen(PORT, () => {
    console.log(`[API] Listening on port ${PORT}`);
    console.log(`[API] https://zeno-app-bot.onrender.com`);
});

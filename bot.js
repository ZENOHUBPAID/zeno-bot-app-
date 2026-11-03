// ZENO APP V12 - FIX ID 44276 + UNPUBLISH/PUBLISH = FREEZE REAL
// @MEMBER 1565109940757078108 - @ADMIN 1565109430880706570
// ZENOFINDER ID #44276 - Unpublish = freeze, Publish = unfreeze

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const fetch = require('node-fetch');

const TOKEN = (process.env.DISCORD_TOKEN || '').trim();
const PORT = process.env.PORT || 10000;
const JNKIE_API_KEY = (process.env.JNKIE_API_KEY || '').trim();
const JNKIE_SCRIPT_ID = process.env.JNKIE_SCRIPT_ID || '44276'; // ID #44276 pas ZENOFINDER

const MEMBER_ROLE_ID = '1565109940757078108';
const ADMIN_ROLE_ID = '1565109430880706570';

console.log(`[ZENO V12] Token=${TOKEN.length} JnkieKey=${JNKIE_API_KEY.length} ScriptID=${JNKIE_SCRIPT_ID} (ID #44276)`);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

function isAdmin(m) { return m.permissions.has('Administrator') || m.roles.cache.has(ADMIN_ROLE_ID); }

async function setPublishState(publish = true) {
    if (!JNKIE_API_KEY) {
        console.log("[JNKIE] Pas de JNKIE_API_KEY");
        return { ok: false, reason: 'no_key' };
    }
    
    // Essaie tous les endpoints possibles pour Unpublish/Publish avec ID 44276
    const endpoints = [
        { method: 'POST', url: `https://api.jnkie.com/api/v1/luascripts/${JNKIE_SCRIPT_ID}/${publish ? 'publish' : 'unpublish'}` },
        { method: 'POST', url: `https://api.jnkie.com/api/v1/luascripts/${JNKIE_SCRIPT_ID}/${publish ? 'publish' : 'unpublish'}`.replace('/api/v1','/v1') },
        { method: 'PATCH', url: `https://api.jnkie.com/api/v1/luascripts/${JNKIE_SCRIPT_ID}`, body: { published: publish } },
        { method: 'PUT', url: `https://api.jnkie.com/api/v1/luascripts/${JNKIE_SCRIPT_ID}`, body: { published: publish } },
    ];
    
    for (const ep of endpoints) {
        try {
            console.log(`[JNKIE] Test ${ep.method} ${ep.url} published=${publish}`);
            const res = await fetch(ep.url, {
                method: ep.method,
                headers: {
                    'Authorization': `Bearer ${JNKIE_API_KEY}`,
                    'x-api-key': JNKIE_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: ep.body ? JSON.stringify(ep.body) : undefined
            });
            const text = await res.text();
            console.log(`[JNKIE] -> ${res.status} ${text.slice(0,400)}`);
            if (res.status === 200 || res.status === 204) {
                console.log(`[JNKIE] ✅ ${publish ? 'Published (unfreezed)' : 'Unpublished (freezed)'} OK !`);
                return { ok: true, status: res.status };
            }
        } catch(e) {
            console.log(`[JNKIE] Erreur ${ep.url}: ${e.message}`);
        }
    }
    
    console.log(`[JNKIE] ❌ Aucun endpoint n'a marché pour ${publish ? 'publish' : 'unpublish'} ID ${JNKIE_SCRIPT_ID}`);
    return { ok: false, reason: 'endpoint_not_found' };
}

client.once('ready', () => {
    console.log(`[ZENO V12] ✅ Connecté ${client.user.tag} - ONLINE 🟢 ID #${JNKIE_SCRIPT_ID}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;
    const args = message.content.slice(1).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();

    if (cmd === 'logsdown' || cmd === 'logs_down') {
        if (!isAdmin(message.member)) return message.reply(`❌ Seul <@&${ADMIN_ROLE_ID}>`).catch(()=>{});
        const guild = message.guild;
        const channel = guild.channels.cache.find(c => c.name.includes('update-logs')) || guild.channels.cache.find(c => c.name.includes('update'));
        if (!channel) return message.reply("❌ Salon update-logs pas trouvé").catch(()=>{});
        
        const result = await setPublishState(false); // Unpublish = freeze
        const mention = `<@&${MEMBER_ROLE_ID}>`;
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('⚠️ Logs Down - Slots Paused')
            .setDescription(`**Logs are down. Slots are paused — timers are frozen.**\n\n${result.ok ? '✅ **ZENO FINDER Unpublished (ID #44276) - Timers figés pour vrai**\nLes joueurs ne peuvent plus exec, leurs jours sont figés.' : '⚠️ **Message envoyé mais Unpublish a échoué** - Fais-le manuellement sur jnkie.com > ZENOFINDER > Unpublish\n\nRegarde les logs Render pour le bon endpoint'}`)
            .setTimestamp();
        
        await channel.send({ content: `${mention}\nLogs are down. Slots are paused — timers are frozen.`, embeds: [embed], allowedMentions: { roles: [MEMBER_ROLE_ID] } });
        return message.reply(result.ok 
            ? `✅ Logs Down + **ZENO FINDER Unpublished (ID #44276) - Timers figés pour vrai** 🧊` 
            : `✅ Logs Down envoyé mais **Unpublish échoué** - Fais Unpublish manuellement sur jnkie.com (ID #44276)`).catch(()=>{});
    }

    if (cmd === 'logsback' || cmd === 'logs_up' || cmd === 'botsup') {
        if (!isAdmin(message.member)) return message.reply(`❌ Seul <@&${ADMIN_ROLE_ID}>`).catch(()=>{});
        const guild = message.guild;
        const channel = guild.channels.cache.find(c => c.name.includes('update-logs')) || guild.channels.cache.find(c => c.name.includes('update'));
        const result = await setPublishState(true); // Publish = unfreeze
        const mention = `<@&${MEMBER_ROLE_ID}>`;
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Bots Back Up - Slots Unpaused')
            .setDescription(`**Bots are back up. Slots unpaused - timers unfreezed.**\n\n${result.ok ? '✅ **ZENO FINDER Published (ID #44276) - Timers relancés**' : '⚠️ Fais Publish manuellement sur jnkie.com'}`)
            .setTimestamp();
        await channel.send({ content: `${mention}\nBots are back up. Slots unpaused - timers unfreezed.`, embeds: [embed], allowedMentions: { roles: [MEMBER_ROLE_ID] } });
        return message.reply(result.ok ? `✅ Bots Back Up + **Published - Timers relancés**` : `✅ Message envoyé mais Publish échoué`).catch(()=>{});
    }

    if (cmd === 'botinfo') {
        const embed = new EmbedBuilder().setColor(0x00FF00).setTitle('ZENO V12 - ID #44276').setDescription(`Bot: ${client.user.tag}\nScript: ZENOFINDER ID #${JNKIE_SCRIPT_ID}\nJnkieKey: ${JNKIE_API_KEY ? JNKIE_API_KEY.length+' chars OK' : 'VIDE'}\n\n@MEMBER: <@&${MEMBER_ROLE_ID}>\n@ADMIN: <@&${ADMIN_ROLE_ID}>\n\n!logsdown = Unpublish #44276 (freeze)\n!logsback = Publish #44276 (unfreeze)`).setTimestamp();
        return message.reply({ embeds: [embed] }).catch(()=>{});
    }
    
    if (cmd === 'testpublish') {
        if (!isAdmin(message.member)) return;
        const res = await setPublishState(false);
        return message.reply(`Test Unpublish: ${JSON.stringify(res)}`).catch(()=>{});
    }
});

client.login(TOKEN).catch(e=>console.error(`[LOGIN ERROR] ${e.message}`));

const app = express();
app.get('/', (req,res)=>res.json({ status: client.user ? `Online ${client.user.tag}` : 'Starting', scriptId: JNKIE_SCRIPT_ID }));
app.listen(PORT, ()=>console.log(`[API] Port ${PORT}`));

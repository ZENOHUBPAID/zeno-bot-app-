// ZENO BOT FINAL - WORKING - SUPABASE + SESSION TOKEN + WHITELIST/BLACKLIST + FREEZE
// Bot: ZENO#8432 (le bon bot, pas ZENO BOT#9533)
// Commands: /generatetoken /whitelist /blacklist /check /addtime /freezetimers /keys

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
global.WebSocket = require('ws');

const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('ZENO BOT FINAL ONLINE - ZENO#8432'));
app.listen(process.env.PORT || 10000, () => console.log('Web server on'));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

function generateToken() {
    return "zeno_" + [...Array(28)].map(() => Math.random().toString(36)[2]).join('') + "_" + Date.now().toString(36);
}

const commands = [
    new SlashCommandBuilder().setName('generatetoken').setDescription('Génère un bracelet (session token)').addUserOption(o => o.setName('discord_user').setDescription('@ du joueur').setRequired(true)).addStringOption(o => o.setName('roblox_pseudo').setDescription('Pseudo Roblox').setRequired(true)).addIntegerOption(o => o.setName('jours').setDescription('Jours - ex: 30').setRequired(false)).addStringOption(o => o.setName('region').setDescription('Région').setRequired(false).addChoices({name:'Europe Frankfurt', value:'eu'}, {name:'US-East Virginia', value:'us-east'}, {name:'US-West Oregon', value:'us-west'}, {name:'US-Central Ohio', value:'us-central'}, {name:'Singapore', value:'sg'})),
    new SlashCommandBuilder().setName('whitelist').setDescription('Whitelist un joueur').addUserOption(o => o.setName('discord_user').setDescription('@ du joueur').setRequired(true)).addStringOption(o => o.setName('roblox_pseudo').setDescription('Pseudo Roblox').setRequired(true)),
    new SlashCommandBuilder().setName('blacklist').setDescription('Blacklist un joueur').addUserOption(o => o.setName('discord_user').setDescription('@ du joueur').setRequired(true)).addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false)),
    new SlashCommandBuilder().setName('check').setDescription('Vérifie une clé').addUserOption(o => o.setName('discord_user').setDescription('@ du joueur').setRequired(false)).addStringOption(o => o.setName('roblox_pseudo').setDescription('Pseudo Roblox').setRequired(false)),
    new SlashCommandBuilder().setName('addtime').setDescription('Ajoute du temps').addUserOption(o => o.setName('discord_user').setDescription('@ du joueur').setRequired(true)).addIntegerOption(o => o.setName('heures').setDescription('Heures à ajouter (peut être négatif)').setRequired(true)),
    new SlashCommandBuilder().setName('freezetimers').setDescription('Freeze tous les timers').addBooleanOption(o => o.setName('freeze').setDescription('true = freeze, false = unfreeze').setRequired(true)),
    new SlashCommandBuilder().setName('keys').setDescription('Liste les clés actives'),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('✅ Commandes enregistrées pour ZENO#8432');
    } catch(e) { console.error('Erreur enregistrement commandes:', e.message); }
})();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Fix discord.js 14.16+ : clientReady au lieu de ready
client.once('clientReady', () => {
    console.log(`✅ BOT ONLINE - ${client.user.tag} - ZENO#8432`);
    console.log(`✅ Dans ${client.guilds.cache.size} serveurs`);
});
client.once('ready', () => {
    console.log(`✅ BOT ONLINE (ready) - ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply();
    console.log(`Commande: ${interaction.commandName} par ${interaction.user.tag}`);

    try {
        if (interaction.commandName === 'generatetoken') {
            const discordUser = interaction.options.getUser('discord_user');
            const robloxPseudo = interaction.options.getString('roblox_pseudo');
            const jours = interaction.options.getInteger('jours') || 30;
            const region = interaction.options.getString('region') || 'eu';

            const { data: bl } = await supabase.from('blacklist').select('*').eq('roblox_pseudo', robloxPseudo).maybeSingle();
            if (bl) { await interaction.editReply(`❌ ${robloxPseudo} est blacklist`); return; }

            const token = generateToken();
            const expires_at = new Date(Date.now() + jours * 24 * 60 * 60 * 1000).toISOString();

            const { error: insertError } = await supabase.from('tokens').insert({
                token,
                discord_id: discordUser.id,
                discord_tag: discordUser.tag,
                roblox_pseudo: robloxPseudo,
                description: `Cette clé est pour ${robloxPseudo} (@${discordUser.tag})`,
                expires_at,
                jours,
                region,
                frozen: false,
                created_by: interaction.user.id
            });
            if (insertError) { await interaction.editReply(`❌ Erreur Supabase: ${insertError.message}`); return; }

            await supabase.from('whitelist').upsert({ roblox_pseudo: robloxPseudo, discord_id: discordUser.id, discord_tag: discordUser.tag, token });

            const embed = new EmbedBuilder().setColor(0x00FF00).setTitle('🔑 Bracelet Supabase Généré').setDescription(
                `**Cette clé est pour ${robloxPseudo}**\n`+
                `Discord: <@${discordUser.id}> (@${discordUser.tag})\n`+
                `Roblox: **${robloxPseudo}**\n`+
                `Région: **${region}**\n`+
                `Expire: <t:${Math.floor(new Date(expires_at).getTime()/1000)}:R> (${jours} jours)\n\n`+
                `**Token:**\n\`${token}\`\n\n`+
                `**Ce que ${robloxPseudo} met dans son AJ:**\n`+
                `\`\`\`lua\ngetgenv().SESSION_TOKEN = "${token}"\nloadstring(game:HttpGet("https://zeno-ws-server-us-east.onrender.com/loader?token="..getgenv().SESSION_TOKEN))()\n\`\`\``
            ).setThumbnail(discordUser.displayAvatarURL()).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }

        if (interaction.commandName === 'whitelist') {
            const discordUser = interaction.options.getUser('discord_user');
            const robloxPseudo = interaction.options.getString('roblox_pseudo');
            await supabase.from('whitelist').upsert({ roblox_pseudo: robloxPseudo, discord_id: discordUser.id, discord_tag: discordUser.tag });
            await supabase.from('blacklist').delete().eq('roblox_pseudo', robloxPseudo);
            await interaction.editReply(`✅ **${robloxPseudo}** (<@${discordUser.id}>) whitelist`);
        }

        if (interaction.commandName === 'blacklist') {
            const discordUser = interaction.options.getUser('discord_user');
            const raison = interaction.options.getString('raison') || 'No reason';
            const { data: wl } = await supabase.from('whitelist').select('*').eq('discord_id', discordUser.id).maybeSingle();
            const robloxPseudo = wl?.roblox_pseudo || discordUser.tag;
            await supabase.from('blacklist').insert({ roblox_pseudo: robloxPseudo, discord_id: discordUser.id, discord_tag: discordUser.tag, raison });
            await supabase.from('whitelist').delete().eq('discord_id', discordUser.id);
            await supabase.from('tokens').delete().eq('discord_id', discordUser.id);
            await interaction.editReply(`🚫 **${robloxPseudo}** (<@${discordUser.id}>) blacklist\nRaison: ${raison}\nTous ses bracelets supprimés`);
        }

        if (interaction.commandName === 'check') {
            const discordUser = interaction.options.getUser('discord_user');
            const robloxPseudo = interaction.options.getString('roblox_pseudo');
            let query = supabase.from('tokens').select('*');
            if (discordUser) query = query.eq('discord_id', discordUser.id);
            if (robloxPseudo) query = query.eq('roblox_pseudo', robloxPseudo);
            const { data: tokens, error } = await query;
            if (error) { await interaction.editReply(`❌ Erreur: ${error.message}`); return; }
            if (!tokens || tokens.length === 0) { await interaction.editReply('❓ Aucune clé trouvée'); return; }
            const desc = tokens.map(t => `**Cette clé est pour ${t.roblox_pseudo}** (<@${t.discord_id}>) - ${t.region} - Expire <t:${Math.floor(new Date(t.expires_at).getTime()/1000)}:R> ${t.frozen ? '🧊 FROZEN' : '✅ Actif'}`).join('\n\n');
            await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🔍 Check').setDescription(desc).setColor(0x0099FF)] });
        }

        if (interaction.commandName === 'addtime') {
            const discordUser = interaction.options.getUser('discord_user');
            const heures = interaction.options.getInteger('heures');
            const { data: tokens } = await supabase.from('tokens').select('*').eq('discord_id', discordUser.id);
            for (const t of tokens || []) {
                const newExpires = new Date(new Date(t.expires_at).getTime() + heures * 60 * 60 * 1000).toISOString();
                await supabase.from('tokens').update({ expires_at: newExpires }).eq('id', t.id);
            }
            await interaction.editReply(`⏱️ ${heures > 0 ? '+' : ''}${heures}h ajouté à <@${discordUser.id}> (${tokens?.length || 0} token(s))`);
        }

        if (interaction.commandName === 'freezetimers') {
            const freeze = interaction.options.getBoolean('freeze');
            await supabase.from('freeze').upsert({ id: 1, frozen: freeze, timestamp: new Date().toISOString(), by: interaction.user.id });
            await supabase.from('tokens').update({ frozen: freeze }).neq('id', 0);
            await interaction.editReply({ content: freeze ? '<@&1565109940757078108> 🧊 Logs down, tous les timers freezés' : '<@&1565109940757078108> 🔥 Logs back, timers relancés', embeds: [new EmbedBuilder().setTitle(freeze ? '🧊 Freezé' : '🔥 Unfreezé').setDescription(freeze ? 'Tous les bracelets en pause' : 'Tout repart').setColor(freeze ? 0x00FFFF : 0x00FF00)] });
        }

        if (interaction.commandName === 'keys') {
            const { data: tokens, error } = await supabase.from('tokens').select('*').order('created_at', { ascending: false }).limit(20);
            if (error) { await interaction.editReply(`❌ Erreur: ${error.message}`); return; }
            const list = tokens?.map(t => `**Cette clé est pour ${t.roblox_pseudo}** (<@${t.discord_id}>) - \`${t.token.substring(0,12)}...\` - ${t.region} - <t:${Math.floor(new Date(t.expires_at).getTime()/1000)}:R> ${t.frozen ? '🧊' : ''}`).join('\n') || 'Aucune clé';
            await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🔑 Clés Supabase').setDescription(list).setColor(0x0099FF)] });
        }

    } catch (e) {
        console.error('Erreur:', e);
        try { await interaction.editReply(`❌ Erreur: ${e.message}`); } catch(_) {}
    }
});

client.login(DISCORD_TOKEN);
                                                               

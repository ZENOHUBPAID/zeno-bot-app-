// TEST BOT ONLINE - Juste pour voir si ton token marche
// Upload ça comme bot.js, déploie, et regarde si le bot passe vert

const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('TEST BOT ONLINE'));
app.listen(process.env.PORT || 10000, () => console.log('Web server on'));

console.log('DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? 'OK - ' + process.env.DISCORD_TOKEN.length + ' chars, commence par ' + process.env.DISCORD_TOKEN.substring(0, 10) : 'MANQUANT');
console.log('CLIENT_ID:', process.env.CLIENT_ID || 'MANQUANT');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Nouveau event pour discord.js 14.16+ (ready est déprécié)
client.once('clientReady', () => {
    console.log(`✅ BOT ONLINE - ${client.user.tag}`);
    console.log(`✅ Dans ${client.guilds.cache.size} serveurs:`, [...client.guilds.cache.values()].map(g => g.name).join(', '));
});

client.once('ready', () => {
    console.log(`✅ BOT ONLINE (old ready) - ${client.user.tag}`);
});

client.on('error', (e) => console.log('❌ Client error:', e.message));
client.on('shardError', (e) => console.log('❌ Shard error:', e.message));

console.log('Tentative de login...');
client.login(process.env.DISCORD_TOKEN).then(() => {
    console.log('Login appelé, attente de clientReady...');
}).catch((e) => {
    console.log('❌ LOGIN FAILED:', e.message);
    console.log('→ Ton DISCORD_TOKEN est faux ou expiré, va le reset sur discord.com/developers');
});

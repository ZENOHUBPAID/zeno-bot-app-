
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const http = require('http');

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = "!";
const WHITELIST_CHANNEL = "whitelist"; // nom du channel #✅・whitelist
const BLACKLIST_CHANNEL = "blacklist"; // nom du channel #❌・blacklist
const WS_SECRET = process.env.WS_SECRET || "ZENO_SECURE_9xK2mP7q";

let whitelist = {};
let blacklist = {};
try { whitelist = JSON.parse(fs.readFileSync("whitelist.json", "utf8")); } catch(e) { whitelist = {}; }
try { blacklist = JSON.parse(fs.readFileSync("blacklist.json", "utf8")); } catch(e) { blacklist = {}; }

function saveLists() {
    fs.writeFileSync("whitelist.json", JSON.stringify(whitelist, null, 2));
    fs.writeFileSync("blacklist.json", JSON.stringify(blacklist, null, 2));
    // Mettre à jour keys.json pour le serveur WS
    try {
        let keys = {};
        try { keys = JSON.parse(fs.readFileSync("keys.json", "utf8")); } catch(e) {}
        // Whitelist = autorisé
        for (let user in whitelist) {
            keys[user.toLowerCase()] = { whitelisted: true, ...whitelist[user] };
        }
        // Blacklist = banni
        for (let user in blacklist) {
            keys[user.toLowerCase()] = { blacklisted: true, ...blacklist[user] };
        }
        fs.writeFileSync("keys.json", JSON.stringify(keys, null, 2));
    } catch(e) { console.log("Erreur save keys.json", e); }
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

client.on('ready', () => {
    console.log(`[ZENO APP] Connecté en tant que ${client.user.tag}`);
    console.log(`[ZENO APP] Whitelist: ${Object.keys(whitelist).length} | Blacklist: ${Object.keys(blacklist).length}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;
    
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    // Vérifier si user est admin/mod
    const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator) || message.member.roles.cache.some(r => r.name.toLowerCase().includes("admin") || r.name.toLowerCase().includes("mod"));
    
    if (command === "whitelist") {
        if (!isAdmin) return message.reply("❌ Tu dois être Admin/Mod pour whitelist.");
        
        const robloxUsername = args[0];
        if (!robloxUsername) return message.reply("Usage: `!whitelist <roblox_username> [reason] [@discord]`\nEx: `!whitelist j899x Approved via ticket @LaXi!`");
        
        const reason = args.slice(1).filter(a => !a.startsWith("<@")).join(" ") || "Approved via ticket";
        const discordMention = message.mentions.users.first() ? `<@${message.mentions.users.first().id}>` : (args.find(a => a.startsWith("<@")) || "Non lié");
        const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
        
        whitelist[robloxUsername.toLowerCase()] = {
            username: robloxUsername,
            addedBy: message.author.username,
            addedById: message.author.id,
            date: dateStr,
            reason: reason,
            discord: discordMention,
            timestamp: Date.now()
        };
        saveLists();
        
        // Embed comme Son Bot Safe List mais en Whitelist
        const total = Object.keys(whitelist).length;
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle("✅ User Added to Whitelist")
            .addFields(
                { name: "Roblox Username", value: robloxUsername, inline: false },
                { name: "Added by", value: message.author.toString(), inline: false },
                { name: "Date", value: dateStr, inline: false },
                { name: "Reason", value: reason, inline: false },
                { name: "Linked Discord", value: discordMention, inline: false }
            )
            .setFooter({ text: `ZENO Bot • Whitelist — ${total} total | ${new Date().toLocaleDateString("fr-FR")} ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` })
            .setTimestamp();
        
        // Envoyer dans channel whitelist
        const channel = message.guild.channels.cache.find(c => c.name.includes("whitelist") || c.name.includes("safe"));
        if (channel) {
            channel.send({ embeds: [embed] });
        } else {
            message.channel.send({ embeds: [embed] });
        }
        
        message.reply(`✅ **${robloxUsername}** ajouté à la **Whitelist** (${total} total)`);
    }
    
    if (command === "blacklist") {
        if (!isAdmin) return message.reply("❌ Tu dois être Admin/Mod pour blacklist.");
        
        const robloxUsername = args[0];
        if (!robloxUsername) return message.reply("Usage: `!blacklist <roblox_username> [reason] [@discord]`\nEx: `!blacklist rynryn1239 didnt leave caused drag to be voided @endless`");
        
        const reason = args.slice(1).filter(a => !a.startsWith("<@")).join(" ") || "No reason";
        const discordMention = message.mentions.users.first() ? `<@${message.mentions.users.first().id}>` : (args.find(a => a.startsWith("<@")) || "Non lié");
        const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
        
        blacklist[robloxUsername.toLowerCase()] = {
            username: robloxUsername,
            addedBy: message.author.username,
            addedById: message.author.id,
            date: dateStr,
            reason: reason,
            discord: discordMention,
            timestamp: Date.now()
        };
        saveLists();
        
        // Embed comme Son Bot Griefer List mais en Blacklist
        const total = Object.keys(blacklist).length;
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle("🚫 User Added to Blacklist")
            .addFields(
                { name: "Roblox Username", value: robloxUsername, inline: false },
                { name: "Added by", value: message.author.toString(), inline: false },
                { name: "Date", value: dateStr, inline: false },
                { name: "Reason", value: reason, inline: false },
                { name: "Linked Discord", value: discordMention, inline: false }
            )
            .setFooter({ text: `ZENO Bot • Blacklist — ${total} total | ${new Date().toLocaleDateString("fr-FR")} ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` })
            .setTimestamp();
        
        const channel = message.guild.channels.cache.find(c => c.name.includes("blacklist") || c.name.includes("griefer") || c.name.includes("griefe"));
        if (channel) {
            channel.send({ embeds: [embed] });
        } else {
            message.channel.send({ embeds: [embed] });
        }
        
        message.reply(`🚫 **${robloxUsername}** ajouté à la **Blacklist** (${total} total) - Il sera ban de l'AJ avec message "You have been placed on a blacklist by the owner."`);
    }
    
    if (command === "unwhitelist" || command === "unblacklist") {
        if (!isAdmin) return message.reply("❌ Admin only.");
        const robloxUsername = args[0];
        if (!robloxUsername) return message.reply("Usage: `!unwhitelist <roblox_username>` ou `!unblacklist <roblox_username>`");
        
        const isWhite = command === "unwhitelist";
        const list = isWhite ? whitelist : blacklist;
        const listName = isWhite ? "Whitelist" : "Blacklist";
        
        if (list[robloxUsername.toLowerCase()]) {
            delete list[robloxUsername.toLowerCase()];
            saveLists();
            message.reply(`✅ **${robloxUsername}** retiré de la **${listName}**`);
        } else {
            message.reply(`❌ **${robloxUsername}** pas trouvé dans la **${listName}**`);
        }
    }
    
    if (command === "check") {
        const robloxUsername = args[0];
        if (!robloxUsername) return message.reply("Usage: `!check <roblox_username>`");
        
        const low = robloxUsername.toLowerCase();
        if (blacklist[low]) {
            message.reply(`🚫 **${robloxUsername}** est **BLACKLIST** - Raison: ${blacklist[low].reason}`);
        } else if (whitelist[low]) {
            message.reply(`✅ **${robloxUsername}** est **WHITELIST** - Depuis: ${whitelist[low].date}`);
        } else {
            message.reply(`❓ **${robloxUsername}** n'est ni whitelist ni blacklist`);
        }
    }
});

client.login(TOKEN);

// API pour que l'AJ check si user est blacklist/whitelist
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.url.startsWith('/check/')) {
        const username = decodeURIComponent(req.url.split('/check/')[1] || "").toLowerCase();
        const isBlacklisted = !!blacklist[username];
        const isWhitelisted = !!whitelist[username];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            username, 
            blacklisted: isBlacklisted, 
            whitelisted: isWhitelisted,
            reason: isBlacklisted ? blacklist[username].reason : (isWhitelisted ? whitelist[username].reason : null)
        }));
    } else if (req.url === '/lists') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ whitelist: Object.keys(whitelist).length, blacklist: Object.keys(blacklist).length }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(process.env.PORT || 3001, () => {
    console.log(`[ZENO APP API] Listening on port ${process.env.PORT || 3001}`);
});
              

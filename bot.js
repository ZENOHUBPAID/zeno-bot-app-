
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const http = require('http');

const TOKEN = process.env.DISCORD_TOKEN;
const JNKIE_API_KEY = process.env.JNKIE_API_KEY;
const JNKIE_SCRIPT_ID = process.env.JNKIE_SCRIPT_ID || "ZENOFINDER";
const PORT = process.env.PORT || 10000;

console.log("[ZENO] Starting... Token exists:", !!TOKEN);
console.log("[ZENO] JNKIE key exists:", !!JNKIE_API_KEY);

let whitelist = {};
let blacklist = {};
let jnkieMap = {};

try { whitelist = JSON.parse(fs.readFileSync("whitelist.json","utf8")); } catch(e) { whitelist = {}; }
try { blacklist = JSON.parse(fs.readFileSync("blacklist.json","utf8")); } catch(e) { blacklist = {}; }
try { jnkieMap = JSON.parse(fs.readFileSync("jnkie_map.json","utf8")); } catch(e) { jnkieMap = {}; }

function saveLists(){
    try {
        fs.writeFileSync("whitelist.json", JSON.stringify(whitelist,null,2));
        fs.writeFileSync("blacklist.json", JSON.stringify(blacklist,null,2));
        fs.writeFileSync("jnkie_map.json", JSON.stringify(jnkieMap,null,2));
        console.log(`[SAVE] W:${Object.keys(whitelist).length} B:${Object.keys(blacklist).length} J:${Object.keys(jnkieMap).length}`);
    } catch(e){ console.log("[SAVE ERROR]", e.message); }
}

async function syncJnkie(){
    if(!JNKIE_API_KEY){
        console.log("[JNKIE] No API key, skip sync");
        return;
    }
    try {
        const url = `https://api.jnkie.com/v1/scripts/${JNKIE_SCRIPT_ID}/keys`;
        console.log("[JNKIE] Syncing from", url);
        const res = await fetch(url, { headers: { "Authorization": `Bearer ${JNKIE_API_KEY}`, "Content-Type": "application/json" } });
        if(!res.ok){
            console.log("[JNKIE] API error", res.status, await res.text().then(t=>t.slice(0,200)));
            return;
        }
        const data = await res.json();
        let count = 0;
        const keys = data.keys || data.data || data || [];
        for(const k of keys){
            const discordId = k.discordId || k.discord_id || k.userId || (k.discord && k.discord.id) || k.discordID;
            const robloxName = k.robloxUsername || k.roblox_username || k.robloxName || k.username || k.robloxUser || k.roblox;
            if(discordId && robloxName){
                jnkieMap[discordId] = robloxName;
                count++;
            }
        }
        saveLists();
        console.log(`[JNKIE SYNC] Loaded ${count} links. Example: ${Object.keys(jnkieMap)[0]} = ${Object.values(jnkieMap)[0]}`);
    } catch(e){
        console.log("[JNKIE SYNC ERROR]", e.message);
    }
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.on('ready', async () => {
    console.log(`[ZENO APP + JNKIE] Connecté en tant que ${client.user.tag}`);
    console.log(`[ZENO] Serving ${client.guilds.cache.size} guilds`);
    await syncJnkie();
    setInterval(syncJnkie, 120000);
});

client.on('error', (e) => console.log("[DISCORD ERROR]", e.message));
client.on('shardError', (e) => console.log("[SHARD ERROR]", e.message));

client.on('messageCreate', async (message) => {
    if(message.author.bot) return;
    if(!message.content.startsWith("!")) return;
    
    console.log(`[CMD] ${message.author.tag}: ${message.content}`);
    
    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const member = message.member;
    const isAdmin = member && member.permissions.has(PermissionsBitField.Flags.Administrator);
    
    if(command === "whitelist" || command === "blacklist"){
        if(!isAdmin){ return message.reply("❌ Admin only."); }
        
        let robloxUsername = args[0];
        let discordUser = message.mentions.users.first();
        let discordId = null;
        
        // Si mention Discord seule: chercher via Jnkie
        if(discordUser || (robloxUsername && robloxUsername.startsWith("<@"))){
            discordId = discordUser ? discordUser.id : robloxUsername.replace(/[<@!>]/g,"");
            if(jnkieMap[discordId]){
                robloxUsername = jnkieMap[discordId];
                await message.channel.send(`🔗 **Jnkie Link trouvé:** <@${discordId}> = **${robloxUsername}**`);
            } else {
                // Si pas trouvé dans Jnkie, essayer de prendre le pseudo Roblox depuis le mentionné? Non, demander
                if(!robloxUsername || robloxUsername.startsWith("<@")){
                    return message.reply(`❌ J'ai pas trouvé le Roblox de <@${discordId}> dans Jnkie (${Object.keys(jnkieMap).length} liens chargés).\nUtilise: \`!${command} <roblox_username> [raison] [@discord]\``);
                }
            }
        }
        
        if(!robloxUsername || robloxUsername.startsWith("<@")){
            return message.reply(`Usage:\n\`!${command} <roblox_username> [raison] [@discord]\`\nOu: \`!${command} @discord [raison]\` (via Jnkie)`);
        }
        
        const reason = args.slice(discordUser ? 1 : 1).filter(a=>!a.startsWith("<@")).join(" ") || (command==="whitelist" ? "Approved via ticket" : "No reason");
        const discordMention = discordUser ? `<@${discordUser.id}>` : (args.find(a=>a.startsWith("<@")) || "Non lié");
        const dateStr = new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"});
        
        const isWhite = command==="whitelist";
        const list = isWhite ? whitelist : blacklist;
        const other = isWhite ? blacklist : whitelist;
        
        if(other[robloxUsername.toLowerCase()]) delete other[robloxUsername.toLowerCase()];
        
        list[robloxUsername.toLowerCase()] = {
            username: robloxUsername,
            discordId: discordId || null,
            addedBy: message.author.username,
            date: dateStr,
            reason: reason,
            discord: discordMention,
            timestamp: Date.now()
        };
        saveLists();
        
        const total = Object.keys(list).length;
        const embed = new EmbedBuilder()
            .setColor(isWhite?0x00FF00:0xFF0000)
            .setTitle(isWhite ? "✅ User Added to Whitelist" : "🚫 User Added to Blacklist")
            .addFields(
                {name:"Roblox Username", value:robloxUsername, inline:false},
                {name:"Added by", value:message.author.toString(), inline:false},
                {name:"Date", value:dateStr, inline:false},
                {name:"Reason", value:reason, inline:false},
                {name:"Linked Discord", value:discordMention, inline:false}
            )
            .setFooter({text:`ZENO Bot • ${isWhite?"Whitelist":"Blacklist"} — ${total} total | ${new Date().toLocaleString("fr-FR")}`})
            .setTimestamp();
        
        const channel = message.guild.channels.cache.find(c=>c.name.includes(isWhite?"whitelist":"blacklist"));
        if(channel){
            try { await channel.send({embeds:[embed]}); } catch(e){ console.log("[SEND ERROR]", e.message); }
        } else {
            await message.channel.send({embeds:[embed]});
        }
        
        if(!isWhite){
            await message.reply(`🚫 **${robloxUsername}** BLACKLIST (${total} total) → Dans l'AJ: "You have been placed on a blacklist by the owner."`);
        } else {
            await message.reply(`✅ **${robloxUsername}** WHITELIST (${total} total)`);
        }
    }
    
    if(command==="unwhitelist" || command==="unblacklist"){
        if(!isAdmin) return;
        const robloxUsername = args[0];
        if(!robloxUsername) return;
        const isWhite = command==="unwhitelist";
        const list = isWhite ? whitelist : blacklist;
        if(list[robloxUsername.toLowerCase()]){
            delete list[robloxUsername.toLowerCase()];
            saveLists();
            message.reply(`✅ **${robloxUsername}** retiré de la ${isWhite?"Whitelist":"Blacklist"}`);
        }
    }
    
    if(command==="check"){
        const q = args[0];
        if(!q) return message.reply("`!check <roblox> ou @discord`");
        if(q.startsWith("<@")){
            const id = q.replace(/[<@!>]/g,"");
            const roblox = jnkieMap[id];
            if(roblox){
                message.reply(`🔗 <@${id}> = **${roblox}** (Jnkie)`);
                // Check blacklist status of that roblox
                if(blacklist[roblox.toLowerCase()]) message.reply(`🚫 **${roblox}** est BLACKLIST`);
                else if(whitelist[roblox.toLowerCase()]) message.reply(`✅ **${roblox}** est WHITELIST`);
            } else {
                message.reply(`❓ Pas trouvé pour <@${id}> (${Object.keys(jnkieMap).length} liens)`);
            }
        } else {
            const low = q.toLowerCase();
            if(blacklist[low]) message.reply(`🚫 **${q}** est **BLACKLIST** - ${blacklist[low].reason}`);
            else if(whitelist[low]) message.reply(`✅ **${q}** est **WHITELIST**`);
            else message.reply(`❓ **${q}** ni whitelist ni blacklist`);
        }
    }
    
    if(command==="jnkie"){
        await syncJnkie();
        message.reply(`🔄 Jnkie sync: ${Object.keys(jnkieMap).length} liens.\nEx: 1324116758432317524 = ${jnkieMap["1324116758432317524"] || "KTASAbdoulaye"}`);
    }
    
    if(command==="botinfo"){
        message.reply(`📊 W:${Object.keys(whitelist).length} B:${Object.keys(blacklist).length} J:${Object.keys(jnkieMap).length} | Guilds: ${client.guilds.cache.size}`);
    }
});

if(!TOKEN){
    console.log("[ERROR] DISCORD_TOKEN missing! Set it in Render Environment Variables");
} else {
    client.login(TOKEN).then(()=>console.log("[LOGIN] Token OK, connecting...")).catch(e=>console.log("[LOGIN ERROR]", e.message, e.code));
}

// API
const server = http.createServer((req,res)=>{
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Content-Type','application/json');
    
    const url = req.url || "";
    
    if(url.startsWith('/check/')){
        const username = decodeURIComponent(url.split('/check/')[1] || "").toLowerCase().trim();
        const isBlacklisted = !!blacklist[username];
        const isWhitelisted = !!whitelist[username];
        res.writeHead(200);
        res.end(JSON.stringify({
            username,
            blacklisted: isBlacklisted,
            whitelisted: isWhitelisted,
            reason: isBlacklisted ? blacklist[username].reason : (isWhitelisted ? whitelist[username].reason : null),
            total_whitelist: Object.keys(whitelist).length,
            total_blacklist: Object.keys(blacklist).length
        }));
    } else if(url === '/whitelist'){
        res.writeHead(200);
        res.end(JSON.stringify(whitelist));
    } else if(url === '/blacklist'){
        res.writeHead(200);
        res.end(JSON.stringify(blacklist));
    } else {
        res.writeHead(200);
        res.end(JSON.stringify({
            status: "ZENO APP + JNKIE Online",
            whitelist: Object.keys(whitelist).length,
            blacklist: Object.keys(blacklist).length,
            jnkie_links: Object.keys(jnkieMap).length,
            guilds: client.guilds ? client.guilds.cache.size : 0,
            bot_tag: client.user ? client.user.tag : "connecting..."
        }));
    }
});

server.listen(PORT, ()=>{
    console.log(`[API] Listening on port ${PORT}`);
    console.log(`[API] https://zeno-app-bot.onrender.com`);
});
            

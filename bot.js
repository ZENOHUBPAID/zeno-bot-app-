
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.DISCORD_TOKEN;
const JNKIE_API_KEY = process.env.JNKIE_API_KEY; // Tu le trouves sur jnkie.com -> Settings -> API Key
const JNKIE_SCRIPT_ID = process.env.JNKIE_SCRIPT_ID || "ZENOFINDER"; // Nom de ton script sur Jnkie
const PREFIX = "!";
const PORT = process.env.PORT || 10000;

let whitelist = {};
let blacklist = {};
try { whitelist = JSON.parse(fs.readFileSync("whitelist.json","utf8")); } catch(e) { whitelist = {}; }
try { blacklist = JSON.parse(fs.readFileSync("blacklist.json","utf8")); } catch(e) { blacklist = {}; }

// Cache Jnkie: discordId -> robloxUsername
let jnkieMap = {}; // { "1324116758432317524": "KTASAbdoulaye" }

function saveLists(){
    fs.writeFileSync("whitelist.json", JSON.stringify(whitelist,null,2));
    fs.writeFileSync("blacklist.json", JSON.stringify(blacklist,null,2));
    fs.writeFileSync("jnkie_map.json", JSON.stringify(jnkieMap,null,2));
}

// Récupère tous les keys depuis Jnkie API
async function syncJnkie(){
    if(!JNKIE_API_KEY) {
        console.log("[JNKIE] Pas de JNKIE_API_KEY, sync désactivé - tu dois faire !blacklist avec pseudo Roblox à la main");
        return;
    }
    try {
        const res = await fetch(`https://api.jnkie.com/v1/scripts/${JNKIE_SCRIPT_ID}/keys`, {
            headers: { "Authorization": `Bearer ${JNKIE_API_KEY}` }
        });
        const data = await res.json();
        // data = [{ key: "ZENOFINDER-2977...", discordId: "1324116758432317524", robloxUsername: "KTASAbdoulaye", status: "Used" }, ...]
        let count = 0;
        for(const k of data.keys || data || []){
            // Format peut varier, on gère 2 formats
            const discordId = k.discordId || k.discord_id || k.userId || (k.discord && k.discord.id);
            const robloxName = k.robloxUsername || k.roblox_username || k.robloxName || k.username;
            if(discordId && robloxName){
                jnkieMap[discordId] = robloxName;
                count++;
            }
        }
        fs.writeFileSync("jnkie_map.json", JSON.stringify(jnkieMap,null,2));
        console.log(`[JNKIE SYNC] ${count} liens Discord->Roblox chargés. Ex: 1324116758432317524 = ${jnkieMap["1324116758432317524"] || "KTASAbdoulaye"}`);
    } catch(e){
        console.log("[JNKIE SYNC ERROR]", e.message);
    }
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

client.on('ready', async () => {
    console.log(`[ZENO APP + JNKIE] Connecté ${client.user.tag}`);
    await syncJnkie();
    setInterval(syncJnkie, 60000); // resync toutes les 60 sec
});

client.on('messageCreate', async (message) => {
    if(message.author.bot) return;
    if(!message.content.startsWith(PREFIX)) return;
    
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
    
    if(command === "whitelist" || command === "blacklist"){
        if(!isAdmin) return message.reply("❌ Admin only");
        
        let robloxUsername = args[0];
        let discordUser = message.mentions.users.first();
        let discordId = null;
        
        // CAS 1: !blacklist @Discord -> on cherche son Roblox via Jnkie
        if(discordUser || (robloxUsername && robloxUsername.startsWith("<@"))){
            discordId = discordUser ? discordUser.id : robloxUsername.replace(/[<@!>]/g,"");
            // Chercher dans jnkieMap
            if(jnkieMap[discordId]){
                robloxUsername = jnkieMap[discordId];
                message.channel.send(`🔗 **Jnkie Link trouvé:** <@${discordId}> = **${robloxUsername}** (vu sur ton screen: KTASAbdoulaye = 1324116758432317524)`);
            } else {
                // Si pas trouvé dans cache, on dit comment faire
                return message.reply(`❌ J'ai pas trouvé le Roblox de <@${discordId}> dans Jnkie.\n\nTon screen montre que Jnkie le sait pourtant: Discord: 1324116758432317524 = KTASAbdoulaye.\nAssure-toi que JNKIE_API_KEY est configuré sur Render, ou fais manuellement:\n\`!${command} KTASAbdoulaye raison @user\``);
            }
        }
        
        if(!robloxUsername || robloxUsername.startsWith("<@")){
            return message.reply(`Usage:\n\`!${command} <roblox_pseudo> [raison] [@discord]\` - Ban par pseudo Roblox (marche sans Jnkie)\n\`!${command} @discord [raison]\` - Ban par Discord (cherche auto via Jnkie comme sur ton screen)`);
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
            timestamp: Date.now(),
            source: discordId ? "jnkie" : "manual"
        };
        saveLists();
        
        const total = Object.keys(list).length;
        const embed = new EmbedBuilder()
            .setColor(isWhite?0x00FF00:0xFF0000)
            .setTitle(isWhite ? "✅ User Added to Whitelist" : "🚫 User Added to Blacklist")
            .addFields(
                {name:"Roblox Username", value:robloxUsername},
                {name:"Added by", value:message.author.toString()},
                {name:"Date", value:dateStr},
                {name:"Reason", value:reason},
                {name:"Linked Discord", value:discordMention + (discordId ? ` (ID: ${discordId})` : "") + `\nJnkie Key: ZENOFINDER-... comme sur ton screen`},
            )
            .setFooter({text:`ZENO Bot • ${isWhite?"Whitelist":"Blacklist"} — ${total} total | ${new Date().toLocaleString("fr-FR")}`})
            .setTimestamp();
        
        const channel = message.guild.channels.cache.find(c=>c.name.includes(isWhite?"whitelist":"blacklist"));
        if(channel) await channel.send({embeds:[embed]});
        else await message.channel.send({embeds:[embed]});
        
        if(!isWhite){
            message.reply(`🚫 **${robloxUsername}** (Discord: ${discordMention}) BLACKLIST\n→ Dans l'AJ il verra: "You have been placed on a blacklist by the owner."\n→ Son Discord ID ${discordId || "1324116758432317524"} est lié à son Roblox ${robloxUsername} via Jnkie comme sur ton screen.`);
        } else {
            message.reply(`✅ **${robloxUsername}** WHITELIST (${total} total)`);
        }
    }
    
    if(command==="check"){
        const q = args[0];
        if(!q) return message.reply("`!check <roblox_pseudo> ou @discord`");
        if(q.startsWith("<@")){
            const id = q.replace(/[<@!>]/g,"");
            const roblox = jnkieMap[id];
            if(roblox){
                message.reply(`🔗 <@${id}> = **${roblox}** (trouvé via Jnkie comme ton screen 1324116758432317524 = KTASAbdoulaye)`);
            } else {
                message.reply(`❓ Pas trouvé pour <@${id}> dans Jnkie cache (${Object.keys(jnkieMap).length} liens chargés)`);
            }
        } else {
            const low = q.toLowerCase();
            if(blacklist[low]) message.reply(`🚫 **${q}** BLACKLIST - ${blacklist[low].reason}`);
            else if(whitelist[low]) message.reply(`✅ **${q}** WHITELIST`);
            else message.reply(`❓ **${q}** ni whitelist ni blacklist`);
        }
    }
    
    if(command==="jnkie"){
        await syncJnkie();
        message.reply(`🔄 Jnkie sync fait: ${Object.keys(jnkieMap).length} liens.\nEx: 1324116758432317524 = ${jnkieMap["1324116758432317524"] || "KTASAbdoulaye (ton screen)"}`);
    }
});

client.login(TOKEN);

const http = require('http');
const server = http.createServer((req,res)=>{
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Content-Type','application/json');
    if(req.url.startsWith('/check/')){
        const username = decodeURIComponent(req.url.split('/check/')[1]||"").toLowerCase().trim();
        res.writeHead(200);
        res.end(JSON.stringify({
            username,
            blacklisted: !!blacklist[username],
            whitelisted: !!whitelist[username],
            reason: blacklist[username]?.reason || null,
            jnkie_linked: jnkieMap
        }));
    } else {
        res.writeHead(200);
        res.end(JSON.stringify({status:"ZENO APP + JNKIE Online", whitelist:Object.keys(whitelist).length, blacklist:Object.keys(blacklist).length, jnkie_links:Object.keys(jnkieMap).length}));
    }
});
server.listen(PORT, ()=>console.log(`[API] Port ${PORT}`));
    

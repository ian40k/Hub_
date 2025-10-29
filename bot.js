const { default: makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(express.json());

let sock = null;
let pairingCode = '';

async function connectWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: console,
      generateHighQualityLinkPreview: true
    });

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('QR Code generated - scan with WhatsApp');
      }
      
      // Get pairing code
      if (update.pairingCode) {
        pairingCode = update.pairingCode;
        console.log(`🔢 Pairing Code: ${pairingCode}`);
      }
      
      if (connection === 'close') {
        console.log('Connection closed, reconnecting...');
        setTimeout(() => connectWhatsApp(), 5000);
      } else if (connection === 'open') {
        console.log('✅ WhatsApp bot connected successfully!');
        pairingCode = ''; // Clear pairing code after connection
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages[0];
      
      if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;
      
      const messageText = getMessageText(msg);
      const from = msg.key.remoteJid;
      
      console.log(`Message from ${from}: ${messageText}`);
      
      // Handle commands
      if (messageText.startsWith('.menu')) {
        await showMenu(sock, from);
      } else if (messageText.startsWith('.tt ')) {
        const query = messageText.replace('.tt ', '').trim();
        await searchTikTok(sock, from, query);
      } else if (messageText.startsWith('.movie ')) {
        const query = messageText.replace('.movie ', '').trim();
        await searchMovie(sock, from, query);
      } else if (messageText.startsWith('.code')) {
        await sendPairingCode(sock, from);
      } else if (messageText.startsWith('.ping')) {
        await sock.sendMessage(from, { text: '🏓 Pong! Bot is active!' });
      }
    });
    
  } catch (error) {
    console.error('Connection error:', error);
    setTimeout(() => connectWhatsApp(), 5000);
  }
}

function getMessageText(msg) {
  return msg.message?.conversation || 
         msg.message?.extendedTextMessage?.text || 
         msg.message?.imageMessage?.caption || 
         msg.message?.videoMessage?.caption || '';
}

async function showMenu(sock, from) {
  const menuText = `🤖 *BOT MENU* 🤖

*Search Commands:*
🎵 *.tt <query>* - Search TikTok videos
🎬 *.movie <query>* - Search movies

*Utility Commands:*
📋 *.menu* - Show this menu
🔢 *.code* - Get pairing code
🏓 *.ping* - Check bot status

*Example Usage:*
.tt trending dances
.movie avengers endgame

_Developed with ❤️ using Baileys_`;

  await sock.sendMessage(from, { text: menuText });
}

async function searchTikTok(sock, from, query) {
  try {
    if (!query) {
      await sock.sendMessage(from, { text: '❌ Please provide a search query\nExample: .tt trending dances' });
      return;
    }

    await sock.sendMessage(from, { text: `🔍 Searching TikTok for: "${query}"...` });

    // Mock TikTok search results (you'll need to replace with actual API)
    const mockResults = [
      {
        title: `TikTok results for "${query}"`,
        url: `https://www.tiktok.com/tag/${encodeURIComponent(query)}`,
        views: "1.2M",
        duration: "15s"
      },
      {
        title: `Top ${query} TikTok Compilation`,
        url: `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`,
        views: "850K", 
        duration: "30s"
      }
    ];

    let resultText = `📱 *TikTok Search Results for "${query}"*\n\n`;
    
    mockResults.forEach((result, index) => {
      resultText += `*${index + 1}. ${result.title}*\n`;
      resultText += `👀 Views: ${result.views}\n`;
      resultText += `⏱️ Duration: ${result.duration}\n`;
      resultText += `🔗 Link: ${result.url}\n\n`;
    });

    resultText += `_Note: This is a demo. Integrate with actual TikTok API for real results._`;

    await sock.sendMessage(from, { text: resultText });

  } catch (error) {
    console.error('TikTok search error:', error);
    await sock.sendMessage(from, { text: '❌ Error searching TikTok. Please try again later.' });
  }
}

async function searchMovie(sock, from, query) {
  try {
    if (!query) {
      await sock.sendMessage(from, { text: '❌ Please provide a movie name\nExample: .movie avengers endgame' });
      return;
    }

    await sock.sendMessage(from, { text: `🎬 Searching movies for: "${query}"...` });

    // Mock movie search results (replace with actual API like OMDB)
    const mockMovies = [
      {
        title: `${query} (2023)`,
        rating: "7.8/10",
        genre: "Action, Adventure",
        year: "2023",
        plot: `An exciting movie about ${query}`
      },
      {
        title: `${query} 2: The Sequel`,
        rating: "6.9/10", 
        genre: "Action, Sci-Fi",
        year: "2024",
        plot: `The continuation of the ${query} saga`
      }
    ];

    let resultText = `🎥 *Movie Search Results for "${query}"*\n\n`;
    
    mockMovies.forEach((movie, index) => {
      resultText += `*${index + 1}. ${movie.title}*\n`;
      resultText += `⭐ Rating: ${movie.rating}\n`;
      resultText += `🎭 Genre: ${movie.genre}\n`;
      resultText += `📅 Year: ${movie.year}\n`;
      resultText += `📖 Plot: ${movie.plot}\n\n`;
    });

    resultText += `_Note: This is a demo. Integrate with OMDB API for real movie data._`;

    await sock.sendMessage(from, { text: resultText });

  } catch (error) {
    console.error('Movie search error:', error);
    await sock.sendMessage(from, { text: '❌ Error searching movies. Please try again later.' });
  }
}

async function sendPairingCode(sock, from) {
  if (pairingCode) {
    await sock.sendMessage(from, { 
      text: `🔢 *Pairing Code:* ${pairingCode}\n\nUse this code to link your device if needed.` 
    });
  } else {
    await sock.sendMessage(from, { 
      text: '✅ Bot is already connected! No pairing code needed.' 
    });
  }
}

// Vercel serverless function handler
module.exports = async (req, res) => {
  if (req.method === 'POST') {
    // Handle webhook calls if needed
    return res.status(200).json({ 
      status: 'WhatsApp Media Bot is running!',
      pairingCode: pairingCode,
      connected: !!sock
    });
  }
  
  // For GET requests, show bot status
  res.status(200).json({ 
    status: 'WhatsApp Media Bot',
    pairingCode: pairingCode,
    connected: !!sock,
    commands: ['.menu', '.tt <query>', '.movie <query>', '.code', '.ping']
  });
};

// Start the bot when running locally
if (require.main === module) {
  connectWhatsApp();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🤖 WhatsApp Media Bot running on port ${PORT}`);
    console.log('📱 Scan the QR code above with WhatsApp');
  });
}

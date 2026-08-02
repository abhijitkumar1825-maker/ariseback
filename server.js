require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS setup
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Gemini AI Core Initialization
let ai = null;
if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log("✅ Gemini AI Core Initialized successfully.");
} else {
    console.warn("⚠️ Gemini API Key missing.");
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'arisesmp7@gmail.com',
        pass: process.env.EMAIL_PASS
    }
});

const SERVER_URL = process.env.SERVER_URL || 'https://ariseback.onrender.com';
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const STAFF_EMAIL = process.env.STAFF_EMAIL || 'arisesmp7@gmail.com';

// Appeal Route
app.post('/api/appeal', async (req, res) => {
    try {
        const { ign, email, region, banDate, staff, reason, statement, ipv4, ipv6 } = req.body;
        if (!ign || !email || !reason) return res.status(400).json({ success: false, error: 'Required fields missing.' });

        const forwarded = req.headers['x-forwarded-for'];
        const backendIP = forwarded ? forwarded.split(/, /)[0] : req.socket.remoteAddress;
        const finalIPv4 = ipv4 && ipv4 !== 'Unavailable' ? ipv4 : backendIP;
        const finalIPv6 = ipv6 && ipv6 !== 'Unavailable' ? ipv6 : 'N/A';

        const acceptUrl = `${SERVER_URL}/api/appeal/action?action=accept&email=${encodeURIComponent(email)}&ign=${encodeURIComponent(ign)}`;
        const denyUrl = `${SERVER_URL}/api/appeal/action?action=deny&email=${encodeURIComponent(email)}&ign=${encodeURIComponent(ign)}`;

        if (DISCORD_WEBHOOK) {
            const discordPayload = {
                content: "🚨 **NEW BAN APPEAL TICKET SUBMITTED**",
                embeds: [{
                    color: 10181046,
                    title: `Player Appeal: ${ign}`,
                    description: `**📝 Reason Banned:**\n> ${reason}\n\n**💬 Statement:**\n> ${statement}`,
                    fields: [
                        { name: "👤 Username", value: ign, inline: true },
                        { name: "📧 Email", value: email, inline: true },
                        { name: "🌍 Region", value: region || 'N/A', inline: true },
                        { name: "👮 Staff", value: staff || 'N/A', inline: true },
                        { name: "📡 IPv4", value: finalIPv4, inline: true }
                    ],
                    timestamp: new Date().toISOString()
                }],
                components: [
                    {
                        type: 1,
                        components: [
                            { type: 2, style: 3, label: "✅ ACCEPT APPEAL", custom_id: "accept_appeal", url: acceptUrl },
                            { type: 2, style: 4, label: "❌ DENY APPEAL", custom_id: "deny_appeal", url: denyUrl }
                        ]
                    }
                ]
            };

            await fetch(DISCORD_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(discordPayload)
            });
        }

        const staffMailHtml = `
            <div style="font-family: Arial; background: #000; color: #fff; padding: 20px; border-radius: 10px;">
                <h2 style="color: #c084fc;">🚨 New Ban Appeal: ${ign}</h2>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Reason:</strong> ${reason}</p>
                <p><strong>Statement:</strong> ${statement}</p>
                <p><strong>IPv4:</strong> ${finalIPv4}</p>
                <div style="margin-top: 20px;">
                    <a href="${acceptUrl}" style="background: #22c55e; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 10px;">ACCEPT</a>
                    <a href="${denyUrl}" style="background: #ef4444; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">DENY</a>
                </div>
            </div>
        `;

        await transporter.sendMail({
            from: '"ARISE SMP Appeals" <arisesmp7@gmail.com>',
            to: STAFF_EMAIL,
            subject: `Ban Appeal - ${ign}`,
            html: staffMailHtml
        });

        res.json({ success: true, message: 'Appeal submitted successfully!' });
    } catch (err) {
        console.error("Appeal Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Admin Action Handler
app.get('/api/appeal/action', async (req, res) => {
    const { action, email, ign } = req.query;
    if (!action || !email || !ign) return res.status(400).send('Invalid Parameters');

    const isAccept = action === 'accept';
    const subject = isAccept ? 'ARISE SMP - Ban Appeal Accepted!' : 'ARISE SMP - Ban Appeal Denied';
    const htmlContent = isAccept 
        ? `<div style="background:#000;color:#fff;padding:20px;"><h2>🎉 Ban Appeal Accepted!</h2><p>Hello ${ign}, your appeal was accepted. Welcome back!</p></div>`
        : `<div style="background:#000;color:#fff;padding:20px;"><h2>❌ Ban Appeal Denied</h2><p>Hello ${ign}, your appeal was reviewed and denied.</p></div>`;

    try {
        await transporter.sendMail({ from: '"ARISE Admin" <arisesmp7@gmail.com>', to: email, subject, html: htmlContent });
        res.send(`<body style="background:#030005;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;"><div style="background:#050505;border:1px solid #9333ea;padding:30px;border-radius:15px;text-align:center;"><h1>Action Processed Successfully</h1><p>Player: ${ign} (${action.toUpperCase()})</p></div></body>`);
    } catch (err) {
        res.status(500).send(`Error: ${err.message}`);
    }
});

// AI Route
app.post('/api/ai', async (req, res) => {
    if (!ai) return res.status(500).json({ error: "AI Core Offline." });
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: "Message missing." });

        const systemPrompt = "You are the ARISE SMP System AI, a dark-fantasy intelligent assistant for a competitive Minecraft server. Keep answers concise, helpful, and immersive.";
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${systemPrompt}\n\nUser: ${message}`
        });

        res.json({ reply: response.text });
    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).json({ error: "AI Core processing failed." });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

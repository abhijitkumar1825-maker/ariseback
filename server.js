require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🌐 CORS: ALLOW NETLIFY TO COMMUNICATE WITH RENDER
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// 🧠 INITIALIZE GEMINI AI CORE
let ai = null;
if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log("✅ Gemini AI Core Initialized successfully.");
} else {
    console.warn("⚠️ Gemini API Key missing. AI features will be offline.");
}

// 📧 NODEMAILER CONFIGURATION
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'arisesmp7@gmail.com',
        pass: process.env.EMAIL_PASS
    }
});

// Environment Variables
const SERVER_URL = process.env.SERVER_URL || 'https://ariseback.onrender.com';
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const STAFF_EMAIL = process.env.STAFF_EMAIL || 'arisesmp7@gmail.com';

// ==========================================
// ROUTE 1: RECEIVE BAN APPEAL (FROM NETLIFY)
// ==========================================
app.post('/api/appeal', async (req, res) => {
    try {
        const { ign, email, region, banDate, staff, reason, statement, ipv4, ipv6 } = req.body;

        if (!ign || !email || !reason) {
            return res.status(400).json({ success: false, error: 'Please fill in all required fields.' });
        }

        // Dual-Layer IP Tracking
        const forwarded = req.headers['x-forwarded-for'];
        const backendIP = forwarded ? forwarded.split(/, /)[0] : req.socket.remoteAddress;
        const finalIPv4 = ipv4 && ipv4 !== 'Unavailable' ? ipv4 : backendIP;
        const finalIPv6 = ipv6 && ipv6 !== 'Unavailable' ? ipv6 : 'N/A';

        // Action URLs for Discord buttons
        const acceptUrl = `${SERVER_URL}/api/appeal/action?action=accept&email=${encodeURIComponent(email)}&ign=${encodeURIComponent(ign)}`;
        const denyUrl = `${SERVER_URL}/api/appeal/action?action=deny&email=${encodeURIComponent(email)}&ign=${encodeURIComponent(ign)}`;

        // Send Discord Webhook WITH INTERACTIVE UI BUTTONS
        if (DISCORD_WEBHOOK) {
            const discordPayload = {
                content: "🚨 **NEW BAN APPEAL TICKET**",
                embeds: [{
                    color: 16711680,
                    title: `Player: ${ign}`,
                    description: `**📝 Reason Banned:**\n> ${reason}\n\n**💬 Statement:**\n> ${statement}`,
                    fields: [
                        { name: "👤 Username", value: ign, inline: true },
                        { name: "📧 Email", value: email, inline: true },
                        { name: "🌍 Region", value: region || 'N/A', inline: true },
                        { name: "👮 Banning Staff", value: staff || 'N/A', inline: true },
                        { name: "📡 IPv4", value: finalIPv4, inline: true },
                        { name: "🌐 IPv6", value: finalIPv6, inline: true }
                    ],
                    footer: { text: "ARISE SMP Secure Security Dispatch" },
                    timestamp: new Date().toISOString()
                }],
                components: [
                    {
                        type: 1,
                        components: [
                            { type: 2, style: 5, label: "✅ ACCEPT APPEAL", url: acceptUrl },
                            { type: 2, style: 5, label: "❌ DENY APPEAL", url: denyUrl }
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

        // Send Staff Email Backup
        const staffMailHtml = `
            <div style="font-family: Arial, sans-serif; background: #000000; color: #fff; padding: 25px; border: 1px solid #2e1065; border-radius: 12px;">
                <h2 style="color: #c084fc;">🚨 New Ban Appeal: ${ign}</h2>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Reason:</strong> ${reason}</p>
                <p><strong>Statement:</strong> ${statement}</p>
                <p><strong>Region:</strong> ${region || 'N/A'} | <strong>Staff:</strong> ${staff || 'N/A'}</p>
                <p><strong>IPv4:</strong> <span style="color: #ef4444; font-family: monospace;">${finalIPv4}</span></p>
                <p><strong>IPv6:</strong> <span style="color: #ef4444; font-family: monospace;">${finalIPv6}</span></p>
                <div style="margin-top: 25px;">
                    <a href="${acceptUrl}" style="background-color: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 15px; display: inline-block;">✅ ACCEPT APPEAL</a>
                    <a href="${denyUrl}" style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">❌ DENY APPEAL</a>
                </div>
            </div>
        `;

        await transporter.sendMail({
            from: '"ARISE SMP Appeals" <arisesmp7@gmail.com>',
            to: STAFF_EMAIL,
            subject: `New Ban Appeal Ticket - ${ign}`,
            html: staffMailHtml
        });

        res.json({ success: true, message: 'Appeal submitted successfully!' });
    } catch (err) {
        console.error("Appeal Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// ROUTE 2: ADMIN DISCORD ACTIONS (ACCEPT/DENY)
// ==========================================
app.get('/api/appeal/action', async (req, res) => {
    const { action, email, ign } = req.query;

    if (!action || !email || !ign) return res.status(400).send('<h1>Invalid Link Parameters</h1>');

    let subject = action === 'accept' ? 'ARISE SMP - Ban Appeal Accepted!' : 'ARISE SMP - Ban Appeal Status Update';
    let htmlContent = action === 'accept' 
        ? `<div style="font-family: Arial, sans-serif; padding: 25px; background: #000000; color: #fff; border: 1px solid #2e1065; border-radius: 12px;">
            <h2 style="color: #22c55e;">🎉 Ban Appeal Accepted!</h2>
            <p>Hello <strong>${ign}</strong>,</p>
            <p>Your ban appeal has been reviewed and <strong>ACCEPTED</strong>.</p>
            <p>You can now enjoy your journey back on the server!</p>
            <br><p style="color: #c084fc; font-weight: bold;">- ARISE SMP Administration Team</p>
           </div>`
        : `<div style="font-family: Arial, sans-serif; padding: 25px; background: #000000; color: #fff; border: 1px solid #2e1065; border-radius: 12px;">
            <h2 style="color: #ef4444;">❌ Ban Appeal Denied</h2>
            <p>Hello <strong>${ign}</strong>,</p>
            <p>Unfortunately, your appeal was denied by our staff team at this time.</p>
            <p>Sorry, but you can continue your journey elsewhere.</p>
            <br><p style="color: #c084fc; font-weight: bold;">- ARISE SMP Administration Team</p>
           </div>`;

    try {
        await transporter.sendMail({
            from: '"ARISE SMP Administration" <arisesmp7@gmail.com>',
            to: email, subject: subject, html: htmlContent
        });

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Action Processed</title>
                <style>
                    body { background-color: #000000; color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .theme-box { background-color: #050505; border: 1px solid #2e1065; padding: 35px; border-radius: 12px; text-align: center; max-width: 450px; box-shadow: 0 0 30px rgba(147, 51, 234, 0.4); }
                    h1 { margin-top: 0; text-transform: uppercase; letter-spacing: 1px; }
                    .success { color: #22c55e; text-shadow: 0 0 15px rgba(34, 197, 94, 0.5); }
                    .deny { color: #ef4444; text-shadow: 0 0 15px rgba(239, 68, 68, 0.5); }
                    p { color: #d1d5db; font-size: 16px; line-height: 1.6; }
                    .ign { color: #c084fc; font-weight: bold; text-shadow: 0 0 10px rgba(192, 132, 252, 0.7); font-family: monospace; font-size: 1.1em;}
                </style>
            </head>
            <body>
                <div class="theme-box">
                    <h1 class="${action === 'accept' ? 'success' : 'deny'}">
                        ${action === 'accept' ? '✅ Appeal Accepted' : '❌ Appeal Denied'}
                    </h1>
                    <p>Action successfully processed for player <span class="ign">${ign}</span>.</p>
                    <p>The automated response email has been dispatched.</p>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send(`<h1>Error sending email: ${err.message}</h1>`);
    }
});

// ==========================================
// ROUTE 3: GEMINI AI CONSOLE
// ==========================================
app.post('/api/ai', async (req, res) => {
    if (!ai) return res.status(500).json({ error: "Gemini AI Core Offline. API Key missing." });
    
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: "Message is required." });

        // ARISE SMP System Personality Prompt
        const systemPrompt = "You are the ARISE SMP System AI. You are a highly intelligent, slightly intimidating, but helpful dark-fantasy AI assistant for a competitive Minecraft server. Keep your answers concise, accurate, and in character. Do not use emojis unless absolutely necessary.";

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${systemPrompt}\n\nUser Query: ${message}`
        });

        res.json({ reply: response.text });
    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).json({ error: "Neural link severed. Failed to generate a response." });
    }
});

// ==========================================
// BOOT UP SERVER
// ==========================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 ARISE SMP Backend Engine running on port ${PORT}`);
});

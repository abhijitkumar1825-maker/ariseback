require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Clean URL Routes for all pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/appeal', (req, res) => res.sendFile(path.join(__dirname, 'public', 'appeal.html')));
app.get('/ranks', (req, res) => res.sendFile(path.join(__dirname, 'public', 'ranks.html')));
app.get('/console', (req, res) => res.sendFile(path.join(__dirname, 'public', 'console.html')));
app.get('/rules', (req, res) => res.sendFile(path.join(__dirname, 'public', 'rules.html')));

// Nodemailer transporter configured with arisesmp7@gmail.com
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'arisesmp7@gmail.com',
        pass: process.env.EMAIL_PASS // Gmail App Password
    }
});

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const STAFF_EMAIL = process.env.STAFF_EMAIL || 'arisesmp7@gmail.com';

// 1. Receive Ban Appeal from Frontend Form
app.post('/api/appeal', async (req, res) => {
    try {
        const { ign, email, region, banDate, staff, reason, statement } = req.body;

        if (!ign || !email || !reason) {
            return res.status(400).json({ success: false, error: 'Please fill in all required fields.' });
        }

        // SECURE IP CAPTURE: Gets IP natively from Node.js
        const forwarded = req.headers['x-forwarded-for'];
        const secureIP = forwarded ? forwarded.split(/, /)[0] : req.socket.remoteAddress;

        // Action URLs for links
        const acceptUrl = `${SERVER_URL}/api/appeal/action?action=accept&email=${encodeURIComponent(email)}&ign=${encodeURIComponent(ign)}`;
        const denyUrl = `${SERVER_URL}/api/appeal/action?action=deny&email=${encodeURIComponent(email)}&ign=${encodeURIComponent(ign)}`;

        // Send Discord Webhook with Clickable Hyperlinks (Standard Webhooks don't support UI buttons)
        if (DISCORD_WEBHOOK) {
            const discordPayload = {
                content: "🚨 **NEW BAN APPEAL TICKET**",
                embeds: [{
                    color: 16711680,
                    title: `Player: ${ign}`,
                    description: `**📝 Reason Banned:**\n> ${reason}\n\n**💬 Statement:**\n> ${statement}\n\n**⚡ ADMIN ACTIONS:**\n> **[✅ ACCEPT APPEAL](${acceptUrl})**  |  **[❌ DENY APPEAL](${denyUrl})**`,
                    fields: [
                        { name: "👤 Minecraft Username", value: ign, inline: true },
                        { name: "📧 Email", value: email, inline: true },
                        { name: "🌍 Region / Country", value: region || 'N/A', inline: true },
                        { name: "📅 Ban Date", value: banDate || 'N/A', inline: true },
                        { name: "👮 Staff", value: staff || 'N/A', inline: true },
                        { name: "📡 Server-Detected IP", value: secureIP || 'Unknown', inline: false }
                    ],
                    footer: { text: "ARISE SMP Secure Security & Appeal Dispatch" },
                    timestamp: new Date().toISOString()
                }]
            };

            await fetch(DISCORD_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(discordPayload)
            });
        }

        // Send Staff Email with Green and Red Buttons (Dark Theme)
        const staffMailHtml = `
            <div style="font-family: Arial, sans-serif; background: #000000; color: #fff; padding: 25px; border: 1px solid #2e1065; border-radius: 12px;">
                <h2 style="color: #c084fc;">🚨 New Ban Appeal: ${ign}</h2>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Reason:</strong> ${reason}</p>
                <p><strong>Statement:</strong> ${statement}</p>
                <p><strong>Region:</strong> ${region || 'N/A'} | <strong>Staff:</strong> ${staff || 'N/A'}</p>
                <p><strong>Detected IP:</strong> <span style="color: #ef4444; font-family: monospace;">${secureIP}</span></p>
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
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Handle Admin Accept/Deny Action Click
app.get('/api/appeal/action', async (req, res) => {
    const { action, email, ign } = req.query;

    if (!action || !email || !ign) {
        return res.status(400).send('<h1>Invalid Link Parameters</h1>');
    }

    let subject = '';
    let htmlContent = '';

    if (action === 'accept') {
        subject = 'ARISE SMP - Ban Appeal Accepted!';
        htmlContent = `
            <div style="font-family: Arial, sans-serif; padding: 25px; background: #000000; color: #fff; border: 1px solid #2e1065; border-radius: 12px;">
                <h2 style="color: #22c55e;">🎉 Ban Appeal Accepted!</h2>
                <p>Hello <strong>${ign}</strong>,</p>
                <p>Good news! Your ban appeal for <strong>ARISE SMP</strong> has been reviewed and <strong>ACCEPTED</strong>.</p>
                <p>You can now enjoy your journey back on the server. Welcome back!</p>
                <br>
                <p style="color: #c084fc; font-weight: bold;">- ARISE SMP Administration Team</p>
            </div>
        `;
    } else if (action === 'deny') {
        subject = 'ARISE SMP - Ban Appeal Status Update';
        htmlContent = `
            <div style="font-family: Arial, sans-serif; padding: 25px; background: #000000; color: #fff; border: 1px solid #2e1065; border-radius: 12px;">
                <h2 style="color: #ef4444;">❌ Ban Appeal Denied</h2>
                <p>Hello <strong>${ign}</strong>,</p>
                <p>Your ban appeal for <strong>ARISE SMP</strong> has been reviewed by our staff team.</p>
                <p>Unfortunately, your appeal was denied at this time. Sorry, but you can continue your journey back elsewhere.</p>
                <br>
                <p style="color: #c084fc; font-weight: bold;">- ARISE SMP Administration Team</p>
            </div>
        `;
    } else {
        return res.status(400).send('<h1>Invalid Action</h1>');
    }

    try {
        await transporter.sendMail({
            from: '"ARISE SMP Administration" <arisesmp7@gmail.com>',
            to: email,
            subject: subject,
            html: htmlContent
        });

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Action Processed</title>
                <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body class="bg-black text-white flex items-center justify-center h-screen font-sans">
                <div class="bg-[#050505] border border-[#2e1065] p-8 rounded-2xl text-center max-w-md shadow-[0_0_25px_rgba(88,28,135,0.2)]">
                    <h1 class="text-3xl font-bold mb-4 ${action === 'accept' ? 'text-green-400' : 'text-red-400'}">
                        ${action === 'accept' ? '✅ Appeal Accepted!' : '❌ Appeal Denied!'}
                    </h1>
                    <p class="text-gray-300 mb-6">Successfully processed action for player <span class="text-[#c084fc] font-mono font-bold">${ign}</span> (${email}). An email has been sent to them.</p>
                    <a href="/" class="bg-gradient-to-r from-[#4c1d95] to-[#9333ea] border border-[#a855f7] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] px-6 py-3 rounded-xl font-bold text-white transition block">Back to Home</a>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error(err);
        res.status(500).send(`<h1>Error sending email: ${err.message}</h1>`);
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`ARISE SMP Server running on port ${PORT}`));
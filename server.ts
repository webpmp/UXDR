import express from 'express';
import { createServer as createViteServer } from 'vite';
import cookieParser from 'cookie-parser';
import { google } from 'googleapis';
import fetch from 'node-fetch';
import crypto from 'crypto';
import path from 'path';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

// In-memory or fallback secret for encryption/decryption
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;

function encrypt(text: string) {
    if (!text) return text;
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string) {
    if (!text) return text;
    let textParts = text.split(':');
    let iv = Buffer.from(textParts.shift()!, 'hex');
    let encryptedText = Buffer.from(textParts.join(':'), 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

// -------------------------------------------------------------
// Google Calendar OAuth
// -------------------------------------------------------------
function getGoogleAuth(redirectUri: string) {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID || 'mock-google-client-id',
        process.env.GOOGLE_CLIENT_SECRET || 'mock-google-client-secret',
        redirectUri
    );
}

app.get('/api/calendar/auth/google/url', (req, res) => {
    // Need exact redirectUri configured in Google Cloud
    const redirectUri = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers.host}/api/calendar/auth/google/callback`;
    const oauth2Client = getGoogleAuth(redirectUri);
    
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent', // Force to get refresh token
        scope: ['https://www.googleapis.com/auth/calendar.events']
    });
    
    res.json({ url });
});

app.get('/api/calendar/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.send('No code returned');
    
    try {
        const redirectUri = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers.host}/api/calendar/auth/google/callback`;
        const oauth2Client = getGoogleAuth(redirectUri);
        const { tokens } = await oauth2Client.getToken(code as string);
        
        const payload = JSON.stringify({
            provider: 'google',
            accessToken: encrypt(tokens.access_token || ''),
            refreshToken: encrypt(tokens.refresh_token || ''),
            expiryDate: tokens.expiry_date
        });
        
        res.send(`
            <html><body><script>
                if (window.opener) {
                    window.opener.postMessage({ type: 'CALENDAR_AUTH_SUCCESS', payload: ${payload} }, '*');
                    window.close();
                } else {
                    window.location.href = '/settings';
                }
            </script></body></html>
        `);
    } catch (err) {
        console.error('Google Auth Error:', err);
        res.send('Authentication failed');
    }
});

// -------------------------------------------------------------
// Outlook Calendar OAuth (MS Graph)
// -------------------------------------------------------------
app.get('/api/calendar/auth/outlook/url', (req, res) => {
    const redirectUri = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers.host}/api/calendar/auth/outlook/callback`;
    const clientId = process.env.OUTLOOK_CLIENT_ID || 'mock-outlook-client-id';
    
    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        response_mode: 'query',
        scope: 'offline_access Calendars.ReadWrite',
    });
    
    res.json({ url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}` });
});

app.get('/api/calendar/auth/outlook/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.send('No code returned');
    
    try {
        const redirectUri = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers.host}/api/calendar/auth/outlook/callback`;
        const clientId = process.env.OUTLOOK_CLIENT_ID || 'mock-outlook-client-id';
        const clientSecret = process.env.OUTLOOK_CLIENT_SECRET || 'mock-outlook-client-secret';
        
        const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                scope: 'offline_access Calendars.ReadWrite',
                code: code as string,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
                client_secret: clientSecret
            })
        });
        
        const tokens: any = await tokenRes.json();
        
        if (!tokens.access_token) throw new Error('No access token');
        
        const payload = JSON.stringify({
            provider: 'outlook',
            accessToken: encrypt(tokens.access_token),
            refreshToken: encrypt(tokens.refresh_token),
            expiryDate: Date.now() + (tokens.expires_in * 1000)
        });
        
        res.send(`
            <html><body><script>
                if (window.opener) {
                    window.opener.postMessage({ type: 'CALENDAR_AUTH_SUCCESS', payload: ${payload} }, '*');
                    window.close();
                } else {
                    window.location.href = '/settings';
                }
            </script></body></html>
        `);
    } catch (err) {
        console.error('Outlook Auth Error:', err);
        res.send('Authentication failed');
    }
});

// -------------------------------------------------------------
// Calendar Sync Event Handler
// -------------------------------------------------------------
app.post('/api/calendar/sync-event', async (req, res) => {
    try {
        const { provider, accessToken, refreshToken, eventData } = req.body;
        // eventData: { id, title, start, end, description, action: 'create' | 'update' | 'delete', externalEventId? }
        
        const plainAccess = decrypt(accessToken);
        const plainRefresh = decrypt(refreshToken);
        
        let externalId = eventData.externalEventId;
        
        if (provider === 'google') {
            const oauth2Client = getGoogleAuth('');
            oauth2Client.setCredentials({ access_token: plainAccess, refresh_token: plainRefresh });
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
            
            if (eventData.action === 'delete' && externalId) {
                await calendar.events.delete({ calendarId: 'primary', eventId: externalId });
            } else {
                const gEvent = {
                    summary: eventData.title,
                    description: eventData.description,
                    start: { dateTime: new Date(eventData.start).toISOString() },
                    end: { dateTime: new Date(eventData.end).toISOString() }
                };
                if (eventData.action === 'update' && externalId) {
                    await calendar.events.update({ calendarId: 'primary', eventId: externalId, requestBody: gEvent });
                } else {
                    const created = await calendar.events.insert({ calendarId: 'primary', requestBody: gEvent });
                    externalId = created.data.id;
                }
            }
        } else if (provider === 'outlook') {
            // Very simplified Outlook sync payload
            const headers = { 'Authorization': `Bearer ${plainAccess}`, 'Content-Type': 'application/json' };
            
            if (eventData.action === 'delete' && externalId) {
                await fetch(`https://graph.microsoft.com/v1.0/me/events/${externalId}`, { method: 'DELETE', headers });
            } else {
                const mEvent = {
                    subject: eventData.title,
                    body: { contentType: 'Text', content: eventData.description },
                    start: { dateTime: new Date(eventData.start).toISOString(), timeZone: 'UTC' },
                    end: { dateTime: new Date(eventData.end).toISOString(), timeZone: 'UTC' }
                };
                if (eventData.action === 'update' && externalId) {
                    await fetch(`https://graph.microsoft.com/v1.0/me/events/${externalId}`, {
                        method: 'PATCH', headers, body: JSON.stringify(mEvent)
                    });
                } else {
                    const outRes = await fetch('https://graph.microsoft.com/v1.0/me/events', {
                        method: 'POST', headers, body: JSON.stringify(mEvent)
                    });
                    const created: any = await outRes.json();
                    externalId = created.id;
                }
            }
        }
        
        res.json({ success: true, externalEventId: externalId });
    } catch (err: any) {
        console.error('Sync Error:', err);
        res.status(500).json({ success: false, error: err.message || 'Unknown error during sync' });
    }
});


app.post('/api/calendar/free-busy', async (req, res) => {
    try {
        const { provider, accessToken, refreshToken, timeMin, timeMax } = req.body;
        
        const plainAccess = decrypt(accessToken);
        const plainRefresh = decrypt(refreshToken);
        
        const busyBlocks: { start: string, end: string }[] = [];
        
        if (provider === 'google') {
            const oauth2Client = getGoogleAuth('');
            oauth2Client.setCredentials({ access_token: plainAccess, refresh_token: plainRefresh });
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
            
            const fbRes = await calendar.freebusy.query({
                requestBody: {
                    timeMin,
                    timeMax,
                    items: [{ id: 'primary' }]
                }
            });
            const busy = fbRes.data.calendars?.['primary']?.busy || [];
            busy.forEach(b => {
                if (b.start && b.end) busyBlocks.push({ start: b.start, end: b.end });
            });
        } else if (provider === 'outlook') {
            const headers = { 
                'Authorization': `Bearer ${plainAccess}`, 
                'Content-Type': 'application/json',
                'Prefer': 'outlook.timezone="UTC"'
            };
            
            // Get user's email first for the free/busy query
            const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', { headers });
            const profileData: any = await profileRes.json();
            
            const scheduleRes = await fetch('https://graph.microsoft.com/v1.0/me/calendar/getSchedule', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    schedules: [profileData.userPrincipalName],
                    startTime: { dateTime: timeMin, timeZone: 'UTC' },
                    endTime: { dateTime: timeMax, timeZone: 'UTC' },
                    availabilityViewInterval: 60
                })
            });
            
            const scheduleData: any = await scheduleRes.json();
            if (scheduleData.value && scheduleData.value.length > 0) {
                const items = scheduleData.value[0].scheduleItems || [];
                items.forEach((item: any) => {
                    if (item.status === 'busy' || item.status === 'oof' || item.status === 'tentative') {
                        busyBlocks.push({
                            start: item.start.dateTime + 'Z',
                            end: item.end.dateTime + 'Z'
                        });
                    }
                });
            }
        }
        
        res.json({ success: true, busyBlocks });
    } catch (err: any) {
        console.error('Free/Busy Error:', err);
        // Explicitly format errors like token expired
        res.status(500).json({ success: false, error: err.message || 'Unknown error getting free/busy' });
    }
});

async function startServer() {
    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*all', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();

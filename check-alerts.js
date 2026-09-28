const https = require('https');
const fs = require('fs');

const FINNHUB_KEY = process.env.FINNHUB_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

function getPrice(symbol) {
  return new Promise((resolve, reject) => {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.c === 0 || !json.c) {
            reject(new Error(`No price for ${symbol}`));
          } else {
            resolve(json.c);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const body = JSON.stringify({
    chat_id: CHAT_ID,
    text: text,
    parse_mode: 'HTML'
  });

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  let alerts;
  try {
    alerts = JSON.parse(fs.readFileSync('alerts.json', 'utf8'));
  } catch (e) {
    console.error('Failed to read alerts.json:', e.message);
    return;
  }

  console.log(`Checking ${alerts.length} alerts...`);

  for (const alert of alerts) {
    try {
      const currentPrice = await getPrice(alert.symbol);
      console.log(`${alert.symbol}: current = ${currentPrice}, target = ${alert.price}`);

      // שולח התראה אם המחיר עבר את היעד (עם מרווח קטן)
      const diff = Math.abs(currentPrice - alert.price);
      if (diff < (alert.price * 0.005) || diff < 0.5) {  // 0.5% או 0.5 דולר
        const message = `🚨 Price Alert\n${alert.symbol} Crossing ${alert.price} (${alert.note || 'מחיר שהוגדר להתראה'})\nCurrent: $${currentPrice.toFixed(2)}`;
        await sendTelegram(message);
        console.log('✅ Alert sent for', alert.symbol);
      } else {
        console.log(`No trigger for ${alert.symbol} (diff = ${diff.toFixed(2)})`);
      }
    } catch (err) {
      console.error(`Error with ${alert.symbol}:`, err.message);
    }
  }
}

main();

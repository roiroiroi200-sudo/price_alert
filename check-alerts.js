const https = require('https');
const fs = require('fs');

const FINNHUB_KEY = process.env.FINNHUB_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

console.log('FINNHUB_KEY exists:', !!FINNHUB_KEY);
console.log('TELEGRAM_TOKEN exists:', !!TELEGRAM_TOKEN);
console.log('CHAT_ID exists:', !!CHAT_ID);

function getPrice(symbol) {
  return new Promise((resolve, reject) => {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`;
    console.log('Requesting:', url.replace(FINNHUB_KEY, '***'));

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Raw response for ${symbol}:`, data);
        try {
          const json = JSON.parse(data);
          if (!json.c || json.c === 0) {
            reject(new Error(`No price for ${symbol} - response: ${data}`));
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
    text: text
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
      res.on('end', () => {
        console.log('Telegram response:', data);
        resolve(data);
      });
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

      const diff = Math.abs(currentPrice - alert.price);
      const threshold = Math.max(alert.price * 0.005, 0.5);

      if (diff < threshold) {
        const message = `🚨 Price Alert\n${alert.symbol} Crossing ${alert.price} (${alert.note || 'מחיר שהוגדר להתראה'})\nCurrent: $${currentPrice.toFixed(2)}`;
        await sendTelegram(message);
        console.log('✅ Alert sent for', alert.symbol);
      } else {
        console.log(`No trigger for ${alert.symbol} (diff = ${diff.toFixed(2)}, threshold = ${threshold.toFixed(2)})`);
      }
    } catch (err) {
      console.error(`Error with ${alert.symbol}:`, err.message);
    }
  }
}

main();

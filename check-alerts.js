const https = require('https');
const fs = require('fs');

const FINNHUB_KEY = process.env.FINNHUB_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

async function getPrice(symbol) {
  return new Promise((resolve, reject) => {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.c); // current price
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function sendTelegram(text) {
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
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const alerts = JSON.parse(fs.readFileSync('alerts.json', 'utf8'));
  
  for (const alert of alerts) {
    try {
      const currentPrice = await getPrice(alert.symbol);
      console.log(`${alert.symbol}: ${currentPrice}`);

      // פשוט Crossing – אם המחיר עבר את היעד (בקירוב)
      if (Math.abs(currentPrice - alert.price) < 0.15) {
        const message = `🚨 Price Alert\n${alert.symbol} Crossing ${alert.price} (${alert.note || 'מחיר שהוגדר להתראה'})`;
        await sendTelegram(message);
        console.log('Alert sent:', message);
      }
    } catch (err) {
      console.error(`Error with ${alert.symbol}:`, err.message);
    }
  }
}

main();

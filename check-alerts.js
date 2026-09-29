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
          if (!json.c || json.c === 0) {
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
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync('state.json', 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.writeFileSync('state.json', JSON.stringify(state, null, 2));
}

async function main() {
  const alerts = JSON.parse(fs.readFileSync('alerts.json', 'utf8'));
  const state = loadState();

  console.log(`Checking ${alerts.length} alerts...`);

  for (const alert of alerts) {
    try {
      const currentPrice = await getPrice(alert.symbol);
      const previousPrice = state[alert.symbol];

      console.log(`${alert.symbol}: current = ${currentPrice}, previous = ${previousPrice || 'none'}, target = ${alert.price}`);

      let crossed = false;

      if (previousPrice !== undefined) {
        // בודק אם המחיר עבר את היעד
        if ((previousPrice < alert.price && currentPrice >= alert.price) ||
            (previousPrice > alert.price && currentPrice <= alert.price)) {
          crossed = true;
        }
      }

      if (crossed) {
        const message = `🚨 Price Alert\n${alert.symbol} Crossing ${alert.price} (${alert.note || 'מחיר שהוגדר להתראה'})\nCurrent: $${currentPrice.toFixed(2)}`;
        await sendTelegram(message);
        console.log('✅ Alert sent for', alert.symbol);
      } else {
        console.log(`No cross for ${alert.symbol}`);
      }

      // שומר את המחיר הנוכחי לפעם הבאה
      state[alert.symbol] = currentPrice;

    } catch (err) {
      console.error(`Error with ${alert.symbol}:`, err.message);
    }
  }

  saveState(state);
  console.log('State saved.');
}

main();

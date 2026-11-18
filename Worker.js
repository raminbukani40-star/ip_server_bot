
export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("IP SERVER Bot is running!", {
        status: 200
      });
    }

    if (!env.BOT_TOKEN) {
      return new Response("BOT_TOKEN is missing", {
        status: 500
      });
    }

    try {
      const update = await request.json();

      if (!update.message || !update.message.text) {
        return new Response("OK");
      }

      const chatId = update.message.chat.id;
      const text = update.message.text.trim();

      let answer = "";

      if (text === "/start") {
        answer =
          "سلام! به IP SERVER خوش آمدید.\n\n" +
          "برای تحلیل، آدرس IP را ارسال کنید.\n\n" +
          "مثال:\n192.168.1.1\n\n" +
          "برای راهنما از /help استفاده کنید.";
      } 
      else if (text === "/help") {
        answer =
          "راهنمای IP SERVER\n\n" +
          "یک آدرس IPv4 ارسال کنید.\n" +
          "مثال:\n192.168.1.1\n" +
          "یا:\n192.168.1.1/24";
      } 
      else {
        answer = analyzeIP(text);
      }

      await sendMessage(env.BOT_TOKEN, chatId, answer);

      return new Response("OK");

    } catch (error) {
      return new Response("Error: " + error.message, {
        status: 500
      });
    }
  }
};


// ارسال پیام به تلگرام
async function sendMessage(token, chatId, text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: text
    })
  });
}


// تبدیل IP به عدد
function ipToNumber(ip) {
  const parts = ip.split(".").map(Number);

  return (
    ((parts[0] << 24) >>> 0) +
    (parts[1] << 16) +
    (parts[2] << 8) +
    parts[3]
  ) >>> 0;
}


// تبدیل عدد به IP
function numberToIP(number) {
  return [
    (number >>> 24) & 255,
    (number >>> 16) & 255,
    (number >>> 8) & 255,
    number & 255
  ].join(".");
}


// اعتبارسنجی IPv4
function isValidIP(ip) {
  const parts = ip.split(".");

  if (parts.length !== 4) return false;

  return parts.every(part =>
    /^\d{1,3}$/.test(part) &&
    Number(part) >= 0 &&
    Number(part) <= 255
  );
}


// تشخیص نوع آدرس
function getIPType(ip) {
  const p = ip.split(".").map(Number);

  if (
    p[0] === 10 ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168)
  ) {
    return "Private";
  }

  return "Public";
}


// تحلیل کامل IP
function analyzeIP(input) {
  const parts = input.split("/");

  const ip = parts[0];

  if (!isValidIP(ip)) {
    return "آدرس IP واردشده معتبر نیست.\nمثال: 192.168.1.1";
  }

  const p = ip.split(".").map(Number);
  const first = p[0];

  let ipClass = "";

  if (first >= 1 && first <= 126) {
    ipClass = "A";
  } else if (first >= 128 && first <= 191) {
    ipClass = "B";
  } else if (first >= 192 && first <= 223) {
    ipClass = "C";
  } else if (first >= 224 && first <= 239) {
    ipClass = "D";
  } else {
    ipClass = "E";
  }

  let prefix;

  if (parts.length === 1) {
    if (ipClass === "A") prefix = 8;
    else if (ipClass === "B") prefix = 16;
    else prefix = 24;
  } else {
    if (!/^\d{1,2}$/.test(parts[1])) {
      return "مقدار CIDR معتبر نیست.";
    }

    prefix = Number(parts[1]);
  }

  if (prefix < 0 || prefix > 32) {
    return "CIDR باید بین 0 تا 32 باشد.";
  }

  const ipNumber = ipToNumber(ip);

  const mask = prefix === 0
    ? 0
    : (0xffffffff << (32 - prefix)) >>> 0;

  const network = (ipNumber & mask) >>> 0;

  const wildcard = (~mask) >>> 0;

  const broadcast = (network | wildcard) >>> 0;

  const totalAddresses = Math.pow(2, 32 - prefix);

  let usableHosts;

  if (prefix === 32) {
    usableHosts = 1;
  } else if (prefix === 31) {
    usableHosts = 2;
  } else {
    usableHosts = Math.max(0, totalAddresses - 2);
  }

  const hostID = ipNumber - network;

  const subnetMask = numberToIP(mask);
  const networkID = numberToIP(network);
  const broadcastIP = numberToIP(broadcast);

  return (
    "📊 گزارش تحلیل IP\n\n" +

    "IP: " + ip + "\n" +

    "کلاس IP: " + ipClass + "\n" +

    "CIDR: /" + prefix + "\n" +

    "Subnet Mask: " + subnetMask + "\n" +

    "Network ID: " + networkID + "\n" +

    "Host ID: " + hostID + "\n" +

    "Broadcast: " + broadcastIP + "\n\n" +

    "تعداد کل آدرس‌ها: " + totalAddresses + "\n" +

    "تعداد آدرس‌های قابل استفاده: " + usableHosts + "\n\n" +

    "نوع آدرس: " + getIPType(ip)
  );
}

const crypto = require('crypto');

const PIXEL_ID = 'a2_hx82f0ng04um';
const CAPI_URL = `https://ads-api.reddit.com/api/v3/pixels/${PIXEL_ID}/conversion_events`;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const token = process.env.REDDIT_CAPI_ACCESS_TOKEN;
  if (!token) {
    console.error('REDDIT_CAPI_ACCESS_TOKEN is not set');
    return { statusCode: 500, body: 'Server not configured' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { conversionId, email, phone, screenWidth, screenHeight } = payload;
  if (!conversionId) {
    return { statusCode: 400, body: 'conversionId is required' };
  }

  const ip =
    event.headers['x-nf-client-connection-ip'] ||
    (event.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const userAgent = event.headers['user-agent'];

  const user = {};
  if (ip) user.ip_address = ip;
  if (userAgent) user.user_agent = userAgent;
  if (screenWidth && screenHeight) {
    user.screen_dimensions = { width: screenWidth, height: screenHeight };
  }
  if (email) user.email = sha256(email.trim().toLowerCase());
  if (phone) {
    const digitsOnly = phone.replace(/[^\d]/g, '');
    if (digitsOnly) user.phone_number = sha256(digitsOnly);
  }

  const body = {
    data: {
      events: [
        {
          event_at: Date.now(),
          action_source: 'website',
          type: {
            tracking_type: 'CUSTOM',
            custom_event_name: 'Sent an Inquiry',
          },
          user,
          metadata: {
            item_count: 1,
            currency: 'USD',
            value: 1,
            conversion_id: conversionId,
          },
        },
      ],
    },
  };

  try {
    const res = await fetch(CAPI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('Reddit CAPI error', res.status, text);
      return { statusCode: 502, body: text };
    }
    return { statusCode: 200, body: text };
  } catch (err) {
    console.error('Reddit CAPI request failed', err);
    return { statusCode: 502, body: 'Upstream request failed' };
  }
};

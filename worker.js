export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'ok',
        message: 'WhatsApp Unban API is running',
        usage: 'POST / with JSON body: phone_number, email, platform, message'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        const { phone_number, email, platform, message } = body;

        if (!phone_number || !email || !message) {
          return new Response(JSON.stringify({
            error: 'Missing required fields'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const platformNames = {
          'android': 'Android',
          'iphone': 'iPhone',
          'web': 'WhatsApp Web/Desktop',
          'kaios': 'KaiOS',
          'other': 'Other'
        };

        const subject = encodeURIComponent('WhatsApp Ban Appeal - ' + phone_number);

        const emailBody = encodeURIComponent(
`Dear WhatsApp Support Team,

I am writing to request a review of my WhatsApp account ban.

Phone Number: ${phone_number}
Email: ${email}
Platform: ${platformNames[platform] || platform}

Details:
${message}

I kindly request that you review my account and restore access. I believe this ban may have been issued in error and I would appreciate a thorough review of my case.

Thank you for your time and assistance.

Best regards,
${email}`
        );

        const whatsappEmails = {
          'android': 'android_web@support.whatsapp.com',
          'iphone': 'iphone_web@support.whatsapp.com',
          'web': 'support@support.whatsapp.com',
          'kaios': 'support@support.whatsapp.com',
          'other': 'support@support.whatsapp.com'
        };

        const toEmail = whatsappEmails[platform] || 'support@support.whatsapp.com';

        // Send email via Cloudflare Email Workers API
        const emailSent = await sendEmail(env, toEmail, subject, emailBody, email);

        if (emailSent) {
          return new Response(JSON.stringify({
            success: true,
            message: 'Email sent successfully to WhatsApp support',
            to: toEmail,
            timestamp: new Date().toISOString()
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          // Fallback: return mailto link
          const mailtoLink = `mailto:${toEmail}?subject=${subject}&body=${emailBody}`;
          return new Response(JSON.stringify({
            success: false,
            message: 'Email sending failed. Use the mailto link below.',
            mailto: mailtoLink,
            to: toEmail,
            timestamp: new Date().toISOString()
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Internal server error',
          details: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }
};

async function sendEmail(env, to, subject, body, replyTo) {
  try {
    if (env.SEND_EMAIL) {
      const response = await env.SEND_EMAIL.send({
        to: [to],
        from: replyTo || 'noreply@workers.dev',
        subject: decodeURIComponent(subject),
        text: decodeURIComponent(body),
      });
      return true;
    }
  } catch (e) {
    console.log('Email Workers not configured:', e.message);
  }
  return false;
}

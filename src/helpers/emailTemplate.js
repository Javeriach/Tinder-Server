// Renders a clean, email-client-safe HTML email (table layout + inline styles
// so it survives Gmail, Outlook, Apple Mail, etc). Keep all styling inline.

const BRAND_NAME = 'Tinder';
const BRAND_COLOR = '#FD297B';
const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Public base URL of the frontend, for links/buttons in emails. */
const appUrl = () =>
  (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

/**
 * @param {object}   opts
 * @param {string}   opts.heading            - headline inside the card
 * @param {string|string[]} opts.body        - one or more paragraphs (may contain inline HTML)
 * @param {{label:string,url:string}} [opts.cta] - optional call-to-action button
 * @param {string}   [opts.preheader]        - hidden inbox-preview text
 * @returns {string} full HTML document
 */
const renderEmail = ({ heading, body, cta, preheader }) => {
  const paragraphs = (Array.isArray(body) ? body : [body])
    .filter((p) => p != null && p !== '')
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#3a3a3a;">${p}</p>`
    )
    .join('');

  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0 4px;">
         <tr>
           <td style="border-radius:999px;background:${BRAND_COLOR};">
             <a href="${cta.url}" target="_blank"
                style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;font-family:${FONT_STACK};">
               ${cta.label}
             </a>
           </td>
         </tr>
       </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  ${
    preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}</div>`
      : ''
  }
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#f4f4f5;padding:24px 12px;font-family:${FONT_STACK};">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:${BRAND_COLOR};padding:22px 32px;">
              <span style="font-size:22px;font-weight:700;letter-spacing:0.5px;color:#ffffff;">${BRAND_NAME}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;color:#1a1a1a;font-weight:700;">${heading}</h1>
              ${paragraphs}
              ${button}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #ededed;">
              <p style="margin:0;font-size:13px;line-height:1.5;color:#8a8a8a;">
                You're receiving this email because you have a ${BRAND_NAME} account.
                If this wasn't you, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#a8a8a8;">&copy; ${new Date().getFullYear()} ${BRAND_NAME}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

module.exports = { renderEmail, appUrl };

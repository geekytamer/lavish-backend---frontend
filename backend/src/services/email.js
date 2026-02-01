const { Resend } = require('resend');
const config = require('../config');

const resend = new Resend(config.resendApiKey);

/**
 * Send order confirmation email to customer
 */
async function sendOrderConfirmation({ email, orderId, total, items, shippingAddress }) {
    if (!email || !config.resendApiKey || config.resendApiKey === 're_placeholder_key') {
        console.log(`[EMAIL-MOCK] To: ${email} | Subject: Order Confirmed #${orderId}`);
        return;
    }

    const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product_name || 'Product'} x ${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">OMR ${item.line_total.toFixed(2)}</td>
    </tr>
  `).join('');

    try {
        await resend.emails.send({
            from: 'Lavish Fashion <orders@lavish.one>',
            to: email,
            subject: `Order Confirmed: #${orderId.slice(0, 8).toUpperCase()}`,
            html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; color: #333;">
          <h1 style="color: #ec4899;">Thank you for your order!</h1>
          <p>Hi there, we've received your payment and are working on your order.</p>
          <div style="border: 1px solid #eee; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h2 style="margin-top: 0;">Order Summary</h2>
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Shipping to:</strong> ${shippingAddress}</p>
            <table style="width: 100%; border-collapse: collapse;">
              ${itemsHtml}
              <tr>
                <td style="padding: 12px 8px; font-weight: bold;">Total</td>
                <td style="padding: 12px 8px; font-weight: bold; text-align: right;">OMR ${total.toFixed(2)}</td>
              </tr>
            </table>
          </div>
          <p style="font-size: 14px; color: #666;">If you have any questions, please reply to this email.</p>
        </div>
      `,
        });
    } catch (error) {
        console.error('Failed to send order confirmation email', error);
    }
}

/**
 * Send sale notification to vendor
 */
async function sendSaleNotification({ vendorEmail, vendorName, orderId, items }) {
    if (!vendorEmail || !config.resendApiKey || config.resendApiKey === 're_placeholder_key') {
        console.log(`[EMAIL-MOCK] To Vendor: ${vendorEmail} | Subject: New Sale!`);
        return;
    }

    const itemsHtml = items.map(item => `
    <li>${item.product_name} (${item.color}/${item.size}) x ${item.quantity}</li>
  `).join('');

    try {
        await resend.emails.send({
            from: 'Lavish Marketplace <sales@lavish.one>',
            to: vendorEmail,
            subject: `New Sale: Order #${orderId.slice(0, 8).toUpperCase()}`,
            html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; color: #333;">
          <h1 style="color: #0f172a;">New Sale Alert!</h1>
          <p>Hi ${vendorName}, you have a new order on Lavish.</p>
          <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <p><strong>Order ID:</strong> ${orderId}</p>
            <h3>Items to fulfill:</h3>
            <ul>${itemsHtml}</ul>
          </div>
          <p>Please log in to your dashboard to process this order.</p>
        </div>
      `,
        });
    } catch (error) {
        console.error('Failed to send sale notification email', error);
    }
}

/**
 * Send status update email to customer
 */
async function sendStatusUpdate({ email, orderId, status }) {
    if (!email || !config.resendApiKey || config.resendApiKey === 're_placeholder_key') {
        console.log(`[EMAIL-MOCK] To: ${email} | Subject: Order Updated: ${status}`);
        return;
    }

    try {
        await resend.emails.send({
            from: 'Lavish Fashion <status@lavish.one>',
            to: email,
            subject: `Order Update: #${orderId.slice(0, 8).toUpperCase()}`,
            html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; color: #333;">
          <h1 style="color: #ec4899;">Order Update</h1>
          <p>Good news! Your order status has been updated to: <strong>${status.toUpperCase()}</strong></p>
          <p>Order ID: ${orderId}</p>
          <p>You can track your order details in the app.</p>
        </div>
      `,
        });
    } catch (error) {
        console.error('Failed to send status update email', error);
    }
}

module.exports = {
    sendOrderConfirmation,
    sendSaleNotification,
    sendStatusUpdate,
};

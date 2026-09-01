const cron = require('node-cron');
const sendEmail = require('./sendEmail.js');
const { renderEmail, appUrl } = require('./emailTemplate.js');
const { startOfDay, endOfDay, subDays } = require('date-fns'); // Import necessary functions
const ConnectionRequest = require('../models/connectionrequest.js');

// Schedule the cron job to run at the 42nd minute of every hour
cron.schedule(' 23 9 * * * *', async () => {
  console.log('Cron job started - checking for pending connection requests');

  // Check an email transport is configured before running email tasks
  const hasGmail = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD;
  if (!hasGmail && !process.env.RESEND_API_KEY) {
    console.warn('No email transport configured. Skipping email cron job.');
    return;
  }

  // Get the starting time and ending time for the previous day
  const yesterday = subDays(new Date(), 1); // Get the previous day's date
  const startingTime = startOfDay(yesterday); // Start of the previous day (12:00 AM)
  const endingTime = endOfDay(yesterday); // End of the previous day (11:59:59 PM)

  try {
    // Fetch pending connection requests created within the previous day
    const pendingRequests = await ConnectionRequest.find({
      status: 'interested',
      createdAt: {
        $gte: startingTime,
        $lt: endingTime,
      },
    }).populate('fromUserId toUserId'); // Corrected the placement of .populate

    const listofEmails = [
      ...new Set(pendingRequests.map((req) => req.toUserId.email)),
    ];

    console.log(`Found ${listofEmails.length} emails to send notifications to`);

    //FOR LOOP USED TO SEND EMAILS IN SYCHRONOUS WAY-GOOD FOR LESS NO OF EMAILS LIKE 200
    const reviewUrl = `${appUrl()}/requests`;

    for (const email of listofEmails) {
      const result = await sendEmail.run(
        'You have pending connection requests on Tinder',
        `You have connection requests waiting for your review. ` +
          `Sign in to Tinder to accept or ignore them.\n\n${reviewUrl}`,
        {
          to: email,
          html: renderEmail({
            heading: 'You have pending connection requests',
            preheader: 'Someone is waiting to connect with you on Tinder',
            body: [
              `You have one or more connection requests waiting for your review.`,
              `Sign in to Tinder to accept or ignore them.`,
            ],
            cta: { label: 'Review requests', url: reviewUrl },
          }),
        }
      );

      if (result.error) {
        console.error(`Failed to send email to ${email}:`, result.error);
      } else {
        console.log(`Email sent successfully to ${email}`);
      }
    }
  } catch (error) {
    console.error('Cron job error:', error);
  }
});

const cron = require('node-cron');
const sendEmail = require('./sendEmail.js');
const { startOfDay, endOfDay, subDays } = require('date-fns'); // Import necessary functions
const ConnectionRequest = require('../models/connectionrequest.js');

// Schedule the cron job to run at the 42nd minute of every hour
cron.schedule(' 23 9 * * * *', async () => {
  console.log('Hello jea kanwal');

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

    //FOR LOOP USED TO SEND EMAILS IN SYCHRONOUS WAY-GOOD FOR LESS NO OF EMAILS LIKE 200
    for (const email of listofEmails) {
      await sendEmail.run(
        'Connection Requests Sent to ' +
          email +
          '.There are so many requests are pending. Kindly open the Tinder and review these requests.'
      );
    }
  } catch (error) {
    console.error('Error:', error);
  }
});

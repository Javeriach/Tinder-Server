const { SendEmailCommand } = require('@aws-sdk/client-ses');
const { sesClient } = require('./sesClient.js');

//Code
const createSendEmailCommand = (toAddress, fromAddress, subject, body) => {
  return new SendEmailCommand({
    Destination: {
      /* required */
      CcAddresses: [
        /* more items */
      ],
      ToAddresses: [
        toAddress,
        /* more To-email addresses */
      ],
    },
    Message: {
      /* required */
      Body: {
        /* required */
        Html: {
          Charset: 'UTF-8',
          Data: `<h1>${body}</h1>`,
        },
        Text: {
          Charset: 'UTF-8',
          Data: 'This is text format email',
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: subject,
      },
    },
    Source: fromAddress,
    ReplyToAddresses: [
      /* more items */
    ],
  });
};

///now we will call the above function is async function
const run = async (subject, body) => {
  // Check if AWS credentials are available
  if (!process.env.AWS_ACCESS_KEYS || !process.env.AWS_SECRET_KEYS) {
    console.warn('AWS credentials not found. Email sending disabled.');
    return { message: 'Email sending disabled - AWS credentials not configured' };
  }

  const sendEmailCommand = createSendEmailCommand(
    'javeriakanwal57@gmail.com',
    'javeriakanwal383@gmail.com',
    subject,
    body
  );

  try {
    return await sesClient.send(sendEmailCommand);
  } catch (caught) {
    if (caught instanceof Error && caught.name === 'MessageRejected') {
      const messageRejectedError = caught;
      return messageRejectedError;
    }
    console.error('Email sending failed:', caught.message);
    return { error: 'Email sending failed', details: caught.message };
  }
};

module.exports = { run };

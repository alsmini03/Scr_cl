/**
 * Gmail API utility to send emails.
 * Constructs a MIME message and sends it via Google's Gmail API.
 */
export async function sendGmail(accessToken: string, to: string, subject: string, body: string) {
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const messageParts = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    body,
  ];
  const message = messageParts.join('\n');

  // The body needs to be base64url encoded
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: encodedMessage,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    console.error('Gmail API error:', errorData);
    throw new Error('Gmail API failed to send email');
  }

  return await res.json();
}

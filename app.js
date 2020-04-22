const express = require('express');
const ngrok = require('ngrok');
const rp = require('request-promise-native');
const dialogflow = require('dialogflow');

const app = express();
const port = 3000;

app.use(express.json());

// Replace the values here.
process.env.GOOGLE_APPLICATION_CREDENTIALS = 'private_key.json';
const INSTANCE_URL = 'https://api.maytapi.com/api';
const PRODUCT_ID = '';
const PHONE_ID = '';
const API_TOKEN = '';
const PROJECT_ID = '';

if (!PRODUCT_ID || !PHONE_ID || !API_TOKEN) throw Error('You need to change PRODUCT_ID, PHONE_ID and API_KEY values in app.js file.');

async function send_message(body) {
	console.log(`Request Body:${JSON.stringify(body)}`);
	let url = `${INSTANCE_URL}/${PRODUCT_ID}/${PHONE_ID}/sendMessage`;
	let response = await rp(url, {
		method: 'post',
		json: true,
		body,
		headers: {
			'Content-Type': 'application/json',
			'x-maytapi-key': API_TOKEN,
		},
	});
	console.log(`Response: ${JSON.stringify(response)}`);
	return response;
}

async function runSample(text = 'hello', sessionId) {
	// A unique identifier for the given session

	// Create a new session
	const sessionClient = new dialogflow.SessionsClient();
	const sessionPath = sessionClient.sessionPath(PROJECT_ID, sessionId);

	// The text query request.
	const request = {
		session: sessionPath,
		queryInput: {
			text: {
				// The query to send to the dialogflow agent
				text,
				// The language used by the client (en-US)
				languageCode: 'en-US',
			},
		},
	};

	// Send request and log result
	const responses = await sessionClient.detectIntent(request);
	console.log('Detected intent');
	const result = responses[0].queryResult;
	console.log(`  Query: ${result.queryText}`);
	console.log(`  Response: ${result.fulfillmentText}`);
	if (result.intent) {
		console.log(`  Intent: ${result.intent.displayName}`);
	} else {
		console.log(`  No intent matched.`);
	}
	return result;
}

async function setup_network() {
	let public_url = await ngrok.connect(3000);
	console.log(`Public Url:${public_url}`);
	let webhook_url = `${public_url}/webhook`;
	let url = `${INSTANCE_URL}/${PRODUCT_ID}/setWebhook`;
	let response = await rp(url, {
		method: 'POST',
		body: { webhook: webhook_url },
		headers: {
			'x-maytapi-key': API_TOKEN,
			'Content-Type': 'application/json',
		},
		json: true,
	});
	console.log(`Response: ${JSON.stringify(response)}`);
}

app.get('/', (req, res) => res.send('Hello World!'));

app.post('/webhook', async (req, res) => {
	res.sendStatus(200);
	let { message, conversation } = req.body;
	let { type, text, fromMe } = message;
	if (fromMe) return;
	if (type === 'text') {
		let result = await runSample(text, conversation);
		if (result && result.fulfillmentText) {
			let body = {
				to_number: conversation,
				message: result.fulfillmentText,
				type: 'text',
			};
			await send_message(body);
		}
	} else {
		console.log(`Ignored Message Type:${type}`);
	}
});

app.listen(port, async () => {
	console.log(process.env.GOOGLE_APPLICATION_CREDENTIALS);
	console.log(`Example app listening at http://localhost:${port}`);
	await setup_network();
});

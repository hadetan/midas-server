const { google } = require('googleapis');
const path = require('path');
const Form = require('../models/Form.js');
const { SCOPES, RECIPIENTNUMBER } = require('../configs/index.js');
const googleSheetService = require('./googleSheet.service.js');
const serialNumberService = require('./serialNumber.service.js');
const { messageToWhatsapp } = require('./whatsappClient.service.js');

//#region Google authentication

const auth = new google.auth.GoogleAuth({
	keyFile: path.join(__dirname, '../auth/user-data-form-b8aa57f3e54a.json'),
	scopes: [SCOPES],
});

const sheets = google.sheets({ version: 'v4', auth });

//#endregion Google authentication

//#region Sending data

module.exports = async () => {
	try {
		// Fetch unprocessed data
		const newEntries = await Form.find({ isProcessed: false });
		if (newEntries.length === 0) {
			return console.log('No new entries to process');
		}

		const batchStart = await serialNumberService(newEntries.length);
		await googleSheetService(sheets, batchStart, newEntries);

		//#region Sending data to WhatsApp

		const message = newEntries
			.map((entry, index) => {
				return `Entry ${batchStart + 1 + index}:\nName: ${
					entry.name
				}\nPhone Number: ${entry.phone}\nEmail: ${
					entry.email
				}\nCourse: ${entry.course}\nMessage: ${entry.message}\n`;
			})
			.join('\n');

		const recipientNumber = Number(RECIPIENTNUMBER);
		await messageToWhatsapp(recipientNumber, message);

		//#endregion Sending data to WhatsApp

		const responseMessage = `${newEntries.length} new ${
			newEntries.length === 1 ? 'entry' : 'entries'
		} added to Google Sheet and sent to WhatsApp.`;

		// Mark entries as processed
		await Form.updateMany(
			{
				_id: {
					$in: newEntries.map((entry) => entry._id),
				},
			},
			{
				$set: {
					isProcessed: true,
				},
			}
		);

		return console.log(responseMessage);
	} catch (err) {
		return console.log(`Error while appending the data  ${err}`);
	}
};

//#endregion Sending data
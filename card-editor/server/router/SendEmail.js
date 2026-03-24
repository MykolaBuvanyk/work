import express from 'express';
import SendEmailForStatus from '../Controller/SendEmailForStatus.js';
const SendEmail = express();

SendEmail.post('/contact', SendEmailForStatus.Contact);

export default SendEmail;

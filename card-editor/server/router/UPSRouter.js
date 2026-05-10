import express from 'express';
import axios from 'axios';
import { Order, User } from '../models/models.js';
import SendEmailForStatus from '../Controller/SendEmailForStatus.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';
import dotenv from 'dotenv';
dotenv.config();

const UPSRouter = express.Router();

const UPS_SERVICES = {
  'ENV': 'UPS Envelope',
  'NDA': 'UPS Next Day Package',
  'E12': 'UPS Express before 12 PM',
  'SAT': 'UPS Saturday Delivery',
  '65': 'UPS Worldwide Saver',
  '07': 'UPS Worldwide Express',
  '08': 'UPS Worldwide Expedited',
  '11': 'UPS Standard',
  '54': 'UPS Express Plus',
};

async function getUpsToken() {
  const isSandbox = process.env.UPS_SANDBOX === 'true';
  const tokenUrl = isSandbox
    ? 'https://wwwcie.ups.com/security/v1/oauth/token'
    : 'https://onlinetools.ups.com/security/v1/oauth/token';

  const credentials = Buffer.from(
    `${process.env.UPS_CLIENT_ID}:${process.env.UPS_CLIENT_SECRET}`
  ).toString('base64');

  const response = await axios.post(tokenUrl, 'grant_type=client_credentials', {
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return response.data.access_token;
}

UPSRouter.post('/create-shipment', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { orderId, name, company, address, address2, address3, city, postalCode, country, phone, email, weight, serviceCode } = req.body;

    if (!orderId || !name || !address || !city || !postalCode || !country) {
      return res.status(400).json({ message: 'Missing required shipment fields' });
    }

    const isSandbox = process.env.UPS_SANDBOX === 'true';
    const shipUrl = isSandbox
      ? 'https://wwwcie.ups.com/api/shipments/v2403/ship'
      : 'https://onlinetools.ups.com/api/shipments/v2403/ship';

    const token = await getUpsToken();

    const isEnvelope = serviceCode === 'ENV';
    const isSaturday = serviceCode === 'SAT';
    const serviceMap = { 'ENV': '07', 'NDA': '07', 'E12': '54', 'SAT': '07' };
    const resolvedServiceCode = serviceMap[serviceCode] || serviceCode || '11';
    const packagingCode = isEnvelope ? '01' : '02';

    const payload = {
      ShipmentRequest: {
        Shipment: {
          Shipper: {
            Name: process.env.UPS_SHIPPER_NAME || 'SignXpert',
            AttentionName: process.env.UPS_SHIPPER_ATTENTION || 'SignXpert',
            ShipperNumber: process.env.UPS_SHIPPER_NUMBER,
            Phone: { Number: process.env.UPS_SHIPPER_PHONE || '' },
            Address: {
              AddressLine: [process.env.UPS_SHIPPER_ADDRESS || ''],
              City: process.env.UPS_SHIPPER_CITY || '',
              PostalCode: process.env.UPS_SHIPPER_POSTAL || '',
              CountryCode: process.env.UPS_SHIPPER_COUNTRY || 'DE',
            },
          },
          ShipTo: {
            Name: company || name,
            AttentionName: name,
            CompanyDisplayableName: company || undefined,
            Phone: { Number: String(phone || '').replace(/\s+/g, '') },
            EMailAddress: email || undefined,
            Address: {
              AddressLine: [address, address2, address3].filter(Boolean),
              City: city,
              PostalCode: postalCode,
              CountryCode: country.toUpperCase(),
            },
          },
          Description: 'Signs',
          Service: {
            Code: resolvedServiceCode,
            Description: UPS_SERVICES[serviceCode] || 'UPS Standard',
          },
          ShipmentServiceOptions: {
            ...(isSaturday ? { SaturdayDeliveryIndicator: '' } : {}),
            ...(email ? {
              Notification: {
                NotificationCode: '6',
                EMail: {
                  EMailAddress: [email],
                  FromEMailAddress: process.env.GMAIL_USER_SEND || 'info@sign-xpert.com',
                  FromName: 'SignXpert',
                  Subject: 'Your order has been shipped',
                  Memo: 'Your SignXpert order is on its way!',
                },
              },
            } : {}),
          },
          PaymentInformation: {
            ShipmentCharge: {
              Type: '01',
              BillShipper: {
                AccountNumber: process.env.UPS_SHIPPER_NUMBER,
              },
            },
          },
          Package: {
            Packaging: { Code: packagingCode },
            PackageWeight: {
              UnitOfMeasurement: { Code: 'KGS' },
              Weight: String(parseFloat(weight) || 1),
            },
          },
        },
        LabelSpecification: {
          LabelImageFormat: { Code: 'GIF' },
        },
      },
    };

    const response = await axios.post(shipUrl, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        transId: `order-${orderId}-${Date.now()}`,
        transactionSrc: 'SignXpert',
      },
    });

    const results = response.data?.ShipmentResponse?.ShipmentResults;
    const packageResults = results?.PackageResults;
    const trackingNumber =
      (Array.isArray(packageResults) ? packageResults[0] : packageResults)?.TrackingNumber ||
      results?.ShipmentIdentificationNumber;

    if (!trackingNumber) {
      throw new Error('UPS did not return a tracking number');
    }

    await Order.update(
      { trackingNumber, status: 'Shipped' },
      { where: { id: Number(orderId) } }
    );

    const orderWithUser = await Order.findOne({
      where: { id: Number(orderId) },
      include: [{ model: User }],
    });

    await Promise.allSettled([
      SendEmailForStatus.StatusShipped(orderWithUser),
      SendEmailForStatus.StatusShipped2(orderWithUser),
    ]);

    return res.json({ success: true, trackingNumber });
  } catch (err) {
    const upsData = err?.response?.data;
    console.error('UPS shipment error:', JSON.stringify(upsData, null, 2) || err.message);
    const upsMsg =
      upsData?.response?.errors?.[0]?.message ||
      upsData?.response?.errors?.[0]?.code ||
      upsData?.message ||
      err.message;
    return res.status(500).json({ message: upsMsg, detail: upsData?.response?.errors || [] });
  }
});

export default UPSRouter;

import express from 'express';
import axios from 'axios';
import { Order } from '../models/models.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';
import dotenv from 'dotenv';
dotenv.config();

const UPSRouter = express.Router();

const UPS_SERVICES = {
  'ENV': 'UPS Envelope',
  'NDA': 'UPS Next Day Package',
  'E12': 'UPS Express before 12 PM',
  'SAT': 'UPS Saturday Delivery',
  '01': 'UPS Next Day Air',
  '02': 'UPS 2nd Day Air',
  '03': 'UPS Ground',
  '07': 'UPS Worldwide Express',
  '08': 'UPS Worldwide Expedited',
  '11': 'UPS Standard',
  '12': 'UPS 3 Day Select',
  '13': 'UPS Next Day Air Saver',
  '14': 'UPS Next Day Air Early',
  '54': 'UPS Express Plus',
  '59': 'UPS 2nd Day Air AM',
  '65': 'UPS Worldwide Saver',
  '70': 'UPS Access Point Economy',
  '74': 'UPS Express 12:00',
  '82': 'UPS Today Standard',
  '83': 'UPS Today Dedicated Courier',
  '84': 'UPS Today Intercity',
  '85': 'UPS Today Express',
  '86': 'UPS Today Express Saver',
};

// Token cache — refresh 5 min before expiry (ready for Q3 2026 1-hour limit)
let _tokenCache = { token: null, expiresAt: 0 };

async function getUpsToken() {
  const now = Date.now();
  if (_tokenCache.token && now < _tokenCache.expiresAt) {
    return _tokenCache.token;
  }

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
    timeout: 8000,
  });

  const expiresIn = Number(response.data.expires_in || 3600);
  _tokenCache = {
    token: response.data.access_token,
    expiresAt: now + (expiresIn - 300) * 1000, // refresh 5 min early
  };

  return _tokenCache.token;
}

UPSRouter.post('/create-shipment', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { orderId, name, company, address, address2, address3, city, postalCode, country, phone, email, weight, length, width, height, declaredValue, serviceCode, schedulePickup, pickupDate, saturdayDelivery } = req.body;

    if (!orderId || !name || !address || !city || !postalCode || !country) {
      return res.status(400).json({ message: 'Missing required shipment fields' });
    }

    const isSandbox = process.env.UPS_SANDBOX === 'true';
    const shipUrl = isSandbox
      ? 'https://wwwcie.ups.com/api/shipments/v2403/ship'
      : 'https://onlinetools.ups.com/api/shipments/v2403/ship';

    const token = await getUpsToken();

    const isEnvelope = serviceCode === 'ENV';
    const isSaturday = serviceCode === 'SAT' || saturdayDelivery === true;
    const upsPickupDate = pickupDate ? pickupDate.replace(/-/g, '') : null;
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
            EMailAddress: process.env.GMAIL_USER_SEND || 'info@sign-xpert.com',
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
          ...(upsPickupDate ? { PickupDate: upsPickupDate } : {}),
          ShipmentServiceOptions: {
            ...(isSaturday ? { SaturdayDeliveryIndicator: '' } : {}),
            ...(schedulePickup ? { OnCallAirPickupIndicator: '' } : {}),
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
            ...(length && width && height ? {
              Dimensions: {
                UnitOfMeasurement: { Code: 'CM' },
                Length: String(length),
                Width: String(width),
                Height: String(height),
              },
            } : {}),
            ...(declaredValue ? {
              PackageServiceOptions: {
                DeclaredValue: {
                  CurrencyCode: 'EUR',
                  MonetaryValue: String(parseFloat(declaredValue).toFixed(2)),
                },
              },
            } : {}),
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
    const firstPackage = Array.isArray(packageResults) ? packageResults[0] : packageResults;
    const trackingNumber =
      firstPackage?.TrackingNumber ||
      results?.ShipmentIdentificationNumber;

    if (!trackingNumber) {
      throw new Error('UPS did not return a tracking number');
    }

    // Extract shipping label (base64 image)
    const labelBase64 = firstPackage?.ShippingLabel?.GraphicImage || null;
    const labelFormat = firstPackage?.ShippingLabel?.ImageFormat?.Code || 'GIF';

    await Order.update(
      { trackingNumber },
      { where: { id: Number(orderId) } }
    );

    let pickupConfirmation = null;
    if (schedulePickup && upsPickupDate) {
      const pickupUrl = isSandbox
        ? 'https://wwwcie.ups.com/api/pickup/v2409/pickupcreation'
        : 'https://onlinetools.ups.com/api/pickup/v2409/pickupcreation';
      try {

        const pickupPayload = {
          PickupCreationRequest: {
            RatePickupIndicator: 'N',
            Shipper: {
              Account: {
                AccountNumber: process.env.UPS_SHIPPER_NUMBER,
                AccountCountryCode: process.env.UPS_SHIPPER_COUNTRY || 'DE',
              },
            },
            PickupDateInfo: {
              CloseTime: '1700',
              ReadyTime: '0900',
              PickupDate: upsPickupDate,
            },
            PickupAddress: {
              CompanyName: process.env.UPS_SHIPPER_NAME || 'SignXpert',
              ContactName: process.env.UPS_SHIPPER_ATTENTION || 'SignXpert',
              AddressLine: process.env.UPS_SHIPPER_ADDRESS || '',
              City: process.env.UPS_SHIPPER_CITY || '',
              PostalCode: process.env.UPS_SHIPPER_POSTAL || '',
              CountryCode: process.env.UPS_SHIPPER_COUNTRY || 'DE',
              Phone: { Number: process.env.UPS_SHIPPER_PHONE || '' },
              ResidentialIndicator: 'N',
            },
            AlternateAddressIndicator: 'N',
            PickupPiece: [{
              ServiceCode: resolvedServiceCode,
              Quantity: '1',
              DestinationCountryCode: country.toUpperCase(),
              ContainerCode: '01',
            }],
            TotalWeight: {
              Weight: String(parseFloat(weight) || 1),
              UnitOfMeasurement: 'KGS',
            },
            OverweightIndicator: 'N',
            PaymentMethod: '00',
          },
        };

        const pickupResponse = await axios.post(pickupUrl, pickupPayload, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            transId: `pickup-${orderId}-${Date.now()}`,
            transactionSrc: 'SignXpert',
          },
          timeout: 10000,
        });

        pickupConfirmation = pickupResponse.data?.PickupCreationResponse?.PRN;
        console.log('Pickup scheduled, PRN:', pickupConfirmation);
      } catch (pickupErr) {
        const pickupMsg = pickupErr?.response?.data?.response?.errors?.[0]?.message || pickupErr.message;
        console.error('Pickup scheduling failed:', pickupMsg, 'Status:', pickupErr?.response?.status, 'URL:', pickupUrl);
        pickupConfirmation = null;
      }
    }

    return res.json({ success: true, trackingNumber, pickupConfirmation, labelBase64, labelFormat });
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

UPSRouter.post('/get-rates', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { address, city, postalCode, country, weight, length, width, height, saturdayDelivery } = req.body;
    if (!city || !postalCode || !country) return res.status(400).json({ message: 'City, PostalCode and Country are required' });

    const isSandbox = process.env.UPS_SANDBOX === 'true';
    const rateUrl = isSandbox
      ? 'https://wwwcie.ups.com/api/rating/v2409/Shop'
      : 'https://onlinetools.ups.com/api/rating/v2409/Shop';

    const token = await getUpsToken();

    const payload = {
      RateRequest: {
        Request: {
          RequestOption: 'Shop',
          TransactionReference: { CustomerContext: `rate-order-${Date.now()}` },
        },
        PickupType: { Code: '01', Description: 'Daily Pickup' },
        CustomerClassification: { Code: '00' },
        Shipment: {
          Shipper: {
            Name: process.env.UPS_SHIPPER_NAME || 'SignXpert',
            ShipperNumber: process.env.UPS_SHIPPER_NUMBER,
            Address: {
              AddressLine: [process.env.UPS_SHIPPER_ADDRESS || ''],
              City: process.env.UPS_SHIPPER_CITY || '',
              PostalCode: process.env.UPS_SHIPPER_POSTAL || '',
              CountryCode: process.env.UPS_SHIPPER_COUNTRY || 'DE',
            },
          },
          ShipTo: {
            Address: {
              AddressLine: [address || ''].filter(Boolean),
              City: city,
              PostalCode: postalCode,
              CountryCode: country.toUpperCase(),
            },
          },
          ShipmentRatingOptions: {
            NegotiatedRatesIndicator: '',
          },
          ...(saturdayDelivery ? { ShipmentServiceOptions: { SaturdayDeliveryIndicator: '' } } : {}),
          Package: [{
            PackagingType: { Code: '02', Description: 'Customer Supplied Package' },
            PackageWeight: {
              UnitOfMeasurement: { Code: 'KGS' },
              Weight: (parseFloat(weight) || 1).toFixed(1),
            },
            ...(length && width && height ? {
              Dimensions: {
                UnitOfMeasurement: { Code: 'CM' },
                Length: String(parseFloat(length).toFixed(0)),
                Width: String(parseFloat(width).toFixed(0)),
                Height: String(parseFloat(height).toFixed(0)),
              },
            } : {}),
          }],
        },
      },
    };

    const response = await axios.post(rateUrl, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        transId: `rate-${Date.now()}`,
        transactionSrc: 'SignXpert',
      },
      timeout: 10000,
    });

    const ratedShipments = response.data?.RateResponse?.RatedShipment || [];
    const vatRate = parseFloat(process.env.UPS_VAT_RATE || '0.19');
    const rates = [].concat(ratedShipments).map(s => {
      const negotiated = s.NegotiatedRateCharges?.TotalCharge || s.NegotiatedRateCharges?.TotalCharges;
      const published = s.TotalCharges;
      const charge = negotiated || published;
      const amountNet = parseFloat(charge?.MonetaryValue || 0);
      const amountWithVat = amountNet > 0 ? (amountNet * (1 + vatRate)).toFixed(2) : null;

      // Delivery date from TimeInTransit (Shoptimeintransit endpoint)
      const arrivalDate = s.TimeInTransit?.ServiceSummary?.EstimatedArrival?.Arrival?.Date;
      const arrivalTime = s.TimeInTransit?.ServiceSummary?.EstimatedArrival?.Arrival?.Time;
      const businessDays = s.GuaranteedDelivery?.BusinessDaysInTransit
        || s.TimeInTransit?.ServiceSummary?.EstimatedArrival?.BusinessDaysInTransit;

      let deliveryDate = null;
      if (arrivalDate) {
        // Format YYYYMMDD → readable
        const d = arrivalDate.replace(/(\d{4})(\d{2})(\d{2})/, '$3.$2.$1');
        deliveryDate = arrivalTime ? `${d} by ${arrivalTime.slice(0,5)}` : d;
      } else if (businessDays) {
        deliveryDate = `${businessDays} business day(s)`;
      }

      return {
        serviceCode: s.Service?.Code,
        serviceName: UPS_SERVICES[s.Service?.Code] || s.Service?.Code,
        currency: charge?.CurrencyCode || 'EUR',
        amount: charge?.MonetaryValue,
        amountWithVat,
        publishedAmount: negotiated ? published?.MonetaryValue : null,
        deliveryDate,
        saturdayDelivery: !!saturdayDelivery,
      };
    }).filter(r => r.amount);

    return res.json({ rates });
  } catch (err) {
    const upsData = err?.response?.data;
    const upsMsg = upsData?.response?.errors?.[0]?.message || err.message;
    console.error('UPS Rate error:', upsMsg);
    return res.status(500).json({ message: upsMsg });
  }
});

UPSRouter.post('/void-shipment', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { trackingNumber } = req.body;
    if (!trackingNumber) return res.status(400).json({ message: 'trackingNumber required' });

    const isSandbox = process.env.UPS_SANDBOX === 'true';
    const voidUrl = isSandbox
      ? `https://wwwcie.ups.com/api/shipments/v2403/void/cancel/${trackingNumber}`
      : `https://onlinetools.ups.com/api/shipments/v2403/void/cancel/${trackingNumber}`;

    const token = await getUpsToken();

    await axios.delete(voidUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        transId: `void-${trackingNumber}-${Date.now()}`,
        transactionSrc: 'SignXpert',
      },
    });

    return res.json({ success: true });
  } catch (err) {
    const upsData = err?.response?.data;
    console.error('UPS void error:', JSON.stringify(upsData, null, 2) || err.message);
    const upsMsg =
      upsData?.response?.errors?.[0]?.message ||
      upsData?.message ||
      err.message;
    return res.status(500).json({ message: upsMsg });
  }
});

export default UPSRouter;

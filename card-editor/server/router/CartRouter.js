import 'dotenv/config'; // для ES модулів
import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';
import CartProject from '../models/CartProject.js';
import { Order, User } from '../models/models.js';
import { col, fn, Op, where } from 'sequelize';
import puppeteer from 'puppeteer';
import SendEmailForStatus from '../Controller/SendEmailForStatus.js';
import Stripe  from 'stripe';
import { zugferd } from 'node-zugferd';
import { EN16931 } from 'node-zugferd/profile/en16931';
import ErrorApi from '../error/ErrorApi.js';

const secretKey = process.env.secretPayKey;
const stripe=Stripe(secretKey);

function formatDate(dateStr) {
  const d = new Date(dateStr);

  const pad = n => String(n).padStart(2, '0');

  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = String(d.getFullYear()).slice(2);
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  return `${day}-${month}-${year} ${hours}:${minutes}`;
}

function formatDatePlusMonth(dateStr) {
  const d = new Date(dateStr);

  // додаємо +1 місяць
  d.setMonth(d.getMonth() + 1);

  const pad = n => String(n).padStart(2, '0');

  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = String(d.getFullYear()).slice(2);
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  return `${day}-${month}-${year} ${hours}:${minutes}`;
}

export function formatInvoiceDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';

  const pad = n => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = String(d.getFullYear()).slice(2);

  return `${day}.${month}.${year}`;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char));
}

export function hasContent(value) {
  return String(value ?? '').trim().length > 0;
}

export function hasAddressContent(address) {
  if (!address || typeof address !== 'object') return false;

  return [
    address.fullName,
    address.companyName,
    address.address1,
    address.address2,
    address.address3,
    address.town,
    address.postalCode,
    address.country,
    address.email,
    address.mobile,
  ].some(hasContent);
}

export function formatMoney(value) {
  return toNumber(value, 0).toFixed(2);
}




const CartRouter = express.Router();

const basicZugferdInvoicer = zugferd({
  profile: EN16931,
  // xsd-schema-validator may be unavailable on some deployments.
  strict: false,
  logger: false,
});

export const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const round2 = (value) => Math.round((toNumber(value, 0) + Number.EPSILON) * 100) / 100;

const parseEmailList = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const mergeInvoiceRecipients = (...values) => {
  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    parseEmailList(value).forEach((email) => {
      const key = String(email || '').trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      result.push(String(email).trim());
    });
  });

  return result.join(', ');
};

const parseAdditionalPayload = (rawValue) => {
  const raw = String(rawValue || '').trim();
  if (!raw) {
    return { instruction: '', additionalInformation: '' };
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const instruction = String(parsed.instruction || parsed.message || '').trim();
      const additionalInformation = String(
        parsed.additionalInformation || parsed.additional || parsed.settings || ''
      ).trim();
      return {
        instruction: instruction || additionalInformation,
        additionalInformation: additionalInformation || instruction,
      };
    }
  } catch {
    // Legacy plain-string value.
  }

  return { instruction: raw, additionalInformation: raw };
};

const normalizeCountryCode = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return 'DE';
  if (raw.length === 2) return raw;
  if (raw.includes('GERMANY') || raw.includes('DEUTSCH')) return 'DE';
  if (raw.includes('UKRAINE') || raw.includes('UKRAIN')) return 'UA';
  if (raw.includes('AUSTRIA')) return 'AT';
  if (raw.includes('FRANCE')) return 'FR';
  if (raw.includes('ITALY')) return 'IT';
  if (raw.includes('SPAIN')) return 'ES';
  if (raw.includes('NETHERLANDS')) return 'NL';
  if (raw.includes('POLAND')) return 'PL';
  return 'DE';
};

export const buildZugferdInvoiceData = ({
  order,
  invoiceNumber,
  customerIdentifier,
  customerCompany,
  customerName,
  customerEmail,
  customerPhone,
  customerStreetLine1,
  customerStreetLine2,
  customerStreetLine3,
  customerPostalCode,
  customerCity,
  customerCountryCode,
  customerCountrySubdivision,
  customerVatNumber,
  buyerReference,
  remittanceInformation,
  paymentDueDate,
  signsCount,
  projectName,
  subtotal,
  vatAmount,
  vatPercent,
  totalAmount,
}) => {
  const hasVat = toNumber(vatPercent, 0) > 0;
  const quantity = Math.max(1, Math.floor(toNumber(signsCount, 1)));
  const lineUnitPrice = quantity > 0 ? round2(toNumber(subtotal, 0) / quantity) : toNumber(subtotal, 0);
  const safeProjectName = String(projectName || order?.orderName || 'Signs order');
  const sellerIdentifier = String(process.env.ZUGFERD_SELLER_IDENTIFIER || 'SIGNXPERT-DE').trim();
  const sellerRegistrationId = String(process.env.ZUGFERD_SELLER_REGISTRATION_ID || '').trim();
  const sellerVatId = String(process.env.ZUGFERD_SELLER_VAT_ID || '').trim();
  const sellerTaxId = String(process.env.ZUGFERD_SELLER_TAX_ID || 'xx/xxx/xxxxx').trim();
  const sellerName = String(process.env.ZUGFERD_SELLER_NAME || 'SignXpert').trim();
  const sellerTradingName = String(process.env.ZUGFERD_SELLER_TRADING_NAME || '').trim();
  const sellerStreetLine1 = String(process.env.ZUGFERD_SELLER_STREET1 || 'Baumwiesen 2').trim();
  const sellerStreetLine2 = String(process.env.ZUGFERD_SELLER_STREET2 || '').trim();
  const sellerStreetLine3 = String(process.env.ZUGFERD_SELLER_STREET3 || '').trim();
  const sellerPostalCode = String(process.env.ZUGFERD_SELLER_POSTAL_CODE || '72401').trim();
  const sellerCity = String(process.env.ZUGFERD_SELLER_CITY || 'Haigerloch').trim();
  const sellerCountryCode = normalizeCountryCode(process.env.ZUGFERD_SELLER_COUNTRY_CODE || 'DE');
  const sellerCountrySubdivision = String(process.env.ZUGFERD_SELLER_COUNTRY_SUBDIVISION || '').trim();
  const sellerEmail = String(process.env.ZUGFERD_SELLER_EMAIL || 'info@sign-xpert.com').trim();
  const sellerPhone = String(process.env.ZUGFERD_SELLER_PHONE || '').trim();
  const sellerContactName = String(process.env.ZUGFERD_SELLER_CONTACT_NAME || '').trim();
  const sellerContactDepartment = String(process.env.ZUGFERD_SELLER_CONTACT_DEPARTMENT || '').trim();
  const sellerIban = String(process.env.ZUGFERD_SELLER_IBAN || 'DE25 0101 0101 0101 0101 01').replace(/\s+/g, ' ').trim();
  const sellerBankAccountNumber = String(process.env.ZUGFERD_SELLER_BANK_ACCOUNT_NUMBER || '').trim();
  const sellerBic = String(process.env.ZUGFERD_SELLER_BIC || '').trim();
  const sellerCreditorIdentifier = String(process.env.ZUGFERD_SELLER_CREDITOR_ID || '').trim();
  const sellerAccountHolderName = String(process.env.ZUGFERD_SELLER_ACCOUNT_HOLDER || '').trim();
  const sellerGlobalIdentifier = String(process.env.ZUGFERD_SELLER_GLOBAL_ID || '').trim();
  const sellerGlobalIdentifierScheme = String(process.env.ZUGFERD_SELLER_GLOBAL_ID_SCHEME || '').trim();
  const sellerRegistrationScheme = String(process.env.ZUGFERD_SELLER_REGISTRATION_SCHEME || '').trim();
  const lineGlobalIdentifierScheme = String(process.env.ZUGFERD_LINE_GLOBAL_ID_SCHEME || '').trim();
  const vatExemptionReasonText = 'No VAT is charged according to § 19 UStG.';
  const buyerIdentifier = String(customerIdentifier || '').trim();
  const lineGlobalIdentifierValue = String(order?.id || invoiceNumber || '').trim();

  const sellerRegistrationIdentifier = sellerRegistrationId
    ? {
        value: sellerRegistrationId,
        ...(sellerRegistrationScheme ? { schemeIdentifier: sellerRegistrationScheme } : {}),
      }
    : undefined;

  const sellerGlobalIdentifierNode = sellerGlobalIdentifier && sellerGlobalIdentifierScheme
    ? {
        value: sellerGlobalIdentifier,
        schemeIdentifier: sellerGlobalIdentifierScheme,
      }
    : undefined;

  return {
    number: String(invoiceNumber || order?.id || ''),
    typeCode: '380',
    issueDate: new Date(order?.createdAt || Date.now()),
    transaction: {
      line: [
        {
          identifier: '1',
          note: `Order No: ${String(invoiceNumber || order?.id || '')}`,
          tradeProduct: {
            name: safeProjectName,
            globalIdentifier: lineGlobalIdentifierValue && lineGlobalIdentifierScheme
              ? {
                  value: lineGlobalIdentifierValue,
                  schemeIdentifier: lineGlobalIdentifierScheme,
                }
              : undefined,
          },
          tradeAgreement: {
            netTradePrice: {
              chargeAmount: formatMoney(lineUnitPrice),
            },
          },
          tradeDelivery: {
            billedQuantity: {
              amount: quantity,
              unitMeasureCode: 'H87',
            },
          },
          tradeSettlement: {
            tradeTax: {
              typeCode: 'VAT',
              categoryCode: hasVat ? 'S' : 'E',
              rateApplicablePercent: hasVat ? formatMoney(vatPercent) : '0.00',
            },
            monetarySummation: {
              lineTotalAmount: formatMoney(subtotal),
            },
          },
        },
      ],
      tradeAgreement: {
        buyerReference: String(buyerReference || order?.userId || invoiceNumber || ''),
        associatedContract: String(order?.idMongo || '').trim()
          ? {
              reference: String(order.idMongo).trim(),
            }
          : undefined,
        seller: {
          identifier: sellerIdentifier,
          globalIdentifier: sellerGlobalIdentifierNode,
          name: sellerName,
          organization: sellerRegistrationIdentifier || sellerTradingName
            ? {
                tradingName: sellerTradingName || sellerName || undefined,
                registrationIdentifier: sellerRegistrationIdentifier,
              }
            : undefined,
          tradeContact: {
            name: sellerContactName || sellerName || undefined,
            departmentName: sellerContactDepartment || undefined,
            phoneNumber: sellerPhone || undefined,
            emailAddress: sellerEmail || undefined,
          },
          postalAddress: {
            line1: sellerStreetLine1,
            line2: sellerStreetLine2 || undefined,
            line3: sellerStreetLine3 || undefined,
            postCode: sellerPostalCode,
            city: sellerCity,
            countryCode: sellerCountryCode,
            countrySubdivision: sellerCountrySubdivision || undefined,
          },
          electronicAddress: sellerEmail
            ? {
                value: sellerEmail,
                schemeIdentifier: 'EM',
              }
            : undefined,
          taxRegistration: sellerVatId || sellerTaxId
            ? {
                vatIdentifier: sellerVatId || undefined,
                localIdentifier: sellerTaxId || undefined,
              }
            : undefined,
        },
        buyer: {
          identifier: buyerIdentifier || undefined,
          name: String(customerCompany || customerName || 'Customer'),
          organization: {
            tradingName: String(customerCompany || '').trim() || undefined,
          },
          tradeContact: {
            name: String(customerName || customerCompany || '').trim() || undefined,
            phoneNumber: String(customerPhone || '').trim() || undefined,
            emailAddress: String(customerEmail || '').trim() || undefined,
          },
          postalAddress: {
            line1: String(customerStreetLine1 || '').trim() || undefined,
            line2: String(customerStreetLine2 || '').trim() || undefined,
            line3: String(customerStreetLine3 || '').trim() || undefined,
            postCode: String(customerPostalCode || '').trim() || undefined,
            city: String(customerCity || '').trim() || undefined,
            countryCode: normalizeCountryCode(customerCountryCode),
            countrySubdivision: String(customerCountrySubdivision || '').trim() || undefined,
          },
          electronicAddress: customerEmail
            ? {
                value: String(customerEmail).trim(),
                schemeIdentifier: 'EM',
              }
            : undefined,
          taxRegistration: customerVatNumber
            ? {
                vatIdentifier: String(customerVatNumber).trim(),
              }
            : undefined,
        },
        associatedOrder: {
          purchaseOrderReference: String(order?.id || invoiceNumber || ''),
        },
      },
      tradeSettlement: {
        currencyCode: 'EUR',
        creditorIdentifier: sellerCreditorIdentifier || undefined,
        remittanceInformation: String(remittanceInformation || `Order No: ${invoiceNumber || order?.id || ''}`),
        payee: sellerAccountHolderName
          ? {
              identifier: sellerIdentifier || undefined,
              name: sellerAccountHolderName,
            }
          : undefined,
        paymentInstruction: {
          typeCode: '58',
          transfers: sellerIban
            ? [
                {
                  accountName: sellerAccountHolderName || undefined,
                  paymentAccountIdentifier: sellerIban,
                  nationalAccountNumber: sellerBankAccountNumber || undefined,
                },
              ]
            : undefined,
          sellerBankInformation: sellerBic
            ? {
                serviceProviderIdentifier: sellerBic,
              }
            : undefined,
        },
        paymentTerms: {
          description: '30 days net',
          dueDate: paymentDueDate || new Date(order?.createdAt || Date.now()),
        },
        vatBreakdown: hasVat
          ? [
              {
                calculatedAmount: formatMoney(vatAmount),
                basisAmount: formatMoney(subtotal),
                categoryCode: 'S',
                rateApplicablePercent: formatMoney(vatPercent),
                typeCode: 'VAT',
              },
            ]
          : [
              {
                calculatedAmount: '0.00',
                basisAmount: formatMoney(subtotal),
                categoryCode: 'E',
                rateApplicablePercent: '0.00',
                typeCode: 'VAT',
                exemptionReasonText: vatExemptionReasonText,
              },
            ],
        monetarySummation: {
          lineTotalAmount: formatMoney(subtotal),
          taxBasisTotalAmount: formatMoney(subtotal),
          taxTotal: formatMoney(vatAmount),
          grandTotalAmount: formatMoney(totalAmount),
          duePayableAmount: formatMoney(totalAmount),
        },
      },
    },
  };
};

const isMongoObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || '').trim());

export const findCartProjectForOrder = async (order) => {
  const key = String(order?.idMongo || '').trim();
  if (!key) return null;

  // New format: idMongo stores CartProject _id for a strict 1:1 mapping.
  if (isMongoObjectId(key)) {
    const byId = await CartProject.findById(key).lean();
    if (byId) return byId;
  }

  // Legacy fallback: old orders stored projectId in idMongo.
  return CartProject.findOne({ projectId: key }, null, { sort: { createdAt: -1 } }).lean();
};

const findCartProjectForId = async (idMongo) => {
  return CartProject.findOne({ projectId: String(idMongo) }, null, { sort: { createdAt: -1 } }).lean();
};

const canAccessOrderDocuments = (user, order) => {
  if (!user || !order) return false;
  if (user.type === 'Admin') return true;

  const currentUserId = String(user.id || '').trim();
  const orderUserId = String(order.userId || '').trim();
  return currentUserId.length > 0 && currentUserId === orderUserId;
};

const COLOR_THEME_BY_INDEX_CAPS = {
  0: 'White / Black',
  1: 'White / Blue',
  2: 'White / Red',
  3: 'Black / White',
  4: 'Blue / White',
  5: 'Red / White',
  6: 'Green / White',
  7: 'Yellow / Black',
  8: 'Silver / Black',
  9: 'Brown / White',
  10: 'Orange / White',
  11: 'Gray / White',
  12: 'Wood / Black',
  13: 'Carbon / White',
};

const normalizeMaterialColorLabel = (value) =>
  String(value || '')
    .replace(/["'`“”‘’]/g, '')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeMaterialThemeKey = (value) => normalizeMaterialColorLabel(value).toLowerCase();

const MATERIAL_ICON_SVGS = {
  'white / black': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0.343262" width="35.1323" height="35.1323" rx="4" fill="white"/><rect x="0.5" y="0.843262" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 26.3628H9.59659L15.8778 8.90825H18.9205L25.2017 26.3628H22.4062L17.4716 12.0787H17.3352L12.392 26.3628ZM12.8608 19.5276H21.929V21.7435H12.8608V19.5276Z" fill="black"/></svg>`,
  'white / blue': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0.343262" width="35.1323" height="35.1323" rx="4" fill="white"/><rect x="0.5" y="0.843262" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25.3433H9.59659L15.8778 7.88872H18.9205L25.2017 25.3433H22.4062L17.4716 11.0592H17.3352L12.392 25.3433ZM12.8608 18.508H21.929V20.7239H12.8608V18.508Z" fill="#00558b"/></svg>`,
  'white / red': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0.343262" width="35.1323" height="35.1323" rx="4" fill="white"/><rect x="0.5" y="0.843262" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25.3433H9.59659L15.8778 7.88872H18.9205L25.2017 25.3433H22.4062L17.4716 11.0592H17.3352L12.392 25.3433ZM12.8608 18.508H21.929V20.7239H12.8608V18.508Z" fill="#FE0000"/></svg>`,
  'black / white': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0.343262" width="35.1323" height="35.1323" rx="4" fill="black"/><rect x="0.5" y="0.843262" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25.3433H9.59659L15.8778 7.88872H18.9205L25.2017 25.3433H22.4062L17.4716 11.0592H17.3352L12.392 25.3433ZM12.8608 18.508H21.929V20.7239H12.8608V18.508Z" fill="white"/></svg>`,
  'blue / white': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0.343262" width="35.1323" height="35.1323" rx="4" fill="#00558b"/><rect x="0.5" y="0.843262" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25.3433H9.59659L15.8778 7.88872H18.9205L25.2017 25.3433H22.4062L17.4716 11.0592H17.3352L12.392 25.3433ZM12.8608 18.508H21.929V20.7239H12.8608V18.508Z" fill="white"/></svg>`,
  'red / white': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0.343262" width="35.1323" height="35.1323" rx="4" fill="#FD0100"/><rect x="0.5" y="0.843262" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25.3433H9.59659L15.8778 7.88872H18.9205L25.2017 25.3433H22.4062L17.4716 11.0592H17.3352L12.392 25.3433ZM12.8608 18.508H21.929V20.7239H12.8608V18.508Z" fill="white"/></svg>`,
  'green / white': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0.343262" width="35.1323" height="35.1323" rx="4" fill="#017F01"/><rect x="0.5" y="0.843262" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25.3433H9.59659L15.8778 7.88872H18.9205L25.2017 25.3433H22.4062L17.4716 11.0592H17.3352L12.392 25.3433ZM12.8608 18.508H21.929V20.7239H12.8608V18.508Z" fill="white"/></svg>`,
  'yellow / black': `<svg width="36" height="37" viewBox="0 0 36 37" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0.880615" width="35.1323" height="35.1323" rx="4" fill="#FFFF01"/><rect x="0.5" y="1.38062" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25.8806H9.59659L15.8778 8.42607H18.9205L25.2017 25.8806H22.4062L17.4716 11.5965H17.3352L12.392 25.8806ZM12.8608 19.0454H21.929V21.2613H12.8608V19.0454Z" fill="black"/></svg>`,
  'silver / black': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="35.1323" height="35.1323" rx="4" fill="url(#paint0_linear_icon_a9)"/><rect x="0.5" y="0.5" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25H9.59659L15.8778 7.54545H18.9205L25.2017 25H22.4062L17.4716 10.7159H17.3352L12.392 25ZM12.8608 18.1648H21.929V20.3807H12.8608V18.1648Z" fill="black"/><defs><linearGradient id="paint0_linear_icon_a9" x1="8.31186" y1="0" x2="26.8204" y2="35.1323" gradientUnits="userSpaceOnUse"><stop offset="0.240385" stop-color="#B5B5B5"/><stop offset="0.528846" stop-color="#F5F5F5"/><stop offset="0.788462" stop-color="#979797"/></linearGradient></defs></svg>`,
  'brown / white': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="35.1323" height="35.1323" rx="4" fill="#964B21"/><rect x="0.5" y="0.5" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25H9.59659L15.8778 7.54545H18.9205L25.2017 25H22.4062L17.4716 10.7159H17.3352L12.392 25ZM12.8608 18.1648H21.929V20.3807H12.8608V18.1648Z" fill="white"/></svg>`,
  'orange / white': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0.216553" width="35.1323" height="35.1323" rx="4" fill="#FD7714"/><rect x="0.5" y="0.716553" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25.2166H9.59659L15.8778 7.76201H18.9205L25.2017 25.2166H22.4062L17.4716 10.9325H17.3352L12.392 25.2166ZM12.8608 18.3813H21.929V20.5972H12.8608V18.3813Z" fill="white"/></svg>`,
  'gray / white': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0.216553" width="35.1323" height="35.1323" rx="4" fill="#808080"/><rect x="0.5" y="0.716553" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25.2166H9.59659L15.8778 7.76201H18.9205L25.2017 25.2166H22.4062L17.4716 10.9325H17.3352L12.392 25.2166ZM12.8608 18.3813H21.929V20.5972H12.8608V18.3813Z" fill="white"/></svg>`,
  'grey / white': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0.216553" width="35.1323" height="35.1323" rx="4" fill="#808080"/><rect x="0.5" y="0.716553" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25.2166H9.59659L15.8778 7.76201H18.9205L25.2017 25.2166H22.4062L17.4716 10.9325H17.3352L12.392 25.2166ZM12.8608 18.3813H21.929V20.5972H12.8608V18.3813Z" fill="white"/></svg>`,
  'wood / black': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><rect width="35.1323" height="35.1323" rx="4" fill="url(#pattern0_icon_a13)"/><rect x="0.5" y="0.5" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25H9.59659L15.8778 7.54545H18.9205L25.2017 25H22.4062L17.4716 10.7159H17.3352L12.392 25ZM12.8608 18.1648H21.929V20.3807H12.8608V18.1648Z" fill="black"/><defs><pattern id="pattern0_icon_a13" patternContentUnits="objectBoundingBox" width="1" height="1"><use xlink:href="#image0_icon_a13" transform="scale(0.0181818)"/></pattern><image id="image0_icon_a13" width="55" height="55" preserveAspectRatio="none" xlink:href="data:image/png;base64,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"/></defs></svg>`,
  'carbon / white': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><rect y="0.294922" width="35.1323" height="35.1323" rx="4" fill="url(#pattern0_icon_a14)"/><rect x="0.5" y="0.794922" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25.2949H9.59659L15.8778 7.84038H18.9205L25.2017 25.2949H22.4062L17.4716 11.0108H17.3352L12.392 25.2949ZM12.8608 18.4597H21.929V20.6756H12.8608V18.4597Z" fill="white"/><defs><pattern id="pattern0_icon_a14" patternContentUnits="objectBoundingBox" width="1" height="1"><use xlink:href="#image0_icon_a14" transform="translate(-0.00662252) scale(0.00662252)"/></pattern><image id="image0_icon_a14" width="153" height="151" preserveAspectRatio="none" xlink:href="data:image/jpeg;base64,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"/></defs></svg>`
};

const extractEmbeddedImageDataUri = (svgMarkup = '') => {
  const match = String(svgMarkup).match(/<image[^>]+(?:xlink:href|xlinkHref)="([^"]+)"/i);
  return match ? match[1] : '';
};

const getTexturedMaterialIconMarkup = (theme, textColor) => {
  const svgMarkup = MATERIAL_ICON_SVGS[theme] || '';
  const textureDataUri = extractEmbeddedImageDataUri(svgMarkup);
  if (!textureDataUri) return svgMarkup;

  if (theme === 'carbon / white') {
    return `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><clipPath id="clip_carbon_pdf"><rect y="0.294922" width="35.1323" height="35.1323" rx="4"/></clipPath></defs><g clip-path="url(#clip_carbon_pdf)"><image x="-0.232664" y="0.294922" width="35.597568" height="35.1323" preserveAspectRatio="none" xlink:href="${textureDataUri}"/></g><rect x="0.5" y="0.794922" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25.2949H9.59659L15.8778 7.84038H18.9205L25.2017 25.2949H22.4062L17.4716 11.0108H17.3352L12.392 25.2949ZM12.8608 18.4597H21.929V20.6756H12.8608V18.4597Z" fill="${textColor}"/></svg>`;
  }

  if (theme === 'wood / black') {
    return `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><clipPath id="clip_wood_pdf"><rect width="35.1323" height="35.1323" rx="4"/></clipPath></defs><g clip-path="url(#clip_wood_pdf)"><image x="0" y="0" width="35.1323" height="35.1323" preserveAspectRatio="none" xlink:href="${textureDataUri}"/></g><rect x="0.5" y="0.5" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25H9.59659L15.8778 7.54545H18.9205L25.2017 25H22.4062L17.4716 10.7159H17.3352L12.392 25ZM12.8608 18.1648H21.929V20.3807H12.8608V18.1648Z" fill="${textColor}"/></svg>`;
  }

  const themeClass = `material-icon-texture--${theme.replace(/[^a-z0-9]+/gi, '-')}`;
  return `<div class="material-icon-texture ${themeClass}" style="background-image:url('${textureDataUri}');"><span class="material-icon-texture__letter" style="color:${textColor};">A</span></div>`;
};

const getMaterialIconSvg = (theme) => {
  const normalizedTheme = normalizeMaterialThemeKey(theme);
  if (normalizedTheme === 'wood / black') {
    return getTexturedMaterialIconMarkup(normalizedTheme, '#000');
  }
  if (normalizedTheme === 'carbon / white') {
    return getTexturedMaterialIconMarkup(normalizedTheme, '#fff');
  }
  return MATERIAL_ICON_SVGS[normalizedTheme] || '';
};

export const buildPdfFooterTemplate = (fontSize = 12, sidePadding = 20, bottomPadding = 4) => `
  <div style="width:100%;box-sizing:border-box;padding:0 ${sidePadding}px ${bottomPadding}px ${sidePadding}px;font-family:Arial,sans-serif;font-size:${fontSize}px;color:#000;text-align:right;">
    Page <span class="pageNumber"></span> of <span class="totalPages"></span>
  </div>`;

const paginatePdfBlocks = (blocks, firstPageCapacity, nextPageCapacity = firstPageCapacity) => {
  const safeBlocks = Array.isArray(blocks) ? blocks.filter(Boolean) : [];
  if (!safeBlocks.length) return [[]];

  const pages = [];
  let currentPage = [];
  let usedCapacity = 0;
  let currentCapacity = firstPageCapacity;

  safeBlocks.forEach((block) => {
    const blockUnits = Math.max(1, Number(block.units) || 1);
    if (currentPage.length > 0 && usedCapacity + blockUnits > currentCapacity) {
      pages.push(currentPage);
      currentPage = [];
      usedCapacity = 0;
      currentCapacity = nextPageCapacity;
    }

    currentPage.push(block);
    usedCapacity += blockUnits;
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
};

const getPdfBlockUnits = (blocks = []) =>
  (Array.isArray(blocks) ? blocks : []).reduce(
    (sum, block) => sum + Math.max(1, Number(block?.units) || 1),
    0
  );

const ensureLastPdfPageCapacity = (pages, lastPageCapacity, overflowPageCapacity = lastPageCapacity) => {
  if (!Array.isArray(pages) || pages.length === 0) return [[]];
  if (!Number.isFinite(lastPageCapacity) || lastPageCapacity <= 0) return pages;

  const normalizedPages = pages.map((page) => (Array.isArray(page) ? [...page] : []));
  let lastPage = normalizedPages[normalizedPages.length - 1];

  if (getPdfBlockUnits(lastPage) <= lastPageCapacity) {
    return normalizedPages;
  }

  const overflowBlocks = [];
  while (lastPage.length > 1 && getPdfBlockUnits(lastPage) > lastPageCapacity) {
    overflowBlocks.unshift(lastPage.pop());
  }

  if (!overflowBlocks.length) {
    return normalizedPages;
  }

  return [
    ...normalizedPages.slice(0, -1),
    lastPage,
    ...paginatePdfBlocks(overflowBlocks, overflowPageCapacity, overflowPageCapacity),
  ];
};

const normalizeThickness = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
};

const resolveColorThemeCaps = (toolbarState = {}, canvasSnap = {}) => {
  const idx = Number(toolbarState?.selectedColorIndex);
  if (Number.isFinite(idx) && COLOR_THEME_BY_INDEX_CAPS[idx]) {
    return normalizeMaterialColorLabel(COLOR_THEME_BY_INDEX_CAPS[idx]);
  }

  const bg =
    toolbarState?.globalColors?.backgroundColor ??
    toolbarState?.backgroundColor ??
    canvasSnap?.backgroundColor;
  const bgType =
    toolbarState?.globalColors?.backgroundType ??
    toolbarState?.backgroundType ??
    canvasSnap?.backgroundType;

  if (typeof bg === 'string' && String(bgType).toLowerCase() === 'texture') {
    const lower = bg.toLowerCase();
    if (lower.includes('wood')) return COLOR_THEME_BY_INDEX_CAPS[12];
    if (lower.includes('carbon')) return COLOR_THEME_BY_INDEX_CAPS[13];
  }

  const existing = typeof canvasSnap?.ColorTheme === 'string' ? canvasSnap.ColorTheme.trim() : '';
  return existing ? normalizeMaterialColorLabel(existing) : 'Unknown';
};

const normalizeTapeLabel = (value) => (value === true ? 'TAPE' : 'NO TAPE');

const normalizeProjectForCart = (project) => {
  if (!project || typeof project !== 'object') return project;

  const canvases = Array.isArray(project.canvases) ? project.canvases : [];
  const mappedCanvases = canvases.map((c) => {
    const canvas = c && typeof c === 'object' ? c : {};
    const toolbarState = canvas.toolbarState && typeof canvas.toolbarState === 'object' ? canvas.toolbarState : {};

    const Thickness = normalizeThickness(canvas.Thickness ?? toolbarState.thickness ?? canvas.thickness);
    const ColorTheme = resolveColorThemeCaps(toolbarState, canvas);
    const Tape =
      typeof canvas.Tape === 'string'
        ? canvas.Tape.trim().toUpperCase() === 'TAPE'
          ? 'TAPE'
          : 'NO TAPE'
        : normalizeTapeLabel(toolbarState.isAdhesiveTape === true);

    return {
      ...canvas,
      Thickness,
      ColorTheme,
      Tape,
    };
  });

  return {
    ...project,
    canvases: mappedCanvases,
  };
};

const normalizeAccessories = (input) => {
  if (!Array.isArray(input)) return [];

  return input
    .filter((x) => x && typeof x === 'object')
    // If checked is explicitly provided, only keep checked=true.
    // If not provided (older clients), assume already filtered.
    .filter((x) => (x.checked === undefined ? true : x.checked === true))
    .map((x) => {
      const qty = Math.floor(toNumber(x.qty, 0));
      return {
        id: x.id,
        name: x.name,
        qty,
        price: x.price,
        desc: x.desc,
      };
    })
    .filter((x) => x.qty > 0 && (x.id != null || x.name != null));
};

const formatDisplayNumber = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
};

const formatCanvasSizeMm = (canvasSnap = {}) => {
  const mmWidth = Number(canvasSnap?.toolbarState?.sizeValues?.width);
  const mmHeight = Number(canvasSnap?.toolbarState?.sizeValues?.height);

  if (Number.isFinite(mmWidth) && Number.isFinite(mmHeight)) {
    return `${formatDisplayNumber(mmWidth)} x ${formatDisplayNumber(mmHeight)} mm`;
  }

  const width = Number(canvasSnap?.width);
  const height = Number(canvasSnap?.height);
  if (Number.isFinite(width) && Number.isFinite(height)) {
    const fallbackWidthMm = (width * 25.4) / 72;
    const fallbackHeightMm = (height * 25.4) / 72;
    return `${formatDisplayNumber(fallbackWidthMm)} x ${formatDisplayNumber(fallbackHeightMm)} mm`;
  }

  return 'Unknown size';
};

const resolveTapeLabel = (canvasSnap = {}) => {
  if (typeof canvasSnap?.Tape === 'string' && canvasSnap.Tape.trim()) {
    return canvasSnap.Tape.trim().toUpperCase();
  }
  return canvasSnap?.toolbarState?.isAdhesiveTape ? 'TAPE' : 'NO TAPE';
};

const resolveCanvasObjects = (canvasSnap = {}) => {
  if (Array.isArray(canvasSnap?.json?.objects)) return canvasSnap.json.objects;
  if (Array.isArray(canvasSnap?.jsonTemplate?.objects)) return canvasSnap.jsonTemplate.objects;
  if (Array.isArray(canvasSnap?.objects)) return canvasSnap.objects;
  return [];
};

const hasObjectFlag = (obj, key) => obj?.[key] === true || obj?.data?.[key] === true;

const isQrObject = (obj) => hasObjectFlag(obj, 'isQRCode');

const isBarcodeObject = (obj) => hasObjectFlag(obj, 'isBarCode');

const isHoleObject = (obj) => {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.isCutElement === true && String(obj.cutType || '').toLowerCase() === 'hole') return true;
  if (typeof obj.id === 'string' && obj.id.startsWith('hole-')) return true;
  if (typeof obj.id === 'string' && obj.id.startsWith('holes-')) return true;
  if (typeof obj.name === 'string' && obj.name.toLowerCase().includes('hole')) return true;
  if (obj.isHole === true) return true;
  return false;
};

const isCutFigureObject = (obj) => {
  if (!obj || typeof obj !== 'object') return false;
  if (isHoleObject(obj)) return false;
  if (obj.isCutElement === true) {
    const cutType = String(obj.cutType || '').toLowerCase();
    return cutType === 'shape' || cutType === 'manual';
  }
  return false;
};

const isTextObject = (obj) => {
  const type = String(obj?.type || '').toLowerCase();
  return ['text', 'textbox', 'i-text'].includes(type) || (typeof obj?.text === 'string' && obj.text.trim());
};

const hasShapeMarker = (obj) =>
  hasContent(obj?.shapeType) ||
  hasContent(obj?.data?.shapeType) ||
  hasContent(obj?.shapeSvgId) ||
  hasContent(obj?.data?.shapeSvgId);

const isImageObject = (obj) => {
  const type = String(obj?.type || '').toLowerCase();
  return (
    type === 'image' ||
    hasObjectFlag(obj, 'isUploadedImage') ||
    hasObjectFlag(obj, 'fromIconMenu') ||
    hasContent(obj?.imageSource) ||
    hasContent(obj?.data?.imageSource)
  );
};

const isHelperObject = (obj) => {
  if (!obj || typeof obj !== 'object') return true;
  return Boolean(
    obj.isBorderShape ||
    obj.cardBorderMode ||
    obj.excludeFromExport ||
    obj.excludeFromSummary ||
    obj.isSafeZone ||
    obj.isBleedZone ||
    obj.isGuide ||
    obj.isGrid ||
    obj.isFrameHole ||
    obj.isHole
  );
};

const isShapeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return false;
  if (!hasShapeMarker(obj)) return false;
  if (isImageObject(obj) || isCutFigureObject(obj) || isHoleObject(obj)) return false;
  if (isQrObject(obj) || isBarcodeObject(obj) || isTextObject(obj)) return false;
  return true;
};

const analyzeCanvasContent = (canvasSnap = {}) => {
  const summary = {
    texts: [],
    shapes: 0,
    cutFigures: 0,
    holes: 0,
    qrCodes: 0,
    barcodes: 0,
    images: 0,
  };

  const walk = (obj) => {
    if (!obj || isHelperObject(obj)) return;

    if (isQrObject(obj)) {
      summary.qrCodes += 1;
      return;
    }

    if (isHoleObject(obj)) {
      summary.holes += 1;
      return;
    }

    if (isCutFigureObject(obj)) {
      summary.cutFigures += 1;
      return;
    }

    if (isBarcodeObject(obj)) {
      summary.barcodes += 1;
      return;
    }

    if (isTextObject(obj)) {
      const text = String(obj?.text || '').trim();
      if (text) summary.texts.push(text);
      return;
    }

    if (isImageObject(obj)) {
      summary.images += 1;
      return;
    }

    if (Array.isArray(obj?.objects) && obj.objects.length > 0) {
      obj.objects.forEach(walk);
      return;
    }

    if (isShapeObject(obj)) {
      summary.shapes += 1;
    }
  };

  resolveCanvasObjects(canvasSnap).forEach(walk);
  return summary;
};

const resolveCopiesCount = (canvasSnap = {}) => {
  const raw = canvasSnap?.copiesCount ?? canvasSnap?.toolbarState?.copiesCount ?? 1;
  const count = Math.floor(Number(raw));
  return Number.isFinite(count) && count > 0 ? count : 1;
};

const expandParsedSigns = (signs = []) => {
  const expanded = [];
  let displayIndex = 1;

  signs.forEach((sign, signIndex) => {
    const copiesCount = Math.max(1, Math.floor(Number(sign?.copiesCount) || 1));
    for (let copyIndex = 0; copyIndex < copiesCount; copyIndex += 1) {
      expanded.push({
        ...sign,
        id: `${String(sign?.id || signIndex)}::copy-${copyIndex + 1}`,
        title: `Sign ${displayIndex}`,
        copiesCount: 1,
      });
      displayIndex += 1;
    }
  });

  return expanded;
};

const buildDeliveryNoteSummary = (order, orderMongo) => {
  const storedSummary = orderMongo?.checkout?.orderTestSummary;

  if (storedSummary && typeof storedSummary === 'object') {
    const expandedStoredSigns = expandParsedSigns(
      Array.isArray(storedSummary?.signs)
        ? storedSummary.signs.map((sign, index) => ({
            id: String(sign?.id || index),
            title: String(sign?.title || `Sign ${index + 1}`),
            metaLine: String(sign?.metaLine || ''),
            textLine: String(sign?.textLine || '—'),
            counts: {
              shapes: Math.max(0, Math.floor(toNumber(sign?.counts?.shapes, 0))),
              cutFigures: Math.max(0, Math.floor(toNumber(sign?.counts?.cutFigures, 0))),
              holes: Math.max(0, Math.floor(toNumber(sign?.counts?.holes, 0))),
              qrCodes: Math.max(0, Math.floor(toNumber(sign?.counts?.qrCodes, 0))),
              barcodes: Math.max(0, Math.floor(toNumber(sign?.counts?.barcodes, 0))),
              images: Math.max(0, Math.floor(toNumber(sign?.counts?.images, 0))),
            },
            copiesCount: Math.max(1, Math.floor(toNumber(sign?.copiesCount, 1))),
          }))
        : []
    );

    return {
      projectTitle: String(storedSummary?.projectTitle || order?.orderName || orderMongo?.projectName || ''),
      totalSigns: expandedStoredSigns.length || Math.max(0, Math.floor(toNumber(storedSummary?.totalSigns, toNumber(order?.signs, 0)))),
      accessories: normalizeAccessories(storedSummary?.accessories),
      signs: expandedStoredSigns,
    };
  }

  const projectSnapshot = normalizeProjectForCart(orderMongo?.project || {});
  const canvases = Array.isArray(projectSnapshot?.canvases) ? projectSnapshot.canvases : [];
  const parsedSigns = canvases.map((canvasSnap, index) => {
    const content = analyzeCanvasContent(canvasSnap);
    const thickness = formatDisplayNumber(canvasSnap?.Thickness ?? canvasSnap?.toolbarState?.thickness);
    const metaParts = [
      formatCanvasSizeMm(canvasSnap),
      resolveColorThemeCaps(canvasSnap?.toolbarState, canvasSnap),
      thickness ? `${thickness}` : null,
      resolveTapeLabel(canvasSnap),
    ].filter(Boolean);

    return {
      id: String(canvasSnap?.id || index),
      title: `Sign ${index + 1}`,
      metaLine: metaParts.join(', '),
      textLine: content.texts.length > 0 ? content.texts.join(', ') : '—',
      counts: {
        shapes: content.shapes,
        cutFigures: content.cutFigures,
        holes: content.holes,
        qrCodes: content.qrCodes,
        barcodes: content.barcodes,
        images: content.images,
      },
      copiesCount: resolveCopiesCount(canvasSnap),
    };
  });
  const signs = expandParsedSigns(parsedSigns);

  return {
    projectTitle: String(order?.orderName || orderMongo?.projectName || ''),
    totalSigns: signs.reduce((sum, sign) => sum + sign.copiesCount, 0) || Math.max(0, Math.floor(toNumber(order?.signs, 0))),
    accessories: normalizeAccessories(orderMongo?.accessories),
    signs,
  };
};

const countProjectSigns = (project) => {
  const canvases = Array.isArray(project?.canvases) ? project.canvases : [];
  return canvases.reduce((sum, canvas) => {
    const rawCopies =
      canvas?.copiesCount ??
      canvas?.toolbarState?.copiesCount ??
      1;
    const copies = Math.max(1, Math.floor(toNumber(rawCopies, 1)));
    return sum + copies;
  }, 0);
};

const countTotalSignsFromProject = (project) => countProjectSigns(project);

// Auth: add current project to cart
CartRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id ? String(req.user.id) : null;
    if (!userId) {
      return res.status(401).json({ status: 401, message: 'Unauthorized' });
    }

    const body = req.body || {};
    const project = normalizeProjectForCart(body.project);
    const projectNameRaw = body.projectName ?? project?.name;
    const projectName = String(projectNameRaw || '').trim();

    if (!project || typeof project !== 'object') {
      return res.status(400).json({ status: 400, message: 'Project payload is required' });
    }

    if (!projectName) {
      return res.status(400).json({ status: 400, message: 'Project name is required' });
    }

    const normalizedAccessories = normalizeAccessories(body.accessories);
    const netAfterDiscount = toNumber(body.netAfterDiscount, toNumber(body.price, 0));
    const totalPriceInclVat = toNumber(body.totalPrice, 0);
    const checkoutSnapshot = body?.checkout && typeof body.checkout === 'object' ? body.checkout : null;
    const checkoutDeliveryLabel = String(body?.checkout?.deliveryLabel || body?.deliveryType || '').trim();
    const checkoutCountryRegion = String(body?.checkout?.deliveryAddress?.region || '').trim().toUpperCase();
    const checkoutCountryName = String(body?.checkout?.deliveryAddress?.country || '').trim();

    const created = await CartProject.create({
      userId,
      projectId: body.projectId ? String(body.projectId) : project?.id ? String(project.id) : null,
      projectName,
      price: netAfterDiscount,
      discountPercent: toNumber(body.discountPercent, 0),
      discountAmount: toNumber(body.discountAmount, 0),
      totalPrice: totalPriceInclVat,
      project,
      accessories: normalizedAccessories,
      checkout: checkoutSnapshot,
      status: 'pending',
    });


    const orderSigns = countProjectSigns(project);


    const user = await User.findOne({ where: { id: req.user.id } });
    const checkoutInvoiceEmailRaw = String(body?.checkout?.invoiceEmail || '').trim();
    const checkoutInvoiceAddressEmailRaw = String(
      body?.checkout?.invoiceAddressEmail || body?.checkout?.invoiceAddress?.email || ''
    ).trim();

    const mergedInvoiceRecipients = mergeInvoiceRecipients(
      user?.weWill,
      checkoutInvoiceEmailRaw,
      checkoutInvoiceAddressEmailRaw
    );

    if (user) {
      const updates = {};
      if (mergedInvoiceRecipients && mergedInvoiceRecipients !== String(user.weWill || '').trim()) {
        updates.weWill = mergedInvoiceRecipients;
      }
      if (
        checkoutInvoiceAddressEmailRaw &&
        checkoutInvoiceAddressEmailRaw !== String(user.eMailInvoice || '').trim()
      ) {
        updates.eMailInvoice = checkoutInvoiceAddressEmailRaw;
      }
      if (Object.keys(updates).length > 0) {
        await user.update(updates);
      }
    }

    const fallbackCountry = String(user?.country || '').trim() || 'NO';
    const order = await Order.create({
      sum: user.type == 'Admin' ? 0 : totalPriceInclVat,
      netAfterDiscount: user.type == ' Admin' ? 0 : netAfterDiscount,
      signs: orderSigns > 0 ? orderSigns : 1,
      userId,
      country: checkoutCountryRegion || checkoutCountryName || fallbackCountry,
      status: 'Received',
      orderName: body.projectName,
      orderType: '',
      deliveryType: checkoutDeliveryLabel,
      accessories: JSON.stringify(normalizedAccessories),
      idMongo: String(created._id),
      isPaid: user.type == 'Admin' ? null : false
    })

    const userOrders = await Order.findOne({ where: { userId: req.user.id, status: 'Deleted' } });
    if (userOrders) {
      order.status = 'Deleted';
      await order.save();
    }
    const orderWithUser = await Order.findOne({
      where: { id: order.id },
      include: [
        {
          model: User
        }
      ]
    })
    let commentOrder='';
    return res.json({
      id: String(created._id),
      status: created.status,
      order,
      createdAt: created.createdAt,
    });
  } catch (e) {
    return next(e);
  }
});

// Admin: list cart entries
CartRouter.get('/admin', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const items = await CartProject.find({}, null, { sort: { createdAt: -1 } }).lean();
    const mapped = (items || []).map((it) => ({
      id: String(it._id),
      userId: it.userId,
      projectId: it.projectId,
      projectName: it.projectName,
      totalPrice: it.totalPrice,
      status: it.status,
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
    }));

    return res.json(mapped);
  } catch (e) {
    return next(e);
  }
});

// Admin: get full cart entry (for opening in admin later)
CartRouter.get('/admin/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await CartProject.findById(id).lean();
    if (!item) {
      return res.status(404).json({ status: 404, message: 'Cart entry not found' });
    }

    return res.json({
      id: String(item._id),
      userId: item.userId,
      projectId: item.projectId,
      projectName: item.projectName,
      price: item.price,
      discountPercent: item.discountPercent,
      discountAmount: item.discountAmount,
      totalPrice: item.totalPrice,
      project: item.project,
      accessories: item.accessories,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  } catch (e) {
    return next(e);
  }
});


CartRouter.get('/filter', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    let { page = 1, limit = 20, search, status, start, finish, lang, userId, isPaid } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    const offset = limit * (page - 1);

    const where = {};
    const userWhere = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where[Op.or] = [
        { userId: { [Op.like]: `%${parseInt(search)}%` } },
        //{ orderName: { [Op.like]: `%${search}%` } },
        //{ orderType: { [Op.like]: `%${search}%` } },
        { id: parseInt(search) },
        //{ deliveryType: { [Op.like]: `%${search}%` } },
        //{ country: { [Op.like]: `%${search}%` } },
        //{ sum: { [Op.like]: `%${search}%` } },
        //{ userId: { [Op.like]: `%${parseInt(search)}%` } }
      ]
    }


    if (start || finish) {
      where.createdAt = {};
      if (start) where.createdAt[Op.gte] = new Date(start);
      if (finish) where.createdAt[Op.lte] = new Date(finish);
    }


    if (isPaid !== undefined) {
      if (isPaid == 'admin') {
        userWhere.type = 'Admin';
      } else {
        where.isPaid = isPaid === 'true';
      }
    }

    if (lang) {
      where.country = lang;
    }

    if (userId !== undefined && userId !== null && String(userId).trim() !== '') {
      const normalizedUserId = Number(userId);
      if (!Number.isFinite(normalizedUserId)) {
        return res.status(400).json({ message: 'Invalid userId filter' });
      }
      where.userId = normalizedUserId;
    }

    let orders = await Order.findAndCountAll({
      offset,
      limit,
      where,
      order: [['createdAt', 'DESC']],
      include: [{ model: User, where: userWhere }],
    });
    let ordersForSum = await Order.findAll({
      where,
      order: [['createdAt', 'DESC']],
      attributes: ['sum']
    });

    let totalSum = 0;
    ordersForSum.forEach(x => totalSum += x.sum);

    const mappedOrders = await Promise.all(
      (orders.rows || []).map(async (order) => {
        const orderMongo = await findCartProjectForOrder(order);
        const totalPrice = Number(orderMongo?.totalPrice);
        const computedSigns = countTotalSignsFromProject(orderMongo?.project);
        return {
          ...(typeof order?.toJSON === 'function' ? order.toJSON() : order),
          orderMongo,
          signs: computedSigns > 0 ? computedSigns : Number(order?.signs || 0),
          totalPrice: Number.isFinite(totalPrice) ? totalPrice : null,
        };
      })
    );

    const baseOrders = orders.rows;

    const resolveOrderSigns = (order) => {
      const canvases = order?.orderMongo?.project?.canvases;
      if (Array.isArray(canvases) && canvases.length > 0) {
        return canvases.reduce((sum, canvas) => {
          const raw = canvas?.copiesCount ?? canvas?.toolbarState?.copiesCount ?? 1;
          const copies = Math.max(1, Math.floor(Number(raw) || 1));
          return sum + copies;
        }, 0);
      }

      const legacy = Number(order?.signs);
      return Number.isFinite(legacy) ? legacy : 0;
    };

    const enrichedOrders = await Promise.all(
      baseOrders.map(async (order) => {
        try {
          if (!order) {
            return res.status(404).json({ message: 'Order not found' });
          }

          const orderMongo = await findCartProjectForOrder(order);
          const computedSigns = countTotalSignsFromProject(orderMongo?.project);

          const signs = computedSigns > 0 ? computedSigns : Number(order?.signs || 0);

          const fullOrder = orderMongo;
          const totalPrice = Number(orderMongo?.totalPrice);
          return {
            ...order.toJSON(),
            orderMongo: fullOrder?.orderMongo || order?.orderMongo || null,
            totalPrice: Number.isFinite(totalPrice) ? totalPrice : null,
            signs: resolveOrderSigns({
              ...order.toJSON(),
              orderMongo: fullOrder?.orderMongo || order?.orderMongo || null,
            }),
          };
        } catch {
          return {
            ...order.toJSON(),
            totalPrice: Number.isFinite(Number(order?.totalPrice)) ? Number(order.totalPrice) : null,
            signs: resolveOrderSigns(order),
          };
        }
      })
    );

    const total = enrichedOrders.reduce((acc, order) => {
      const value = Number(order?.totalPrice);
      return Number.isFinite(value) ? acc + value : acc;
    }, 0);

    const sum = total.toFixed(2)


    return res.json({
      orders: enrichedOrders,
      page,
      totalSum,
      count: orders.count
    });
  } catch (err) {
    console.error(4234, err)
    return res.status(400).json(err);
  }
});

CartRouter.get('/get/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({
      where: { id: Number(id) },
      include: [
        {
          model: User,
          include: [
            {
              model: Order
            }
          ]
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const orderMongo = await findCartProjectForOrder(order);
    const computedSigns = countTotalSignsFromProject(orderMongo?.project);


    return res.json({
      order: {
        ...order.toJSON(),
        orderMongo,
        signs: computedSigns > 0 ? computedSigns : Number(order?.signs || 0),
      },
    });
  } catch (err) {
    console.error('GET ORDER ERROR:', err);
    return res.status(500).json({ message: err.message });
  }
});

CartRouter.post('/setStatus', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { orderId, newStatus } = req.body;

    let updatedCount;

    if (newStatus == 'Deleted') {
      [updatedCount] = await Order.update(
        { status: newStatus },
        { where: { userId: req.user.id } }
      );
    } else {
      [updatedCount] = await Order.update(
        { status: newStatus },
        { where: { id: Number(orderId) } }
      );
    }

    const orderWithUser = await Order.findOne({
      where: { id: Number(orderId) },
      include: [
        {
          model: User
        }
      ]
    });
    if (newStatus == 'Printed') {
      SendEmailForStatus.StatusPrinted(orderWithUser);
    }
    if (newStatus == 'Shipped') {
      SendEmailForStatus.StatusShipped(orderWithUser);
      SendEmailForStatus.StatusShipped2(orderWithUser);
    }
    if (newStatus == 'Delivered') {
      setTimeout(() => {
        SendEmailForStatus.StatusDelivered(orderWithUser);
      }, 48 * 60 * 60 * 1000);
    }

    if (updatedCount === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    return res.json({
      success: true,
      orderId,
      status: newStatus,
    });
  } catch (err) {
    console.error('SET STATUS ERROR:', err);
    return res.status(500).json({ message: err.message });
  }
});

CartRouter.get('/getPdfs/:idOrder', requireAuth, async (req, res, next) => {
  let browser;
  try {
    const { idOrder } = req.params;
    const order = await Order.findOne({
      where: { id: Number(idOrder) },
      include: [{
        model: User,
        include: [{ model: Order }]
      }]
    });

    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!canAccessOrderDocuments(req.user, order)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const orderMongo = await findCartProjectForOrder(order);
    const project = normalizeProjectForCart(orderMongo?.project || {});
    const canvases = Array.isArray(project?.canvases) ? project.canvases : [];
    const checkout = orderMongo?.checkout && typeof orderMongo.checkout === 'object'
      ? orderMongo.checkout
      : {};
    const deliveryAddress = hasAddressContent(checkout?.deliveryAddress)
      ? checkout.deliveryAddress
      : null;
    const invoiceAddress = hasAddressContent(checkout?.invoiceAddress)
      ? checkout.invoiceAddress
      : null;

    const formatOrderDateTime = (dateStr) => {
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) return '';
      const pad = (value) => String(value).padStart(2, '0');
      return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear()).slice(2)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const getThemeBadgeClass = (theme) => {
      const normalized = normalizeMaterialColorLabel(theme).toLowerCase();
      const map = {
        'white / black': 'bg-white-black',
        'white / blue': 'bg-white-blue',
        'white / red': 'bg-white-red',
        'black / white': 'bg-black-white',
        'blue / white': 'bg-blue-white',
        'red / white': 'bg-red-white',
        'green / white': 'bg-green-white',
        'yellow / black': 'bg-yellow-black',
        'gray / white': 'bg-gray-white',
        'grey / white': 'bg-gray-white',
        'orange / white': 'bg-orange-white',
        'brown / white': 'bg-brown-white',
        'silver / black': 'bg-silver-black',
        'wood / black': 'bg-wood-black',
        'carbon / white': 'bg-carbon-white',
      };
      return map[normalized] || 'bg-default';
    };

    const materialGroupsMap = new Map();
    canvases.forEach((canvas, index) => {
      const colorTheme = normalizeMaterialColorLabel(resolveColorThemeCaps(canvas?.toolbarState, canvas) || 'Unknown') || 'Unknown';
      const thicknessRaw = canvas?.Thickness ?? canvas?.toolbarState?.thickness;
      const thicknessValue = formatDisplayNumber(thicknessRaw) || '1.6';
      const tapeLabel = resolveTapeLabel(canvas);
      const copiesCount = resolveCopiesCount(canvas);
      const materialKey = `${colorTheme}::${thicknessValue}::${tapeLabel}`;
      const existing = materialGroupsMap.get(materialKey);

      if (!existing) {
        materialGroupsMap.set(materialKey, {
          key: materialKey,
          colorTheme,
          thickness: thicknessValue,
          tape: tapeLabel,
          count: copiesCount,
          badgeClass: getThemeBadgeClass(colorTheme),
          sortIndex: index,
        });
      } else {
        existing.count += copiesCount;
      }
    });

    const materialGroups = Array.from(materialGroupsMap.values()).sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      if (left.sortIndex !== right.sortIndex) return left.sortIndex - right.sortIndex;
      return left.key.localeCompare(right.key);
    });

    const formatThicknessSuffix = (value) => {
      const normalized = formatDisplayNumber(value);
      if (!normalized) return '';
      return normalized === '1.6' ? '' : ` ${normalized}`;
    };

    const userOrdersCountRaw = await Order.count({
      where: { userId: order.userId }
    });

    const orderDate = escapeHtml(formatOrderDateTime(order.createdAt));
    const customerNumber = escapeHtml(order.userId);
    const orderNumber = escapeHtml(order.id);
    const userOrdersCount = escapeHtml(userOrdersCountRaw || 0);
    const totalSigns = escapeHtml(order.signs || countProjectSigns(project) || 0);
    const orderTitle = escapeHtml(`${order.id} - ${order.orderName || orderMongo?.projectName || 'Untitled'}`);
    const userAdditionalMessages = parseAdditionalPayload(order?.user?.additional || '');
    const noticeText = escapeHtml(
      [
        String(userAdditionalMessages.instruction || '').trim(),
        String(orderMongo?.checkout?.deliveryComment || '').trim(),
        String(orderMongo?.manufacturerNote || project?.manufacturerNote || '').trim(),
      ]
        .filter(hasContent)
        .join('; ')
    );

    const deliveryStreetLines = [
      deliveryAddress?.address1,
      deliveryAddress?.address2,
      deliveryAddress?.address3,
    ].filter(hasContent);

    const fallbackStreetLines = [
      order.user?.address,
      order.user?.house,
      order.user?.address2,
      order.user?.address3,
    ].filter(hasContent);

    const rightAddressLines = [
      deliveryAddress?.companyName || invoiceAddress?.companyName || order.user?.company || '',
      deliveryAddress?.fullName || [order.user?.firstName, order.user?.surname].filter(hasContent).join(' '),
      ...(deliveryStreetLines.length > 0 ? deliveryStreetLines : ""),
      [deliveryAddress?.postalCode, deliveryAddress?.town].filter(hasContent).join(' ') || [order.user?.postcode, order.user?.city].filter(hasContent).join(' '),
      deliveryAddress?.country || order.user?.country || order.country || '',
      deliveryAddress?.mobile || order.user?.phone ? `Phone: ${deliveryAddress?.mobile || order.user?.phone || ''}` : '',
    ].filter(hasContent);

    const leftAddressLines = [
      ...rightAddressLines,
      checkout?.invoiceAddressEmail || order.user?.email || '',
    ].filter(hasContent);

    const leftAddressHtml = leftAddressLines.map((line) => `${escapeHtml(line)}<br>`).join('');
    const rightAddressHtml = rightAddressLines.map((line) => `${escapeHtml(line)}<br>`).join('');

    const materialRowBlocks = materialGroups.map((group) => {
      const thicknessSuffix = formatThicknessSuffix(group.thickness);
      const tapeSuffix = group.tape === 'TAPE' ? '' : ' NO TAPE';
      const label = `${order.userId} ${group.colorTheme}${thicknessSuffix}${tapeSuffix} (${order.id}) (${group.count} signs)`;
      const iconSvg = getMaterialIconSvg(group.colorTheme);

      return {
        section: 'material',
        units: 1,
        measureHtml: `
        <div class="item-row">
            <div class="checkbox"></div>
            <div class="label-box"><span class="label-box__fallback">A</span></div>
            <div class="item-text">${escapeHtml(label)}</div>
        </div>`,
        html: `
        <div class="item-row">
            <div class="checkbox"></div>
            <div class="label-box">${iconSvg || '<span class="label-box__fallback">A</span>'}</div>
            <div class="item-text">${escapeHtml(label)}</div>
        </div>`
      };
    });

    const accessoryBlocks = normalizeAccessories(orderMongo?.accessories).map((item) => ({
        section: 'accessory',
        units: 1,
      measureHtml: `
      <div class="extra-row">
        <div class="checkbox"></div>
        <span>${escapeHtml(item.qty)}&nbsp; <u>${escapeHtml(item.name)}</u></span>
      </div>`,
        html: `
        <div class="extra-row">
            <div class="checkbox"></div>
            <span>${escapeHtml(item.qty)}&nbsp; <u>${escapeHtml(item.name)}</u></span>
        </div>`
      }));

    const deliveryLabel = escapeHtml(order.deliveryType || checkout?.deliveryLabel || '');
    const orderSum = escapeHtml(formatMoney(order.sum));

    const firstPageHeaderHtml = `
    <div class="header">
      <h1>CSA</h1>
      <p>Germany</p>
    </div>

    <div class="order-info">
      <div class="order-details">
        <div class="order-date">${orderDate}</div>
        <div>Customer No: ${customerNumber}</div>
        <div>Order No: ${orderNumber}</div>
        <div>Count orders: ${userOrdersCount}</div>
        <div>Count sign: ${totalSigns}</div>
      </div>
      <div class="order-title">${orderTitle}</div>
    </div>

    <div class="address-section">
      <div class="address-left">${leftAddressHtml}${noticeText ? `<div class="notice notice--after-email">Our Notice: ${noticeText}</div>` : ''}</div>
      <div class="address-right">${rightAddressHtml}</div>
    </div>`;

    const continuedPageHeaderHtml = `
    <div class="header header--continued">
      <h1>CSA</h1>
      <p>Germany</p>
    </div>
    <div class="order-title order-title--continued">${orderTitle}</div>`;

    const footerHtml = `
    <div class="footer">
      <div class="footer-row">
        <div class="footer-checkbox"></div>
        <div class="footer-details">
          <div>Delivery: ${deliveryLabel}</div>
          <div class="footer-order-sum">Order Sum: ${orderSum}</div>
        </div>
      </div>
    </div>`;

    const csaPdfMarginsPx = {
      top: 10,
      right: 20,
      bottom: 28,
      left: 20,
    };
    const csaPrintableWidthCss = `calc(210mm - ${csaPdfMarginsPx.left + csaPdfMarginsPx.right}px)`;
    const csaPrintableHeightCss = `calc(297mm - ${csaPdfMarginsPx.top + csaPdfMarginsPx.bottom}px)`;

    const csaPageStyles = `
      @page {
        size: A4;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 0;
        font-family: Arial, sans-serif;
        background-color: #f0f0f0;
      }
      .sheet {
        width: ${csaPrintableWidthCss};
        height: ${csaPrintableHeightCss};
        padding: 16mm 20mm 20mm;
        margin: 10mm auto;
        background: white;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
      }
      .sheet.page-break {
        break-after: page;
        page-break-after: always;
      }
      .sheet.sheet--continued {
        padding-top: 24mm;
      }
      .header {
        text-align: center;
        margin-bottom: 30px;
      }
      .header--continued {
        margin-bottom: 18px;
      }
      .header h1 {
        margin: 0;
        font-size: 28px;
        letter-spacing: 2px;
      }
      .header p {
        margin: 0;
        font-size: 20px;
        font-weight: bold;
      }
      .order-info {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 22px;
      }
      .order-details {
        line-height: 1.5;
      }
      .order-date {
        text-decoration: underline;
      }
      .order-title {
        font-size: 22px;
        font-weight: bold;
        margin-top: 30px;
        text-align: right;
      }
      .order-title--continued {
        margin-top: 0;
        margin-bottom: 20px;
        text-align: left;
        font-size: 18px;
      }
      .notice {
        margin-bottom: 30px;
      }
      .notice--after-email {
        display: block;
        width: 100%;
        max-width: 80%;
        margin-top: 12px;
        margin-bottom: 0;
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .address-section {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 40px;
        line-height: 1.4;
      }
      .address-left {
        width: 40%;
        flex: 0 0 40%;
        max-width: 40%;
        font-size: 14px;
      }
      .address-right {
        width: 40%;
        flex: 0 0 40%;
        max-width: 40%;
        font-size: 14px;
      }
      .items-list {
        margin-top: 20px;
      }
      .item-row {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
        break-inside: avoid;
      }
      .checkbox {
        width: 35px;
        height: 20px;
        border: 1px solid #000;
        margin-right: 20px;
        box-sizing: border-box;
        flex: 0 0 auto;
      }
      .label-box {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 20px;
        flex: 0 0 auto;
      }
      .label-box svg {
        width: 100%;
        height: 100%;
        display: block;
      }
      .material-icon-texture {
        width: 100%;
        height: 100%;
        border-radius: 4px;
        border: 1px solid rgba(0, 0, 0, 0.29);
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .material-icon-texture--carbon-white {
        background-size: 108% 108%;
        background-position: 50% 46%;
      }
      .material-icon-texture--wood-black {
        background-size: 104% 104%;
        background-position: center;
      }
      .material-icon-texture__letter {
        font-size: 22px;
        line-height: 1;
        font-weight: 500;
      }
      .label-box__fallback {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #000;
        border-radius: 4px;
        font-weight: bold;
      }
      .item-text {
        text-decoration: underline;
        font-size: 16px;
      }
      .extra-items {
        margin-top: 40px;
      }
      .extra-row {
        display: flex;
        align-items: center;
        margin-bottom: 15px;
        break-inside: avoid;
      }
      .extra-row span {
        font-size: 18px;
        font-weight: normal;
      }
      .footer {
        margin-top: 28px;
      }
      .footer-row {
        display: flex;
        align-items: flex-start;
      }
      .footer-checkbox {
        width: 35px;
        height: 20px;
        border: 1px solid #000;
        margin-right: 20px;
        box-sizing: border-box;
        flex: 0 0 auto;
      }
      .footer-details {
        line-height: 1.45;
      }
      .footer-order-sum {
        margin-top: 16px;
      }
      .bg-white-black { background: #fff; border: 1px solid #000; color: #000; }
      .bg-white-blue { background: #fff; border: 1px solid #1d4ed8; color: #1d4ed8; }
      .bg-white-red { background: #fff; border: 1px solid #dc2626; color: #dc2626; }
      .bg-black-white { background: #000; color: #fff; }
      .bg-blue-white { background: #0000ff; color: #fff; }
      .bg-red-white { background: #ff0000; color: #fff; }
      .bg-green-white { background: #15803d; color: #fff; }
      .bg-yellow-black { background: #facc15; color: #000; }
      .bg-gray-white { background: #6b7280; color: #fff; }
      .bg-orange-white { background: #f97316; color: #fff; }
      .bg-brown-white { background: #92400e; color: #fff; }
      .bg-silver-black { background: #c0c0c0; border: 1px solid #999; color: #000; }
      .bg-wood-black { background: #b08968; color: #000; }
      .bg-carbon-white { background: #374151; color: #fff; }
      .bg-default { background: #fff; border: 1px solid #ccc; color: #000; }
      @media print {
        body { background: none; }
        .sheet { margin: 0; box-shadow: none; }
      }
    `;

    const allOrderBlocks = [...materialRowBlocks, ...accessoryBlocks];
    const getPdfBlockHeight = (block) => Math.max(1, Number(block?.heightPx) || 1);
    let pagedOrderBlocks = ensureLastPdfPageCapacity(
      paginatePdfBlocks(allOrderBlocks, 10, 18),
      16,
      18
    );

    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();

    try {
      let measurementPage;
      let measureResult;
      try {
        measurementPage = await browser.newPage();
      const measureHtml = `
      <!DOCTYPE html>
      <html lang="uk">
      <head>
        <meta charset="UTF-8">
        <style>${csaPageStyles}</style>
      </head>
      <body>
        <div id="measure-first" class="sheet">
          ${firstPageHeaderHtml}
          <div id="measure-first-anchor"></div>
        </div>

        <div id="measure-next" class="sheet sheet--continued">
          ${continuedPageHeaderHtml}
          <div id="measure-next-anchor"></div>
        </div>

        <div class="sheet">
          <div id="measure-blocks">
            ${allOrderBlocks
              .map(
                (block, index) =>
                  `<div data-measure-block="${index}">${block.measureHtml || block.html}</div>`
              )
              .join('')}
          </div>
          <div id="measure-footer">${footerHtml}</div>
        </div>
      </body>
      </html>`;

      await measurementPage.setContent(measureHtml, { waitUntil: 'domcontentloaded' });
      measureResult = await measurementPage.evaluate(() => {
        const toOuterHeight = (el) => {
          if (!el) return 0;
          const style = window.getComputedStyle(el);
          const marginTop = Number.parseFloat(style.marginTop || '0') || 0;
          const marginBottom = Number.parseFloat(style.marginBottom || '0') || 0;
          return el.getBoundingClientRect().height + marginTop + marginBottom;
        };

        const firstSheet = document.getElementById('measure-first');
        const firstAnchor = document.getElementById('measure-first-anchor');
        const nextSheet = document.getElementById('measure-next');
        const nextAnchor = document.getElementById('measure-next-anchor');
        const footerNode = document.querySelector('#measure-footer .footer');

        const firstCapacityPx =
          firstSheet && firstAnchor
            ? Math.max(
                1,
                firstSheet.getBoundingClientRect().bottom -
                  firstAnchor.getBoundingClientRect().top
              )
            : 1;

        const nextCapacityPx =
          nextSheet && nextAnchor
            ? Math.max(
                1,
                nextSheet.getBoundingClientRect().bottom -
                  nextAnchor.getBoundingClientRect().top
              )
            : firstCapacityPx;

        const blockHeights = Array.from(
          document.querySelectorAll('[data-measure-block]')
        ).map((wrapper) => toOuterHeight(wrapper.firstElementChild || wrapper));

        return {
          blockHeights,
          firstCapacityPx,
          nextCapacityPx,
          footerReservePx: toOuterHeight(footerNode) + 8,
          itemsListTopMarginPx: 20,
          extraItemsTopMarginPx: 40,
        };
      });
      } finally {
        if (measurementPage && !measurementPage.isClosed()) {
          await measurementPage.close();
        }
      }

      const measuredBlocks = allOrderBlocks.map((block, index) => ({
        ...block,
        heightPx: Math.max(1, Number(measureResult?.blockHeights?.[index]) || 1),
      }));

      const itemsListTopMarginPx = Math.max(
        0,
        Number(measureResult?.itemsListTopMarginPx) || 0
      );
      const extraItemsTopMarginPx = Math.max(
        0,
        Number(measureResult?.extraItemsTopMarginPx) || 0
      );

      const getPageContentHeight = (blocks = []) => {
        let totalHeight = 0;
        let hasMaterialRows = false;
        let hasAccessoryRows = false;

        (Array.isArray(blocks) ? blocks : []).forEach((block) => {
          if (block?.section === 'material' && !hasMaterialRows) {
            totalHeight += itemsListTopMarginPx;
            hasMaterialRows = true;
          }
          if (block?.section === 'accessory' && !hasAccessoryRows) {
            totalHeight += extraItemsTopMarginPx;
            hasAccessoryRows = true;
          }
          totalHeight += getPdfBlockHeight(block);
        });

        return totalHeight;
      };

      const firstCapacityPx = Math.max(
        1,
        Number(measureResult?.firstCapacityPx) || 1
      );
      const nextCapacityPx = Math.max(
        1,
        Number(measureResult?.nextCapacityPx) || firstCapacityPx
      );

      const measuredPages = [];
      let currentPageBlocks = [];
      let currentCapacity = firstCapacityPx;

      measuredBlocks.forEach((block) => {
        const candidatePageBlocks = [...currentPageBlocks, block];
        const candidateHeight = getPageContentHeight(candidatePageBlocks);

        if (
          currentPageBlocks.length > 0 &&
          candidateHeight > currentCapacity
        ) {
          measuredPages.push(currentPageBlocks);
          currentPageBlocks = [block];
          currentCapacity = nextCapacityPx;
          return;
        }

        currentPageBlocks = candidatePageBlocks;
      });

      if (currentPageBlocks.length > 0) {
        measuredPages.push(currentPageBlocks);
      }

      const getPageCapacityByIndex = (index) => (index === 0 ? firstCapacityPx : nextCapacityPx);
      const footerReservePx = Math.max(
        0,
        Number(measureResult?.footerReservePx) || 0
      );
      const balancedPages = measuredPages.length > 0
        ? measuredPages.map((pageBlocks) => [...pageBlocks])
        : [[]];

      const ensureLastPageFooterCapacity = () => {
        let safety = 0;
        while (balancedPages.length > 0 && safety < 10000) {
          safety += 1;
          const lastPageIndex = balancedPages.length - 1;
          const lastPageBlocks = balancedPages[lastPageIndex] || [];
          const pageCapacity = getPageCapacityByIndex(lastPageIndex);

          if (getPageContentHeight(lastPageBlocks) + footerReservePx <= pageCapacity) {
            break;
          }

          if (lastPageBlocks.length <= 1) {
            break;
          }

          const movedBlock = lastPageBlocks.pop();
          if (!balancedPages[lastPageIndex + 1]) {
            balancedPages.push([]);
          }
          balancedPages[lastPageIndex + 1].unshift(movedBlock);
        }
      };

      const rebalanceForward = () => {
        let changed = true;
        let safety = 0;

        while (changed && safety < 10000) {
          safety += 1;
          changed = false;

          for (let i = 0; i < balancedPages.length - 1; i += 1) {
            const currentPage = balancedPages[i] || [];
            const nextPage = balancedPages[i + 1] || [];
            const currentCapacity = getPageCapacityByIndex(i);

            while (nextPage.length > 0) {
              const candidateBlock = nextPage[0];
              const candidateHeight = getPageContentHeight([...currentPage, candidateBlock]);

              if (candidateHeight <= currentCapacity) {
                currentPage.push(nextPage.shift());
                changed = true;
              } else {
                break;
              }
            }

            if (nextPage.length === 0) {
              balancedPages.splice(i + 1, 1);
              changed = true;
              i -= 1;
            }
          }
        }
      };

      ensureLastPageFooterCapacity();
      rebalanceForward();
      ensureLastPageFooterCapacity();

      pagedOrderBlocks = balancedPages.length > 0 ? balancedPages : [[]];
    } catch (measureError) {
      console.warn('CSA pagination measurement failed, fallback to unit pagination:', measureError?.message || measureError);
    }

    const buildCsaOrderHtml = (pages) => `
  <!DOCTYPE html>
  <html lang="uk">
  <head>
    <meta charset="UTF-8">
    <title>CSA Germany Order</title>
    <style>${csaPageStyles}</style>
  </head>
  <body>
  ${pages.map((pageBlocks, pageIndex) => {
    const isFirstPage = pageIndex === 0;
    const isLastPage = pageIndex === pages.length - 1;
    const pageMaterialRowsHtml = pageBlocks.filter((block) => block.section === 'material').map((block) => block.html).join('');
    const pageAccessoriesHtml = pageBlocks.filter((block) => block.section === 'accessory').map((block) => block.html).join('');

    return `
  <div class="sheet${isFirstPage ? '' : ' sheet--continued'}${isLastPage ? '' : ' page-break'}">
    ${isFirstPage ? firstPageHeaderHtml : continuedPageHeaderHtml}

    ${pageMaterialRowsHtml ? `<div class="items-list">${pageMaterialRowsHtml}</div>` : ''}
    ${pageAccessoriesHtml ? `<div class="extra-items">${pageAccessoriesHtml}</div>` : ''}

    ${isLastPage ? footerHtml : ''}
  </div>`;
  }).join('')}
  </body>
  </html>`;

    let overflowSafety = 0;
    while (overflowSafety < 1000) {
      overflowSafety += 1;

      const htmlForCheck = buildCsaOrderHtml(pagedOrderBlocks);
      await page.setContent(htmlForCheck, { waitUntil: 'domcontentloaded' });

      const overflowIndex = await page.evaluate(() => {
        const sheets = Array.from(document.querySelectorAll('.sheet'));
        return sheets.findIndex((sheet) => sheet.scrollHeight - sheet.clientHeight > 1);
      });

      if (overflowIndex < 0) {
        break;
      }

      const sourcePage = pagedOrderBlocks[overflowIndex] || [];
      if (sourcePage.length <= 1) {
        break;
      }

      const movedBlock = sourcePage.pop();
      if (!pagedOrderBlocks[overflowIndex + 1]) {
        pagedOrderBlocks[overflowIndex + 1] = [];
      }
      pagedOrderBlocks[overflowIndex + 1].unshift(movedBlock);

      if ((pagedOrderBlocks[overflowIndex] || []).length === 0) {
        pagedOrderBlocks.splice(overflowIndex, 1);
      }
    }

    const htmlContent = buildCsaOrderHtml(pagedOrderBlocks);
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: buildPdfFooterTemplate(12, 20, 2),
      margin: {
        top: `${csaPdfMarginsPx.top}px`,
        right: `${csaPdfMarginsPx.right}px`,
        bottom: `${csaPdfMarginsPx.bottom}px`,
        left: `${csaPdfMarginsPx.left}px`,
      }
    });

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="order-${idOrder}.pdf"`,
      'Content-Length': pdfBuffer.length
    });

    return res.end(pdfBuffer, 'binary');

  } catch (err) {
    console.error('error get pdfs', err);
    return res.status(500).send('Error');
  } finally {
    if (browser) await browser.close();
  }
});


CartRouter.get('/getPdfs2/:idOrder', requireAuth, async (req, res, next) => {
  let browser; // Оголошуємо зовні, щоб закрити у блоці finally
  try {
    const { idOrder } = req.params;

    // Твоя логіка пошуку даних
    const order = await Order.findOne({
      where: { id: Number(idOrder) },
      include: [{ model: User, include: [{ model: Order }] }]
    });

    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!canAccessOrderDocuments(req.user, order)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const orderMongo = await findCartProjectForOrder(order);

    // Запускаємо Puppeteer
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Важливо для Linux/VPS
    });
    const page = await browser.newPage();
    const checkout = orderMongo?.checkout && typeof orderMongo.checkout === 'object' ? orderMongo.checkout : {};
    const deliveryAddress = hasAddressContent(checkout?.deliveryAddress) ? checkout.deliveryAddress : null;
    const summary = buildDeliveryNoteSummary(order, orderMongo);
    const orderDate = escapeHtml(formatInvoiceDate(order.createdAt));
    const customerNumber = escapeHtml(order.userId);
    const orderNumber = escapeHtml(order.id);
    const orderName = escapeHtml(summary.projectTitle || order.orderName || orderMongo?.projectName || 'Untitled');
    const invoiceNumber = escapeHtml(order.id);
    const totalSigns = escapeHtml(summary.totalSigns || order.signs || 0);
    const accessoriesSummary = summary.accessories.length
      ? summary.accessories.map((item) => `${escapeHtml(item.qty)} ${escapeHtml(item.name)}`).join('; ')
      : 'No accessories selected';
    const accessoriesBlockHtml = `
    <div class="item-block">
      <div class="col-left">Accessories: ${escapeHtml(summary.accessories.length)} Types:</div>
      <div class="col-right">${accessoriesSummary}</div>
    </div>`;
    const shippingCompany = deliveryAddress?.companyName || '';
    const shippingName = deliveryAddress?.fullName || [order.user?.firstName, order.user?.surname].filter(hasContent).join(' ');
    const shippingAddressLine1 = [deliveryAddress?.address1, deliveryAddress?.address2, deliveryAddress?.address3]
      .filter(hasContent)
      .join(', ');
    const shippingAddressLine2 = [deliveryAddress?.postalCode, deliveryAddress?.town].filter(hasContent).join(' ');
    const shippingCountry = deliveryAddress?.country || order.country || order.user?.country || '';
    const shippingPhone = deliveryAddress?.mobile || order.user?.phone || '';
    const shippingAddressHtml = [
      shippingCompany,
      shippingName,
      shippingAddressLine1,
      shippingAddressLine2,
      shippingCountry,
      shippingPhone ? `Phone: ${shippingPhone}` : '',
    ]
      .filter(hasContent)
      .map(escapeHtml)
      .join('<br>');
    const signBlocks = summary.signs.length > 0
      ? summary.signs
        .map((sign, index) => {
          const counts = sign?.counts || {};
          const countsSummary = [
            toNumber(counts.images, 0) > 0 ? `${Math.floor(toNumber(counts.images, 0))} Images` : null,
            toNumber(counts.shapes, 0) > 0 ? `${Math.floor(toNumber(counts.shapes, 0))} Shapes` : null,
            toNumber(counts.cutFigures, 0) > 0 ? `${Math.floor(toNumber(counts.cutFigures, 0))} Cut Figures` : null,
            toNumber(counts.holes, 0) > 0 ? `${Math.floor(toNumber(counts.holes, 0))} Holes` : null,
            toNumber(counts.qrCodes, 0) > 0 ? `${Math.floor(toNumber(counts.qrCodes, 0))} QR` : null,
            toNumber(counts.barcodes, 0) > 0 ? `${Math.floor(toNumber(counts.barcodes, 0))} Bar Codes` : null,
          ].filter(Boolean);
          const copiesCount = Math.max(1, Math.floor(toNumber(sign?.copiesCount, 1)));
          const signTitle = `${String(sign?.title || `Sign ${index + 1}`)}${copiesCount > 1 ? ` (${copiesCount} pcs)` : ''}`;
          const signMetaLine = [String(sign?.metaLine || '').trim(), ...countsSummary].filter(hasContent).join(', ');

          return {
            section: 'sign',
            units: 1,
            html: `
    <div class="item-block">
      <div class="col-left">${escapeHtml(signTitle)}:</div>
      <div class="col-right">
        ${escapeHtml(signMetaLine || 'No sign details available')}<br>
        <span class="item-details">Text: ${escapeHtml(sign?.textLine || '—')}</span>
      </div>
    </div>`
          };
        })
      : [{
        section: 'sign',
        units: 1,
        html: `
    <div class="item-block">
      <div class="col-left">Signs:</div>
      <div class="col-right">No sign details available for this order.</div>
    </div>`
      }];

    const pagedDeliveryBlocks = paginatePdfBlocks(
      [{ section: 'accessory', units: 1, html: accessoriesBlockHtml }, ...signBlocks],
        15,
        18
    );

    const htmlContent = `
  <!DOCTYPE html>
  <html lang="uk">
  <head>
    <meta charset="UTF-8">
    <title>Delivery Note - SignXpert</title>
    <style>
      @page {
        size: A4;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 0;
        font-family: 'Inter', Arial, sans-serif;
        font-size: 13px;
        color: #000;
        background-color: #f0f0f0;
      }
      .sheet {
        width: 210mm;
        min-height: 297mm;
        padding: 15mm 20mm;
        margin: 0 auto;
        background: white;
        box-sizing: border-box;
        position: relative;
      }
      .sheet.page-break {
        break-after: page;
        page-break-after: always;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 40px;
      }
      .header.header--continued {
        margin-bottom: 24px;
      }
      .logo-section {
        display: flex;
        align-items: flex-start;
      }
      .logo-wrap svg {
        width: 279px;
        height: 71px;
        display: block;
      }
      .header-contacts {
        margin-left: 20px;
        font-size: 12px;
        line-height: 1.3;
        color: #000;
        padding-top: 2px;
      }
      .header-contacts a {
        color: #000;
        text-decoration: none;
      }
      .delivery-title {
        font-size: 30px;
        font-weight: 700;
        text-decoration: underline;
        margin-top: -5px;
      }
      .delivery-title--continued {
        font-size: 22px;
        margin-top: 0;
      }
      .info-grid {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 25px;
      }
      .order-meta table {
        border-collapse: collapse;
      }
      .order-meta td {
        padding: 2px 0;
        font-weight: 400;
        vertical-align: top;
      }
      .label {
        width: 130px;
      }
      .value {
        padding-left: 10px;
      }
      .shipping-address {
        width: 45%;
        line-height: 1.4;
        font-weight: 400;
        word-break: break-word;
      }
      .count-section {
        margin: 20px 0;
        font-size: 16px;
        font-weight: 400;
      }
      .item-block {
        display: flex;
        width: 100%;
        border: 1px solid #999;
        margin-bottom: 5px;
        break-inside: avoid;
      }
      .col-left {
        width: 25%;
        padding: 4px 10px;
        border-right: 1px solid #999;
        background-color: #fff;
        box-sizing: border-box;
      }
      .col-right {
        width: 75%;
        padding: 4px 10px;
        background-color: #fff;
        box-sizing: border-box;
      }
      .item-details {
        display: block;
        margin-top: 2px;
      }
      .footer-note {
        position: absolute;
        left: 20mm;
        right: 20mm;
        bottom: 14mm;
        text-align: center;
        font-size: 11px;
        line-height: 1.6;
      }
    </style>
  </head>
  <body>
  ${pagedDeliveryBlocks.map((pageBlocks, pageIndex) => {
    const isFirstPage = pageIndex === 0;
    const isLastPage = pageIndex === pagedDeliveryBlocks.length - 1;
    const pageAccessoryBlocksHtml = pageBlocks.filter((block) => block.section === 'accessory').map((block) => block.html).join('');
    const pageSignBlocksHtml = pageBlocks.filter((block) => block.section === 'sign').map((block) => block.html).join('');

    return `
  <div class="sheet${isLastPage ? ' sheet--with-footer' : ''}${isLastPage ? '' : ' page-break'}">
    <div class="header${isFirstPage ? '' : ' header--continued'}">
      <div class="logo-section">
        <div>
            <div class="svg-logo">
<svg width="279" height="71" viewBox="0 0 279 71" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M118.876 48.2324H2.61572V49.0686H118.876V48.2324Z" fill="#006CA4"/>
<path d="M146.84 2.22474H275.735V1.4043H147.078L146.84 2.22474Z" fill="#006CA4"/>
<path d="M18.4361 30.9404C18.4361 30.1673 18.1983 29.5047 17.7227 28.9524C17.2472 28.4002 16.296 28.0058 14.8693 27.7533L11.4611 27.1064C8.7028 26.6016 6.62615 25.7653 5.23115 24.5978C3.83615 23.4302 3.13865 21.7104 3.13865 19.4384C3.13865 17.7502 3.56667 16.3302 4.42269 15.1784C5.27871 14.0267 6.48348 13.1431 8.03701 12.5593C9.59053 11.9598 11.3977 11.6758 13.4585 11.6758C15.7095 11.6758 17.5642 11.9913 19.0068 12.6224C20.4493 13.2536 21.5431 14.1056 22.3199 15.21C23.0808 16.3144 23.5564 17.5609 23.7625 18.9967L18.2459 19.6909C17.9288 18.4918 17.4216 17.5924 16.7399 17.0402C16.0424 16.4722 14.9327 16.1882 13.3792 16.1882C11.7306 16.1882 10.5575 16.4722 9.86002 17.0244C9.16252 17.5767 8.81377 18.2867 8.81377 19.1544C8.81377 20.0222 9.08326 20.6849 9.60638 21.1424C10.1454 21.6 11.0648 21.9629 12.4122 22.2311L15.979 22.9253C18.8641 23.4776 20.9566 24.3611 22.2723 25.576C23.5881 26.7909 24.238 28.5107 24.238 30.7353C24.238 33.1651 23.3503 35.1373 21.5907 36.6047C19.8152 38.0878 17.1996 38.8293 13.7438 38.8293C10.4307 38.8293 7.81507 38.1351 5.89695 36.7309C3.97882 35.3267 2.90087 33.1809 2.66309 30.262H4.56536H8.3382C8.56013 31.6662 9.11496 32.6918 10.0344 33.3387C10.938 33.9856 12.2696 34.3169 14.0133 34.3169C15.6778 34.3169 16.8509 34.0013 17.5167 33.3702C18.1032 32.7076 18.4361 31.9187 18.4361 30.9404Z" fill="#262626"/>
<path d="M35.0649 12.3228H40.7718V38.151H35.0649V12.3228Z" fill="#262626"/>
<path d="M51.7734 25.3078C51.7734 22.5624 52.249 20.1642 53.216 18.1289C54.1671 16.0936 55.578 14.5 57.4168 13.3798C59.2557 12.2438 61.4909 11.6758 64.1065 11.6758C67.1818 11.6758 69.6072 12.3858 71.3668 13.8216C73.1423 15.2573 74.252 17.2138 74.7117 19.6909L69.0366 20.3062C68.7195 19.1071 68.1964 18.1604 67.4672 17.482C66.738 16.8036 65.5966 16.4722 64.0589 16.4722C62.5371 16.4722 61.3007 16.8509 60.3654 17.5924C59.4301 18.334 58.7484 19.3596 58.3363 20.6691C57.9083 21.9787 57.7022 23.4776 57.7022 25.1973C57.7022 28.0216 58.257 30.1831 59.3667 31.7136C60.4763 33.2282 62.2518 33.9856 64.6772 33.9856C66.6904 33.9856 68.3866 33.5596 69.7658 32.7233V28.4949H64.7089V23.9667H75.108V35.2478C73.7288 36.3996 72.0961 37.2831 70.2096 37.8827C68.3232 38.4822 66.4051 38.782 64.4711 38.782C60.4288 38.782 57.3059 37.5987 55.1024 35.2636C52.8831 32.9127 51.7734 29.5993 51.7734 25.3078Z" fill="#262626"/>
<path d="M86.6011 12.3228H91.7214L102.548 29.2839V12.3228H107.922V38.151H102.881L91.975 21.2214V38.151H86.6011V12.3228Z" fill="#262626"/>
<path d="M165.751 12.3228H175.088C177.577 12.3228 179.575 12.6699 181.049 13.3483C182.523 14.0425 183.585 15.005 184.251 16.2356C184.901 17.4821 185.234 18.9494 185.234 20.6376C185.234 22.3732 184.901 23.8879 184.235 25.1816C183.569 26.4754 182.491 27.4694 181.017 28.1794C179.543 28.8894 177.577 29.2523 175.136 29.2523H171.284V38.151H165.767V12.3228H165.751ZM179.876 20.7165C179.876 19.3912 179.543 18.413 178.861 17.7976C178.18 17.1823 176.927 16.8825 175.088 16.8825H171.268V24.6925H175.12C176.991 24.6925 178.243 24.3454 178.893 23.667C179.559 22.9728 179.876 21.9945 179.876 20.7165Z" fill="#262626"/>
<path d="M195.442 12.3228H213.435V16.9141H201.086V22.6572H212.721V27.2485H201.086V33.5439H214.164L213.577 38.1352H195.442V12.3228Z" fill="#262626"/>
<path d="M224.817 12.3228H234.598C237.039 12.3228 239.005 12.6541 240.463 13.3325C241.921 14.011 242.984 14.9419 243.649 16.141C244.299 17.3401 244.632 18.697 244.632 20.2116C244.632 21.8525 244.299 23.2725 243.618 24.4716C242.936 25.6708 241.89 26.649 240.495 27.359L245.916 38.1352H239.924L235.374 28.5896C235.184 28.5896 234.994 28.5896 234.788 28.6054C234.598 28.6212 234.408 28.6212 234.201 28.6212H230.27V38.1352H224.817V12.3228ZM239.1 20.3852C239.1 19.1861 238.751 18.271 238.054 17.6556C237.356 17.0403 236.072 16.7405 234.233 16.7405H230.27V24.2665H234.455C236.246 24.2665 237.467 23.9352 238.133 23.2725C238.783 22.5941 239.1 21.6474 239.1 20.3852Z" fill="#262626"/>
<path d="M262.038 17.277H254.112V12.3228H275.734V17.277H267.776V38.151H262.038V17.277Z" fill="#262626"/>
<path d="M140.515 24.4714L135.727 31.4136L123.553 49.069H113.978L130.94 24.4714L122.903 12.8116L119.748 8.23607H129.323L132.478 12.8116L135.727 17.5292L140.515 24.4714ZM137.392 33.8119L140.863 38.8607H150.438L142.179 26.8696L137.392 33.8119ZM156.415 1.4043H146.84L137.376 15.131L142.163 22.0732L156.415 1.4043Z" fill="#006CA4"/>
<path d="M37.9028 8.17296L34.1617 1.4043L30.5474 5.68008L37.9028 8.17296Z" fill="#006CA4"/>
<path d="M186.708 69.4222H66.9282C62.3628 69.4222 58.6533 65.7302 58.6533 61.1862C58.6533 56.6422 62.3628 52.9502 66.9282 52.9502H186.708C191.273 52.9502 194.983 56.6422 194.983 61.1862C194.983 65.7302 191.273 69.4222 186.708 69.4222Z" fill="#006CA4"/>
<path d="M7.70441 65.2573C7.08617 65.2573 6.54719 65.1468 6.08748 64.9417C5.62776 64.7366 5.26316 64.4526 4.99367 64.0897C4.72418 63.7268 4.58151 63.3008 4.5498 62.8117H5.43753C5.46924 63.1746 5.59606 63.4744 5.80213 63.7268C6.00821 63.9793 6.2777 64.1528 6.6106 64.2948C6.9435 64.421 7.3081 64.4841 7.70441 64.4841C8.16412 64.4841 8.56043 64.4053 8.90918 64.2633C9.25793 64.1055 9.52742 63.9004 9.7335 63.6321C9.93958 63.3639 10.0347 63.0484 10.0347 62.6855C10.0347 62.3857 9.95543 62.1333 9.79691 61.9281C9.63838 61.723 9.41645 61.5495 9.13111 61.4075C8.84577 61.2655 8.51287 61.1393 8.13242 61.0288L7.05446 60.7133C6.34111 60.4766 5.77043 60.1926 5.37412 59.7981C4.97782 59.4037 4.78759 58.9461 4.78759 58.3781C4.78759 57.889 4.91441 57.4473 5.1839 57.0844C5.45338 56.7057 5.80213 56.4217 6.26185 56.2008C6.72157 55.9957 7.22884 55.8853 7.78367 55.8853C8.35435 55.8853 8.86162 55.9957 9.30549 56.2008C9.74935 56.4059 10.0981 56.7057 10.3517 57.0686C10.6054 57.4315 10.748 57.8417 10.7639 58.315H9.92373C9.87617 57.8101 9.65424 57.4157 9.25793 57.1159C8.86162 56.8161 8.3702 56.6741 7.76782 56.6741C7.35566 56.6741 6.9752 56.753 6.65816 56.895C6.34111 57.037 6.08748 57.2421 5.9131 57.4946C5.73873 57.747 5.64361 58.031 5.64361 58.3624C5.64361 58.6779 5.73873 58.9304 5.9131 59.1513C6.08748 59.3721 6.32526 59.5299 6.59475 59.6719C6.88009 59.7666 7.14958 59.877 7.45077 59.9559L8.40191 60.2241C8.7031 60.303 8.98844 60.4135 9.28963 60.5397C9.59083 60.6659 9.84446 60.8237 10.0981 61.013C10.3359 61.2024 10.5261 61.439 10.6846 61.7073C10.8273 61.9755 10.9066 62.3068 10.9066 62.6697C10.9066 63.1588 10.7797 63.6006 10.5261 63.9793C10.2566 64.3895 9.89202 64.6893 9.41645 64.9101C8.94088 65.1468 8.3702 65.2573 7.70441 65.2573Z" fill="#262626"/>
<path d="M16.9619 65.0994V58.2834H17.7704V59.8454H17.6753C17.7704 59.4668 17.9131 59.1512 18.135 58.8988C18.3411 58.6463 18.5947 58.4728 18.8642 58.3466C19.1495 58.2203 19.4349 58.1572 19.7202 58.1572C20.2275 58.1572 20.6396 58.315 20.9567 58.6148C21.2896 58.9303 21.4957 59.3406 21.5749 59.8612H21.4481C21.5274 59.5141 21.67 59.1986 21.892 58.9461C22.0981 58.6937 22.3675 58.4886 22.6687 58.3623C22.9699 58.2203 23.3028 58.1572 23.6674 58.1572C24.0796 58.1572 24.4442 58.2519 24.7612 58.4254C25.0783 58.599 25.3319 58.8672 25.5221 59.2143C25.7124 59.5614 25.8075 59.9874 25.8075 60.5081V65.0994H24.9832V60.5239C24.9832 59.9717 24.8405 59.5772 24.5393 59.309C24.2381 59.0566 23.8894 58.9146 23.4613 58.9146C23.1284 58.9146 22.8431 58.9777 22.5895 59.1197C22.3358 59.2617 22.1456 59.451 22.0029 59.7034C21.8603 59.9559 21.7969 60.2557 21.7969 60.587V65.0837H20.9725V60.445C20.9725 59.9717 20.8299 59.593 20.5604 59.3248C20.2909 59.0566 19.9263 58.9146 19.4983 58.9146C19.1971 58.9146 18.9117 58.9934 18.6581 59.1354C18.4045 59.2774 18.1984 59.4826 18.0399 59.7508C17.8813 60.019 17.8021 60.3346 17.8021 60.7132V65.0994H16.9619Z" fill="#262626"/>
<path d="M33.94 65.2571C33.5278 65.2571 33.1474 65.1782 32.7986 65.0204C32.4499 64.8626 32.1804 64.626 31.9902 64.3104C31.7841 63.9949 31.689 63.632 31.689 63.1902C31.689 62.8589 31.7524 62.5749 31.8792 62.3382C32.006 62.1015 32.1804 61.9122 32.4182 61.7702C32.656 61.6282 32.9413 61.502 33.2583 61.4231C33.5754 61.3442 33.94 61.2653 34.3204 61.218C34.7009 61.1706 35.0179 61.1233 35.2874 61.0917C35.5569 61.0602 35.763 60.9971 35.8898 60.9182C36.0325 60.8393 36.0959 60.7131 36.0959 60.5395V60.3817C36.0959 60.082 36.0325 59.8137 35.9057 59.5929C35.7789 59.372 35.6045 59.1984 35.3667 59.088C35.1289 58.9775 34.8436 58.9144 34.4948 58.9144C34.1778 58.9144 33.8924 58.9617 33.6388 59.0564C33.401 59.1511 33.1949 59.2931 33.0364 59.4509C32.8779 59.6086 32.7511 59.7822 32.6718 59.9715L31.8792 59.7033C32.0377 59.3404 32.2438 59.0406 32.5133 58.8197C32.7828 58.5989 33.0998 58.4253 33.4327 58.3306C33.7815 58.2202 34.1302 58.1729 34.479 58.1729C34.7485 58.1729 35.0338 58.2044 35.3191 58.2833C35.6045 58.3464 35.874 58.4726 36.1118 58.6462C36.3495 58.8197 36.5556 59.0406 36.7141 59.3404C36.8727 59.6402 36.9361 60.0031 36.9361 60.4606V65.0993H36.1276V64.0264H36.0642C35.9691 64.2315 35.8264 64.4366 35.6362 64.626C35.446 64.8153 35.2082 64.9731 34.9228 65.0835C34.6375 65.194 34.3046 65.2571 33.94 65.2571ZM34.051 64.5155C34.4631 64.5155 34.8277 64.4209 35.1289 64.2473C35.4301 64.058 35.6679 63.8213 35.8423 63.5057C36.0166 63.1902 36.0959 62.8589 36.0959 62.4802V61.502C36.0325 61.5651 35.9374 61.6124 35.7947 61.6597C35.652 61.7071 35.4935 61.7386 35.3191 61.7702C35.1448 61.8017 34.9545 61.8333 34.7802 61.8491C34.6058 61.8806 34.4473 61.8964 34.3046 61.9122C33.9241 61.9595 33.5912 62.0226 33.3218 62.1331C33.0523 62.2277 32.8462 62.3697 32.7035 62.5433C32.5608 62.7169 32.4974 62.9377 32.4974 63.206C32.4974 63.4742 32.5608 63.7109 32.7035 63.9002C32.8462 64.0895 33.0206 64.2315 33.2583 64.342C33.4961 64.4524 33.7656 64.5155 34.051 64.5155Z" fill="#262626"/>
<path d="M43.2451 65.0991V58.2831H44.0536V59.3403H44.117C44.2597 58.9931 44.4974 58.7091 44.8303 58.504C45.1632 58.2989 45.5437 58.1885 45.9876 58.1885C46.051 58.1885 46.1302 58.1885 46.2095 58.1885C46.2888 58.1885 46.3522 58.1885 46.4156 58.2043V59.0405C46.3839 59.0405 46.3205 59.0247 46.2253 59.0089C46.1302 58.9931 46.0351 58.9931 45.9241 58.9931C45.5754 58.9931 45.2584 59.072 44.973 59.214C44.6877 59.356 44.4816 59.5611 44.3231 59.8294C44.1645 60.0818 44.0853 60.3816 44.0853 60.7287V65.0991H43.2451Z" fill="#262626"/>
<path d="M54.2944 58.2833V59.0091H51.0288V58.2833H54.2944ZM52.0434 56.6582H52.8835V63.49C52.8835 63.8213 52.9628 64.0738 53.1055 64.2315C53.264 64.3893 53.4859 64.4524 53.803 64.4209C53.8664 64.4209 53.9298 64.4209 54.009 64.4051C54.0883 64.3893 54.1676 64.3735 54.2468 64.3578L54.4212 65.0678C54.3261 65.0993 54.231 65.1151 54.12 65.1309C54.009 65.1466 53.8981 65.1624 53.7871 65.1624C53.2323 65.194 52.8043 65.0678 52.5031 64.768C52.2019 64.4682 52.0434 64.058 52.0434 63.5373V56.6582Z" fill="#262626"/>
<path d="M70.6063 65.2571C69.988 65.2571 69.449 65.1467 68.9893 64.9415C68.5296 64.7364 68.165 64.4524 67.8955 64.0895C67.626 63.7267 67.4834 63.3007 67.4517 62.8115H68.3394C68.3711 63.1744 68.4979 63.4742 68.704 63.7267C68.9101 63.9791 69.1796 64.1527 69.5125 64.2947C69.8454 64.4209 70.21 64.484 70.6063 64.484C71.066 64.484 71.4623 64.4051 71.811 64.2631C72.1598 64.1053 72.4293 63.9002 72.6354 63.632C72.8414 63.3638 72.9365 63.0482 72.9365 62.6853C72.9365 62.3855 72.8573 62.1331 72.6988 61.928C72.5402 61.7229 72.3183 61.5493 72.033 61.4073C71.7476 61.2653 71.4147 61.1391 71.0343 61.0287L69.9563 60.7131C69.2271 60.508 68.6723 60.2082 68.276 59.8295C67.8797 59.4509 67.6894 58.9618 67.6894 58.3938C67.6894 57.9047 67.8163 57.4629 68.0858 57.1C68.3552 56.7213 68.704 56.4373 69.1637 56.2164C69.6234 56.0113 70.1307 55.9009 70.6855 55.9009C71.2562 55.9009 71.7635 56.0113 72.2073 56.2164C72.6512 56.4215 73 56.7213 73.2536 57.0842C73.5072 57.4471 73.6499 57.8573 73.6658 58.3307H72.8097C72.7622 57.8258 72.5402 57.4313 72.1439 57.1315C71.7476 56.8318 71.2562 56.6898 70.6538 56.6898C70.2417 56.6898 69.8612 56.7687 69.5442 56.9107C69.2271 57.0527 68.9735 57.2578 68.7991 57.5102C68.6247 57.7627 68.5296 58.0467 68.5296 58.378C68.5296 58.6935 68.6247 58.946 68.7991 59.1669C68.9735 59.3878 69.2113 59.5455 69.4808 59.6875C69.7661 59.8295 70.0356 59.94 70.3368 60.0189L71.2879 60.2871C71.5891 60.366 71.8744 60.4764 72.1756 60.6027C72.4768 60.7289 72.7305 60.8867 72.9841 61.076C73.2219 61.2653 73.4121 61.502 73.5706 61.7702C73.7133 62.0384 73.7926 62.3698 73.7926 62.7327C73.7926 63.2218 73.6658 63.6635 73.4121 64.0422C73.1585 64.4367 72.7939 64.7364 72.3183 64.9573C71.8269 65.1467 71.2562 65.2571 70.6063 65.2571Z" fill="white"/>
<path d="M80.2601 57.0211C80.1016 57.0211 79.9589 56.958 79.8321 56.8475C79.7053 56.7371 79.6577 56.5951 79.6577 56.4373C79.6577 56.2795 79.7211 56.1375 79.8321 56.0271C79.9589 55.9166 80.1016 55.8535 80.2601 55.8535C80.4345 55.8535 80.5771 55.9166 80.6881 56.0271C80.7991 56.1375 80.8625 56.2795 80.8625 56.4373C80.8625 56.5951 80.7991 56.7371 80.6881 56.8475C80.5771 56.958 80.4345 57.0211 80.2601 57.0211ZM79.8479 65.0993V58.2833H80.6881V65.0993H79.8479Z" fill="white"/>
<path d="M89.613 67.7971C89.1533 67.7971 88.7411 67.734 88.3765 67.6236C88.0278 67.4974 87.7266 67.3396 87.4888 67.1345C87.251 66.9294 87.0608 66.6927 86.9181 66.4245L87.5998 66.0143C87.6949 66.1878 87.8375 66.3614 87.9961 66.5191C88.1546 66.6769 88.3765 66.8189 88.6302 66.9136C88.8997 67.024 89.2167 67.0714 89.5972 67.0714C90.1995 67.0714 90.691 66.9294 91.0556 66.6296C91.4202 66.3298 91.6104 65.8723 91.6104 65.2411V63.7107H91.5311C91.436 63.9158 91.3092 64.1367 91.1348 64.3418C90.9605 64.5469 90.7385 64.7205 90.4532 64.8467C90.1678 64.9729 89.8349 65.036 89.4228 65.036C88.8838 65.036 88.3924 64.9098 87.9644 64.6416C87.5364 64.3734 87.2035 63.9947 86.9657 63.4898C86.7279 62.9849 86.6011 62.3854 86.6011 61.6911C86.6011 60.9969 86.712 60.3816 86.9498 59.8609C87.1876 59.3403 87.5205 58.93 87.9485 58.6303C88.3765 58.3305 88.8679 58.1885 89.4228 58.1885C89.8349 58.1885 90.1837 58.2674 90.469 58.4094C90.7544 58.5514 90.9763 58.7407 91.1348 58.9616C91.2933 59.1825 91.436 59.3876 91.5311 59.5927H91.6104V58.2831H92.4189V65.2727C92.4189 65.8565 92.292 66.3298 92.0543 66.7085C91.8165 67.0871 91.4677 67.3554 91.0397 67.5447C90.6593 67.7025 90.1678 67.7971 89.613 67.7971ZM89.5654 64.2787C90.0093 64.2787 90.3739 64.1683 90.691 63.9631C90.9922 63.758 91.2299 63.4583 91.4043 63.0638C91.5628 62.6694 91.6421 62.196 91.6421 61.6596C91.6421 61.1389 91.5628 60.6656 91.4043 60.2554C91.2458 59.8451 91.008 59.5296 90.7068 59.2929C90.4056 59.0563 90.0252 58.9458 89.5813 58.9458C89.1374 58.9458 88.757 59.072 88.4399 59.3087C88.1229 59.5454 87.901 59.8767 87.7266 60.2869C87.5681 60.6971 87.4888 61.1547 87.4888 61.6596C87.4888 62.1803 87.5681 62.6378 87.7266 63.0323C87.8851 63.4267 88.1229 63.7423 88.4399 63.9474C88.7411 64.1683 89.1216 64.2787 89.5654 64.2787Z" fill="white"/>
<path d="M99.616 60.8553V65.1153H98.7759V58.2993H99.5843V59.8928H99.4575C99.6478 59.2933 99.9331 58.8673 100.345 58.599C100.742 58.3308 101.201 58.2046 101.724 58.2046C102.184 58.2046 102.596 58.2993 102.945 58.4886C103.294 58.6779 103.563 58.9619 103.769 59.3406C103.96 59.7193 104.071 60.161 104.071 60.7133V65.131H103.246V60.7448C103.246 60.1926 103.088 59.7508 102.771 59.4195C102.454 59.0881 102.041 58.9304 101.502 58.9304C101.138 58.9304 100.821 59.0093 100.535 59.167C100.25 59.3248 100.028 59.5457 99.8538 59.8297C99.6953 60.1137 99.616 60.4608 99.616 60.8553Z" fill="white"/>
<path d="M120.572 65.2255C120.018 65.2255 119.526 65.1151 119.098 64.8942C118.67 64.6733 118.353 64.3735 118.115 64.0107C117.878 63.6478 117.767 63.2218 117.767 62.7642C117.767 62.4013 117.83 62.0858 117.973 61.8175C118.115 61.5493 118.321 61.2811 118.591 61.0287C118.86 60.7762 119.177 60.5238 119.558 60.2398L120.905 59.2458C121.08 59.1195 121.238 58.9775 121.381 58.8513C121.524 58.7251 121.65 58.5515 121.73 58.378C121.825 58.2044 121.856 58.0151 121.856 57.7942C121.856 57.4471 121.746 57.1631 121.524 56.958C121.302 56.7529 121 56.6267 120.636 56.6267C120.382 56.6267 120.144 56.674 119.954 56.7844C119.748 56.8949 119.59 57.0369 119.479 57.2262C119.368 57.4155 119.304 57.6364 119.304 57.8889C119.304 58.1098 119.352 58.3307 119.447 58.5358C119.542 58.7409 119.685 58.946 119.875 59.1827C120.065 59.4193 120.271 59.6718 120.509 59.9715L124.678 65.0993H123.679L120.033 60.6658C119.716 60.2871 119.447 59.9558 119.209 59.656C118.971 59.372 118.781 59.088 118.654 58.804C118.528 58.52 118.464 58.2202 118.464 57.9047C118.464 57.5102 118.559 57.1631 118.734 56.8633C118.908 56.5635 119.162 56.3269 119.494 56.1533C119.812 55.9798 120.192 55.9009 120.604 55.9009C121.032 55.9009 121.397 55.9798 121.698 56.1533C122.015 56.3269 122.253 56.5478 122.427 56.8318C122.602 57.1158 122.681 57.4471 122.681 57.7942C122.681 58.0624 122.633 58.3149 122.538 58.5358C122.443 58.7567 122.3 58.9933 122.11 59.1984C121.92 59.4035 121.698 59.6087 121.444 59.798L119.78 61.0287C119.352 61.3442 119.051 61.644 118.876 61.9122C118.702 62.1804 118.607 62.4644 118.607 62.7642C118.607 63.0955 118.686 63.3795 118.845 63.632C119.003 63.8844 119.241 64.0895 119.526 64.2315C119.812 64.3735 120.144 64.4524 120.509 64.4524C120.905 64.4524 121.27 64.3735 121.619 64.2315C121.967 64.0895 122.269 63.8687 122.538 63.5847C122.808 63.3007 123.014 62.9693 123.172 62.5907C123.331 62.1962 123.426 61.7702 123.458 61.2969L124.266 61.3127C124.25 61.8018 124.187 62.212 124.06 62.5433C123.949 62.8904 123.806 63.1744 123.648 63.3953C123.489 63.6162 123.347 63.8055 123.236 63.9475L123.061 64.1684C122.792 64.484 122.427 64.7364 121.983 64.9258C121.539 65.1309 121.08 65.2255 120.572 65.2255Z" fill="white"/>
<path d="M138.089 65.0992V56.0112H138.961V64.3261H143.305V65.0992H138.089Z" fill="white"/>
<path d="M151.041 65.2571C150.628 65.2571 150.248 65.1782 149.899 65.0204C149.55 64.8626 149.281 64.626 149.091 64.3104C148.885 63.9949 148.79 63.632 148.79 63.1902C148.79 62.8589 148.853 62.5749 148.98 62.3382C149.107 62.1015 149.281 61.9122 149.519 61.7702C149.757 61.6282 150.042 61.502 150.359 61.4231C150.676 61.3442 151.041 61.2653 151.421 61.218C151.801 61.1706 152.119 61.1233 152.388 61.0917C152.658 61.0602 152.864 60.9971 152.99 60.9182C153.133 60.8393 153.196 60.7131 153.196 60.5395V60.3817C153.196 60.082 153.133 59.8137 153.006 59.5929C152.879 59.372 152.705 59.1984 152.467 59.088C152.229 58.9775 151.944 58.9144 151.595 58.9144C151.278 58.9144 150.993 58.9617 150.739 59.0564C150.502 59.1511 150.296 59.2931 150.137 59.4509C149.978 59.6086 149.852 59.7822 149.772 59.9715L148.98 59.7033C149.138 59.3404 149.344 59.0406 149.614 58.8197C149.883 58.5989 150.2 58.4253 150.533 58.3306C150.882 58.2202 151.231 58.1729 151.58 58.1729C151.849 58.1729 152.134 58.2044 152.42 58.2833C152.705 58.3464 152.975 58.4726 153.212 58.6462C153.45 58.8197 153.656 59.0406 153.815 59.3404C153.973 59.6402 154.037 60.0031 154.037 60.4606V65.0993H153.228V64.0264H153.165C153.07 64.2315 152.927 64.4366 152.737 64.626C152.547 64.8153 152.309 64.9731 152.023 65.0835C151.738 65.194 151.421 65.2571 151.041 65.2571ZM151.167 64.5155C151.58 64.5155 151.944 64.4209 152.245 64.2473C152.547 64.058 152.784 63.8213 152.959 63.5057C153.133 63.1902 153.212 62.8589 153.212 62.4802V61.502C153.149 61.5651 153.054 61.6124 152.911 61.6597C152.768 61.7071 152.61 61.7386 152.436 61.7702C152.261 61.8017 152.071 61.8333 151.897 61.8491C151.722 61.8806 151.564 61.8964 151.421 61.9122C151.041 61.9595 150.708 62.0226 150.438 62.1331C150.169 62.2277 149.963 62.3697 149.82 62.5433C149.677 62.7169 149.614 62.9377 149.614 63.206C149.614 63.4742 149.677 63.7109 149.82 63.9002C149.963 64.0895 150.137 64.2315 150.375 64.342C150.613 64.4524 150.866 64.5155 151.167 64.5155Z" fill="white"/>
<path d="M163.358 65.2412C162.945 65.2412 162.613 65.1623 162.327 65.0203C162.042 64.8783 161.82 64.689 161.646 64.4681C161.471 64.2472 161.344 64.0263 161.249 63.8212H161.154V65.0992H160.346V56.0112H161.186V59.5928H161.249C161.344 59.3877 161.471 59.1668 161.646 58.9617C161.82 58.7566 162.042 58.5672 162.311 58.4095C162.581 58.2675 162.93 58.1886 163.358 58.1886C163.912 58.1886 164.404 58.3306 164.832 58.6303C165.26 58.9301 165.577 59.3403 165.815 59.861C166.053 60.3817 166.163 61.0128 166.163 61.707C166.163 62.417 166.053 63.0323 165.815 63.5688C165.577 64.1052 165.26 64.5155 164.832 64.8152C164.404 65.115 163.928 65.2412 163.358 65.2412ZM163.247 64.4997C163.691 64.4997 164.071 64.3735 164.388 64.121C164.705 63.8686 164.927 63.5372 165.101 63.1112C165.26 62.6852 165.339 62.2119 165.339 61.6912C165.339 61.1706 165.26 60.6972 165.101 60.287C164.943 59.8768 164.705 59.5455 164.388 59.293C164.071 59.0406 163.691 58.9301 163.247 58.9301C162.803 58.9301 162.422 59.0563 162.121 59.2772C161.82 59.5139 161.582 59.8452 161.424 60.2555C161.265 60.6657 161.186 61.1548 161.186 61.6912C161.186 62.2277 161.265 62.7168 161.424 63.1428C161.582 63.5688 161.82 63.9001 162.137 64.1368C162.438 64.3735 162.819 64.4997 163.247 64.4997Z" fill="white"/>
<path d="M174.914 65.2413C174.28 65.2413 173.725 65.0993 173.25 64.7995C172.774 64.4997 172.426 64.0895 172.172 63.5531C171.918 63.0166 171.792 62.4171 171.792 61.7229C171.792 61.0286 171.918 60.4291 172.172 59.8926C172.426 59.3562 172.774 58.946 173.234 58.6304C173.694 58.3306 174.217 58.1729 174.803 58.1729C175.184 58.1729 175.548 58.236 175.881 58.378C176.23 58.52 176.547 58.7251 176.817 58.9933C177.102 59.2773 177.308 59.6244 177.467 60.0504C177.625 60.4764 177.704 60.9813 177.704 61.5651V61.928H172.33V61.218H177.261L176.88 61.4862C176.88 60.9971 176.801 60.5553 176.626 60.1766C176.452 59.7822 176.214 59.4824 175.913 59.2615C175.596 59.0406 175.231 58.9302 174.788 58.9302C174.36 58.9302 173.979 59.0406 173.646 59.2773C173.313 59.514 173.076 59.798 172.885 60.1766C172.695 60.5553 172.616 60.9655 172.616 61.4073V61.8333C172.616 62.3697 172.711 62.8273 172.901 63.2375C173.091 63.632 173.361 63.9475 173.694 64.1684C174.027 64.3893 174.439 64.4997 174.914 64.4997C175.231 64.4997 175.517 64.4524 175.755 64.342C175.992 64.2473 176.198 64.1053 176.373 63.9317C176.547 63.7582 176.658 63.5846 176.737 63.3795L177.53 63.632C177.419 63.916 177.261 64.1842 177.023 64.4209C176.785 64.6733 176.5 64.8626 176.135 65.0046C175.786 65.1782 175.374 65.2413 174.914 65.2413Z" fill="white"/>
<path d="M184.473 56.0112V65.0992H183.633V56.0112H184.473Z" fill="white"/>
<path d="M201.435 65.2571C200.817 65.2571 200.278 65.1467 199.802 64.9415C199.327 64.7364 198.978 64.4524 198.709 64.0895C198.439 63.7267 198.296 63.3007 198.265 62.8115H199.152C199.184 63.1744 199.311 63.4742 199.517 63.7267C199.723 63.9791 199.993 64.1527 200.325 64.2947C200.658 64.4209 201.023 64.484 201.419 64.484C201.879 64.484 202.275 64.4051 202.624 64.2631C202.973 64.1053 203.242 63.9002 203.448 63.632C203.654 63.3638 203.75 63.0482 203.75 62.6853C203.75 62.3855 203.67 62.1331 203.512 61.928C203.353 61.7229 203.131 61.5493 202.846 61.4073C202.561 61.2653 202.228 61.1391 201.847 61.0287L200.769 60.7131C200.04 60.508 199.485 60.2082 199.089 59.8295C198.693 59.4509 198.502 58.9618 198.502 58.3938C198.502 57.9047 198.629 57.4629 198.899 57.1C199.168 56.7213 199.517 56.4373 199.977 56.2164C200.436 55.9955 200.944 55.9009 201.499 55.9009C202.069 55.9009 202.576 56.0113 203.02 56.2164C203.464 56.4215 203.813 56.7213 204.067 57.0842C204.32 57.4471 204.463 57.8573 204.479 58.3307H203.623C203.575 57.8258 203.353 57.4313 202.957 57.1315C202.561 56.8318 202.069 56.6898 201.467 56.6898C201.055 56.6898 200.674 56.7687 200.357 56.9107C200.04 57.0527 199.786 57.2578 199.612 57.5102C199.438 57.7627 199.343 58.0467 199.343 58.378C199.343 58.6935 199.422 58.946 199.612 59.1669C199.786 59.372 200.024 59.5455 200.294 59.6875C200.563 59.8295 200.849 59.94 201.15 60.0189L202.101 60.2871C202.402 60.366 202.687 60.4764 202.989 60.6027C203.29 60.7289 203.543 60.8867 203.797 61.076C204.035 61.2653 204.241 61.502 204.384 61.7702C204.526 62.0384 204.606 62.3698 204.606 62.7327C204.606 63.2218 204.479 63.6635 204.225 64.0422C203.971 64.4367 203.607 64.7364 203.131 64.9573C202.672 65.1467 202.101 65.2571 201.435 65.2571Z" fill="#262626"/>
<path d="M213.356 65.2411C212.754 65.2411 212.231 65.0991 211.787 64.7994C211.343 64.4996 210.978 64.0894 210.725 63.5529C210.471 63.0165 210.344 62.4169 210.344 61.7227C210.344 61.0285 210.471 60.4131 210.725 59.8767C210.978 59.3403 211.343 58.93 211.787 58.6303C212.231 58.3305 212.77 58.1885 213.356 58.1885C213.943 58.1885 214.466 58.3305 214.926 58.6303C215.385 58.93 215.734 59.3403 216.003 59.8767C216.273 60.4131 216.384 61.0285 216.384 61.7227C216.384 62.4169 216.257 63.0165 216.003 63.5529C215.75 64.0894 215.385 64.4996 214.941 64.7994C214.482 65.0991 213.959 65.2411 213.356 65.2411ZM213.356 64.4996C213.832 64.4996 214.228 64.3734 214.545 64.1209C214.878 63.8685 215.116 63.5371 215.29 63.1111C215.465 62.6851 215.544 62.2276 215.544 61.7227C215.544 61.2178 215.465 60.7445 215.29 60.3343C215.116 59.9083 214.862 59.5769 214.545 59.3245C214.212 59.072 213.816 58.9458 213.356 58.9458C212.896 58.9458 212.5 59.072 212.167 59.3245C211.834 59.5769 211.597 59.924 211.422 60.3343C211.248 60.7603 211.169 61.2178 211.169 61.7227C211.169 62.2276 211.248 62.6851 211.422 63.1111C211.597 63.5371 211.834 63.8685 212.167 64.1209C212.484 64.3734 212.881 64.4996 213.356 64.4996Z" fill="#262626"/>
<path d="M223.184 56.0112V65.0992H222.344V56.0112H223.184Z" fill="#262626"/>
<path d="M231.84 65.1939C231.38 65.1939 230.968 65.0992 230.619 64.9099C230.27 64.7205 229.985 64.4365 229.795 64.0579C229.589 63.6792 229.494 63.2374 229.494 62.701V58.2832H230.334V62.6379C230.334 63.1901 230.492 63.6319 230.809 63.9632C231.126 64.2945 231.539 64.4523 232.078 64.4523C232.442 64.4523 232.759 64.3734 233.045 64.2314C233.33 64.0894 233.552 63.8528 233.726 63.5688C233.901 63.2848 233.98 62.9377 233.98 62.559V58.299H234.82V65.115H234.012V63.5214H234.138C233.948 64.121 233.647 64.5628 233.251 64.8152C232.854 65.0677 232.347 65.1939 231.84 65.1939Z" fill="#262626"/>
<path d="M243.428 58.2833V59.0091H240.162V58.2833H243.428ZM241.177 56.6582H242.017V63.49C242.017 63.8213 242.096 64.0738 242.239 64.2315C242.381 64.3893 242.619 64.4524 242.936 64.4209C243 64.4209 243.063 64.4209 243.142 64.4051C243.222 64.3893 243.301 64.3735 243.38 64.3578L243.554 65.0678C243.459 65.0993 243.364 65.1151 243.253 65.1309C243.142 65.1466 243.031 65.1624 242.92 65.1624C242.381 65.194 241.938 65.0678 241.636 64.768C241.319 64.4682 241.177 64.058 241.177 63.5373V56.6582Z" fill="#262626"/>
<path d="M249.499 57.0211C249.341 57.0211 249.198 56.958 249.071 56.8475C248.945 56.7371 248.897 56.5951 248.897 56.4373C248.897 56.2795 248.96 56.1375 249.071 56.0271C249.198 55.9166 249.341 55.8535 249.499 55.8535C249.674 55.8535 249.816 55.9166 249.927 56.0271C250.038 56.1375 250.102 56.2795 250.102 56.4373C250.102 56.5951 250.038 56.7371 249.927 56.8475C249.801 56.958 249.658 57.0211 249.499 57.0211ZM249.071 65.0993V58.2833H249.912V65.0993H249.071Z" fill="#262626"/>
<path d="M258.9 65.2411C258.297 65.2411 257.774 65.0991 257.33 64.7994C256.886 64.4996 256.522 64.0894 256.268 63.5529C256.015 63.0165 255.888 62.4169 255.888 61.7227C255.888 61.0285 256.015 60.4131 256.268 59.8767C256.522 59.3403 256.886 58.93 257.33 58.6303C257.774 58.3305 258.313 58.1885 258.9 58.1885C259.486 58.1885 260.009 58.3305 260.469 58.6303C260.929 58.93 261.277 59.3403 261.531 59.8767C261.785 60.4131 261.912 61.0285 261.912 61.7227C261.912 62.4169 261.785 63.0165 261.531 63.5529C261.277 64.0894 260.913 64.4996 260.469 64.7994C260.009 65.0991 259.486 65.2411 258.9 65.2411ZM258.9 64.4996C259.375 64.4996 259.772 64.3734 260.089 64.1209C260.421 63.8685 260.659 63.5371 260.834 63.1111C261.008 62.6851 261.087 62.2276 261.087 61.7227C261.087 61.2178 261.008 60.7445 260.834 60.3343C260.659 59.924 260.406 59.5769 260.089 59.3245C259.756 59.072 259.359 58.9458 258.9 58.9458C258.44 58.9458 258.044 59.072 257.711 59.3245C257.378 59.5769 257.14 59.924 256.966 60.3343C256.791 60.7603 256.712 61.2178 256.712 61.7227C256.712 62.2276 256.791 62.6851 256.966 63.1111C257.14 63.5371 257.378 63.8685 257.711 64.1209C258.028 64.3734 258.424 64.4996 258.9 64.4996Z" fill="#262626"/>
<path d="M268.712 60.8553V65.1153H267.872V58.2993H268.681V59.8928H268.554C268.744 59.2933 269.029 58.8673 269.441 58.599C269.838 58.3308 270.297 58.2046 270.821 58.2046C271.28 58.2046 271.692 58.2993 272.041 58.4886C272.39 58.6779 272.659 58.9619 272.866 59.3406C273.056 59.7193 273.167 60.161 273.167 60.7133V65.131H272.342V60.7448C272.342 60.1926 272.184 59.7508 271.867 59.4195C271.55 59.0881 271.138 58.9304 270.599 58.9304C270.234 58.9304 269.917 59.0093 269.632 59.167C269.346 59.3248 269.124 59.5457 268.95 59.8297C268.792 60.1137 268.712 60.4608 268.712 60.8553Z" fill="#262626"/>
</svg>
            </div>
        </div>
        <div class="header-contacts">
          <a href="https://sign-xpert.com" target="_blank" rel="noopener noreferrer">sign-xpert.com</a><br>
          info@<a href="https://sign-xpert.com" target="_blank" rel="noopener noreferrer">sign-xpert.com</a><br>
          +49 157 766 25 125
        </div>
      </div>
        <div class="delivery-title${isFirstPage ? '' : ' delivery-title--continued'}">Delivery Note</div>
    </div>

    ${isFirstPage ? `
    <div class="info-grid">
      <div class="order-meta">
        <table>
          <tr><td class="label">Order Date:</td><td class="value">${orderDate}</td></tr>
          <tr><td class="label">Customer No:</td><td class="value">${customerNumber}</td></tr>
          <tr><td class="label">Order No:</td><td class="value">${orderNumber}</td></tr>
          <tr><td class="label">Order name:</td><td class="value">${orderName}</td></tr>
          <tr><td class="label">Invoice No:</td><td class="value">${invoiceNumber}</td></tr>
        </table>
      </div>
      <div class="shipping-address">
        ${shippingAddressHtml || escapeHtml([order.user?.firstName, order.user?.surname].filter(hasContent).join(' ') || order.orderName || 'No delivery address')}
      </div>
    </div>

    <div class="count-section">
      Count Sings: &nbsp;&nbsp; ${totalSigns}
    </div>` : ''}

    ${pageAccessoryBlocksHtml}

    ${pageSignBlocksHtml}

    ${isLastPage ? `
    <div class="footer-note">
      Please check the delivery upon receipt.<br>
      If any items are missing, damaged, or incorrect, please notify us by email at the address stated above.<br><br>
      <span style="font-weight: 700;">Thank you for choosing SignXpert!</span>
    </div>` : ''}
  </div>`;
  }).join('')}
  </body>
  </html>`;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: buildPdfFooterTemplate(11, 20, 2),
      margin: { top: '0', right: '0', bottom: '26px', left: '0' }
    });
    res.removeHeader('Content-Type');

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="order-${idOrder}.pdf"`,
      'Content-Length': pdfBuffer.length
    });

    return res.end(pdfBuffer, 'binary'); // Використовуємо .end з вказанням бінарного формату

  } catch (err) {
    console.error('error get pdfs', err);
    res.status(500).send('Error generating PDF');
  } finally {
    if (browser) await browser.close(); // Обов'язково закриваємо процес
  }
});


CartRouter.get('/getPdfs3/:idOrder', requireAuth, async (req, res, next) => {
  let browser; // Оголошуємо зовні, щоб закрити у блоці finally
  try {
    const { idOrder } = req.params;

    // Твоя логіка пошуку даних
    const order = await Order.findOne({
      where: { id: Number(idOrder) },
      include: [{ model: User, include: [{ model: Order }] }]
    });

    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!canAccessOrderDocuments(req.user, order)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const orderMongo = await findCartProjectForOrder(order);

    // Запускаємо Puppeteer
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Важливо для Linux/VPS
    });
    const page = await browser.newPage();

    const checkout = orderMongo?.checkout && typeof orderMongo.checkout === 'object'
      ? orderMongo.checkout
      : {};
    const deliveryAddress = checkout?.deliveryAddress && typeof checkout.deliveryAddress === 'object'
      ? checkout.deliveryAddress
      : {};
    const invoiceAddress = checkout?.invoiceAddress && typeof checkout.invoiceAddress === 'object'
      ? checkout.invoiceAddress
      : null;
    const customerAddress = hasAddressContent(invoiceAddress) ? invoiceAddress : deliveryAddress;

    const customerCompany = escapeHtml(
      customerAddress?.companyName || order.user?.company || 'Water Design Solution GmbH'
    );
    const customerIdentifierRaw = String(order.user?.reference || order.userId || '').trim();
    const customerStreetLine1Raw = String(
      customerAddress?.address1
      || [order.user?.address, order.user?.house].filter(hasContent).join(' ')
      || ''
    ).trim();
    const customerStreetLine2Raw = String(customerAddress?.address2 || order.user?.address2 || '').trim();
    const customerStreetLine3Raw = String(customerAddress?.address3 || order.user?.address3 || '').trim();
    const customerPostalCodeRaw = String(customerAddress?.postalCode || order.user?.postcode || '').trim();
    const customerCityRaw = String(customerAddress?.town || order.user?.city || '').trim();
    const customerCountryRaw = String(customerAddress?.country || order.user?.country || order.country || '').trim();
    const customerCountrySubdivisionRaw = String(customerAddress?.state || order.user?.state || '').trim();
    const customerEmailRaw = String(
      checkout?.invoiceAddressEmail
      || checkout?.invoiceEmail
      || invoiceAddress?.email
      || deliveryAddress?.email
      || customerAddress?.email
      || order.user?.eMailInvoice
      || order.user?.email
      || ''
    ).trim();
    const customerPhoneRaw = String(
      invoiceAddress?.mobile
      || deliveryAddress?.mobile
      || customerAddress?.mobile
      || order.user?.phone2
      || order.user?.phone
      || ''
    ).trim();
    const customerVatNumberRaw = String(checkout?.vatNumber || order.user?.vatNumber || '').trim();
    const customerName = escapeHtml(
      customerAddress?.fullName || [order.user?.firstName, order.user?.surname].filter(Boolean).join(' ')
    );
    const addressLine1 = escapeHtml(customerStreetLine1Raw);
    const addressLine2 = escapeHtml(customerStreetLine2Raw);
    const addressLine3 = escapeHtml(customerStreetLine3Raw);
    const cityLine = escapeHtml(
      [customerPostalCodeRaw, customerCityRaw].filter(hasContent).join(' ')
    );
    const countryLine = escapeHtml(customerCountryRaw);
    const phoneLine = escapeHtml(customerPhoneRaw);
    const vatNumber = escapeHtml(customerVatNumberRaw);

    const invoiceNumberRaw = String(order.id || '');
    const invoiceNumber = escapeHtml(invoiceNumberRaw);
    const customerNumber = escapeHtml(order.userId);
    const invoiceDate = escapeHtml(formatInvoiceDate(order.createdAt));
    const invoiceDueDateDate = new Date(new Date(order.createdAt).setMonth(new Date(order.createdAt).getMonth() + 1));
    const invoiceDueDate = escapeHtml(formatInvoiceDate(invoiceDueDateDate));
    const selectedPaymentMethod = String(checkout?.paymentMethod || 'invoice').trim().toLowerCase();
    const isPayOnline = selectedPaymentMethod === 'online';
    const paymentStatusRaw = order.user?.type === 'Admin' ? 'Admin' : order.isPaid ? 'Paid' : 'Unpaid';
    const isInvoiceUnpaidCase = selectedPaymentMethod === 'invoice' && paymentStatusRaw === 'Unpaid';
    const shouldRenderPaymentInformation = !isPayOnline && paymentStatusRaw === 'Unpaid';
    const paymentStatus = escapeHtml(paymentStatusRaw);
    const projectNameRaw = String(order.orderName || orderMongo?.projectName || 'Water Sings 23');
    const projectName = escapeHtml(projectNameRaw);
    const signsCountRaw = Math.max(0, Number(order.signs || 0));
    const signsCount = escapeHtml(signsCountRaw);
    const deliveryLabel = escapeHtml(order?.deliveryType || checkout?.deliveryLabel || '');

    const netAmount = Number.isFinite(Number(order?.netAfterDiscount))
      ? Number(order.netAfterDiscount)
      : Number.isFinite(Number(orderMongo?.price))
        ? Number(orderMongo.price)
        : 0;
    const discountAmount = toNumber(orderMongo?.discountAmount, 0);
    const discountPercent = toNumber(orderMongo?.discountPercent, 0);
    const subtotal = round2(netAmount + discountAmount);
    const shippingCost = Number.isFinite(Number(checkout?.deliveryPrice))
      ? Number(checkout.deliveryPrice)
      : 0;
    const vatPercent = toNumber(checkout?.vatPercent, 0);
    const totalAmount = Number.isFinite(Number(order?.sum))
      ? Number(order.sum)
      : Number.isFinite(Number(orderMongo?.totalPrice))
        ? Number(orderMongo.totalPrice)
        : round2(netAmount + shippingCost);
    const totalAmountFormatted = formatMoney(totalAmount);
    const vatAmount = Number.isFinite(Number(checkout?.vatAmount))
      ? Number(checkout.vatAmount)
      : Math.max(0, round2(totalAmount - netAmount - shippingCost));

    const taxNoteMarkup = vatPercent > 0
      ? ''
      : `
      <div class="tax-note">
        No VAT is charged according to § 19 UStG.
      </div>`;

    const vatIdMarkup = vatNumber ? `<br>VAT ID: ${vatNumber}` : '';

    const htmlContent = `
<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice - SignXpert</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap" rel="stylesheet">
    <style>
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
      }

        body {
        font-family: 'Inter', sans-serif;
            margin: 0;
        padding: 0;
        background-color: #f5f5f5;
            color: #000;
        font-size: 10.5pt;
            line-height: 1.2;
        }

      .page {
        width: 210mm;
        height: 297mm;
        padding: 10mm 15mm 10mm 15mm;
        margin: 10mm auto;
        background: white;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
        position: relative;
        display: flex;
        flex-direction: column;
      }

      @media print {
        body { background: none; }
        .page { margin: 0; box-shadow: none; }
        }

      .nowrap { white-space: nowrap; }

        .header {
            display: flex;
            justify-content: space-between;
        align-items: center;
        margin-bottom: 40px;
        }

      .logo {
        font-weight: 800;
        font-size: 22pt;
        letter-spacing: 0.5px;
        }
      .logo span { color: #0056b3; }
      .logo-sub {
        font-size: 7.5pt;
            display: block;
        margin-top: -4px;
      }
      .logo-sub span {
        background: #1a4a8d;
        color: white;
        padding: 0 4px;
        border-radius: 1px;
        }

        .invoice-title {
        font-size: 26pt;
        font-weight: 700;
            text-decoration: underline;
        text-underline-offset: 6px;
        }

      .info-section {
            display: flex;
        margin-bottom: 35px;
        }

      .address-block { width: 52%; line-height: 1.3; }

      .details-block {
        width: 48%;
        padding-left: 35px;
        }

      .details-table {
            border-collapse: collapse;
        }
      .details-table td {
        padding: 1px 0;
        vertical-align: top;
        font-weight: 400;
        }
      .details-table td:first-child { width: 140px; }
      .details-table tr:first-child td { font-weight: 700; }

      .items-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 30px;
        }

      .items-table th,
      .items-table td {
        border: 0.5pt solid #000;
        padding: 4px 8px;
            text-align: left;
        }
      .items-table th { font-weight: 400; }
      .col-order { width: 12%; }
      .col-desc { width: 68%; }
      .col-total { width: 20%; }
      .items-table th.col-order { white-space: nowrap; }

      .calc-section {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        margin-bottom: 25px;
        }

      .calc-table {
        width: 38%;
            border-collapse: collapse;
        }
      .calc-table td { padding: 2px 0; }
      .calc-table td:last-child { text-align: right; }
      .money-cell {
        white-space: nowrap;
        text-align: right;
      }
      .total-row {
        border-top: 1px solid #000;
        font-weight: 700;
        }

      .tax-note {
        font-size: 8.5pt;
        margin-top: 16px;
        text-align: left;
        width: 38%;
        align-self: flex-end;
        line-height: 1.1;
        }

      .payment-info { margin-top: 25px; }
      .payment-info h3 {
        font-size: 10.5pt;
        text-decoration: underline;
        margin-bottom: 5px;
        font-weight: 700;
        }
      .payment-grid { display: grid; grid-template-columns: 140px auto; gap: 1px; }
      .payment-value {
        white-space: nowrap;
        text-align: left;
        font-weight: 700;
      }

      .online-payment-note {
        margin-top: 15px;
        font-size: 11px;
        line-height: 1.25;
        }

      .svg-logo {
        display: inline-block;
        width: 78mm;
        max-width: 95mm;
        height: auto;
        }
      .svg-logo svg { width: 100%; height: auto; display:block; }

      .header .logo, .header .logo-sub { display: none; }
      .company-name { font-weight: 400; }
      .online-payment-note .first-line { white-space: nowrap; }
      .footer-col-right div { margin-bottom: 2px; }
      .footer-info-table {
        border-collapse: collapse;
        width: 100%;
      }
      .footer-info-table td {
        padding: 0 8px 4px 0;
        vertical-align: top;
      }
      .footer-info-table td:first-child {
        white-space: nowrap;
        width: 66px;
      }
      .footer-info-table .footer-value-cell {
        width: 100%;
      }

      .footer-wrapper {
        margin-top: auto;
        margin-bottom: 6mm;
        }
    </style>
</head>
<body>

  <div class="page">
    <div class="header">
      <div>
            <div class="svg-logo">
<svg width="279" height="71" viewBox="0 0 279 71" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M118.876 48.2324H2.61572V49.0686H118.876V48.2324Z" fill="#006CA4"/>
<path d="M146.84 2.22474H275.735V1.4043H147.078L146.84 2.22474Z" fill="#006CA4"/>
<path d="M18.4361 30.9404C18.4361 30.1673 18.1983 29.5047 17.7227 28.9524C17.2472 28.4002 16.296 28.0058 14.8693 27.7533L11.4611 27.1064C8.7028 26.6016 6.62615 25.7653 5.23115 24.5978C3.83615 23.4302 3.13865 21.7104 3.13865 19.4384C3.13865 17.7502 3.56667 16.3302 4.42269 15.1784C5.27871 14.0267 6.48348 13.1431 8.03701 12.5593C9.59053 11.9598 11.3977 11.6758 13.4585 11.6758C15.7095 11.6758 17.5642 11.9913 19.0068 12.6224C20.4493 13.2536 21.5431 14.1056 22.3199 15.21C23.0808 16.3144 23.5564 17.5609 23.7625 18.9967L18.2459 19.6909C17.9288 18.4918 17.4216 17.5924 16.7399 17.0402C16.0424 16.4722 14.9327 16.1882 13.3792 16.1882C11.7306 16.1882 10.5575 16.4722 9.86002 17.0244C9.16252 17.5767 8.81377 18.2867 8.81377 19.1544C8.81377 20.0222 9.08326 20.6849 9.60638 21.1424C10.1454 21.6 11.0648 21.9629 12.4122 22.2311L15.979 22.9253C18.8641 23.4776 20.9566 24.3611 22.2723 25.576C23.5881 26.7909 24.238 28.5107 24.238 30.7353C24.238 33.1651 23.3503 35.1373 21.5907 36.6047C19.8152 38.0878 17.1996 38.8293 13.7438 38.8293C10.4307 38.8293 7.81507 38.1351 5.89695 36.7309C3.97882 35.3267 2.90087 33.1809 2.66309 30.262H4.56536H8.3382C8.56013 31.6662 9.11496 32.6918 10.0344 33.3387C10.938 33.9856 12.2696 34.3169 14.0133 34.3169C15.6778 34.3169 16.8509 34.0013 17.5167 33.3702C18.1032 32.7076 18.4361 31.9187 18.4361 30.9404Z" fill="#262626"/>
<path d="M35.0649 12.3228H40.7718V38.151H35.0649V12.3228Z" fill="#262626"/>
<path d="M51.7734 25.3078C51.7734 22.5624 52.249 20.1642 53.216 18.1289C54.1671 16.0936 55.578 14.5 57.4168 13.3798C59.2557 12.2438 61.4909 11.6758 64.1065 11.6758C67.1818 11.6758 69.6072 12.3858 71.3668 13.8216C73.1423 15.2573 74.252 17.2138 74.7117 19.6909L69.0366 20.3062C68.7195 19.1071 68.1964 18.1604 67.4672 17.482C66.738 16.8036 65.5966 16.4722 64.0589 16.4722C62.5371 16.4722 61.3007 16.8509 60.3654 17.5924C59.4301 18.334 58.7484 19.3596 58.3363 20.6691C57.9083 21.9787 57.7022 23.4776 57.7022 25.1973C57.7022 28.0216 58.257 30.1831 59.3667 31.7136C60.4763 33.2282 62.2518 33.9856 64.6772 33.9856C66.6904 33.9856 68.3866 33.5596 69.7658 32.7233V28.4949H64.7089V23.9667H75.108V35.2478C73.7288 36.3996 72.0961 37.2831 70.2096 37.8827C68.3232 38.4822 66.4051 38.782 64.4711 38.782C60.4288 38.782 57.3059 37.5987 55.1024 35.2636C52.8831 32.9127 51.7734 29.5993 51.7734 25.3078Z" fill="#262626"/>
<path d="M86.6011 12.3228H91.7214L102.548 29.2839V12.3228H107.922V38.151H102.881L91.975 21.2214V38.151H86.6011V12.3228Z" fill="#262626"/>
<path d="M165.751 12.3228H175.088C177.577 12.3228 179.575 12.6699 181.049 13.3483C182.523 14.0425 183.585 15.005 184.251 16.2356C184.901 17.4821 185.234 18.9494 185.234 20.6376C185.234 22.3732 184.901 23.8879 184.235 25.1816C183.569 26.4754 182.491 27.4694 181.017 28.1794C179.543 28.8894 177.577 29.2523 175.136 29.2523H171.284V38.151H165.767V12.3228H165.751ZM179.876 20.7165C179.876 19.3912 179.543 18.413 178.861 17.7976C178.18 17.1823 176.927 16.8825 175.088 16.8825H171.268V24.6925H175.12C176.991 24.6925 178.243 24.3454 178.893 23.667C179.559 22.9728 179.876 21.9945 179.876 20.7165Z" fill="#262626"/>
<path d="M195.442 12.3228H213.435V16.9141H201.086V22.6572H212.721V27.2485H201.086V33.5439H214.164L213.577 38.1352H195.442V12.3228Z" fill="#262626"/>
<path d="M224.817 12.3228H234.598C237.039 12.3228 239.005 12.6541 240.463 13.3325C241.921 14.011 242.984 14.9419 243.649 16.141C244.299 17.3401 244.632 18.697 244.632 20.2116C244.632 21.8525 244.299 23.2725 243.618 24.4716C242.936 25.6708 241.89 26.649 240.495 27.359L245.916 38.1352H239.924L235.374 28.5896C235.184 28.5896 234.994 28.5896 234.788 28.6054C234.598 28.6212 234.408 28.6212 234.201 28.6212H230.27V38.1352H224.817V12.3228ZM239.1 20.3852C239.1 19.1861 238.751 18.271 238.054 17.6556C237.356 17.0403 236.072 16.7405 234.233 16.7405H230.27V24.2665H234.455C236.246 24.2665 237.467 23.9352 238.133 23.2725C238.783 22.5941 239.1 21.6474 239.1 20.3852Z" fill="#262626"/>
<path d="M262.038 17.277H254.112V12.3228H275.734V17.277H267.776V38.151H262.038V17.277Z" fill="#262626"/>
<path d="M140.515 24.4714L135.727 31.4136L123.553 49.069H113.978L130.94 24.4714L122.903 12.8116L119.748 8.23607H129.323L132.478 12.8116L135.727 17.5292L140.515 24.4714ZM137.392 33.8119L140.863 38.8607H150.438L142.179 26.8696L137.392 33.8119ZM156.415 1.4043H146.84L137.376 15.131L142.163 22.0732L156.415 1.4043Z" fill="#006CA4"/>
<path d="M37.9028 8.17296L34.1617 1.4043L30.5474 5.68008L37.9028 8.17296Z" fill="#006CA4"/>
<path d="M186.708 69.4222H66.9282C62.3628 69.4222 58.6533 65.7302 58.6533 61.1862C58.6533 56.6422 62.3628 52.9502 66.9282 52.9502H186.708C191.273 52.9502 194.983 56.6422 194.983 61.1862C194.983 65.7302 191.273 69.4222 186.708 69.4222Z" fill="#006CA4"/>
<path d="M7.70441 65.2573C7.08617 65.2573 6.54719 65.1468 6.08748 64.9417C5.62776 64.7366 5.26316 64.4526 4.99367 64.0897C4.72418 63.7268 4.58151 63.3008 4.5498 62.8117H5.43753C5.46924 63.1746 5.59606 63.4744 5.80213 63.7268C6.00821 63.9793 6.2777 64.1528 6.6106 64.2948C6.9435 64.421 7.3081 64.4841 7.70441 64.4841C8.16412 64.4841 8.56043 64.4053 8.90918 64.2633C9.25793 64.1055 9.52742 63.9004 9.7335 63.6321C9.93958 63.3639 10.0347 63.0484 10.0347 62.6855C10.0347 62.3857 9.95543 62.1333 9.79691 61.9281C9.63838 61.723 9.41645 61.5495 9.13111 61.4075C8.84577 61.2655 8.51287 61.1393 8.13242 61.0288L7.05446 60.7133C6.34111 60.4766 5.77043 60.1926 5.37412 59.7981C4.97782 59.4037 4.78759 58.9461 4.78759 58.3781C4.78759 57.889 4.91441 57.4473 5.1839 57.0844C5.45338 56.7057 5.80213 56.4217 6.26185 56.2008C6.72157 55.9957 7.22884 55.8853 7.78367 55.8853C8.35435 55.8853 8.86162 55.9957 9.30549 56.2008C9.74935 56.4059 10.0981 56.7057 10.3517 57.0686C10.6054 57.4315 10.748 57.8417 10.7639 58.315H9.92373C9.87617 57.8101 9.65424 57.4157 9.25793 57.1159C8.86162 56.8161 8.3702 56.6741 7.76782 56.6741C7.35566 56.6741 6.9752 56.753 6.65816 56.895C6.34111 57.037 6.08748 57.2421 5.9131 57.4946C5.73873 57.747 5.64361 58.031 5.64361 58.3624C5.64361 58.6779 5.73873 58.9304 5.9131 59.1513C6.08748 59.3721 6.32526 59.5299 6.59475 59.6719C6.88009 59.7666 7.14958 59.877 7.45077 59.9559L8.40191 60.2241C8.7031 60.303 8.98844 60.4135 9.28963 60.5397C9.59083 60.6659 9.84446 60.8237 10.0981 61.013C10.3359 61.2024 10.5261 61.439 10.6846 61.7073C10.8273 61.9755 10.9066 62.3068 10.9066 62.6697C10.9066 63.1588 10.7797 63.6006 10.5261 63.9793C10.2566 64.3895 9.89202 64.6893 9.41645 64.9101C8.94088 65.1468 8.3702 65.2573 7.70441 65.2573Z" fill="#262626"/>
<path d="M16.9619 65.0994V58.2834H17.7704V59.8454H17.6753C17.7704 59.4668 17.9131 59.1512 18.135 58.8988C18.3411 58.6463 18.5947 58.4728 18.8642 58.3466C19.1495 58.2203 19.4349 58.1572 19.7202 58.1572C20.2275 58.1572 20.6396 58.315 20.9567 58.6148C21.2896 58.9303 21.4957 59.3406 21.5749 59.8612H21.4481C21.5274 59.5141 21.67 59.1986 21.892 58.9461C22.0981 58.6937 22.3675 58.4886 22.6687 58.3623C22.9699 58.2203 23.3028 58.1572 23.6674 58.1572C24.0796 58.1572 24.4442 58.2519 24.7612 58.4254C25.0783 58.599 25.3319 58.8672 25.5221 59.2143C25.7124 59.5614 25.8075 59.9874 25.8075 60.5081V65.0994H24.9832V60.5239C24.9832 59.9717 24.8405 59.5772 24.5393 59.309C24.2381 59.0566 23.8894 58.9146 23.4613 58.9146C23.1284 58.9146 22.8431 58.9777 22.5895 59.1197C22.3358 59.2617 22.1456 59.451 22.0029 59.7034C21.8603 59.9559 21.7969 60.2557 21.7969 60.587V65.0837H20.9725V60.445C20.9725 59.9717 20.8299 59.593 20.5604 59.3248C20.2909 59.0566 19.9263 58.9146 19.4983 58.9146C19.1971 58.9146 18.9117 58.9934 18.6581 59.1354C18.4045 59.2774 18.1984 59.4826 18.0399 59.7508C17.8813 60.019 17.8021 60.3346 17.8021 60.7132V65.0994H16.9619Z" fill="#262626"/>
<path d="M33.94 65.2571C33.5278 65.2571 33.1474 65.1782 32.7986 65.0204C32.4499 64.8626 32.1804 64.626 31.9902 64.3104C31.7841 63.9949 31.689 63.632 31.689 63.1902C31.689 62.8589 31.7524 62.5749 31.8792 62.3382C32.006 62.1015 32.1804 61.9122 32.4182 61.7702C32.656 61.6282 32.9413 61.502 33.2583 61.4231C33.5754 61.3442 33.94 61.2653 34.3204 61.218C34.7009 61.1706 35.0179 61.1233 35.2874 61.0917C35.5569 61.0602 35.763 60.9971 35.8898 60.9182C36.0325 60.8393 36.0959 60.7131 36.0959 60.5395V60.3817C36.0959 60.082 36.0325 59.8137 35.9057 59.5929C35.7789 59.372 35.6045 59.1984 35.3667 59.088C35.1289 58.9775 34.8436 58.9144 34.4948 58.9144C34.1778 58.9144 33.8924 58.9617 33.6388 59.0564C33.401 59.1511 33.1949 59.2931 33.0364 59.4509C32.8779 59.6086 32.7511 59.7822 32.6718 59.9715L31.8792 59.7033C32.0377 59.3404 32.2438 59.0406 32.5133 58.8197C32.7828 58.5989 33.0998 58.4253 33.4327 58.3306C33.7815 58.2202 34.1302 58.1729 34.479 58.1729C34.7485 58.1729 35.0338 58.2044 35.3191 58.2833C35.6045 58.3464 35.874 58.4726 36.1118 58.6462C36.3495 58.8197 36.5556 59.0406 36.7141 59.3404C36.8727 59.6402 36.9361 60.0031 36.9361 60.4606V65.0993H36.1276V64.0264H36.0642C35.9691 64.2315 35.8264 64.4366 35.6362 64.626C35.446 64.8153 35.2082 64.9731 34.9228 65.0835C34.6375 65.194 34.3046 65.2571 33.94 65.2571ZM34.051 64.5155C34.4631 64.5155 34.8277 64.4209 35.1289 64.2473C35.4301 64.058 35.6679 63.8213 35.8423 63.5057C36.0166 63.1902 36.0959 62.8589 36.0959 62.4802V61.502C36.0325 61.5651 35.9374 61.6124 35.7947 61.6597C35.652 61.7071 35.4935 61.7386 35.3191 61.7702C35.1448 61.8017 34.9545 61.8333 34.7802 61.8491C34.6058 61.8806 34.4473 61.8964 34.3046 61.9122C33.9241 61.9595 33.5912 62.0226 33.3218 62.1331C33.0523 62.2277 32.8462 62.3697 32.7035 62.5433C32.5608 62.7169 32.4974 62.9377 32.4974 63.206C32.4974 63.4742 32.5608 63.7109 32.7035 63.9002C32.8462 64.0895 33.0206 64.2315 33.2583 64.342C33.4961 64.4524 33.7656 64.5155 34.051 64.5155Z" fill="#262626"/>
<path d="M43.2451 65.0991V58.2831H44.0536V59.3403H44.117C44.2597 58.9931 44.4974 58.7091 44.8303 58.504C45.1632 58.2989 45.5437 58.1885 45.9876 58.1885C46.051 58.1885 46.1302 58.1885 46.2095 58.1885C46.2888 58.1885 46.3522 58.1885 46.4156 58.2043V59.0405C46.3839 59.0405 46.3205 59.0247 46.2253 59.0089C46.1302 58.9931 46.0351 58.9931 45.9241 58.9931C45.5754 58.9931 45.2584 59.072 44.973 59.214C44.6877 59.356 44.4816 59.5611 44.3231 59.8294C44.1645 60.0818 44.0853 60.3816 44.0853 60.7287V65.0991H43.2451Z" fill="#262626"/>
<path d="M54.2944 58.2833V59.0091H51.0288V58.2833H54.2944ZM52.0434 56.6582H52.8835V63.49C52.8835 63.8213 52.9628 64.0738 53.1055 64.2315C53.264 64.3893 53.4859 64.4524 53.803 64.4209C53.8664 64.4209 53.9298 64.4209 54.009 64.4051C54.0883 64.3893 54.1676 64.3735 54.2468 64.3578L54.4212 65.0678C54.3261 65.0993 54.231 65.1151 54.12 65.1309C54.009 65.1466 53.8981 65.1624 53.7871 65.1624C53.2323 65.194 52.8043 65.0678 52.5031 64.768C52.2019 64.4682 52.0434 64.058 52.0434 63.5373V56.6582Z" fill="#262626"/>
<path d="M70.6063 65.2571C69.988 65.2571 69.449 65.1467 68.9893 64.9415C68.5296 64.7364 68.165 64.4524 67.8955 64.0895C67.626 63.7267 67.4834 63.3007 67.4517 62.8115H68.3394C68.3711 63.1744 68.4979 63.4742 68.704 63.7267C68.9101 63.9791 69.1796 64.1527 69.5125 64.2947C69.8454 64.4209 70.21 64.484 70.6063 64.484C71.066 64.484 71.4623 64.4051 71.811 64.2631C72.1598 64.1053 72.4293 63.9002 72.6354 63.632C72.8414 63.3638 72.9365 63.0482 72.9365 62.6853C72.9365 62.3855 72.8573 62.1331 72.6988 61.928C72.5402 61.7229 72.3183 61.5493 72.033 61.4073C71.7476 61.2653 71.4147 61.1391 71.0343 61.0287L69.9563 60.7131C69.2271 60.508 68.6723 60.2082 68.276 59.8295C67.8797 59.4509 67.6894 58.9618 67.6894 58.3938C67.6894 57.9047 67.8163 57.4629 68.0858 57.1C68.3552 56.7213 68.704 56.4373 69.1637 56.2164C69.6234 56.0113 70.1307 55.9009 70.6855 55.9009C71.2562 55.9009 71.7635 56.0113 72.2073 56.2164C72.6512 56.4215 73 56.7213 73.2536 57.0842C73.5072 57.4471 73.6499 57.8573 73.6658 58.3307H72.8097C72.7622 57.8258 72.5402 57.4313 72.1439 57.1315C71.7476 56.8318 71.2562 56.6898 70.6538 56.6898C70.2417 56.6898 69.8612 56.7687 69.5442 56.9107C69.2271 57.0527 68.9735 57.2578 68.7991 57.5102C68.6247 57.7627 68.5296 58.0467 68.5296 58.378C68.5296 58.6935 68.6247 58.946 68.7991 59.1669C68.9735 59.3878 69.2113 59.5455 69.4808 59.6875C69.7661 59.8295 70.0356 59.94 70.3368 60.0189L71.2879 60.2871C71.5891 60.366 71.8744 60.4764 72.1756 60.6027C72.4768 60.7289 72.7305 60.8867 72.9841 61.076C73.2219 61.2653 73.4121 61.502 73.5706 61.7702C73.7133 62.0384 73.7926 62.3698 73.7926 62.7327C73.7926 63.2218 73.6658 63.6635 73.4121 64.0422C73.1585 64.4367 72.7939 64.7364 72.3183 64.9573C71.8269 65.1467 71.2562 65.2571 70.6063 65.2571Z" fill="white"/>
<path d="M80.2601 57.0211C80.1016 57.0211 79.9589 56.958 79.8321 56.8475C79.7053 56.7371 79.6577 56.5951 79.6577 56.4373C79.6577 56.2795 79.7211 56.1375 79.8321 56.0271C79.9589 55.9166 80.1016 55.8535 80.2601 55.8535C80.4345 55.8535 80.5771 55.9166 80.6881 56.0271C80.7991 56.1375 80.8625 56.2795 80.8625 56.4373C80.8625 56.5951 80.7991 56.7371 80.6881 56.8475C80.5771 56.958 80.4345 57.0211 80.2601 57.0211ZM79.8479 65.0993V58.2833H80.6881V65.0993H79.8479Z" fill="white"/>
<path d="M89.613 67.7971C89.1533 67.7971 88.7411 67.734 88.3765 67.6236C88.0278 67.4974 87.7266 67.3396 87.4888 67.1345C87.251 66.9294 87.0608 66.6927 86.9181 66.4245L87.5998 66.0143C87.6949 66.1878 87.8375 66.3614 87.9961 66.5191C88.1546 66.6769 88.3765 66.8189 88.6302 66.9136C88.8997 67.024 89.2167 67.0714 89.5972 67.0714C90.1995 67.0714 90.691 66.9294 91.0556 66.6296C91.4202 66.3298 91.6104 65.8723 91.6104 65.2411V63.7107H91.5311C91.436 63.9158 91.3092 64.1367 91.1348 64.3418C90.9605 64.5469 90.7385 64.7205 90.4532 64.8467C90.1678 64.9729 89.8349 65.036 89.4228 65.036C88.8838 65.036 88.3924 64.9098 87.9644 64.6416C87.5364 64.3734 87.2035 63.9947 86.9657 63.4898C86.7279 62.9849 86.6011 62.3854 86.6011 61.6911C86.6011 60.9969 86.712 60.3816 86.9498 59.8609C87.1876 59.3403 87.5205 58.93 87.9485 58.6303C88.3765 58.3305 88.8679 58.1885 89.4228 58.1885C89.8349 58.1885 90.1837 58.2674 90.469 58.4094C90.7544 58.5514 90.9763 58.7407 91.1348 58.9616C91.2933 59.1825 91.436 59.3876 91.5311 59.5927H91.6104V58.2831H92.4189V65.2727C92.4189 65.8565 92.292 66.3298 92.0543 66.7085C91.8165 67.0871 91.4677 67.3554 91.0397 67.5447C90.6593 67.7025 90.1678 67.7971 89.613 67.7971ZM89.5654 64.2787C90.0093 64.2787 90.3739 64.1683 90.691 63.9631C90.9922 63.758 91.2299 63.4583 91.4043 63.0638C91.5628 62.6694 91.6421 62.196 91.6421 61.6596C91.6421 61.1389 91.5628 60.6656 91.4043 60.2554C91.2458 59.8451 91.008 59.5296 90.7068 59.2929C90.4056 59.0563 90.0252 58.9458 89.5813 58.9458C89.1374 58.9458 88.757 59.072 88.4399 59.3087C88.1229 59.5454 87.901 59.8767 87.7266 60.2869C87.5681 60.6971 87.4888 61.1547 87.4888 61.6596C87.4888 62.1803 87.5681 62.6378 87.7266 63.0323C87.8851 63.4267 88.1229 63.7423 88.4399 63.9474C88.7411 64.1683 89.1216 64.2787 89.5654 64.2787Z" fill="white"/>
<path d="M99.616 60.8553V65.1153H98.7759V58.2993H99.5843V59.8928H99.4575C99.6478 59.2933 99.9331 58.8673 100.345 58.599C100.742 58.3308 101.201 58.2046 101.724 58.2046C102.184 58.2046 102.596 58.2993 102.945 58.4886C103.294 58.6779 103.563 58.9619 103.769 59.3406C103.96 59.7193 104.071 60.161 104.071 60.7133V65.131H103.246V60.7448C103.246 60.1926 103.088 59.7508 102.771 59.4195C102.454 59.0881 102.041 58.9304 101.502 58.9304C101.138 58.9304 100.821 59.0093 100.535 59.167C100.25 59.3248 100.028 59.5457 99.8538 59.8297C99.6953 60.1137 99.616 60.4608 99.616 60.8553Z" fill="white"/>
<path d="M120.572 65.2255C120.018 65.2255 119.526 65.1151 119.098 64.8942C118.67 64.6733 118.353 64.3735 118.115 64.0107C117.878 63.6478 117.767 63.2218 117.767 62.7642C117.767 62.4013 117.83 62.0858 117.973 61.8175C118.115 61.5493 118.321 61.2811 118.591 61.0287C118.86 60.7762 119.177 60.5238 119.558 60.2398L120.905 59.2458C121.08 59.1195 121.238 58.9775 121.381 58.8513C121.524 58.7251 121.65 58.5515 121.73 58.378C121.825 58.2044 121.856 58.0151 121.856 57.7942C121.856 57.4471 121.746 57.1631 121.524 56.958C121.302 56.7529 121 56.6267 120.636 56.6267C120.382 56.6267 120.144 56.674 119.954 56.7844C119.748 56.8949 119.59 57.0369 119.479 57.2262C119.368 57.4155 119.304 57.6364 119.304 57.8889C119.304 58.1098 119.352 58.3307 119.447 58.5358C119.542 58.7409 119.685 58.946 119.875 59.1827C120.065 59.4193 120.271 59.6718 120.509 59.9715L124.678 65.0993H123.679L120.033 60.6658C119.716 60.2871 119.447 59.9558 119.209 59.656C118.971 59.372 118.781 59.088 118.654 58.804C118.528 58.52 118.464 58.2202 118.464 57.9047C118.464 57.5102 118.559 57.1631 118.734 56.8633C118.908 56.5635 119.162 56.3269 119.494 56.1533C119.812 55.9798 120.192 55.9009 120.604 55.9009C121.032 55.9009 121.397 55.9798 121.698 56.1533C122.015 56.3269 122.253 56.5478 122.427 56.8318C122.602 57.1158 122.681 57.4471 122.681 57.7942C122.681 58.0624 122.633 58.3149 122.538 58.5358C122.443 58.7567 122.3 58.9933 122.11 59.1984C121.92 59.4035 121.698 59.6087 121.444 59.798L119.78 61.0287C119.352 61.3442 119.051 61.644 118.876 61.9122C118.702 62.1804 118.607 62.4644 118.607 62.7642C118.607 63.0955 118.686 63.3795 118.845 63.632C119.003 63.8844 119.241 64.0895 119.526 64.2315C119.812 64.3735 120.144 64.4524 120.509 64.4524C120.905 64.4524 121.27 64.3735 121.619 64.2315C121.967 64.0895 122.269 63.8687 122.538 63.5847C122.808 63.3007 123.014 62.9693 123.172 62.5907C123.331 62.1962 123.426 61.7702 123.458 61.2969L124.266 61.3127C124.25 61.8018 124.187 62.212 124.06 62.5433C123.949 62.8904 123.806 63.1744 123.648 63.3953C123.489 63.6162 123.347 63.8055 123.236 63.9475L123.061 64.1684C122.792 64.484 122.427 64.7364 121.983 64.9258C121.539 65.1309 121.08 65.2255 120.572 65.2255Z" fill="white"/>
<path d="M138.089 65.0992V56.0112H138.961V64.3261H143.305V65.0992H138.089Z" fill="white"/>
<path d="M151.041 65.2571C150.628 65.2571 150.248 65.1782 149.899 65.0204C149.55 64.8626 149.281 64.626 149.091 64.3104C148.885 63.9949 148.79 63.632 148.79 63.1902C148.79 62.8589 148.853 62.5749 148.98 62.3382C149.107 62.1015 149.281 61.9122 149.519 61.7702C149.757 61.6282 150.042 61.502 150.359 61.4231C150.676 61.3442 151.041 61.2653 151.421 61.218C151.801 61.1706 152.119 61.1233 152.388 61.0917C152.658 61.0602 152.864 60.9971 152.99 60.9182C153.133 60.8393 153.196 60.7131 153.196 60.5395V60.3817C153.196 60.082 153.133 59.8137 153.006 59.5929C152.879 59.372 152.705 59.1984 152.467 59.088C152.229 58.9775 151.944 58.9144 151.595 58.9144C151.278 58.9144 150.993 58.9617 150.739 59.0564C150.502 59.1511 150.296 59.2931 150.137 59.4509C149.978 59.6086 149.852 59.7822 149.772 59.9715L148.98 59.7033C149.138 59.3404 149.344 59.0406 149.614 58.8197C149.883 58.5989 150.2 58.4253 150.533 58.3306C150.882 58.2202 151.231 58.1729 151.58 58.1729C151.849 58.1729 152.134 58.2044 152.42 58.2833C152.705 58.3464 152.975 58.4726 153.212 58.6462C153.45 58.8197 153.656 59.0406 153.815 59.3404C153.973 59.6402 154.037 60.0031 154.037 60.4606V65.0993H153.228V64.0264H153.165C153.07 64.2315 152.927 64.4366 152.737 64.626C152.547 64.8153 152.309 64.9731 152.023 65.0835C151.738 65.194 151.421 65.2571 151.041 65.2571ZM151.167 64.5155C151.58 64.5155 151.944 64.4209 152.245 64.2473C152.547 64.058 152.784 63.8213 152.959 63.5057C153.133 63.1902 153.212 62.8589 153.212 62.4802V61.502C153.149 61.5651 153.054 61.6124 152.911 61.6597C152.768 61.7071 152.61 61.7386 152.436 61.7702C152.261 61.8017 152.071 61.8333 151.897 61.8491C151.722 61.8806 151.564 61.8964 151.421 61.9122C151.041 61.9595 150.708 62.0226 150.438 62.1331C150.169 62.2277 149.963 62.3697 149.82 62.5433C149.677 62.7169 149.614 62.9377 149.614 63.206C149.614 63.4742 149.677 63.7109 149.82 63.9002C149.963 64.0895 150.137 64.2315 150.375 64.342C150.613 64.4524 150.866 64.5155 151.167 64.5155Z" fill="white"/>
<path d="M163.358 65.2412C162.945 65.2412 162.613 65.1623 162.327 65.0203C162.042 64.8783 161.82 64.689 161.646 64.4681C161.471 64.2472 161.344 64.0263 161.249 63.8212H161.154V65.0992H160.346V56.0112H161.186V59.5928H161.249C161.344 59.3877 161.471 59.1668 161.646 58.9617C161.82 58.7566 162.042 58.5672 162.311 58.4095C162.581 58.2675 162.93 58.1886 163.358 58.1886C163.912 58.1886 164.404 58.3306 164.832 58.6303C165.26 58.9301 165.577 59.3403 165.815 59.861C166.053 60.3817 166.163 61.0128 166.163 61.707C166.163 62.417 166.053 63.0323 165.815 63.5688C165.577 64.1052 165.26 64.5155 164.832 64.8152C164.404 65.115 163.928 65.2412 163.358 65.2412ZM163.247 64.4997C163.691 64.4997 164.071 64.3735 164.388 64.121C164.705 63.8686 164.927 63.5372 165.101 63.1112C165.26 62.6852 165.339 62.2119 165.339 61.6912C165.339 61.1706 165.26 60.6972 165.101 60.287C164.943 59.8768 164.705 59.5455 164.388 59.293C164.071 59.0406 163.691 58.9301 163.247 58.9301C162.803 58.9301 162.422 59.0563 162.121 59.2772C161.82 59.5139 161.582 59.8452 161.424 60.2555C161.265 60.6657 161.186 61.1548 161.186 61.6912C161.186 62.2277 161.265 62.7168 161.424 63.1428C161.582 63.5688 161.82 63.9001 162.137 64.1368C162.438 64.3735 162.819 64.4997 163.247 64.4997Z" fill="white"/>
<path d="M174.914 65.2413C174.28 65.2413 173.725 65.0993 173.25 64.7995C172.774 64.4997 172.426 64.0895 172.172 63.5531C171.918 63.0166 171.792 62.4171 171.792 61.7229C171.792 61.0286 171.918 60.4291 172.172 59.8926C172.426 59.3562 172.774 58.946 173.234 58.6304C173.694 58.3306 174.217 58.1729 174.803 58.1729C175.184 58.1729 175.548 58.236 175.881 58.378C176.23 58.52 176.547 58.7251 176.817 58.9933C177.102 59.2773 177.308 59.6244 177.467 60.0504C177.625 60.4764 177.704 60.9813 177.704 61.5651V61.928H172.33V61.218H177.261L176.88 61.4862C176.88 60.9971 176.801 60.5553 176.626 60.1766C176.452 59.7822 176.214 59.4824 175.913 59.2615C175.596 59.0406 175.231 58.9302 174.788 58.9302C174.36 58.9302 173.979 59.0406 173.646 59.2773C173.313 59.514 173.076 59.798 172.885 60.1766C172.695 60.5553 172.616 60.9655 172.616 61.4073V61.8333C172.616 62.3697 172.711 62.8273 172.901 63.2375C173.091 63.632 173.361 63.9475 173.694 64.1684C174.027 64.3893 174.439 64.4997 174.914 64.4997C175.231 64.4997 175.517 64.4524 175.755 64.342C175.992 64.2473 176.198 64.1053 176.373 63.9317C176.547 63.7582 176.658 63.5846 176.737 63.3795L177.53 63.632C177.419 63.916 177.261 64.1842 177.023 64.4209C176.785 64.6733 176.5 64.8626 176.135 65.0046C175.786 65.1782 175.374 65.2413 174.914 65.2413Z" fill="white"/>
<path d="M184.473 56.0112V65.0992H183.633V56.0112H184.473Z" fill="white"/>
<path d="M201.435 65.2571C200.817 65.2571 200.278 65.1467 199.802 64.9415C199.327 64.7364 198.978 64.4524 198.709 64.0895C198.439 63.7267 198.296 63.3007 198.265 62.8115H199.152C199.184 63.1744 199.311 63.4742 199.517 63.7267C199.723 63.9791 199.993 64.1527 200.325 64.2947C200.658 64.4209 201.023 64.484 201.419 64.484C201.879 64.484 202.275 64.4051 202.624 64.2631C202.973 64.1053 203.242 63.9002 203.448 63.632C203.654 63.3638 203.75 63.0482 203.75 62.6853C203.75 62.3855 203.67 62.1331 203.512 61.928C203.353 61.7229 203.131 61.5493 202.846 61.4073C202.561 61.2653 202.228 61.1391 201.847 61.0287L200.769 60.7131C200.04 60.508 199.485 60.2082 199.089 59.8295C198.693 59.4509 198.502 58.9618 198.502 58.3938C198.502 57.9047 198.629 57.4629 198.899 57.1C199.168 56.7213 199.517 56.4373 199.977 56.2164C200.436 55.9955 200.944 55.9009 201.499 55.9009C202.069 55.9009 202.576 56.0113 203.02 56.2164C203.464 56.4215 203.813 56.7213 204.067 57.0842C204.32 57.4471 204.463 57.8573 204.479 58.3307H203.623C203.575 57.8258 203.353 57.4313 202.957 57.1315C202.561 56.8318 202.069 56.6898 201.467 56.6898C201.055 56.6898 200.674 56.7687 200.357 56.9107C200.04 57.0527 199.786 57.2578 199.612 57.5102C199.438 57.7627 199.343 58.0467 199.343 58.378C199.343 58.6935 199.422 58.946 199.612 59.1669C199.786 59.372 200.024 59.5455 200.294 59.6875C200.563 59.8295 200.849 59.94 201.15 60.0189L202.101 60.2871C202.402 60.366 202.687 60.4764 202.989 60.6027C203.29 60.7289 203.543 60.8867 203.797 61.076C204.035 61.2653 204.241 61.502 204.384 61.7702C204.526 62.0384 204.606 62.3698 204.606 62.7327C204.606 63.2218 204.479 63.6635 204.225 64.0422C203.971 64.4367 203.607 64.7364 203.131 64.9573C202.672 65.1467 202.101 65.2571 201.435 65.2571Z" fill="#262626"/>
<path d="M213.356 65.2411C212.754 65.2411 212.231 65.0991 211.787 64.7994C211.343 64.4996 210.978 64.0894 210.725 63.5529C210.471 63.0165 210.344 62.4169 210.344 61.7227C210.344 61.0285 210.471 60.4131 210.725 59.8767C210.978 59.3403 211.343 58.93 211.787 58.6303C212.231 58.3305 212.77 58.1885 213.356 58.1885C213.943 58.1885 214.466 58.3305 214.926 58.6303C215.385 58.93 215.734 59.3403 216.003 59.8767C216.273 60.4131 216.384 61.0285 216.384 61.7227C216.384 62.4169 216.257 63.0165 216.003 63.5529C215.75 64.0894 215.385 64.4996 214.941 64.7994C214.482 65.0991 213.959 65.2411 213.356 65.2411ZM213.356 64.4996C213.832 64.4996 214.228 64.3734 214.545 64.1209C214.878 63.8685 215.116 63.5371 215.29 63.1111C215.465 62.6851 215.544 62.2276 215.544 61.7227C215.544 61.2178 215.465 60.7445 215.29 60.3343C215.116 59.9083 214.862 59.5769 214.545 59.3245C214.212 59.072 213.816 58.9458 213.356 58.9458C212.896 58.9458 212.5 59.072 212.167 59.3245C211.834 59.5769 211.597 59.924 211.422 60.3343C211.248 60.7603 211.169 61.2178 211.169 61.7227C211.169 62.2276 211.248 62.6851 211.422 63.1111C211.597 63.5371 211.834 63.8685 212.167 64.1209C212.484 64.3734 212.881 64.4996 213.356 64.4996Z" fill="#262626"/>
<path d="M223.184 56.0112V65.0992H222.344V56.0112H223.184Z" fill="#262626"/>
<path d="M231.84 65.1939C231.38 65.1939 230.968 65.0992 230.619 64.9099C230.27 64.7205 229.985 64.4365 229.795 64.0579C229.589 63.6792 229.494 63.2374 229.494 62.701V58.2832H230.334V62.6379C230.334 63.1901 230.492 63.6319 230.809 63.9632C231.126 64.2945 231.539 64.4523 232.078 64.4523C232.442 64.4523 232.759 64.3734 233.045 64.2314C233.33 64.0894 233.552 63.8528 233.726 63.5688C233.901 63.2848 233.98 62.9377 233.98 62.559V58.299H234.82V65.115H234.012V63.5214H234.138C233.948 64.121 233.647 64.5628 233.251 64.8152C232.854 65.0677 232.347 65.1939 231.84 65.1939Z" fill="#262626"/>
<path d="M243.428 58.2833V59.0091H240.162V58.2833H243.428ZM241.177 56.6582H242.017V63.49C242.017 63.8213 242.096 64.0738 242.239 64.2315C242.381 64.3893 242.619 64.4524 242.936 64.4209C243 64.4209 243.063 64.4209 243.142 64.4051C243.222 64.3893 243.301 64.3735 243.38 64.3578L243.554 65.0678C243.459 65.0993 243.364 65.1151 243.253 65.1309C243.142 65.1466 243.031 65.1624 242.92 65.1624C242.381 65.194 241.938 65.0678 241.636 64.768C241.319 64.4682 241.177 64.058 241.177 63.5373V56.6582Z" fill="#262626"/>
<path d="M249.499 57.0211C249.341 57.0211 249.198 56.958 249.071 56.8475C248.945 56.7371 248.897 56.5951 248.897 56.4373C248.897 56.2795 248.96 56.1375 249.071 56.0271C249.198 55.9166 249.341 55.8535 249.499 55.8535C249.674 55.8535 249.816 55.9166 249.927 56.0271C250.038 56.1375 250.102 56.2795 250.102 56.4373C250.102 56.5951 250.038 56.7371 249.927 56.8475C249.801 56.958 249.658 57.0211 249.499 57.0211ZM249.071 65.0993V58.2833H249.912V65.0993H249.071Z" fill="#262626"/>
<path d="M258.9 65.2411C258.297 65.2411 257.774 65.0991 257.33 64.7994C256.886 64.4996 256.522 64.0894 256.268 63.5529C256.015 63.0165 255.888 62.4169 255.888 61.7227C255.888 61.0285 256.015 60.4131 256.268 59.8767C256.522 59.3403 256.886 58.93 257.33 58.6303C257.774 58.3305 258.313 58.1885 258.9 58.1885C259.486 58.1885 260.009 58.3305 260.469 58.6303C260.929 58.93 261.277 59.3403 261.531 59.8767C261.785 60.4131 261.912 61.0285 261.912 61.7227C261.912 62.4169 261.785 63.0165 261.531 63.5529C261.277 64.0894 260.913 64.4996 260.469 64.7994C260.009 65.0991 259.486 65.2411 258.9 65.2411ZM258.9 64.4996C259.375 64.4996 259.772 64.3734 260.089 64.1209C260.421 63.8685 260.659 63.5371 260.834 63.1111C261.008 62.6851 261.087 62.2276 261.087 61.7227C261.087 61.2178 261.008 60.7445 260.834 60.3343C260.659 59.924 260.406 59.5769 260.089 59.3245C259.756 59.072 259.359 58.9458 258.9 58.9458C258.44 58.9458 258.044 59.072 257.711 59.3245C257.378 59.5769 257.14 59.924 256.966 60.3343C256.791 60.7603 256.712 61.2178 256.712 61.7227C256.712 62.2276 256.791 62.6851 256.966 63.1111C257.14 63.5371 257.378 63.8685 257.711 64.1209C258.028 64.3734 258.424 64.4996 258.9 64.4996Z" fill="#262626"/>
<path d="M268.712 60.8553V65.1153H267.872V58.2993H268.681V59.8928H268.554C268.744 59.2933 269.029 58.8673 269.441 58.599C269.838 58.3308 270.297 58.2046 270.821 58.2046C271.28 58.2046 271.692 58.2993 272.041 58.4886C272.39 58.6779 272.659 58.9619 272.866 59.3406C273.056 59.7193 273.167 60.161 273.167 60.7133V65.131H272.342V60.7448C272.342 60.1926 272.184 59.7508 271.867 59.4195C271.55 59.0881 271.138 58.9304 270.599 58.9304C270.234 58.9304 269.917 59.0093 269.632 59.167C269.346 59.3248 269.124 59.5457 268.95 59.8297C268.792 60.1137 268.712 60.4608 268.712 60.8553Z" fill="#262626"/>
</svg>
            </div>
            <div class="logo">SIGN<span>X</span>PERT</div>
            <div class="logo-sub">Smart <span>Sign & Label</span> Solution</div>
        </div>
        <div class="invoice-title">INVOICE</div>
    </div>

    <div class="info-section">
      <div class="address-block">
        <span class="company-name">${customerCompany}</span><br>
        ${customerName ? `${customerName}<br>` : ''}
        ${addressLine1 ? `${addressLine1}<br>` : ''}
        ${addressLine2 ? `${addressLine2}<br>` : ''}
        ${addressLine3 ? `${addressLine3}<br>` : ''}
        ${cityLine ? `${cityLine}<br>` : ''}
        ${countryLine ? `${countryLine}<br>` : ''}
        ${phoneLine ? `Phone: ${phoneLine}` : ''}
        ${vatIdMarkup}
        </div>
      <div class="details-block">
        <table class="details-table">
          <tr><td><strong>Invoice No:</strong></td><td><strong>${invoiceNumber}</strong></td></tr>
          <tr><td>Customer No:</td><td>${customerNumber}</td></tr>
          <tr><td>Date:</td><td>${invoiceDate}</td></tr>
          ${isInvoiceUnpaidCase
            ? `<tr><td>Invoice due date:</td><td>${invoiceDueDate}</td></tr>
          <tr><td>Payment Terms:</td><td>30 days net</td></tr>`
            : `<tr><td>Payment status:</td><td>${paymentStatus}</td></tr>`}
          <tr><td>Reference:</td><td>Order No: ${invoiceNumber}</td></tr>
            </table>
        </div>
    </div>

    <table class="items-table">
        <thead>
            <tr>
          <th class="col-order nowrap">Order No</th>
          <th class="col-desc">Description</th>
          <th class="col-total">Net total</th>
            </tr>
        </thead>
        <tbody>
            <tr>
          <td>${invoiceNumber}</td>
          <td>Count Signs:${signsCount} (${projectName})</td>
          <td class="money-cell">€&nbsp;${formatMoney(subtotal)}</td>
            </tr>
        </tbody>
    </table>

    <div class="calc-section">
      <table class="calc-table">
        <tr><td>Subtotal</td><td class="money-cell">€&nbsp;${formatMoney(subtotal)}</td></tr>
        <tr><td>Discount (${discountPercent.toFixed(0)} %)</td><td class="money-cell">€&nbsp;${formatMoney(discountAmount)}</td></tr>
        <tr><td>Shipping & Packaging cost${deliveryLabel ? ` (${deliveryLabel})` : ''}</td><td class="money-cell">€&nbsp;${formatMoney(shippingCost)}</td></tr>
            <tr class="total-row">
          <td style="padding-top: 15px; padding-bottom: 6px;"><u>Total amount</u></td>
          <td class="money-cell" style="padding-top: 12px; padding-bottom: 6px;">€&nbsp;${totalAmountFormatted}</td>
            </tr>
        </table>
    </div>

    ${shouldRenderPaymentInformation ? `
    <div class="payment-info">
      <h3><u>Payment information:</u></h3>
      <div class="payment-grid">
        <div>Amount due:</div><div class="payment-value">€&nbsp;${totalAmountFormatted}</div>
        <div>Account holder:</div><div>SignXpert (Kostyantyn Utvenko)</div>
        <div>IBAN:</div><div>DE78 6535 1260 0134 0819 40</div>
        <div>BIC / SWIFT:</div><div>SOLADES1BAL</div>
        <div>Payment reference:</div><div>Order No: ${invoiceNumber}</div>
      </div>
    </div>

    <div class="online-payment-note">
      <span class="first-line">If you would like to pay by card or use any of the other online payment methods available, please visit: <span class="nowrap">sign-xpert.com</span></span><br>
      Log in to your account and go to: <span class="nowrap">My Account → My Orders</span><br>
      Select the relevant invoice and click “Pay” to complete your payment securely.
    </div>
    ` : ''}

    <div class="footer-wrapper">
      <div class="footer-thanks" style="text-align:center;margin-bottom:10px;font-weight:700;"><strong>Thank you for choosing SignXpert!</strong></div>
      <div class="footer-box" style="border:0.5pt solid #000;padding:6px 10px;display:flex;justify-content:space-between;font-size:8pt;line-height:1.05;">
        <div class="footer-col-left">
          <table class="footer-info-table">
            <tr>
              <td><strong>SignXpert</strong></td>
              <td class="footer-value-cell"></td>
            </tr>
            <tr>
              <td>Owner:</td>
              <td class="footer-value-cell">Kostyantyn Utvenko</td>
            </tr>
            <tr>
              <td>Address:</td>
              <td class="footer-value-cell">Baumwiesen 2, Haigerloch 72401, Germany</td>
            </tr>
            <tr>
              <td>IBAN:</td>
              <td class="footer-value-cell">DE78 6535 1260 0134 0819 40</td>
            </tr>
            <tr>
              <td>BIC / SWIFT:</td>
              <td class="footer-value-cell">SOLADES1BAL</td>
            </tr>
            <tr>
              <td>St.-Nr.:</td>
              <td class="footer-value-cell">xx/xxx/xxxxx Gemäß § 19 UStG wird keine Umsatzsteuer berechnet/</td>
            </tr>
            <tr>
              <td></td>
              <td class="footer-value-cell">No VAT is charged under the small business exemption (§ 19 UStG).</td>
            </tr>
          </table>
        </div>
        <div class="footer-col-right" style="text-align:right;display:flex;flex-direction:column;justify-content:flex-end;">
          <div>sign-xpert.com</div>
          <div>info@sign-xpert.com</div>
          <div>+49 157 766 25 125</div>
        </div>
        </div>
    </div>
  </div>

</body>
</html>`

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: buildPdfFooterTemplate(10, 20, 2),
      margin: { top: '20px', right: '20px', bottom: '28px', left: '20px' }
    });

    const zugferdData = buildZugferdInvoiceData({
      order,
      invoiceNumber: invoiceNumberRaw,
      customerIdentifier: customerIdentifierRaw,
      customerCompany: customerAddress?.companyName || order.user?.company || '',
      customerName: customerAddress?.fullName || [order.user?.firstName, order.user?.surname].filter(Boolean).join(' '),
      customerEmail: customerEmailRaw,
      customerPhone: customerPhoneRaw,
      customerStreetLine1: customerStreetLine1Raw,
      customerStreetLine2: customerStreetLine2Raw,
      customerStreetLine3: customerStreetLine3Raw,
      customerPostalCode: customerPostalCodeRaw,
      customerCity: customerCityRaw,
      customerCountryCode: customerCountryRaw,
      customerCountrySubdivision: customerCountrySubdivisionRaw,
      customerVatNumber: customerVatNumberRaw,
      buyerReference: String(order.user?.reference || order.userId || order.id || ''),
      remittanceInformation: `Order No: ${invoiceNumberRaw}`,
      paymentDueDate: invoiceDueDateDate,
      signsCount: signsCountRaw,
      projectName: projectNameRaw,
      subtotal,
      vatAmount,
      vatPercent,
      totalAmount,
    });

    const invoice = basicZugferdInvoicer.create(zugferdData);
    const zugferdPdf = await invoice.embedInPdf(pdfBuffer, {
      metadata: {
        title: `Invoice ${invoiceNumber}`,
        subject: `Invoice ${invoiceNumber}`,
        author: 'SignXpert',
        creator: 'SignXpert backend',
        producer: 'SignXpert backend',
        keywords: ['ZUGFeRD', 'Factur-X', 'Invoice'],
        language: 'en',
      },
    });
    const outputPdfBuffer = Buffer.from(zugferdPdf);
    res.removeHeader('Content-Type');

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="order-${idOrder}.pdf"`,
      'Content-Length': outputPdfBuffer.length
    });

    return res.end(outputPdfBuffer, 'binary'); // Factur-X/ZUGFeRD XML embedded in PDF/A-3

  } catch (err) {
    console.error('error get pdfs', err);
    res.status(500).send('Error generating PDF');
  } finally {
    if (browser) await browser.close(); // Обов'язково закриваємо процес
  }
});

CartRouter.get('/getMyOrders', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    let {page=1,limit=15}=req.query;
    page=parseInt(page);
    limit=parseInt(limit);
    const offset = limit * (page - 1);


    const ordersNoNumber = await Order.findAll({
      where: { userId: Number(userId) },
      offset,
      limit,
      include: [
        {
          model: User,
          include: [
            {
              model: Order
            }
          ]
        }
      ],
      order:[['id','DESC']]
    });
    
    const count=await Order.findAndCountAll({
      where: { userId: Number(userId) },
      offset,
      limit,
      attributes:['id']
    });
    
    const orders = ordersNoNumber.map((x, index) => ({
      ...x.toJSON(), // щоб отримати plain object, якщо x — це Sequelize instance
      orderNo: count.count - offset - index
    }));

    // IMPORTANT: Order is a Sequelize model instance. Adding a dynamic field (orders[i].orderMongo)
    // will NOT be serialized by res.json(). Convert to plain objects explicitly.
    const mapped = await Promise.all(
      (orders || []).map(async (order) => {
        const orderMongo = await findCartProjectForOrder(order);
        const computedSigns = countTotalSignsFromProject(orderMongo?.project);

        return {
          ...(typeof order?.toJSON === 'function' ? order.toJSON() : order),
          orderMongo,
          signs: computedSigns > 0 ? computedSigns : Number(order?.signs || 0),
        };
      })
    );

    const countPages=Math.ceil(count.count/limit);

    return res.json({
      orders: mapped,
      countPages
    });
  } catch (err) {
    console.error('GET MY ORDERS ERROR:', err);
    return res.status(500).json({ message: 'Failed to load orders' });
  }
})

CartRouter.post('/setPay', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findOne({ 
      where: { id: Number(orderId) },
      include:[{
        model:User
      }]
    });
    order.isPaid = !order.isPaid;
    await order.save();
    SendEmailForStatus.SendAdminStatusPaid(order);
    SendEmailForStatus.SendStatusPaid(order);
    return res.json({ message: 'is pay updated' });
  } catch (err) {
    console.error('ERROR GET PAY:', err);
    return res.status(500).json({ message: 'Failed to load orders' });
  }
})

CartRouter.post('/set-payment-method/:orderId', requireAuth, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const paymentMethodRaw = String(req.body?.paymentMethod || '').trim().toLowerCase();
    const allowedMethods = ['invoice', 'online'];

    if (!allowedMethods.includes(paymentMethodRaw)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    const order = await Order.findOne({ where: { id: Number(orderId) } });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!canAccessOrderDocuments(req.user, order)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const cartKey = String(order.idMongo || '').trim();
    if (!cartKey) {
      return res.status(404).json({ message: 'Order snapshot not found' });
    }

    let updatedCartProject = null;
    if (isMongoObjectId(cartKey)) {
      updatedCartProject = await CartProject.findByIdAndUpdate(
        cartKey,
        { $set: { 'checkout.paymentMethod': paymentMethodRaw } },
        { new: true }
      );
    }

    if (!updatedCartProject) {
      updatedCartProject = await CartProject.findOneAndUpdate(
        { projectId: cartKey },
        { $set: { 'checkout.paymentMethod': paymentMethodRaw } },
        { new: true, sort: { createdAt: -1 } }
      );
    }

    if (!updatedCartProject) {
      return res.status(404).json({ message: 'Order snapshot not found' });
    }

    return res.json({ message: 'Payment method updated', paymentMethod: paymentMethodRaw });
  } catch (err) {
    console.error('ERROR SET PAYMENT METHOD:', err);
    return res.status(500).json({ message: 'Failed to update payment method' });
  }
});

CartRouter.post('/create-payment-intent/:orderId', requireAuth, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ where: { id: parseInt(orderId) } });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // ВАЖЛИВО: Stripe приймає суму в ЦЕНТАХ (ціле число)
    // Якщо order.sum = 15.50 (float), ми перетворюємо його в 1550
    const amountInCents = Math.round(order.sum * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents, 
      currency: 'eur',
      // Рекомендується додавати метадані для відстеження замовлення в Dashboard
      metadata: { orderId: order.id.toString() },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Повертаємо clientSecret на фронтенд
    res.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error('Stripe Error:', err); // Логування помилки для розробки
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

CartRouter.post('/sendReviewAndComent',requireAuth,async(req,resp,next)=>{
  try{
    const { id, comment, rating } = req.body;
    const order=await Order.findOne({
      where:{
        id:parseInt(id)
      },
      include:[
        {
          model:User
        }
      ]
  });
  SendEmailForStatus.SendToAdminNewOrder(order,comment,rating)
  SendEmailForStatus.CreateOrder(order);


    
  }catch(err){
    return next(ErrorApi.badRequest(err));
  }
})

//Виніс в layout
/*CartRouter.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  console.log('--- 🔔 New Webhook Received ---');
  console.log('Headers Signature:', sig ? '✅ Present' : '❌ Missing');
  console.log('Webhook Secret Key:', endpointSecret ? '✅ Loaded' : '❌ NOT FOUND IN ENV');

  let event;

  try {
    // Перевірка, що запит дійсно від Stripe
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('✅ Event successfully constructed:', event.type);
  } catch (err) {
    console.log(`❌ Webhook Error (Signature Verification Failed): ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Обробка події успішної оплати
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    
    console.log('💰 PaymentIntent Succeeded for:', paymentIntent.id);
    console.log('📦 Metadata received:', paymentIntent.metadata);

    const orderId = paymentIntent.metadata?.orderId;

    if (orderId) {
      try {
        console.log(`🔄 Attempting to update database for Order ID: ${orderId}...`);
        
        // ОНОВЛЮЄМО СТАТУС У БАЗІ
        const [updated] = await Order.update(
          { paid: true }, 
          { where: { id: parseInt(orderId) } }
        );

        if (updated) {
          console.log(`✅ Success: Order №${orderId} marked as PAID in DB.`);
        } else {
          console.log(`⚠️ Warning: Order №${orderId} found, but status NOT updated (maybe already paid?).`);
        }
      } catch (dbErr) {
        console.log(`❌ Database Update Error: ${dbErr.message}`);
      }
    } else {
      console.log('⚠️ Warning: No orderId found in metadata.');
    }
  } else {
    // Логуємо інші типи подій, які нам приходять, щоб знати, що Stripe "стукає"
    console.log(`ℹ️ Received other event type: ${event.type}`);
  }

  // Stripe чекає від нас 200 OK
  res.json({ received: true });
});*/

export default CartRouter;

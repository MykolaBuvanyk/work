import 'dotenv/config'; // для ES модулів
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';
import CartProject from '../models/CartProject.js';
import { Coupon, CouponUsage, Order, User } from '../models/models.js';
import sequelize from '../db.js';
import { col, fn, Op, where } from 'sequelize';
import puppeteer from 'puppeteer';
import SendEmailForStatus from '../Controller/SendEmailForStatus.js';
import Stripe  from 'stripe';
import { zugferd } from 'node-zugferd';
import { EN16931 } from 'node-zugferd/profile/en16931';
import ErrorApi from '../error/ErrorApi.js';
import { countryToLanguage, DEFAULT_LANGUAGE, t } from '../i18n/index.js';
import { localize } from '../i18n/localize.js';

// Pick the customer's language for PDF rendering.
// Priority: order.language snapshot (taken at order creation) → user.language → mapped from country → default.
const pdfLang = (order) => {
  if (order?.language) return order.language;
  const user = order?.user;
  return user?.language || countryToLanguage(user?.country) || DEFAULT_LANGUAGE;
};

const pdfText = (key, lang, vars) => escapeHtml(t(key, lang, vars));

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

export function resolveOrderPaymentDate(order) {
  const candidates = [
    order?.paidAt,
    order?.paymentDate,
    order?.paymentDateAt,
    order?.updatedAt,
    order?.createdAt,
    Date.now(),
  ];

  for (const value of candidates) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return new Date();
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

const normalizeCouponCode = (value) => String(value || '').trim().toUpperCase();

const calculateCouponDiscount = (amount, discount) => {
  const base = Math.max(0, toNumber(amount, 0));
  const percent = Math.min(100, Math.max(0, toNumber(discount, 0)));
  return round2(base * (percent / 100));
};

const resolvePdfFontPath = (fileName) =>
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/fonts', fileName);

const readPdfFontDataUri = (fileName) => {
  try {
    const fontBuffer = fs.readFileSync(resolvePdfFontPath(fileName));
    return `data:font/ttf;base64,${fontBuffer.toString('base64')}`;
  } catch (error) {
    console.warn(`PDF font \"${fileName}\" unavailable:`, error?.message || error);
    return '';
  }
};

const buildInterFontFaceCss = () => {
  const regularFontSrc = readPdfFontDataUri('Inter-Regular.ttf');
  const boldFontSrc = readPdfFontDataUri('Inter-Bold.ttf');
  const italicFontSrc = readPdfFontDataUri('Inter-Italic.ttf');

  if (!regularFontSrc) {
    return '';
  }

  const fontFaces = [
    `@font-face { font-family: 'Inter'; font-style: normal; font-weight: 400; src: url('${regularFontSrc}') format('truetype'); font-display: swap; }`,
  ];

  if (boldFontSrc) {
    fontFaces.push(`@font-face { font-family: 'Inter'; font-style: normal; font-weight: 700; src: url('${boldFontSrc}') format('truetype'); font-display: swap; }`);
  }

  if (italicFontSrc) {
    fontFaces.push(`@font-face { font-family: 'Inter'; font-style: italic; font-weight: 400; src: url('${italicFontSrc}') format('truetype'); font-display: swap; }`);
  }

  return fontFaces.join('\n');
};

export const INTER_FONT_FACE_CSS = buildInterFontFaceCss();

export const waitForPdfFonts = async (page) => {
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  });
};

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
  discountAmount,
  shippingCost,
  vatAmount,
  vatPercent,
  totalAmount,
}) => {
  const hasVat = toNumber(vatPercent, 0) > 0;
  const isPaidInvoice = order?.user?.type !== 'Admin' && Boolean(order?.isPaid);
  const quantity = 1;
  const totalSignsCount = Math.max(0, Math.floor(toNumber(signsCount, 0)));
  const lineUnitPrice = toNumber(subtotal, 0);
  const safeProjectName = String(projectName || order?.orderName || 'Signs order');
  const invoiceIssueDate = new Date(order?.createdAt || Date.now());
  const invoicePaymentDate = resolveOrderPaymentDate(order);
  const sellerIdentifier = '';
  const sellerRegistrationId = String(process.env.ZUGFERD_SELLER_REGISTRATION_ID || '').trim();
  const sellerVatId = String(process.env.ZUGFERD_SELLER_VAT_ID || 'DE461817538').trim();
  const sellerTaxId = String(process.env.ZUGFERD_SELLER_TAX_ID || '53/411/50012').trim();
  const sellerName = 'Kostyantyn Utvenko';
  const sellerTradingName = String(process.env.ZUGFERD_SELLER_TRADING_NAME || 'SignXpert').trim();
  const sellerStreetLine1 = String(process.env.ZUGFERD_SELLER_STREET1 || 'Baumwiesen 2').trim();
  const sellerStreetLine2 = String(process.env.ZUGFERD_SELLER_STREET2 || '').trim();
  const sellerStreetLine3 = String(process.env.ZUGFERD_SELLER_STREET3 || '').trim();
  const sellerPostalCode = String(process.env.ZUGFERD_SELLER_POSTAL_CODE || '72401').trim();
  const sellerCity = String(process.env.ZUGFERD_SELLER_CITY || 'Haigerloch').trim();
  const sellerCountryCode = normalizeCountryCode(process.env.ZUGFERD_SELLER_COUNTRY_CODE || 'DE');
  const sellerCountrySubdivision = String(process.env.ZUGFERD_SELLER_COUNTRY_SUBDIVISION || 'Baden-Württemberg').trim();
  const sellerEmail = String(process.env.ZUGFERD_SELLER_EMAIL || 'info@sign-xpert.com').trim();
  const sellerPhone = String(process.env.ZUGFERD_SELLER_PHONE || '+49 157 766 25 125').trim();
  const sellerContactName = String(process.env.ZUGFERD_SELLER_CONTACT_NAME || 'Kostyantyn Utvenko').trim();
  const sellerContactDepartment = String(process.env.ZUGFERD_SELLER_CONTACT_DEPARTMENT || '').trim();
  const sellerIban = String(process.env.ZUGFERD_SELLER_IBAN || 'DE78 6535 1260 0134 0819 40').replace(/\s+/g, ' ').trim();
  const sellerBankAccountNumber = String(process.env.ZUGFERD_SELLER_BANK_ACCOUNT_NUMBER || '').trim();
  const sellerBic = String(process.env.ZUGFERD_SELLER_BIC || 'SOLADES1BAL').trim();
  const sellerCreditorIdentifier = String(process.env.ZUGFERD_SELLER_CREDITOR_ID || '').trim();
  const sellerAccountHolderName = 'Kostyantyn Utvenko';
  const sellerGlobalIdentifier = String(process.env.ZUGFERD_SELLER_GLOBAL_ID || '').trim();
  const sellerGlobalIdentifierScheme = String(process.env.ZUGFERD_SELLER_GLOBAL_ID_SCHEME || '').trim();
  const sellerRegistrationScheme = String(process.env.ZUGFERD_SELLER_REGISTRATION_SCHEME || '').trim();
  const lineGlobalIdentifierScheme = String(process.env.ZUGFERD_LINE_GLOBAL_ID_SCHEME || '').trim();
  const vatExemptionReasonText = 'Kleinunternehmer gemäß § 19 UStG';
  const buyerVatIdentifier = String(customerVatNumber || '').trim();
  const buyerVatSchema = '9917';
  const effectiveDiscountAmount = Math.max(0, toNumber(discountAmount, 0));
  const effectiveShippingCost = Math.max(0, toNumber(shippingCost, 0));
  const taxBasisAmount = round2(Math.max(0, toNumber(subtotal, 0) - effectiveDiscountAmount + effectiveShippingCost));
  const invoiceRemarks = 'Kleinunternehmer gemäß § 19 UStG. Keine Umsatzsteuer wird berechnet.\nNo VAT is charged under the small business exemption (§ 19 UStG).';
  const lineItemName = `Count Signs:${totalSignsCount}`;
  const lineGlobalIdentifierValue = String(order?.id || invoiceNumber || '').trim();
  const settledPaidAmount = isPaidInvoice ? formatMoney(totalAmount) : undefined;
  const duePayableAmount = isPaidInvoice ? '0.00' : formatMoney(totalAmount);
  const paymentTermsDescription = isPaidInvoice ? 'Rechnung bereits beglichen' : '30 days net';
  const paymentTermsDueDate = isPaidInvoice
    ? invoicePaymentDate
    : paymentDueDate || new Date(order?.createdAt || Date.now());

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
    issueDate: invoiceIssueDate,
    includedNote: [
      { content: invoiceRemarks },
    ],
    transaction: {
      line: [
        {
          identifier: '1',
          note: safeProjectName,
          tradeProduct: {
            name: lineItemName,
            description: safeProjectName,
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
              unitMeasureCode: 'C62',
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
        projectReference: {
          name: safeProjectName,
        },
        seller: {
          identifier: sellerIdentifier || undefined,
          globalIdentifier: sellerGlobalIdentifierNode,
          name: sellerName,
          description: vatExemptionReasonText,
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
          identifier: buyerVatIdentifier || undefined,
          name: String(customerCompany || customerName || 'Customer'),
          organization: {
            tradingName: String(customerCompany || '').trim() || undefined,
            registrationIdentifier: buyerVatIdentifier
              ? {
                  value: buyerVatIdentifier,
                  schemeIdentifier: buyerVatSchema,
                }
              : undefined,
          },
          globalIdentifier: buyerVatIdentifier
            ? {
                value: buyerVatIdentifier,
                schemeIdentifier: buyerVatSchema,
              }
            : undefined,
          tradeContact: {
            name: String(customerName || customerCompany || '').trim() || undefined,
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
        vatAccountingCurrencyCode: 'EUR',
        creditorIdentifier: sellerCreditorIdentifier || undefined,
        remittanceInformation: String(remittanceInformation || `Order No: ${invoiceNumber || order?.id || ''}`),
        payee: sellerAccountHolderName
          ? {
              name: sellerAccountHolderName,
            }
          : undefined,
        paymentInstruction: {
          typeCode: '58',
          transfers: sellerIban
            ? [
                {
                  accountName: sellerAccountHolderName || undefined,
                  accountname: sellerAccountHolderName || undefined,
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
          description: paymentTermsDescription,
          dueDate: paymentTermsDueDate,
        },
        invoicingPeriod: {
          startDate: invoiceIssueDate,
          endDate: invoiceIssueDate,
        },
        vatBreakdown: hasVat
          ? [
              {
                calculatedAmount: formatMoney(vatAmount),
                basisAmount: formatMoney(taxBasisAmount),
                categoryCode: 'S',
                rateApplicablePercent: formatMoney(vatPercent),
                typeCode: 'VAT',
              },
            ]
          : [
              {
                calculatedAmount: '0.00',
                basisAmount: formatMoney(taxBasisAmount),
                categoryCode: 'E',
                rateApplicablePercent: '0.00',
                typeCode: 'VAT',
                exemptionReasonText: vatExemptionReasonText,
              },
            ],
        allowances: effectiveDiscountAmount > 0
          ? [
              {
                actualAmount: formatMoney(effectiveDiscountAmount),
                reasonCode: '95',
                reason: 'Discount',
                categoryTradeTax: {
                  categoryCode: hasVat ? 'S' : 'E',
                  vatRate: hasVat ? formatMoney(vatPercent) : '0.00',
                },
              },
            ]
          : undefined,
        charges: effectiveShippingCost > 0
          ? [
              {
                actualAmount: formatMoney(effectiveShippingCost),
                reasonCode: 'FC',
                reason: 'Shipping',
                categoryTradeTax: {
                  categoryCode: hasVat ? 'S' : 'E',
                  vatRate: hasVat ? formatMoney(vatPercent) : '0.00',
                },
              },
            ]
          : undefined,
        monetarySummation: {
          lineTotalAmount: formatMoney(subtotal),
          chargeTotalAmount: effectiveShippingCost > 0 ? formatMoney(effectiveShippingCost) : undefined,
          allowanceTotalAmount: effectiveDiscountAmount > 0 ? formatMoney(effectiveDiscountAmount) : undefined,
          taxBasisTotalAmount: formatMoney(taxBasisAmount),
          taxTotal: formatMoney(vatAmount),
          grandTotalAmount: formatMoney(totalAmount),
          paidAmount: settledPaidAmount,
          duePayableAmount,
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
  9: 'Light blue / White',
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

const MATERIAL_COLOR_TRANSLATION_KEYS = {
  'white / black': 'pdf.materialColors.whiteBlack',
  'white / blue': 'pdf.materialColors.whiteBlue',
  'white / red': 'pdf.materialColors.whiteRed',
  'black / white': 'pdf.materialColors.blackWhite',
  'blue / white': 'pdf.materialColors.blueWhite',
  'red / white': 'pdf.materialColors.redWhite',
  'green / white': 'pdf.materialColors.greenWhite',
  'yellow / black': 'pdf.materialColors.yellowBlack',
  'silver / black': 'pdf.materialColors.silverBlack',
  'light blue / white': 'pdf.materialColors.lightBlueWhite',
  'orange / white': 'pdf.materialColors.orangeWhite',
  'gray / white': 'pdf.materialColors.grayWhite',
  'grey / white': 'pdf.materialColors.grayWhite',
  'wood / black': 'pdf.materialColors.mapleWoodBlack',
  'maple wood / black': 'pdf.materialColors.mapleWoodBlack',
  'maple / wood / black': 'pdf.materialColors.mapleWoodBlack',
  'carbon / white': 'pdf.materialColors.carbonWhite',
};

const translateMaterialColorLabel = (value, lang) => {
  const normalized = normalizeMaterialThemeKey(value);
  const key = MATERIAL_COLOR_TRANSLATION_KEYS[normalized];
  if (!key) return normalizeMaterialColorLabel(value);
  const translated = t(key, lang);
  return translated === key ? normalizeMaterialColorLabel(value) : translated;
};

const MATERIAL_ICON_SVGS = {
  'white / black': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0.343262" width="35.1323" height="35.1323" rx="4" fill="white"/><rect x="0.5" y="0.843262" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 26.3628H9.59659L15.8778 8.90825H18.9205L25.2017 26.3628H22.4062L17.4716 12.0787H17.3352L12.392 26.3628ZM12.8608 19.5276H21.929V21.7435H12.8608V19.5276Z" fill="black"/></svg>`,
  'white / blue': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0.343262" width="35.1323" height="35.1323" rx="4" fill="white"/><rect x="0.5" y="0.843262" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25.3433H9.59659L15.8778 7.88872H18.9205L25.2017 25.3433H22.4062L17.4716 11.0592H17.3352L12.392 25.3433ZM12.8608 18.508H21.929V20.7239H12.8608V18.508Z" fill="#00558b"/></svg>`,
  'white / red': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0.343262" width="35.1323" height="35.1323" rx="4" fill="white"/><rect x="0.5" y="0.843262" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25.3433H9.59659L15.8778 7.88872H18.9205L25.2017 25.3433H22.4062L17.4716 11.0592H17.3352L12.392 25.3433ZM12.8608 18.508H21.929V20.7239H12.8608V18.508Z" fill="#FE0000"/></svg>`,
  'black / white': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0.343262" width="35.1323" height="35.1323" rx="4" fill="black"/><rect x="0.5" y="0.843262" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25.3433H9.59659L15.8778 7.88872H18.9205L25.2017 25.3433H22.4062L17.4716 11.0592H17.3352L12.392 25.3433ZM12.8608 18.508H21.929V20.7239H12.8608V18.508Z" fill="white"/></svg>`,
  'blue / white': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0.343262" width="35.1323" height="35.1323" rx="4" fill="#00558b"/><rect x="0.5" y="0.843262" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25.3433H9.59659L15.8778 7.88872H18.9205L25.2017 25.3433H22.4062L17.4716 11.0592H17.3352L12.392 25.3433ZM12.8608 18.508H21.929V20.7239H12.8608V18.508Z" fill="white"/></svg>`,
  'red / white': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0.343262" width="35.1323" height="35.1323" rx="4" fill="#FD0100"/><rect x="0.5" y="0.843262" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25.3433H9.59659L15.8778 7.88872H18.9205L25.2017 25.3433H22.4062L17.4716 11.0592H17.3352L12.392 25.3433ZM12.8608 18.508H21.929V20.7239H12.8608V18.508Z" fill="white"/></svg>`,
  'green / white': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0.343262" width="35.1323" height="35.1323" rx="4" fill="#017F01"/><rect x="0.5" y="0.843262" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25.3433H9.59659L15.8778 7.88872H18.9205L25.2017 25.3433H22.4062L17.4716 11.0592H17.3352L12.392 25.3433ZM12.8608 18.508H21.929V20.7239H12.8608V18.508Z" fill="white"/></svg>`,
  'yellow / black': `<svg width="36" height="37" viewBox="0 0 36 37" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0.880615" width="35.1323" height="35.1323" rx="4" fill="#fdf030"/><rect x="0.5" y="1.38062" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25.8806H9.59659L15.8778 8.42607H18.9205L25.2017 25.8806H22.4062L17.4716 11.5965H17.3352L12.392 25.8806ZM12.8608 19.0454H21.929V21.2613H12.8608V19.0454Z" fill="black"/></svg>`,
  'silver / black': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="35.1323" height="35.1323" rx="4" fill="url(#paint0_linear_icon_a9)"/><rect x="0.5" y="0.5" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25H9.59659L15.8778 7.54545H18.9205L25.2017 25H22.4062L17.4716 10.7159H17.3352L12.392 25ZM12.8608 18.1648H21.929V20.3807H12.8608V18.1648Z" fill="black"/><defs><linearGradient id="paint0_linear_icon_a9" x1="8.31186" y1="0" x2="26.8204" y2="35.1323" gradientUnits="userSpaceOnUse"><stop offset="0.240385" stop-color="#B5B5B5"/><stop offset="0.528846" stop-color="#F5F5F5"/><stop offset="0.788462" stop-color="#979797"/></linearGradient></defs></svg>`,
  'light blue / white': `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="35.1323" height="35.1323" rx="4" fill="#00c7fe"/><rect x="0.5" y="0.5" width="34.1323" height="34.1323" rx="3.5" stroke="black" stroke-opacity="0.29" stroke-width="1"/><path d="M12.392 25H9.59659L15.8778 7.54545H18.9205L25.2017 25H22.4062L17.4716 10.7159H17.3352L12.392 25ZM12.8608 18.1648H21.929V20.3807H12.8608V18.1648Z" fill="white"/></svg>`,
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

const buildDeliveryNoteSummary = (order, orderMongo, lang = DEFAULT_LANGUAGE) => {
  const storedSummary = orderMongo?.checkout?.orderTestSummary;
  const projectSnapshot = normalizeProjectForCart(orderMongo?.project || {});
  const canvases = Array.isArray(projectSnapshot?.canvases) ? projectSnapshot.canvases : [];
  const parsedProjectSigns = canvases.map((canvasSnap, index) => {
    const content = analyzeCanvasContent(canvasSnap);
    const thickness = formatDisplayNumber(canvasSnap?.Thickness ?? canvasSnap?.toolbarState?.thickness);
    const metaParts = [
      formatCanvasSizeMm(canvasSnap),
      translateMaterialColorLabel(resolveColorThemeCaps(canvasSnap?.toolbarState, canvasSnap), lang),
      thickness ? `${thickness}` : null,
      resolveTapeLabel(canvasSnap),
    ].filter(Boolean);

    return {
      id: String(canvasSnap?.id || index),
      title: `Sign ${index + 1}`,
      metaLine: metaParts.join(', '),
      textLine: content.texts.length > 0 ? content.texts.join(', ') : 'вЂ”',
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
  const expandedProjectSigns = expandParsedSigns(parsedProjectSigns);

  if (storedSummary && typeof storedSummary === 'object') {
    const expandedStoredSigns = expandParsedSigns(
      Array.isArray(storedSummary?.signs)
        ? storedSummary.signs.map((sign, index) => ({
            id: String(sign?.id || index),
            title: String(sign?.title || `Sign ${index + 1}`),
            metaLine: String(expandedProjectSigns[index]?.metaLine || sign?.metaLine || ''),
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

  const parsedSigns = canvases.map((canvasSnap, index) => {
    const content = analyzeCanvasContent(canvasSnap);
    const thickness = formatDisplayNumber(canvasSnap?.Thickness ?? canvasSnap?.toolbarState?.thickness);
    const metaParts = [
      formatCanvasSizeMm(canvasSnap),
      translateMaterialColorLabel(resolveColorThemeCaps(canvasSnap?.toolbarState, canvasSnap), lang),
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

CartRouter.get('/coupons', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const coupons = await Coupon.findAll({ order: [['createdAt', 'DESC']] });
    return res.json(coupons);
  } catch (e) {
    return next(e);
  }
});

CartRouter.post('/coupons', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const code = normalizeCouponCode(req.body?.code);
    const discount = toNumber(req.body?.discount, NaN);
    if (!code) return res.status(400).json({ message: 'Coupon code is required' });
    if (!Number.isFinite(discount) || discount <= 0 || discount > 100) {
      return res.status(400).json({ message: 'Discount must be from 1 to 100' });
    }
    const [coupon] = await Coupon.upsert({ code, discount });
    return res.json(coupon);
  } catch (e) {
    return next(e);
  }
});

CartRouter.put('/coupons/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    const code = normalizeCouponCode(req.body?.code);
    const discount = toNumber(req.body?.discount, NaN);
    if (!code) return res.status(400).json({ message: 'Coupon code is required' });
    if (!Number.isFinite(discount) || discount <= 0 || discount > 100) {
      return res.status(400).json({ message: 'Discount must be from 1 to 100' });
    }
    await coupon.update({ code, discount });
    return res.json(coupon);
  } catch (e) {
    return next(e);
  }
});

CartRouter.delete('/coupons/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    await coupon.destroy();
    return res.json({ success: true });
  } catch (e) {
    return next(e);
  }
});

CartRouter.post('/coupons/apply', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const code = normalizeCouponCode(req.body?.code);
    const amount = toNumber(req.body?.amount, 0);
    if (!code) return res.status(400).json({ message: 'Coupon code is required' });
    const coupon = await Coupon.findOne({ where: { code } });
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    const usage = await CouponUsage.findOne({ where: { userId, couponId: coupon.id } });
    if (usage) return res.status(409).json({ message: 'Coupon already used' });
    return res.json({
      id: coupon.id,
      code: coupon.code,
      discount: coupon.discount,
      discountAmount: calculateCouponDiscount(amount, coupon.discount),
    });
  } catch (e) {
    return next(e);
  }
});

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
    const couponDiscountAmount = toNumber(body?.checkout?.coupon?.discountAmount, 0);
    const requestDiscountAmount = toNumber(body.discountAmount, 0);
    const totalDiscountAmount = requestDiscountAmount > 0 ? requestDiscountAmount : couponDiscountAmount;
    const baseDiscountPercent = toNumber(body.baseDiscountPercent, toNumber(body.discountPercent, 0));
    const couponDiscountPercent = toNumber(body?.checkout?.coupon?.discount, 0);
    const totalDiscountPercent = couponDiscountPercent > 0
      ? baseDiscountPercent + couponDiscountPercent
      : toNumber(body.discountPercent, baseDiscountPercent);
    const checkoutDeliveryLabel = String(body?.checkout?.deliveryLabel || body?.deliveryType || '').trim();
    const checkoutCountryRegion = String(body?.checkout?.deliveryAddress?.region || '').trim().toUpperCase();
    const checkoutCountryName = String(body?.checkout?.deliveryAddress?.country || '').trim();
    const couponCode = normalizeCouponCode(body?.checkout?.coupon?.code || body?.couponCode);
    let coupon = null;
    if (couponCode) {
      coupon = await Coupon.findOne({ where: { code: couponCode } });
      if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
      const usage = await CouponUsage.findOne({ where: { userId: req.user.id, couponId: coupon.id } });
      if (usage) return res.status(409).json({ message: 'Coupon already used' });
    }

    const created = await CartProject.create({
      userId,
      projectId: body.projectId ? String(body.projectId) : project?.id ? String(project.id) : null,
      projectName,
      price: netAfterDiscount,
      discountPercent: totalDiscountPercent,
      discountAmount: totalDiscountAmount,
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
    const orderCountry = checkoutCountryRegion || checkoutCountryName || fallbackCountry;
    const order = await Order.create({
      sum: user.type == 'Admin' ? 0 : totalPriceInclVat,
      netAfterDiscount: user.type == ' Admin' ? 0 : netAfterDiscount,
      signs: orderSigns > 0 ? orderSigns : 1,
      userId,
      country: orderCountry,
      status: 'Received',
      orderName: body.projectName,
      orderType: '',
      deliveryType: checkoutDeliveryLabel,
      accessories: JSON.stringify(normalizedAccessories),
      idMongo: String(created._id),
      isPaid: user.type == 'Admin' ? null : false,
      language: user?.language || countryToLanguage(orderCountry),
    })

    if (coupon) {
      await CouponUsage.create({
        userId: req.user.id,
        couponId: coupon.id,
        orderId: order.id,
      });
    }

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

CartRouter.delete('/customer/:userId', requireAuth, requireAdmin, async (req, res) => {
  const userId = Number(req.params.userId);

  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ message: 'Invalid customer id' });
  }

  if (userId === Number(req.user.id)) {
    return res.status(400).json({ message: 'Admin account cannot delete itself here' });
  }

  try {
    const orders = await Order.findAll({
      where: { userId },
      attributes: ['id', 'idMongo'],
    });

    const customer = await User.findOne({ where: { id: userId } });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    if (customer.type === 'Admin') {
      return res.status(400).json({ message: 'Admin accounts cannot be deleted here' });
    }

    await sequelize.transaction(async (transaction) => {
      await Order.destroy({ where: { userId }, transaction });
      await User.destroy({ where: { id: userId }, transaction });
    });

    const mongoObjectIds = [];
    const projectIds = [];

    orders.forEach((order) => {
      const key = String(order?.idMongo || '').trim();
      if (!key) return;
      if (isMongoObjectId(key)) {
        mongoObjectIds.push(key);
      } else {
        projectIds.push(key);
      }
    });

    const mongoDeleteOr = [{ userId: String(userId) }];
    if (mongoObjectIds.length > 0) {
      mongoDeleteOr.push({ _id: { $in: mongoObjectIds } });
    }
    if (projectIds.length > 0) {
      mongoDeleteOr.push({ projectId: { $in: projectIds } });
    }

    await CartProject.deleteMany({ $or: mongoDeleteOr });

    return res.json({
      success: true,
      userId,
      deletedOrders: orders.length,
    });
  } catch (err) {
    console.error('DELETE CUSTOMER ERROR:', err);
    return res.status(500).json({ message: err.message || 'Failed to delete customer' });
  }
});

CartRouter.post('/saveTracking', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { orderId, trackingNumber } = req.body;
    if (!orderId) return res.status(400).json({ message: 'orderId required' });
    const value = trackingNumber ? String(trackingNumber).trim() : null;
    await Order.update({ trackingNumber: value }, { where: { id: Number(orderId) } });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

CartRouter.post('/setStatus', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { orderId, newStatus, trackingNumber } = req.body;

    let updatedCount;

    if (newStatus == 'Deleted') {
      [updatedCount] = await Order.update(
        { status: newStatus },
        { where: { userId: req.user.id } }
      );
    } else {
      const updateFields = { status: newStatus };
      if (newStatus === 'Shipped' && trackingNumber) {
        updateFields.trackingNumber = String(trackingNumber).trim();
      }
      [updatedCount] = await Order.update(
        updateFields,
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
      SendEmailForStatus.StatusPrinted(orderWithUser).catch(e =>
        console.error('Email StatusPrinted failed:', e)
      );
    }
    if (newStatus == 'Shipped') {
      const [r1, r2] = await Promise.allSettled([
        SendEmailForStatus.StatusShipped(orderWithUser),
        SendEmailForStatus.StatusShipped2(orderWithUser),
      ]);
      const emailFailed = [r1, r2].some(r => r.status === 'rejected' || r.value === false);
      if (emailFailed) {
        console.error('Email StatusShipped failed for order', orderId);
      }
    }
    if (newStatus == 'Delivered') {
      setTimeout(() => {
        SendEmailForStatus.StatusDelivered(orderWithUser).catch(e =>
          console.error('Email StatusDelivered failed:', e)
        );
      }, 48 * 60 * 60 * 1000);
    }

    if (updatedCount === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    return res.json({
      success: true,
      orderId,
      status: newStatus,
      trackingNumber: orderWithUser?.trackingNumber ?? null,
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

    const lang = pdfLang(order);
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
        'light blue / white': 'bg-light-blue-white',
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
          colorThemeLabel: translateMaterialColorLabel(colorTheme, lang),
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
      const label = `${order.userId} ${group.colorThemeLabel || group.colorTheme}${thicknessSuffix}${tapeSuffix} (${order.id}) (${group.count} signs)`;
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
        width: 40%;
        flex: 0 0 40%;
        max-width: 40%;
        font-size: 16px;
        font-weight: bold;
        margin-top: 30px;
        text-align: left;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .order-title--continued {
        width: 100%;
        flex: none;
        max-width: 100%;
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
      .bg-yellow-black { background: #fdf030; color: #000; }
      .bg-gray-white { background: #6b7280; color: #fff; }
      .bg-orange-white { background: #f97316; color: #fff; }
      .bg-light-blue-white { background: #00c7fe; color: #fff; }
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

      await measurementPage.setContent(localize(measureHtml, pdfLang(order)), { waitUntil: 'domcontentloaded' });
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
      await page.setContent(localize(htmlForCheck, pdfLang(order)), { waitUntil: 'domcontentloaded' });

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
    await page.setContent(localize(htmlContent, pdfLang(order)), { waitUntil: 'networkidle0' });
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
    const lang = pdfLang(order);
    const checkout = orderMongo?.checkout && typeof orderMongo.checkout === 'object' ? orderMongo.checkout : {};
    const deliveryAddress = hasAddressContent(checkout?.deliveryAddress) ? checkout.deliveryAddress : null;
    const summary = buildDeliveryNoteSummary(order, orderMongo, lang);
    const estimateDeliveryBlockUnits = (primaryText, secondaryText = '') => {
      const combined = `${String(primaryText || '')} ${String(secondaryText || '')}`.trim();
      const length = combined.length;
      if (length > 340) return 3;
      if (length > 190) return 2;
      return 1;
    };
    const orderDate = escapeHtml(formatInvoiceDate(order.createdAt));
    const customerNumber = escapeHtml(order.userId);
    const orderNumber = escapeHtml(order.id);
    const orderName = escapeHtml(summary.projectTitle || order.orderName || orderMongo?.projectName || 'Untitled');
    const invoiceNumber = escapeHtml(order.id);
    const totalSigns = escapeHtml(summary.totalSigns || order.signs || 0);
    const accessoriesSummary = summary.accessories.length
      ? summary.accessories.map((item) => `${escapeHtml(item.qty)} ${escapeHtml(item.name)}`).join('; ')
      : pdfText('pdf.deliveryNote.noAccessories', lang);
    const accessoriesUnits = estimateDeliveryBlockUnits(
      `${t('pdf.deliveryNote.accessoriesLabel', lang)} ${summary.accessories.length} ${t('pdf.deliveryNote.typesLabel', lang)}`,
      accessoriesSummary
    );
    const accessoriesBlockHtml = `
    <div class="item-block">
      <div class="col-left">${pdfText('pdf.deliveryNote.accessoriesLabel', lang)} ${escapeHtml(summary.accessories.length)} ${pdfText('pdf.deliveryNote.typesLabel', lang)}</div>
      <div class="col-right">${accessoriesSummary}</div>
    </div>`;
    const shippingCompany = deliveryAddress?.companyName || '';
    const shippingName = deliveryAddress?.fullName || [order.user?.firstName, order.user?.surname].filter(hasContent).join(' ');
    const shippingAddressLine1 = deliveryAddress?.address1 || order.user?.address || '';
    const shippingAddressLine2 = deliveryAddress?.address2 || order.user?.address2 || '';
    const shippingAddressLine3 = deliveryAddress?.address3 || order.user?.address3 || '';
    const shippingAddressLine4 = [deliveryAddress?.postalCode, deliveryAddress?.town].filter(hasContent).join(' ') || [order.user?.postcode, order.user?.city].filter(hasContent).join(' ');
    const shippingCountry = deliveryAddress?.country || order.country || order.user?.country || '';
    const shippingPhone = deliveryAddress?.mobile || order.user?.phone || '';
    const shippingAddressHtml = [
      shippingCompany,
      shippingName,
      shippingAddressLine1,
      shippingAddressLine2,
      shippingAddressLine3,
      shippingAddressLine4,
      shippingCountry,
      shippingPhone ? `${t('pdf.deliveryNote.phoneInline', lang)} ${shippingPhone}` : '',
    ]
      .filter(hasContent)
      .map(escapeHtml)
      .join('<br>');
    const signBlocks = summary.signs.length > 0
      ? summary.signs
        .map((sign, index) => {
          const counts = sign?.counts || {};
          const countsSummary = [
            toNumber(counts.images, 0) > 0 ? `${Math.floor(toNumber(counts.images, 0))} ${t('pdf.deliveryNote.unitImages', lang)}` : null,
            toNumber(counts.shapes, 0) > 0 ? `${Math.floor(toNumber(counts.shapes, 0))} ${t('pdf.deliveryNote.unitShapes', lang)}` : null,
            toNumber(counts.cutFigures, 0) > 0 ? `${Math.floor(toNumber(counts.cutFigures, 0))} ${t('pdf.deliveryNote.unitCutFigures', lang)}` : null,
            toNumber(counts.holes, 0) > 0 ? `${Math.floor(toNumber(counts.holes, 0))} ${t('pdf.deliveryNote.unitHoles', lang)}` : null,
            toNumber(counts.qrCodes, 0) > 0 ? `${Math.floor(toNumber(counts.qrCodes, 0))} ${t('pdf.deliveryNote.unitQR', lang)}` : null,
            toNumber(counts.barcodes, 0) > 0 ? `${Math.floor(toNumber(counts.barcodes, 0))} ${t('pdf.deliveryNote.unitBarCodes', lang)}` : null,
          ].filter(Boolean);
          const copiesCount = Math.max(1, Math.floor(toNumber(sign?.copiesCount, 1)));
          const signTitle = `${String(sign?.title || `${t('pdf.deliveryNote.signFallback', lang)} ${index + 1}`)}${copiesCount > 1 ? ` (${copiesCount} ${t('pdf.deliveryNote.pcsSuffix', lang)})` : ''}`;
          const signMetaLine = [String(sign?.metaLine || '').trim(), ...countsSummary].filter(hasContent).join(', ');
          const signUnits = estimateDeliveryBlockUnits(signTitle, `${signMetaLine} ${String(sign?.textLine || '—')}`);

          return {
            section: 'sign',
            units: signUnits,
            html: `
    <div class="item-block">
      <div class="col-left">${escapeHtml(signTitle)}:</div>
      <div class="col-right">
        ${escapeHtml(signMetaLine || t('pdf.deliveryNote.noSignDetails', lang))}<br>
        <span class="item-details">${pdfText('pdf.deliveryNote.textLineLabel', lang)} ${escapeHtml(sign?.textLine || '-')}</span>
      </div>
    </div>`
          };
        })
      : [{
        section: 'sign',
        units: 1,
        html: `
    <div class="item-block">
      <div class="col-left">${pdfText('pdf.deliveryNote.signsLabel', lang)}</div>
      <div class="col-right">${pdfText('pdf.deliveryNote.noSignsForOrder', lang)}</div>
    </div>`
      }];

    let pagedDeliveryBlocks = paginatePdfBlocks(
      [{ section: 'accessory', units: accessoriesUnits, html: accessoriesBlockHtml }, ...signBlocks],
        14,
        18
    );

    const buildDeliveryNoteHtml = (pages) => `
  <!DOCTYPE html>
  <html lang="${escapeHtml(lang)}">
  <head>
    <meta charset="UTF-8">
    <title>${pdfText('pdf.deliveryNote.documentTitle', lang)}</title>
    <style>
      ${INTER_FONT_FACE_CSS}
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
        height: 297mm;
        padding: 15mm 20mm;
        margin: 0 auto;
        background: white;
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
      }
      .sheet.sheet--with-footer {
        padding-bottom: 48mm;
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
  ${pages.map((pageBlocks, pageIndex) => {
    const isFirstPage = pageIndex === 0;
    const isLastPage = pageIndex === pages.length - 1;
    const pageAccessoryBlocksHtml = pageBlocks.filter((block) => block.section === 'accessory').map((block) => block.html).join('');
    const pageSignBlocksHtml = pageBlocks.filter((block) => block.section === 'sign').map((block) => block.html).join('');

    return `
  <div class="sheet${isLastPage ? ' sheet--with-footer' : ''}${isLastPage ? '' : ' page-break'}">
    <div class="header${isFirstPage ? '' : ' header--continued'}">
      <div class="logo-section">
        <div>
            <div class="svg-logo"><img src="${process.env.VITE_LAYOUT_SERVER || ''}images/images/logo.png" alt="SignXpert"></div>
        </div>
        <div class="header-contacts">
          <a href="https://sign-xpert.com" target="_blank" rel="noopener noreferrer">sign-xpert.com</a><br>
          info@<a href="https://sign-xpert.com" target="_blank" rel="noopener noreferrer">sign-xpert.com</a><br>
          +49 157 766 25 125
        </div>
      </div>
        <div class="delivery-title${isFirstPage ? '' : ' delivery-title--continued'}">${pdfText('pdf.deliveryNote.title', lang)}</div>
    </div>

    ${isFirstPage ? `
    <div class="info-grid">
      <div class="order-meta">
        <table>
          <tr><td class="label">${pdfText('pdf.deliveryNote.orderDateLabel', lang)}</td><td class="value">${orderDate}</td></tr>
          <tr><td class="label">${pdfText('pdf.deliveryNote.customerNoLabel', lang)}</td><td class="value">${customerNumber}</td></tr>
          <tr><td class="label">${pdfText('pdf.deliveryNote.orderNoLabel', lang)}</td><td class="value">${orderNumber}</td></tr>
          <tr><td class="label">${pdfText('pdf.deliveryNote.orderNameLabel', lang)}</td><td class="value">${orderName}</td></tr>
          <tr><td class="label">${pdfText('pdf.deliveryNote.invoiceNoLabel', lang)}</td><td class="value">${invoiceNumber}</td></tr>
        </table>
      </div>
      <div class="shipping-address">
        ${shippingAddressHtml || escapeHtml([order.user?.firstName, order.user?.surname].filter(hasContent).join(' ') || order.orderName || t('pdf.deliveryNote.noDeliveryAddress', lang))}
      </div>
    </div>

    <div class="count-section">
      ${pdfText('pdf.deliveryNote.countSigns', lang)} &nbsp;&nbsp; ${totalSigns}
    </div>` : ''}

    ${pageAccessoryBlocksHtml}

    ${pageSignBlocksHtml}

    ${isLastPage ? `
    <div class="footer-note">
      ${pdfText('pdf.deliveryNote.footerCheck', lang)}<br>
      ${pdfText('pdf.deliveryNote.footerIfIssues', lang)}<br><br>
      <span style="font-weight: 700;">${pdfText('pdf.deliveryNote.footerThanks', lang)}</span>
    </div>` : ''}
  </div>`;
  }).join('')}
  </body>
  </html>`;

    let overflowSafety = 0;
    while (overflowSafety < 1000) {
      overflowSafety += 1;

      const htmlForCheck = buildDeliveryNoteHtml(pagedDeliveryBlocks);
      await page.setContent(htmlForCheck, { waitUntil: 'domcontentloaded' });

      const overflowIndex = await page.evaluate(() => {
        const sheets = Array.from(document.querySelectorAll('.sheet'));
        return sheets.findIndex((sheet) => sheet.scrollHeight - sheet.clientHeight > 1);
      });

      if (overflowIndex < 0) {
        break;
      }

      const sourcePage = pagedDeliveryBlocks[overflowIndex] || [];
      if (sourcePage.length <= 1) {
        break;
      }

      const movedBlock = sourcePage.pop();
      if (!pagedDeliveryBlocks[overflowIndex + 1]) {
        pagedDeliveryBlocks[overflowIndex + 1] = [];
      }
      pagedDeliveryBlocks[overflowIndex + 1].unshift(movedBlock);

      if ((pagedDeliveryBlocks[overflowIndex] || []).length === 0) {
        pagedDeliveryBlocks.splice(overflowIndex, 1);
      }
    }

    const htmlContent = buildDeliveryNoteHtml(pagedDeliveryBlocks);

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    await waitForPdfFonts(page);
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
    const lang = pdfLang(order);

    const checkout = orderMongo?.checkout && typeof orderMongo.checkout === 'object'
      ? orderMongo.checkout
      : {};
    const hasSeparateInvoiceAddress =
      typeof checkout?.isInvoiceDifferent === 'boolean'
        ? checkout.isInvoiceDifferent
        : hasAddressContent(checkout?.invoiceAddress);
    const deliveryAddress = checkout?.deliveryAddress && typeof checkout.deliveryAddress === 'object'
      ? checkout.deliveryAddress
      : {};
    const invoiceAddress = hasSeparateInvoiceAddress && checkout?.invoiceAddress && typeof checkout.invoiceAddress === 'object'
      ? checkout.invoiceAddress
      : null;
    const invoiceAddressFromUser = {
      fullName: [order.user?.firstName2, order.user?.surname2].filter(hasContent).join(' '),
      companyName: order.user?.company2,
      address1: order.user?.address4,
      address2: order.user?.address5,
      address3: order.user?.address6,
      town: order.user?.city2,
      postalCode: order.user?.postcode2,
      country: order.user?.country2,
      state: order.user?.state2,
      email: order.user?.eMailInvoice,
      mobile: order.user?.phone2,
    };
    const hasCheckoutInvoiceAddress = hasSeparateInvoiceAddress && hasAddressContent(invoiceAddress);
    const hasUserInvoiceAddress = hasSeparateInvoiceAddress && hasAddressContent(invoiceAddressFromUser);
    const customerAddress = hasCheckoutInvoiceAddress
      ? invoiceAddress
      : hasUserInvoiceAddress
        ? invoiceAddressFromUser
        : deliveryAddress;

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
      || invoiceAddressFromUser?.email
      || (!hasCheckoutInvoiceAddress && !hasUserInvoiceAddress ? deliveryAddress?.email : '')
      || customerAddress?.email
      || order.user?.eMailInvoice
      || order.user?.email
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
    const paymentStatus = paymentStatusRaw === 'Paid'
      ? pdfText('common.statusPaid', lang)
      : paymentStatusRaw === 'Unpaid'
        ? pdfText('common.statusUnpaid', lang)
        : escapeHtml(paymentStatusRaw);
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
    const subtotal = Number.isFinite(Number(checkout?.canvasSubtotal)) && Number(checkout.canvasSubtotal) > 0
      ? round2(Number(checkout.canvasSubtotal))
      : round2(netAmount + discountAmount);
    const checkoutBaseDiscountPercent = toNumber(checkout?.baseDiscountPercent, 0);
    const checkoutCouponDiscountPercent = toNumber(checkout?.coupon?.discount, 0);
    const checkoutCouponDiscountAmount = toNumber(checkout?.coupon?.discountAmount, 0);
    const derivedBaseDiscountPercent = subtotal > 0
      ? Math.round((Math.max(0, discountAmount - checkoutCouponDiscountAmount) / subtotal) * 100)
      : 0;
    const displayDiscountPercent = checkoutCouponDiscountPercent > 0
      ? (checkoutBaseDiscountPercent > 0 ? checkoutBaseDiscountPercent : derivedBaseDiscountPercent) + checkoutCouponDiscountPercent
      : discountPercent;
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
        ${pdfText('common.noVatAccording', lang)}
      </div>`;

    const vatIdMarkup = vatNumber ? `<tr><td>${pdfText('common.vatIdLabel', lang)}</td><td>${vatNumber}</td></tr>` : '';

    const htmlContent = `
<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pdfText('pdf.invoice.documentTitle', lang)}</title>
    <style>
      ${INTER_FONT_FACE_CSS}
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
      .svg-logo img { width: 100%; height: auto; display:block; }

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
            <div class="svg-logo"><img src="${process.env.VITE_LAYOUT_SERVER || ''}images/images/logo.png" alt="SignXpert"></div>
            <div class="logo">SIGN<span>X</span>PERT</div>
            <div class="logo-sub">Smart <span>Sign & Label</span> Solution</div>
        </div>
        <div class="invoice-title">${pdfText('pdf.invoice.title', lang)}</div>
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
        </div>
      <div class="details-block">
        <table class="details-table">
          <tr><td><strong>${pdfText('pdf.invoice.invoiceNoLabel', lang)}</strong></td><td><strong>${invoiceNumber}</strong></td></tr>
          <tr><td>${pdfText('pdf.invoice.customerNoLabel', lang)}</td><td>${customerNumber}</td></tr>
          ${vatIdMarkup}
          <tr><td>${pdfText('pdf.invoice.dateLabel', lang)}</td><td>${invoiceDate}</td></tr>
          ${isInvoiceUnpaidCase
            ? `<tr><td>${pdfText('pdf.invoice.invoiceDueDateLabel', lang)}</td><td>${invoiceDueDate}</td></tr>
          <tr><td>${pdfText('pdf.invoice.paymentTermsLabel', lang)}</td><td>${pdfText('common.thirtyDaysNet', lang)}</td></tr>`
            : `<tr><td>${pdfText('pdf.invoice.paymentStatusLabel', lang)}</td><td>${paymentStatus}</td></tr>`}
          <tr><td>${pdfText('pdf.invoice.referenceLabel', lang)}</td><td>${pdfText('pdf.invoice.referenceOrderNo', lang)} ${invoiceNumber}</td></tr>
            </table>
        </div>
    </div>

    <table class="items-table">
        <thead>
            <tr>
          <th class="col-order nowrap">${pdfText('pdf.invoice.colOrderNo', lang)}</th>
          <th class="col-desc">${pdfText('pdf.invoice.colDescription', lang)}</th>
          <th class="col-total">${pdfText('pdf.invoice.colNetTotal', lang)}</th>
            </tr>
        </thead>
        <tbody>
            <tr>
          <td>${invoiceNumber}</td>
          <td>${pdfText('pdf.invoice.countSigns', lang)}${signsCount} (${projectName})</td>
          <td class="money-cell">€&nbsp;${formatMoney(subtotal)}</td>
            </tr>
        </tbody>
    </table>

    <div class="calc-section">
      <table class="calc-table">
        <tr><td>${pdfText('pdf.invoice.subtotalLabel', lang)}</td><td class="money-cell">€&nbsp;${formatMoney(subtotal)}</td></tr>
        <tr><td>${pdfText('pdf.invoice.discountLabel', lang)} (${displayDiscountPercent.toFixed(0)} %)</td><td class="money-cell">€&nbsp;${formatMoney(discountAmount)}</td></tr>
        <tr><td>${pdfText('pdf.invoice.shippingAndPackaging', lang)}${deliveryLabel ? ` (${deliveryLabel})` : ''}</td><td class="money-cell">€&nbsp;${formatMoney(shippingCost)}</td></tr>
            <tr class="total-row">
          <td style="padding-top: 15px; padding-bottom: 6px;"><u>${pdfText('pdf.invoice.totalAmount', lang)}</u></td>
          <td class="money-cell" style="padding-top: 12px; padding-bottom: 6px;">€&nbsp;${totalAmountFormatted}</td>
            </tr>
        </table>
    </div>

    ${shouldRenderPaymentInformation ? `
    <div class="payment-info">
      <h3><u>${pdfText('pdf.invoice.paymentInformationHeading', lang)}</u></h3>
      <div class="payment-grid">
        <div>${pdfText('pdf.invoice.amountDue', lang)}</div><div class="payment-value">€&nbsp;${totalAmountFormatted}</div>
        <div>${pdfText('pdf.invoice.accountHolder', lang)}</div><div>Kostyantyn Utvenko</div>
        <div>${pdfText('pdf.invoice.ibanLabel', lang)}</div><div>DE78 6535 1260 0134 0819 40</div>
        <div>${pdfText('pdf.invoice.bicSwiftLabel', lang)}</div><div>SOLADES1BAL</div>
        <div>${pdfText('pdf.invoice.paymentReferenceLabel', lang)}</div><div>${pdfText('pdf.invoice.referenceOrderNo', lang)} ${invoiceNumber}</div>
      </div>
    </div>

    <div class="online-payment-note">
      <span class="first-line">${pdfText('pdf.invoice.onlinePaymentLine1', lang)} <span class="nowrap">sign-xpert.com</span></span><br>
      ${pdfText('pdf.invoice.onlinePaymentLine2', lang)} <span class="nowrap">${pdfText('common.myAccountArrowMyOrders', lang)}</span><br>
      ${pdfText('pdf.invoice.onlinePaymentLine3', lang)}
    </div>
    ` : ''}

    <div class="footer-wrapper">
      <div class="footer-thanks" style="text-align:center;margin-bottom:10px;font-weight:700;"><strong>${pdfText('pdf.invoice.footerThanks', lang)}</strong></div>
      <div class="footer-box" style="border:0.5pt solid #000;padding:6px 10px;display:flex;justify-content:space-between;font-size:8pt;line-height:1.05;">
        <div class="footer-col-left">
          <table class="footer-info-table">
            <tr>
              <td><strong>SignXpert</strong></td>
              <td class="footer-value-cell"></td>
            </tr>
            <tr>
              <td>${pdfText('pdf.invoice.footerOwnerLabel', lang)}</td>
              <td class="footer-value-cell">Kostyantyn Utvenko</td>
            </tr>
            <tr>
              <td>${pdfText('pdf.invoice.footerAddressLabel', lang)}</td>
              <td class="footer-value-cell">${pdfText('pdf.invoice.footerAddressValue2', lang)}</td>
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
              <td>${pdfText('pdf.invoice.footerUstIdLabel', lang)}</td>
              <td class="footer-value-cell">${pdfText('common.germanVatLine', lang)}</td>
            </tr>
            <tr>
              <td></td>
              <td class="footer-value-cell">${pdfText('common.noVatSmallBusiness', lang)}</td>
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
  await waitForPdfFonts(page);
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
      customerStreetLine1: customerStreetLine1Raw,
      customerStreetLine2: customerStreetLine2Raw,
      customerStreetLine3: customerStreetLine3Raw,
      customerPostalCode: customerPostalCodeRaw,
      customerCity: customerCityRaw,
      customerCountryCode: customerCountryRaw,
      customerCountrySubdivision: customerCountrySubdivisionRaw,
      customerVatNumber: customerVatNumberRaw,
      buyerReference: String(order.user?.reference || order.userId || order.id || ''),
      remittanceInformation: `${t('pdf.invoice.referenceOrderNo', lang)} ${invoiceNumberRaw}`,
      paymentDueDate: invoiceDueDateDate,
      signsCount: signsCountRaw,
      projectName: projectNameRaw,
      subtotal,
      discountAmount,
      shippingCost,
      vatAmount,
      vatPercent,
      totalAmount,
    });

    const invoice = basicZugferdInvoicer.create(zugferdData);
    const zugferdPdf = await invoice.embedInPdf(pdfBuffer, {
      metadata: {
        title: `${t('pdf.invoice.title', lang)} ${invoiceNumber}`,
        subject: `${t('pdf.invoice.title', lang)} ${invoiceNumber}`,
        author: 'SignXpert',
        creator: 'SignXpert backend',
        producer: 'SignXpert backend',
        keywords: ['ZUGFeRD', 'Factur-X', 'Invoice'],
        language: lang,
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
  if (!order) {
    return resp.status(404).json({ message: 'Order not found' });
  }

  // Respond immediately so UI can close modal; heavy email work continues in background.
  resp.json({ ok: true });

  Promise.all([
    SendEmailForStatus.SendToAdminNewOrder(order,comment,rating),
    SendEmailForStatus.CreateOrder(order),
  ]).catch((emailErr) => {
    console.error('sendReviewAndComent async processing error:', emailErr);
  });

  return;


    
  }catch(err){
    return next(ErrorApi.badRequest(err));
  }
})

CartRouter.post('/sendOrderEmails', requireAuth, async (req, resp, next) => {
  try {
    const { id } = req.body;
    const order = await Order.findOne({
      where: {
        id: parseInt(id),
      },
      include: [
        {
          model: User,
        },
      ],
    });

    if (!order) {
      return resp.status(404).json({ message: 'Order not found' });
    }

    // Respond immediately so UI can close modal; email work continues in background.
    resp.json({ ok: true });

    Promise.all([
      SendEmailForStatus.SendToAdminNewOrder(order),
      SendEmailForStatus.CreateOrder(order),
    ]).catch((emailErr) => {
      console.error('sendOrderEmails async processing error:', emailErr);
    });

    return;
  } catch (err) {
    return next(ErrorApi.badRequest(err));
  }
})

CartRouter.get('/isBisy/:id',async(req,resp,next)=>{
  try{
    let {id}=req.params;
    id=parseInt(id);
    const res=await Order.findOne({where:{id}});
    let isBisy=false;
    if(res){
      isBisy=true;
    }
    return resp.json({isBisy});
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

export const INDUSTRY_OPTIONS = [
  'Academic / University',
  'Research Institute',
  'Biotechnology',
  'Pharmaceutical',
  'Healthcare / Hospital',
  'Clinical Diagnostics Lab',
  'Environmental Testing',
  'Food & Beverage Testing',
  'Chemical Industry',
  'Agriculture / AgriTech',
  'Oil & Gas / Energy',
  'Semiconductor / Electronics',
  'Contract Research Organization (CRO)',
  'Government / Regulatory',
  'Manufacturing / Industrial Lab',
  'Distributor / Reseller',
  'Startup / Small Business',
  'Other',
] as const;

export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'ja', label: '日本語' },
  { value: 'th', label: 'ภาษาไทย' },
] as const;

export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Taipei', label: '台北 (GMT+8)' },
  { value: 'Asia/Hong_Kong', label: '香港 (GMT+8)' },
  { value: 'Asia/Shanghai', label: '上海 (GMT+8)' },
  { value: 'Asia/Tokyo', label: '東京 (GMT+9)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (GMT+7)' },
  { value: 'UTC', label: 'UTC' },
] as const;

export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'TWD', label: 'TWD (NT$)' },
  { value: 'HKD', label: 'HKD (HK$)' },
  { value: 'CNY', label: 'CNY (¥)' },
  { value: 'JPY', label: 'JPY (¥)' },
  { value: 'THB', label: 'THB (฿)' },
] as const;

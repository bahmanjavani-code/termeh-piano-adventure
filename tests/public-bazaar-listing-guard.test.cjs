'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const docs={
  faPrivacy:fs.readFileSync('docs/privacy.html','utf8'),
  enPrivacy:fs.readFileSync('docs/en/privacy.html','utf8'),
  faTerms:fs.readFileSync('docs/terms.html','utf8'),
  enTerms:fs.readFileSync('docs/en/terms.html','utf8'),
  faHome:fs.readFileSync('docs/index.html','utf8'),
  enHome:fs.readFileSync('docs/en/index.html','utf8'),
  listing:fs.readFileSync('STORE_LISTING_DRAFT.md','utf8')
};
const notOutdated=[
  /خرید واقعی و پشتیبان‌گیری ابری در نسخه آزمایشی فعال نیستند/,
  /real purchases, and cloud backup are not available in the beta/,
  /we plan to offer permanent advanced lessons/i,
  /the commercial app is planned as a free download/i,
  /قیمت پیشنهادی ۹۹٬۰۰۰ تومان/,
  /وضعیت: نسخه آزمایشی \(بتا\)/,
  /<strong>Beta testing\.<\/strong>/,
];
for(const [page,html] of Object.entries(docs)){
  for(const re of notOutdated)assert(!re.test(html),'Outdated beta-only Bazaar claims in '+page+': '+re);
}
assert(docs.faPrivacy.includes('کافه‌بازار')&&docs.enPrivacy.includes('Cafe Bazaar'),
  'Both privacy policies must describe real Cafe Bazaar payment and local entitlement storage');
assert(docs.faTerms.includes('قفل آموزشی به معنی ناموفق‌بودن خرید نیست')||
       docs.faTerms.includes('قفل آموزشی به معنی ناموفق‌بودن خرید نیست.'),
  'Explain that an educational lock is independent of purchase success');
assert(docs.enTerms.includes('learning prerequisite is not a failed purchase'),
  'English terms must explain ownership versus learning stages');
assert(docs.listing.includes('حذف برنامه یا پاک‌کردن داده‌ها')&&
       docs.listing.includes('restoring a lifetime purchase')&&
       docs.listing.includes('versionCode 35'),
  'Bazaar store listing must accurately disclose local-progress loss and version');
assert(docs.enHome.includes('not yet publicly distributed')&&docs.faHome.includes('انتشار عمومی هنوز'),
  'Keep website honest about pending public launch');
console.log('PASS: public Bazaar store and website copy reflects verified purchase, learning locks, local-progress reset and pending release.');

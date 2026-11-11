// Labelled training data for the vape purchase classifier, built from merchant names
// and the ways UK bank statements dress them up. Label 1 = vape purchase.
//
// To improve the model: add real (anonymised) descriptions to REAL below, or names to
// the lists, then `npm run train:vape`. Tobacconists and newsagents are left out on
// purpose: they sell both, so the analyser lets people tick those by hand.
'use strict';

const VAPE = [
  'VPZ', 'Totally Wicked', 'Vape Club', 'ECigWizard', 'Vape Superstore', 'Evapo', 'Grey Haze', 'Vapouriz',
  'Vape Shed', 'The Vape Lab', 'Vape Hub', 'Vape Corner', 'Cloud Vapes', 'Vapour Lounge', 'Vape Town',
  'Vape Kingdom', 'Vape Express', 'Vape Planet', 'Vapor Zone', 'Liquid Vapes', 'Vape Station', 'Vape House',
  'Ecig Store', 'E-Cig Shop', 'Vape Mate', 'Vapes Direct', 'Vape World', 'Puff Vapes', 'Mr Vape', 'Vape Bar',
  'Hayati Vape', 'Elf Bar', 'Lost Mary', 'SKE Crystal', 'IVG Vapes', 'Vuse', 'Vaporesso', 'Geekvape', 'Voopoo',
  'Smok Store', 'Uwell', 'Aspire Vape', 'Dinner Lady Vapes', 'Vape Monster', 'Vapourium', 'Vapestore',
  'Vape Emporium', 'Vape Cave', 'Vape Den', 'Vape Junction', 'Vape Republic', 'Vaper Shop', 'Vapers Paradise',
  'Ecig Outlet', 'E Liquid Shop', 'Eliquid Direct', 'Juice Box Vapes', 'Vape Wholesale', 'Cloud Chasers',
  'Vape Point', 'Vape Spot', 'Vape Store UK', 'Vapor Hut', 'Vapour Depot', 'Vape Nation', 'Vape Haven',
  'Vape Galaxy', 'Puff Bar', 'Hayati Pro Max', 'Crystal Bar', 'Elfliq', 'Vape Pods Direct', 'Pod Salt',
  'Nic Salts UK', 'Disposable Vapes', 'Vape Bars Direct', 'Vapeology', 'Vape Lounge', 'Vapour Trail',
  'Smoke Free Vapes', 'Quit Vape Shop', 'Vape Escape', 'Vapetastic', 'Vape Village', 'Vape Supplies',
  'Juul', 'Hayati', 'Hayati Disposables', 'E-Liquids UK', 'Nic Shop', 'Disposables Direct', 'Blu Ecigs', 'Innokin',
];

const OTHER = [
  'Tesco Stores', 'Sainsburys', 'Asda Stores', 'Aldi', 'Lidl GB', 'Morrisons', 'Waitrose', 'Co-op Food', 'Iceland',
  'M&S Simply Food', 'Amazon.co.uk', 'Amazon Prime', 'Netflix.com', 'Spotify', 'TfL Travel Charge', 'Uber Trip',
  'Deliveroo', 'Just Eat', 'Greggs', 'Costa Coffee', 'Starbucks', 'McDonalds', 'KFC', 'Burger King', 'Nandos',
  'Pret A Manger', 'Boots', 'Superdrug', 'Shell', 'BP', 'Esso', 'Argos', 'Currys', 'PayPal', 'Apple.com/bill',
  'Google Play', 'Steam Games', 'Valve', 'Primark', 'Next Retail', 'Zara', 'H&M', 'JD Sports', 'Sports Direct',
  'B&Q', 'Wickes', 'Screwfix', 'Toolstation', 'IKEA', 'Dunelm', 'The Range', 'Home Bargains', 'B&M Retail',
  'Poundland', 'Wilko', 'Specsavers', 'Vodafone', 'EE Limited', 'O2', 'Three', 'Sky Digital', 'Virgin Media',
  'BT Group', 'British Gas', 'Octopus Energy', 'Thames Water', 'Council Tax', 'DVLA', 'Trainline', 'National Rail',
  'Avanti West Coast', 'Ryanair', 'easyJet', 'Booking.com', 'Airbnb', 'Premier Inn', 'Travelodge', 'Odeon',
  'Cineworld', 'Vue Cinemas', 'PureGym', 'The Gym Group', 'David Lloyd', 'Wetherspoon', 'Pizza Express', 'Dominos',
  'Papa Johns', 'Wagamama', 'Five Guys', 'Subway', 'Itsu', 'Leon', 'Tortilla', 'Vapiano', 'Cloudflare', 'iCloud',
  'Google Cloud', 'Smokehouse BBQ', 'Smoke and Fire Grill', 'Puffin Books', 'Elf Cosmetics', 'Vax Ltd',
  'Vaseline', 'Valero', 'Vauxhall', 'Vans Store', 'Barbers', 'Hairdressers', 'Pets at Home', 'Halfords',
  'Holland & Barrett', 'Lush', 'Waterstones', 'WHSmith', 'Card Factory', 'Clintons', 'TK Maxx', 'New Look',
  'River Island', 'Matalan', 'Ebay', 'Etsy', 'Vinted', 'Depop', 'Shein', 'Temu', 'ASOS', 'Boohoo', 'Gymshark',
  'Monzo Pot', 'Transfer to savings', 'Standing order', 'Direct debit', 'Salary', 'HMRC', 'NHS Prescription',
  'Dentist', 'Opticians', 'Parking', 'RingGo', 'JustPark', 'Car Wash', 'Laundrette', 'Post Office', 'Royal Mail',
  'Evri', 'DPD', 'Cloud Nine Bakery', 'Vapor Wake Surf', 'Barclaycard', 'Klarna', 'Clearpay', 'Disney Plus',
  'YouTube Premium', 'Xbox', 'PlayStation Network', 'Nintendo', 'Patreon', 'Twitch', 'Uber Eats', 'Bolt',
  'Lime Bike', 'Santander Cycles', 'Snappy Snaps', 'Timpson', 'Robert Dyas', 'Lakeland', 'Joules', 'Fat Face',
];

const CITIES = ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Liverpool', 'Bristol', 'Cardiff',
  'Sheffield', 'Newcastle', 'Nottingham', 'Leicester', 'Belfast', 'Edinburgh', 'Brighton', 'Southampton',
  'Coventry', 'Hull', 'Stoke', 'Derby', 'Swansea', 'Plymouth', 'Reading', 'Bolton', 'Wigan', 'Croydon'];

// How statements wrap a merchant name. {n} = name as written, {N} = upper case, {c} = city.
const TEMPLATES = [
  '{n}', '{N}', '{N} {c}', '{N} {c} GB', 'CARD PAYMENT TO {N} ON 12-03', 'CARD PAYMENT TO {N},{c}',
  'SQ *{N}', 'SUMUP *{N}', 'ZETTLE_*{N}', 'PAYPAL *{N}', '{N} LTD', '{N} LIMITED', '{n}.co.uk',
  'WWW.{NN}.CO.UK', 'POS {N} 4921', 'CONTACTLESS {N} {c}', 'VIS {N} {c}', '{N} 1234 {c} GBR', '{n} {c}',
  'DEBIT CARD {N}', '{N} ONLINE', 'APPLE PAY {N}', '{N} STORE 042', 'CRV*{N}', 'SP {N}',
];

// Real descriptions seen in statements (anonymised): [description, label].
const REAL = [];

function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function render(t, name, city) {
  return t.replace('{n}', name).replace('{NN}', name.toUpperCase().replace(/[^A-Z0-9]/g, '')).replace('{N}', name.toUpperCase()).replace('{c}', city.toUpperCase());
}

// Names are split into train and test, so the test score shows how well the model
// recognises shops it has never seen, not just ones it memorised.
function build(seed = 7) {
  const r = rng(seed);
  const split = (names) => {
    const s = [...names].sort(() => r() - 0.5);
    const cut = Math.floor(s.length * 0.8);
    return [s.slice(0, cut), s.slice(cut)];
  };
  const [vTrain, vTest] = split(VAPE);
  const [oTrain, oTest] = split(OTHER);
  const expand = (names, label, per) => names.flatMap((n) => Array.from({ length: per }, () => [render(TEMPLATES[Math.floor(r() * TEMPLATES.length)], n, CITIES[Math.floor(r() * CITIES.length)]), label]));
  return {
    train: [...expand(vTrain, 1, 14), ...expand(oTrain, 0, 10), ...REAL],
    test: [...expand(vTest, 1, 6), ...expand(oTest, 0, 6)],
  };
}

module.exports = { VAPE, OTHER, build };

const crypto = require('crypto');
const AnalyticsEvent = require('../models/AnalyticsEvent');

// Map of common Egyptian governorate names returned by IP APIs → canonical Arabic/English
const EGYPT_GOVERNORATES = {
  // English variants
  'cairo': 'Cairo',
  'giza': 'Giza',
  'alexandria': 'Alexandria',
  'luxor': 'Luxor',
  'aswan': 'Aswan',
  'asyut': 'Asyut',
  'assiut': 'Asyut',
  'beheira': 'Beheira',
  'beni suef': 'Beni Suef',
  'beni-suef': 'Beni Suef',
  'dakahlia': 'Dakahlia',
  'damietta': 'Damietta',
  'faiyum': 'Faiyum',
  'fayoum': 'Faiyum',
  'gharbia': 'Gharbia',
  'ismailia': 'Ismailia',
  'kafr el sheikh': 'Kafr El Sheikh',
  'kafr el-sheikh': 'Kafr El Sheikh',
  'matruh': 'Matruh',
  'minya': 'Minya',
  'monufia': 'Monufia',
  'menoufia': 'Monufia',
  'new valley': 'New Valley',
  'north sinai': 'North Sinai',
  'port said': 'Port Said',
  'qalyubia': 'Qalyubia',
  'qena': 'Qena',
  'red sea': 'Red Sea',
  'sharqia': 'Sharqia',
  'sharkia': 'Sharqia',
  'sohag': 'Sohag',
  'south sinai': 'South Sinai',
  'suez': 'Suez',
};

// City to Governorate mapping for Egyptian cities
const CITY_TO_GOVERNORATE = {
  // Cairo region
  'cairo': 'Cairo',
  'giza': 'Giza',
  'shubra el kheima': 'Qalyubia',
  'shubra': 'Qalyubia',
  'tanta': 'Gharbia',
  'alexandria': 'Alexandria',
  'luxor': 'Luxor',
  'aswan': 'Aswan',
  'asyut': 'Asyut',
  'assiut': 'Asyut',
  'sohag': 'Sohag',
  'qena': 'Qena',
  'damanhur': 'Beheira',
  'kafr el sheikh': 'Kafr El Sheikh',
  'kafr el-sheikh': 'Kafr El Sheikh',
  'banha': 'Qalyubia',
  'menouf': 'Monufia',
  'eltahrir': 'Dakahlia',
  'damietta city': 'Damietta',
  'helwan': 'Cairo',
  'new cairo': 'Cairo',
  'nasr city': 'Cairo',
  'zamalek': 'Cairo',
  'downtown': 'Cairo',
  'mansoura': 'Dakahlia',
  'kahera': 'Kafr El Sheikh',
  'santa': 'Gharbia',
  'sammra': 'Monufia',
  'shebin el kom': 'Monufia',
  'minya': 'Minya',
  'malawi': 'Minya',
  'maghaga': 'Matruh',
  'siwa': 'Matruh',
  'sidi barrani': 'Matruh',
  'tabarka': 'Beheira',
  'hurghada': 'Red Sea',
  'sharm el sheikh': 'South Sinai',
  'sharm': 'South Sinai',
  'taba': 'South Sinai',
  'arbaeen': 'Port Said',
  'farsko': 'Damietta',
  'zagazig': 'Sharqia',
  'bilbes': 'Sharqia',
  'ismailia': 'Ismailia',
  'tora': 'Asyut',
  'abnub': 'Asyut',
  'dishna': 'Qena',
  'nagaa': 'Sohag',
  'baliana': 'Beni Suef',
  'faiyum': 'Faiyum',
  'fayoum': 'Faiyum',
  'mohasant': 'Kafr El Sheikh',
  'damieta': 'Damietta',
  'safaga': 'Red Sea',
  'abu qir': 'Port Said',
  'halwan': 'Cairo',
  'ain shams': 'Cairo',
  'heliopolis': 'Cairo',
  'midan nasr': 'Cairo',
  'obour': 'Giza',
  'shexada': 'Giza',
};

// ─── IP Geolocation Service Functions ───────────────────────────────────────────

// ISO 3166-2 region codes mapping for Egyptian governorates
const REGION_CODE_TO_GOVERNORATE = {
  'ALX': 'Alexandria',
  'ASN': 'Aswan',
  'AST': 'Asyut',
  'BA': 'Red Sea',
  'BH': 'Beheira',
  'BS': 'Beni Suef',
  'C': 'Cairo',
  'DK': 'Dakahlia',
  'DT': 'Damietta',
  'FYM': 'Faiyum',
  'GH': 'Gharbia',
  'GZ': 'Giza',
  'IS': 'Ismailia',
  'KFS': 'Kafr El Sheikh',
  'LX': 'Luxor',
  'MN': 'Minya',
  'MNF': 'Monufia',
  'MT': 'Matruh',
  'PTS': 'Port Said',
  'KB': 'Qalyubia',
  'KN': 'Qena',
  'SHR': 'Sharqia',
  'SHG': 'Sohag',
  'JS': 'South Sinai',
  'SUZ': 'Suez',
  'SIN': 'North Sinai',
  'WAD': 'New Valley'
};

// Try multiple IP geolocation services for better reliability
async function resolveGovernorate(ip, req) {
  // 1. Check Vercel GeoIP Headers first (fast, accurate, no rate-limits)
  if (req && req.headers) {
    const vercelCountry = req.headers['x-vercel-ip-country'] || '';
    if (vercelCountry.toUpperCase() === 'EG') {
      const vercelRegion = (req.headers['x-vercel-ip-country-region'] || '').toUpperCase().trim();
      const vercelCity = (req.headers['x-vercel-ip-city'] || '').trim();

      let vercelGov = null;

      // Extract code (e.g. "EG-C" or "C" -> "C")
      let code = vercelRegion;
      if (code.startsWith('EG-')) {
        code = code.substring(3);
      }

      if (REGION_CODE_TO_GOVERNORATE[code]) {
        vercelGov = REGION_CODE_TO_GOVERNORATE[code];
      }

      const regionLower = vercelRegion.toLowerCase();
      const cityLower = vercelCity.toLowerCase();

      // Fallback to direct name checks if code wasn't matched
      if (!vercelGov && vercelRegion) {
        vercelGov = EGYPT_GOVERNORATES[regionLower];
      }
      if (!vercelGov && vercelCity) {
        vercelGov = CITY_TO_GOVERNORATE[cityLower];
      }
      if (!vercelGov) {
        const foundKey = Object.keys(EGYPT_GOVERNORATES).find(key => 
          (cityLower && key.includes(cityLower)) || (regionLower && key.includes(regionLower))
        );
        if (foundKey) {
          vercelGov = EGYPT_GOVERNORATES[foundKey];
        }
      }

      if (vercelGov) {
        return { governorate: vercelGov, city: vercelCity };
      }
    }
  }

  // Skip resolution for loopback / private IPs in dev
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return { governorate: 'Unknown', city: 'Unknown' };
  }

  // List of IP geolocation services to try
  const services = [
    {
      name: 'ipapi',
      url: `https://ipapi.co/${ip}/json/`,
      parser: (data) => ({
        country: data.country_code,
        region: data.region,
        city: data.city
      })
    },
    {
      name: 'ipinfo',
      url: `https://ipinfo.io/${ip}/json?token=free`,
      parser: (data) => ({
        country: data.country,
        region: data.region,
        city: data.city
      })
    },
    {
      name: 'ip-api',
      url: `http://ip-api.com/json/${ip}`,
      parser: (data) => ({
        country: data.countryCode,
        region: data.regionName,
        city: data.city
      })
    }
  ];

  for (const service of services) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(service.url, { 
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeout);

      if (!response.ok) continue;

      const data = await response.json();
      const parsed = service.parser(data);
      
      if (parsed.country !== 'EG' && parsed.country !== 'EG') {
        continue; // Try next service for non-Egypt IPs
      }

      // Try to get governorate from region
      let governorate = null;
      const regionLower = (parsed.region || '').toLowerCase().trim();
      const cityLower = (parsed.city || '').toLowerCase().trim();

      // Check direct region match in governorate map
      if (parsed.region) {
        governorate = EGYPT_GOVERNORATES[regionLower];
      }

      // If no match, try city-to-governorate mapping
      if (!governorate && parsed.city) {
        governorate = CITY_TO_GOVERNORATE[cityLower];
      }

      // If still no match, try to find matching governorate by partial city/region name
      if (!governorate) {
        governorate = Object.keys(EGYPT_GOVERNORATES).find(key => 
          key.includes(cityLower) || key.includes(regionLower)
        ) || EGYPT_GOVERNORATES[regionLower];
      }

      // Final fallback to region or city
      if (!governorate) {
        governorate = parsed.region || parsed.city || 'Unknown';
        const finalMatch = EGYPT_GOVERNORATES[governorate.toLowerCase()];
        if (finalMatch) governorate = finalMatch;
      }

      return { governorate, city: parsed.city || '' };
    } catch (e) {
      // Continue to next service on failure
      continue;
    }
  }

  return { governorate: 'Unknown', city: '' };
}

function hashIp(ip) {
  if (!ip) return '';
  return crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'fe-salt')).digest('hex').slice(0, 16);
}

function getClientIp(req) {
  return (
    req.headers['cf-connecting-ip'] ||         // Cloudflare
    req.headers['x-real-ip'] ||                // Nginx
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.ip ||
    ''
  );
}

// ─── GET /api/analytics/unknown-ips ───────────────────────────────────────
// Admin-only. Returns IPs that couldn't be geolocated for debugging.
exports.getUnknownIPs = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get unknown IP events with timestamps
    const unknownEvents = await AnalyticsEvent.find({
      governorate: 'Unknown',
      createdAt: { $gte: since }
    })
    .sort({ createdAt: -1 })
    .limit(100)
    .select('ipHash city page createdAt type');

    res.json({
      count: unknownEvents.length,
      events: unknownEvents
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── POST /api/analytics/event ─────────────────────────────────────────────
// Public endpoint — no auth required. Rate-limited via the global limiter.
exports.trackEvent = async (req, res) => {
  try {
    const { type, productId, page } = req.body;

    if (!['page_view', 'order_click'].includes(type)) {
      return res.status(400).json({ message: 'Invalid event type' });
    }

    const ip = getClientIp(req);
    const { governorate, city } = await resolveGovernorate(ip, req);

    await AnalyticsEvent.create({
      type,
      governorate,
      city,
      ipHash: hashIp(ip),
      productId: productId || null,
      page: page || ''
    });

    res.status(201).json({ ok: true });
  } catch (error) {
    // Fail silently — analytics must never break the UX
    res.status(201).json({ ok: true });
  }
};

// ─── GET /api/analytics/summary ────────────────────────────────────────────
// Admin-only. Returns aggregated stats including unknown IP counts.
exports.getSummary = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Visitors per governorate
    const visitorsByGov = await AnalyticsEvent.aggregate([
      { $match: { type: 'page_view', createdAt: { $gte: since } } },
      { $group: { _id: '$governorate', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Order clicks per governorate
    const orderClicksByGov = await AnalyticsEvent.aggregate([
      { $match: { type: 'order_click', createdAt: { $gte: since } } },
      { $group: { _id: '$governorate', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Unknown IPs count (for debugging visibility)
    const unknownVisitors = await AnalyticsEvent.countDocuments({ 
      type: 'page_view', 
      governorate: 'Unknown',
      createdAt: { $gte: since } 
    });
    
    const unknownClicks = await AnalyticsEvent.countDocuments({ 
      type: 'order_click', 
      governorate: 'Unknown',
      createdAt: { $gte: since } 
    });

    // Daily visitors trend (last N days)
    const dailyVisitors = await AnalyticsEvent.aggregate([
      { $match: { type: 'page_view', createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Daily order clicks trend
    const dailyClicks = await AnalyticsEvent.aggregate([
      { $match: { type: 'order_click', createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Totals
    const totalVisitors = visitorsByGov.reduce((s, g) => s + g.count, 0);
    const totalClicks   = orderClicksByGov.reduce((s, g) => s + g.count, 0);

    res.json({
      totalVisitors,
      totalClicks,
      conversionRate: totalVisitors > 0 ? ((totalClicks / totalVisitors) * 100).toFixed(1) : '0.0',
      topGovernorate: visitorsByGov[0]?._id || '—',
      unknownVisitors,
      unknownClicks,
      visitorsByGovernorate: visitorsByGov.map(g => ({ governorate: g._id, count: g.count })),
      orderClicksByGovernorate: orderClicksByGov.map(g => ({ governorate: g._id, count: g.count })),
      dailyVisitors: dailyVisitors.map(d => ({ date: d._id, count: d.count })),
      dailyClicks: dailyClicks.map(d => ({ date: d._id, count: d.count })),
      periodDays: days
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

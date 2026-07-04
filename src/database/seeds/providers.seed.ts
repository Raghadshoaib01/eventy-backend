// src/database/seeds/providers.seed.ts
// ─────────────────────────────────────────────────────────────────────────────
// Seeds service providers, their services, availability, sub-services, and
// bank accounts.  One provider is created per service type (6 providers total)
// plus an extra FOOD provider to demonstrate multiple providers per type.
//
// Idempotent: each provider is looked up by email before creation.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ApprovalStatus,
  AccountStatus,
  DayOfWeek,
  EventType,
  FileType,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import {
  ALL_DAYS,
  AvailabilityBlock,
  createAvailability,
  getSeedPasswordHash,
  WEEKDAYS,
  WEEKEND_DAYS,
} from './helpers.seed';
import {
  SeededProvidersContext,
} from './seed-context.types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubServiceDef {
  name: string;
  description: string;
  pricePerUnit: number;
  unitType: string;
  dailyCapacity: number;
  mediaUrls?: string[];
}

interface ServiceDef {
  typeName: string;
  description: string;
  eventTypes: EventType[];
  isPackaged?: boolean;
  serviceLogo?:string;
  minCapacity?: number;
  maxCapacity?: number;
  price?: number;
  availability: AvailabilityBlock[];
  subServices?: SubServiceDef[];
  /** Optional sample media files */
  fileUrls?: { url: string; fileType: FileType; publicId: string }[];
}

interface ProviderDef {
  fullName: string;
  email: string;
  phone: string;
  locationName: string;
  profileImage?:string;
  latitude: number;
  longitude: number;
  businessName: string;
  businessLicense: string;
  description: string;
  bankIban: string;
  bankName: string;
  services: ServiceDef[];
}

// ─── Provider definitions ─────────────────────────────────────────────────────

const PROVIDERS: ProviderDef[] = [
  // ── 1. FOOD provider ────────────────────────────────────────────────────────
  {
    fullName: 'Anas Nabaah',
    email: 'anas@nabaah.com',
    phone: '+962791100001',
    locationName: 'Amman, Jordan',
    profileImage:'https://res.cloudinary.com/dchobrz74/image/upload/v1777143261/eventy/profiles/hrqupb0ib7lmusyazmhd.jpg',
    latitude: 31.9539,
    longitude: 35.9106,
    businessName: 'NABAAH Catering',
    businessLicense: 'CR-NABAAH-20251001',
    description: 'Premium catering and food services for all occasions.',
    bankIban: 'JO94CBJO0010000000000131000302',
    bankName: 'Arab Bank',
    services: [
      {
        typeName: 'FOOD',
        serviceLogo:'https://res.cloudinary.com/dchobrz74/image/upload/v1783165071/eventy/services/jow8wiibvcwjys6tprwe.jpg',
        fileUrls:[
          {url:'https://res.cloudinary.com/dchobrz74/video/upload/v1783167905/v1_bshbkf.mp4',
          fileType:FileType.VIDEO ,
          publicId:'v1_bshbkf' ,
          },
          {
        url:'https://res.cloudinary.com/dchobrz74/image/upload/v1783165071/eventy/services/jow8wiibvcwjys6tprwe.jpg',
          fileType:FileType.IMAGE ,
          publicId:'eventy/services/jow8wiibvcwjys6tprwe' ,}
        ],
        description:
          'Premium catering for weddings, graduations, engagements, and all occasions.',
        eventTypes: [
          EventType.WEDDING,
          EventType.GRADUATION,
          EventType.ENGAGEMENT,
          EventType.BIRTHDAY,
          EventType.ALL_EVENTS,
        ],
        availability: [
          {
            workFromTime: '09:00',
            workToTime: '22:00',
            capacity: 1000,
            hasSlots: false,
            days: [
              DayOfWeek.SUNDAY,
              DayOfWeek.MONDAY,
              DayOfWeek.WEDNESDAY,
              DayOfWeek.THURSDAY,
              DayOfWeek.FRIDAY,
              DayOfWeek.SATURDAY,
            ],
          },
          {
            workFromTime: '09:00',
            workToTime: '20:00',
            capacity: 800,
            hasSlots: true,
            days: [DayOfWeek.TUESDAY],
            timeSlots: [
              { fromTime: '10:00', toTime: '13:00', capacity: 400 },
              { fromTime: '14:00', toTime: '20:00', capacity: 400 },
            ],
          },
        ],
        subServices: [
          {
            name: 'Deluxe Cassita Platter',
            description: 'Premium deluxe cassita platter for large gatherings.',
            pricePerUnit: 18.0,
            unitType: 'ITEM',
            dailyCapacity: 500,
            mediaUrls: [
              'https://res.cloudinary.com/dchobrz74/image/upload/v1783165856/7_ybkl5x.jpg',
              'https://res.cloudinary.com/dchobrz74/image/upload/v1783165841/4_gvf85u.jpg',
              'https://res.cloudinary.com/dchobrz74/video/upload/v1783167905/v1_bshbkf.mp4'
            ],
          },
          {
            name: 'Grilled Meat Station',
            description: 'Live grilling station with lamb, beef, and chicken skewers.',
            pricePerUnit: 25.0,
            unitType: 'ITEM',
            dailyCapacity: 300,
          },
          {
            name: 'Fresh Berry Juice',
            description: 'Freshly squeezed seasonal berry juice served chilled.',
            pricePerUnit: 3.5,
            unitType: 'ITEM',
            dailyCapacity: 1000,
          },
          {
            name: 'Wedding Cake (3-tier)',
            description: 'Custom three-tier wedding cake with fondant decorations.',
            pricePerUnit: 150.0,
            unitType: 'ITEM',
            dailyCapacity: 10,
            mediaUrls: [
              'https://res.cloudinary.com/dchobrz74/image/upload/v1783165857/10_esxjyp.jpg',
              'https://res.cloudinary.com/dchobrz74/image/upload/v1783165852/8_jp8vs8.jpg',
            ],
          },
        ],
      },
    ],
  },

  // ── 2. Second FOOD provider ──────────────────────────────────────────────────
  {
    fullName: 'Sara Hadidi',
    email: 'sara@hadidi-kitchen.com',
    phone: '+962791100009',
    locationName: 'Zarqa, Jordan',
    latitude: 32.0728,
    longitude: 36.0876,
    businessName: 'Hadidi Kitchen',
    businessLicense: 'CR-HADIDI-20251015',
    description: 'Home-style catering with authentic Jordanian cuisine.',
    bankIban: 'JO94CBJO0010000000000131000310',
    bankName: 'Cairo Amman Bank',
    services: [
      {
        typeName: 'FOOD',
        description: 'Authentic Jordanian home-style cooking for intimate gatherings and large events.',
        eventTypes: [
          EventType.WEDDING,
          EventType.BABY_SHOWER,
          EventType.BIRTHDAY,
          EventType.ALL_EVENTS,
        ],
        availability: [
          {
            workFromTime: '08:00',
            workToTime: '21:00',
            capacity: 600,
            hasSlots: false,
            days: ALL_DAYS,
          },
        ],
        subServices: [
          {
            name: 'Mansaf (Large Tray)',
            description: 'Traditional Jordanian mansaf served on a large communal tray.',
            pricePerUnit: 45.0,
            unitType: 'ITEM',
            dailyCapacity: 100,
          },
          {
            name: 'Knafeh Dessert Station',
            description: 'Freshly prepared knafeh with sweet cheese and sugar syrup.',
            pricePerUnit: 8.0,
            unitType: 'ITEM',
            dailyCapacity: 200,
          },
          {
            name: 'Mezze Platter',
            description: 'Assorted cold and hot mezze including hummus, fattoush, and falafel.',
            pricePerUnit: 12.0,
            unitType: 'ITEM',
            dailyCapacity: 300,
          },
        ],
      },
    ],
  },

  // ── 3. PHOTOGRAPHY provider ──────────────────────────────────────────────────
  {
    fullName: 'Lina Barakat',
    email: 'lina@lenscraft.jo',
    phone: '+962791100002',
    locationName: 'Amman, Jordan',
    latitude: 31.9638,
    longitude: 35.8802,
    businessName: 'LensCraft Studio',
    businessLicense: 'CR-LENSCRAFT-20241101',
    description: 'Award-winning photography and videography for life\'s most special moments.',
    bankIban: 'JO94CBJO0010000000000131000303',
    bankName: 'Jordan Ahli Bank',
    services: [
      {
        typeName: 'PHOTOGRAPHY',
        description: 'Full-coverage wedding and event photography — from pre-ceremony to reception.',
        eventTypes: [
          EventType.WEDDING,
          EventType.ENGAGEMENT,
          EventType.GRADUATION,
          EventType.ALL_EVENTS,
        ],
        availability: [
          {
            workFromTime: '07:00',
            workToTime: '23:00',
            capacity: 3,
            hasSlots: true,
            days: WEEKEND_DAYS,
            timeSlots: [
              { fromTime: '07:00', toTime: '13:00', capacity: 1 },
              { fromTime: '14:00', toTime: '20:00', capacity: 1 },
              { fromTime: '20:00', toTime: '23:00', capacity: 1 },
            ],
          },
          {
            workFromTime: '09:00',
            workToTime: '18:00',
            capacity: 2,
            hasSlots: true,
            days: WEEKDAYS,
            timeSlots: [
              { fromTime: '09:00', toTime: '13:00', capacity: 1 },
              { fromTime: '14:00', toTime: '18:00', capacity: 1 },
            ],
          },
        ],
        subServices: [
          {
            name: 'Photo Session (4 Hours)',
            description: 'Dedicated 4-hour photo session with professional lighting and editing.',
            pricePerUnit: 250.0,
            unitType: 'SESSION',
            dailyCapacity: 2,
          },
          {
            name: 'Cinematic Video (Full Day)',
            description: 'Full-day cinematic videography with drone footage and same-day highlights reel.',
            pricePerUnit: 600.0,
            unitType: 'BOOKING',
            dailyCapacity: 1,
          },
          {
            name: 'Engagement Shoot',
            description: 'Romantic outdoor engagement photography session with 80+ edited photos.',
            pricePerUnit: 180.0,
            unitType: 'SESSION',
            dailyCapacity: 2,
          },
          {
            name: 'Photo Album (Premium)',
            description: 'Luxury 30-page lay-flat photo album with custom cover design.',
            pricePerUnit: 120.0,
            unitType: 'ITEM',
            dailyCapacity: 5,
          },
        ],
      },
    ],
  },

  // ── 4. Second PHOTOGRAPHY provider ──────────────────────────────────────────
  {
    fullName: 'Omar Rasheed',
    email: 'omar@flashpoint.jo',
    phone: '+962791100010',
    locationName: 'Irbid, Jordan',
    latitude: 32.5568,
    longitude: 35.8469,
    businessName: 'FlashPoint Media',
    businessLicense: 'CR-FLASH-20250301',
    description: 'Creative photography and social-media content production.',
    bankIban: 'JO94CBJO0010000000000131000311',
    bankName: 'Arab Bank',
    services: [
      {
        typeName: 'PHOTOGRAPHY',
        description: 'Creative event photography focused on candid moments and storytelling.',
        eventTypes: [
          EventType.BIRTHDAY,
          EventType.GRADUATION,
          EventType.CONFERENCE,
          EventType.ALL_EVENTS,
        ],
        availability: [
          {
            workFromTime: '10:00',
            workToTime: '22:00',
            capacity: 2,
            hasSlots: false,
            days: ALL_DAYS,
          },
        ],
        subServices: [
          {
            name: 'Photobooth Package',
            description: 'Instant-print photobooth with custom backdrop and props for 3 hours.',
            pricePerUnit: 200.0,
            unitType: 'BOOKING',
            dailyCapacity: 1,
          },
          {
            name: 'Social Reel (Short Form)',
            description: 'Professionally edited 60-second Instagram / TikTok reel delivered within 48 hours.',
            pricePerUnit: 150.0,
            unitType: 'BOOKING',
            dailyCapacity: 2,
          },
          {
            name: 'Portrait Headshots (1 Hour)',
            description: 'Professional headshots for corporate or personal branding.',
            pricePerUnit: 80.0,
            unitType: 'SESSION',
            dailyCapacity: 4,
          },
        ],
      },
    ],
  },

  // ── 5. FAVORS provider ───────────────────────────────────────────────────────
  {
    fullName: 'Nour Al-Masri',
    email: 'nour@giftwrap.jo',
    phone: '+962791100003',
    locationName: 'Amman, Jordan',
    latitude: 31.9722,
    longitude: 35.9339,
    businessName: 'GiftWrap Studio',
    businessLicense: 'CR-GIFTWRAP-20250201',
    description: 'Bespoke wedding favours and personalised gifts for every occasion.',
    bankIban: 'JO94CBJO0010000000000131000304',
    bankName: 'Bank of Jordan',
    services: [
      {
        typeName: 'FAVORS',
        description: 'Custom wedding and event favours — from eco-friendly gifts to luxury boxes.',
        eventTypes: [
          EventType.WEDDING,
          EventType.ENGAGEMENT,
          EventType.BABY_SHOWER,
          EventType.BIRTHDAY,
        ],
        availability: [
          {
            workFromTime: '09:00',
            workToTime: '18:00',
            capacity: 500,
            hasSlots: false,
            days: WEEKDAYS,
          },
        ],
        subServices: [
          {
            name: 'Custom Name Box',
            description: 'Elegant white gift box with laser-engraved names and date, filled with 3 chocolates.',
            pricePerUnit: 4.5,
            unitType: 'ITEM',
            dailyCapacity: 500,
          },
          {
            name: 'Scented Candle Favour',
            description: 'Hand-poured soy candle in a frosted glass with custom label.',
            pricePerUnit: 6.0,
            unitType: 'ITEM',
            dailyCapacity: 300,
          },
          {
            name: 'Seed Packet Favour (Eco)',
            description: 'Eco-friendly wildflower seed packet in a kraft envelope with personalised tag.',
            pricePerUnit: 2.5,
            unitType: 'ITEM',
            dailyCapacity: 800,
          },
          {
            name: 'Luxury Chocolate Box (6-piece)',
            description: 'Premium Belgian chocolate assortment in a velvet ribbon box.',
            pricePerUnit: 12.0,
            unitType: 'ITEM',
            dailyCapacity: 200,
          },
        ],
      },
    ],
  },

  // ── 6. Second FAVORS provider ────────────────────────────────────────────────
  {
    fullName: 'Hana Zreiqat',
    email: 'hana@bloomboutique.jo',
    phone: '+962791100011',
    locationName: 'Aqaba, Jordan',
    latitude: 29.5317,
    longitude: 35.0061,
    businessName: 'Bloom Boutique',
    businessLicense: 'CR-BLOOM-20250401',
    description: 'Floral-inspired favours and handcrafted event gifts.',
    bankIban: 'JO94CBJO0010000000000131000312',
    bankName: 'HSBC Jordan',
    services: [
      {
        typeName: 'FAVORS',
        description: 'Handcrafted floral-themed gifts and keepsakes for weddings and celebrations.',
        eventTypes: [
          EventType.WEDDING,
          EventType.BABY_SHOWER,
          EventType.ENGAGEMENT,
        ],
        availability: [
          {
            workFromTime: '08:00',
            workToTime: '17:00',
            capacity: 400,
            hasSlots: false,
            days: [
              DayOfWeek.SUNDAY,
              DayOfWeek.MONDAY,
              DayOfWeek.TUESDAY,
              DayOfWeek.WEDNESDAY,
              DayOfWeek.THURSDAY,
            ],
          },
        ],
        subServices: [
          {
            name: 'Dried Flower Frame',
            description: 'A5 pressed wildflower art frame with couple\'s name and event date.',
            pricePerUnit: 9.0,
            unitType: 'ITEM',
            dailyCapacity: 150,
          },
          {
            name: 'Potpourri Sachet',
            description: 'Lavender and rose potpourri in an organza bag with ribbon.',
            pricePerUnit: 3.0,
            unitType: 'ITEM',
            dailyCapacity: 600,
          },
        ],
      },
    ],
  },

  // ── 7. DECORATION provider ───────────────────────────────────────────────────
  {
    fullName: 'Tarek Suleiman',
    email: 'tarek@grandecor.jo',
    phone: '+962791100004',
    locationName: 'Amman, Jordan',
    latitude: 31.9800,
    longitude: 35.9200,
    businessName: 'Grande Décor',
    businessLicense: 'CR-GRANDECOR-20240901',
    description: 'High-end event decoration — floral walls, chandeliers, and themed setups.',
    bankIban: 'JO94CBJO0010000000000131000305',
    bankName: 'Arab Bank',
    services: [
      {
        typeName: 'DECORATION',
        description: 'Luxury event decoration including floral installations, lighting, and complete venue styling.',
        eventTypes: [
          EventType.WEDDING,
          EventType.ENGAGEMENT,
          EventType.GRADUATION,
          EventType.ALL_EVENTS,
        ],
        availability: [
          {
            workFromTime: '08:00',
            workToTime: '22:00',
            capacity: 4,
            hasSlots: false,
            days: ALL_DAYS,
          },
        ],
        subServices: [
          {
            name: 'Floral Backdrop Wall',
            description: 'Custom 3×3 m floral wall with fresh or silk flowers in wedding colours.',
            pricePerUnit: 350.0,
            unitType: 'BOOKING',
            dailyCapacity: 2,
          },
          {
            name: 'Aisle Floral Arrangement',
            description: 'Ceremony aisle decorated with arrangements every 2 m, 20 stands included.',
            pricePerUnit: 180.0,
            unitType: 'BOOKING',
            dailyCapacity: 3,
          },
          {
            name: 'Centrepiece (Per Table)',
            description: 'Elegant table centrepiece with fresh flowers, candles, and greenery.',
            pricePerUnit: 40.0,
            unitType: 'ITEM',
            dailyCapacity: 100,
          },
          {
            name: 'Fairy-Light Canopy',
            description: 'Overhead fairy-light canopy covering up to 100 m² of ceiling space.',
            pricePerUnit: 450.0,
            unitType: 'BOOKING',
            dailyCapacity: 1,
          },
        ],
      },
    ],
  },

  // ── 8. Second DECORATION provider ───────────────────────────────────────────
  {
    fullName: 'Maya Khoury',
    email: 'maya@petalsandlight.jo',
    phone: '+962791100012',
    locationName: 'Madaba, Jordan',
    latitude: 31.7161,
    longitude: 35.7934,
    businessName: 'Petals & Light',
    businessLicense: 'CR-PL-20250501',
    description: 'Rustic and boho-inspired décor for intimate events.',
    bankIban: 'JO94CBJO0010000000000131000313',
    bankName: 'Jordan Islamic Bank',
    services: [
      {
        typeName: 'DECORATION',
        description: 'Rustic, boho, and garden-party decoration with natural materials.',
        eventTypes: [
          EventType.WEDDING,
          EventType.BABY_SHOWER,
          EventType.BIRTHDAY,
          EventType.ENGAGEMENT,
        ],
        availability: [
          {
            workFromTime: '09:00',
            workToTime: '20:00',
            capacity: 3,
            hasSlots: false,
            days: [
              DayOfWeek.THURSDAY,
              DayOfWeek.FRIDAY,
              DayOfWeek.SATURDAY,
              DayOfWeek.SUNDAY,
            ],
          },
        ],
        subServices: [
          {
            name: 'Pampas Grass Arch',
            description: 'Dried pampas grass and eucalyptus arch (2×2 m) for ceremony backdrop.',
            pricePerUnit: 220.0,
            unitType: 'BOOKING',
            dailyCapacity: 2,
          },
          {
            name: 'Lantern Pathway Set',
            description: 'Set of 20 iron lanterns lining a garden pathway with LED candles.',
            pricePerUnit: 85.0,
            unitType: 'BOOKING',
            dailyCapacity: 4,
          },
          {
            name: 'Balloon Garland (3 m)',
            description: 'Organic balloon garland in custom colours, 3 m length.',
            pricePerUnit: 60.0,
            unitType: 'ITEM',
            dailyCapacity: 10,
          },
        ],
      },
    ],
  },

  // ── 9. HALL provider ─────────────────────────────────────────────────────────
  {
    fullName: 'Khalid Mansour',
    email: 'khalid@royalevents.jo',
    phone: '+962791100005',
    locationName: 'Amman, Jordan',
    latitude: 31.9580,
    longitude: 35.9370,
    businessName: 'Royal Events Venue',
    businessLicense: 'CR-ROYALEVENTS-20230601',
    description: 'Upscale ballroom and banquet hall for weddings, conferences, and galas.',
    bankIban: 'JO94CBJO0010000000000131000306',
    bankName: 'Jordan Kuwait Bank',
    services: [
      {
        typeName: 'HALL',
        description: 'Grand ballroom seating up to 800 guests with in-house AV and catering coordination.',
        eventTypes: [
          EventType.WEDDING,
          EventType.ENGAGEMENT,
          EventType.CONFERENCE,
          EventType.ALL_EVENTS,
        ],
        isPackaged: false,
        minCapacity: 100,
        maxCapacity: 800,
        price: 2500.0,
        availability: [
          {
            workFromTime: '10:00',
            workToTime: '02:00',
            capacity: 2,
            hasSlots: true,
            days: ALL_DAYS,
            timeSlots: [
              { fromTime: '10:00', toTime: '16:00', capacity: 1 },
              { fromTime: '18:00', toTime: '02:00', capacity: 1 },
            ],
          },
        ],
        // HALL has no sub-services by design
      },
    ],
  },

  // ── 10. Second HALL provider ──────────────────────────────────────────────────
  {
    fullName: 'Rania Odeh',
    email: 'rania@gardenpalace.jo',
    phone: '+962791100006',
    locationName: 'Jerash, Jordan',
    latitude: 32.2731,
    longitude: 35.8994,
    businessName: 'Garden Palace Venue',
    businessLicense: 'CR-GARDENPALACE-20240101',
    description: 'Open-air garden venue with a classic Roman-inspired aesthetic.',
    bankIban: 'JO94CBJO0010000000000131000307',
    bankName: 'Arab Bank',
    services: [
      {
        typeName: 'HALL',
        description: 'Scenic outdoor garden venue for weddings and celebrations, surrounded by ancient ruins.',
        eventTypes: [
          EventType.WEDDING,
          EventType.GRADUATION,
          EventType.BIRTHDAY,
          EventType.ENGAGEMENT,
        ],
        isPackaged: false,
        minCapacity: 50,
        maxCapacity: 400,
        price: 1500.0,
        availability: [
          {
            workFromTime: '14:00',
            workToTime: '23:59',
            capacity: 1,
            hasSlots: true,
            days: WEEKEND_DAYS,
            timeSlots: [
              { fromTime: '14:00', toTime: '18:00', capacity: 1 },
              { fromTime: '19:00', toTime: '23:59', capacity: 1 },
            ],
          },
          {
            workFromTime: '10:00',
            workToTime: '20:00',
            capacity: 1,
            hasSlots: false,
            days: [DayOfWeek.THURSDAY, DayOfWeek.SUNDAY],
          },
        ],
        // HALL has no sub-services by design
      },
    ],
  },

  // ── 11. SOUND provider ────────────────────────────────────────────────────────
  {
    fullName: 'Yousef Qasim',
    email: 'yousef@soundwave.jo',
    phone: '+962791100007',
    locationName: 'Amman, Jordan',
    latitude: 31.9450,
    longitude: 35.9270,
    businessName: 'SoundWave Productions',
    businessLicense: 'CR-SOUNDWAVE-20241201',
    description: 'Professional DJ, PA systems, and lighting for events of all sizes.',
    bankIban: 'JO94CBJO0010000000000131000308',
    bankName: 'Housing Bank',
    services: [
      {
        typeName: 'SOUND',
        description: 'Full audio-visual production services — DJ sets, PA rigs, intelligent lighting, and live sound.',
        eventTypes: [
          EventType.WEDDING,
          EventType.BIRTHDAY,
          EventType.CONFERENCE,
          EventType.ALL_EVENTS,
        ],
        isPackaged: false,
        price: 800.0,
        availability: [
          {
            workFromTime: '12:00',
            workToTime: '03:00',
            capacity: 3,
            hasSlots: false,
            days: ALL_DAYS,
          },
        ],
        // SOUND has no sub-services by design
      },
    ],
  },

  // ── 12. Second SOUND provider ─────────────────────────────────────────────────
  {
    fullName: 'Faris Halabi',
    email: 'faris@beatmaster.jo',
    phone: '+962791100008',
    locationName: 'Zarqa, Jordan',
    latitude: 32.0694,
    longitude: 36.1008,
    businessName: 'BeatMaster Audio',
    businessLicense: 'CR-BEATMASTER-20250101',
    description: 'Budget-friendly DJ and audio services with modern equipment.',
    bankIban: 'JO94CBJO0010000000000131000309',
    bankName: 'Cairo Amman Bank',
    services: [
      {
        typeName: 'SOUND',
        description: 'Affordable DJ and PA setup for corporate events, graduations, and private parties.',
        eventTypes: [
          EventType.GRADUATION,
          EventType.CONFERENCE,
          EventType.BIRTHDAY,
          EventType.OTHER,
        ],
        isPackaged: false,
        price: 450.0,
        availability: [
          {
            workFromTime: '14:00',
            workToTime: '02:00',
            capacity: 2,
            hasSlots: false,
            days: [
              DayOfWeek.THURSDAY,
              DayOfWeek.FRIDAY,
              DayOfWeek.SATURDAY,
              DayOfWeek.SUNDAY,
              DayOfWeek.MONDAY,
            ],
          },
        ],
        // SOUND has no sub-services by design
      },
    ],
  },
];

// ─── Seeder function ──────────────────────────────────────────────────────────

export async function seedProviders(prisma: PrismaClient): Promise<SeededProvidersContext> {
  const passwordHash = await getSeedPasswordHash();
  const refs: Partial<SeededProvidersContext> = {};

  for (const def of PROVIDERS) {
    // ── User & ServiceProvider ────────────────────────────────────────────────
    let user = await prisma.user.findUnique({ where: { email: def.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          fullName: def.fullName,
          email: def.email,
          phoneNumber: def.phone,
          profileImage:def.profileImage ?? null,
          passwordHash,
          role: UserRole.PROVIDER,
          status: AccountStatus.ACTIVE,
          emailVerified: true,
          locationName: def.locationName,
          latitude: def.latitude,
          longitude: def.longitude,
          provider: {
            create: {
              businessName: def.businessName,
              businessLicense: def.businessLicense,
              description: def.description,
              approvalStatus: ApprovalStatus.APPROVED,
            },
          },
        },
        include: { provider: true },
      });
      console.log('  ✅ Provider created:', user.email);
    } else {
      console.log('  ⚠️  Provider exists, skipping user creation:', user.email);
    }

    const provider = await prisma.serviceProvider.findUnique({
      where: { userId: user.id },
    });
    if (!provider) throw new Error(`ServiceProvider missing for user ${user.email}`);

    if (def.email === 'khalid@royalevents.jo') {
      refs.khalidRoyalEvents = {
        providerId: provider.id,
        providerUserId: user.id,
        businessName: provider.businessName,
      };
    }

    if (def.email === 'faris@beatmaster.jo') {
      refs.beatmasterAudio = {
        providerId: provider.id,
        providerUserId: user.id,
        businessName: provider.businessName,
      };
    }

    // ── BankAccount ───────────────────────────────────────────────────────────
    const existingBank = await prisma.bankAccount.findUnique({ where: { userId: user.id } });
    if (!existingBank) {
      await prisma.bankAccount.create({
        data: {
          userId: user.id,
          iban: def.bankIban,
          bankName: def.bankName,
          accountHolderName: def.fullName,
          isVerified: true,
        },
      });
    }

    // ── Services ──────────────────────────────────────────────────────────────
    for (const svcDef of def.services) {
      const serviceType = await prisma.serviceType.findUnique({
        where: { name: svcDef.typeName },
      });
      if (!serviceType) throw new Error(`ServiceType '${svcDef.typeName}' not found. Run admin seed first.`);

      // Idempotent check: one provider/type combination
      let service = await prisma.service.findFirst({
        where: { providerId: provider.id, serviceTypeId: serviceType.id },
      });

      if (!service) {
        service = await prisma.service.create({
          data: {
            providerId: provider.id,
            serviceTypeId: serviceType.id,
            description: svcDef.description,
            approvalStatus: 'ACTIVE',
            serviceLogo:svcDef.serviceLogo ?? null,
            isCompleted: true,
            isPackaged: svcDef.isPackaged ?? false,
            minCapacity: svcDef.minCapacity,
            maxCapacity: svcDef.maxCapacity,
            price: svcDef.price,
            eventTypes: {
              create: svcDef.eventTypes.map((et) => ({ eventType: et })),
            },
            files: svcDef.fileUrls
              ? {
                  create: svcDef.fileUrls.map((f) => ({
                    fileUrl: f.url,
                    fileType: f.fileType,
                    publicId: f.publicId,
                  })),
                }
              : undefined,
          },
        });
        console.log(`    ✅ Service [${svcDef.typeName}]:`, service.id);
      } else {
        console.log(`    ⚠️  Service [${svcDef.typeName}] already exists:`, service.id);
      }

      if (def.email === 'anas@nabaah.com' && svcDef.typeName === 'FOOD') {
        refs.anasFoodService = {
          providerId: provider.id,
          providerUserId: user.id,
          businessName: provider.businessName,
          serviceId: service.id,
          serviceType: serviceType.name,
        };
      }

      // ── Availability ────────────────────────────────────────────────────────
      for (const avail of svcDef.availability) {
        await createAvailability(prisma, service.id, avail);
      }

      // ── Sub-services ────────────────────────────────────────────────────────
      if (svcDef.subServices && svcDef.subServices.length > 0) {
        for (const sub of svcDef.subServices) {
          const existing = await prisma.subService.findFirst({
            where: { serviceId: service.id, name: sub.name },
          });
          if (!existing) {
            await prisma.subService.create({
              data: {
                serviceId: service.id,
                name: sub.name,
                description: sub.description,
                pricePerUnit: sub.pricePerUnit,
                unitType: sub.unitType,
                dailyCapacity: sub.dailyCapacity,
                isAvailable: true,
                media: sub.mediaUrls
                  ? {
                      create: sub.mediaUrls.map((url) => ({
                        url,
                        type: /\.(mp4|mov|webm)$/i.test(url) ? FileType.VIDEO : FileType.IMAGE,
                      })),
                    }
                  : undefined,
              },
            });
          }
        }
        console.log(`    ✅ SubServices for [${svcDef.typeName}]: ${svcDef.subServices.length} items`);
      }
    }
  }

  console.log('\n✅ All providers seeded.');

  if (!refs.khalidRoyalEvents || !refs.anasFoodService || !refs.beatmasterAudio) {
    throw new Error('Notification seed provider references were not fully resolved.');
  }

  return {
    khalidRoyalEvents: refs.khalidRoyalEvents,
    anasFoodService: refs.anasFoodService,
    beatmasterAudio: refs.beatmasterAudio,
  };
}

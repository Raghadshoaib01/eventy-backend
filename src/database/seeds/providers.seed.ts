// src/database/seeds/providers.seed.ts
import {
  ApprovalStatus,
  AccountStatus,
  DayOfWeek,
  EventType,
  FileType,
  PrismaClient,
  ServiceStatus,
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
import { SeededProvidersContext } from './seed-context.types';

// ─── Types ────────────────────────────────────────────────────────────────

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
  serviceLogo?: string;
  minCapacity?: number;
  maxCapacity?: number;
  price?: number;
  availability?: AvailabilityBlock[];
  subServices?: SubServiceDef[];
  fileUrls?: { url: string; fileType: FileType; publicId: string }[];
  /** حالة الخدمة: افتراضي ACTIVE + isCompleted true (خدمة جاهزة بالكامل) */
  serviceApprovalStatus?: ServiceStatus;
  isCompleted?: boolean;
  /** إن true: يُنشأ ServiceChangeRequest من نوع CREATE بحالة PENDING (خدمة تنتظر مراجعة الأدمن) */
  needsCreateChangeRequest?: boolean;
}

interface ProviderDef {
  fullName: string;
  email: string;
  phone: string;
  locationName: string;
  profileImage?: string;
  latitude: number;
  longitude: number;
  businessName: string;
  businessLicense: string;
  description: string;
  bankIban?: string;
  bankName?: string;
  /** حالة المزوّد: افتراضي APPROVED */
  providerApprovalStatus?: ApprovalStatus;
  userStatus?: AccountStatus;
  services: ServiceDef[];
}

// ─── Provider definitions ───────────────────────────────────────────────────

const PROVIDERS: ProviderDef[] = [
  // ══════════ 12 مزوّدين فعّالين (2 لكل نوع) — الدومين فقط تغيّر ══════════
  {
    fullName: 'Anas Nabaah',
    email: 'anas@eventy.com',
    phone: '+962791100001',
    locationName: 'Amman, Jordan',
    latitude: 31.9539,
    longitude: 35.9106,
    businessName: 'NABAAH Catering',
    businessLicense: 'CR-NABAAH-20251001',
    description: 'Premium catering and food services for all occasions.',
    profileImage:'https://res.cloudinary.com/dchobrz74/image/upload/v1787164714/anas_zvhkmo.jpg',
    bankIban: 'JO94CBJO0010000000000131000302',
    bankName: 'Arab Bank',
    services: [
      {
        typeName: 'FOOD',
        description: 'Premium catering for weddings, graduations, engagements, and all occasions.',
        serviceLogo:'https://res.cloudinary.com/dchobrz74/image/upload/v1783165071/eventy/services/jow8wiibvcwjys6tprwe.jpg',
        eventTypes: [EventType.WEDDING, EventType.GRADUATION, EventType.ENGAGEMENT, EventType.BIRTHDAY, EventType.ALL_EVENTS],
        availability: [
          { workFromTime: '09:00', workToTime: '22:00', capacity: 1000, hasSlots: false, days: ALL_DAYS },
        ],
        subServices: [
          { name: 'Deluxe Cassita Platter', description: 'Premium deluxe cassita platter.', pricePerUnit: 18.0, unitType: 'ITEM', dailyCapacity: 500,
            mediaUrls: [
              'https://res.cloudinary.com/dchobrz74/image/upload/v1783165856/7_ybkl5x.jpg',
            ],
           },
          { name: '3-tier wedding cake', description: 'Elegant three-tier cake with rich flavors.', pricePerUnit: 25.0, unitType: 'ITEM', dailyCapacity: 300,
              mediaUrls: [
              'https://res.cloudinary.com/dchobrz74/image/upload/v1783165852/8_jp8vs8.jpg',
            ],
           },
          { name: 'Fresh Berry Juice', description: 'Freshly squeezed juice.', pricePerUnit: 3.5, unitType: 'ITEM', dailyCapacity: 1000,
              mediaUrls: [
              'https://res.cloudinary.com/dchobrz74/image/upload/v1787174546/berryJuice_qav1y0.jpg',
            ],
           },
        ],
      },
      {
        typeName: 'HALL',
        description: 'Integrated event hall offering a comfortable setting for weddings and special occasions.',
        serviceLogo:'https://res.cloudinary.com/dchobrz74/image/upload/v1787170289/logoNB_axocoe.jpg',
        isPackaged:true,
        eventTypes: [EventType.WEDDING, EventType.GRADUATION, EventType.ENGAGEMENT, EventType.BIRTHDAY, EventType.ALL_EVENTS],
        availability: [
          { workFromTime: '09:00', workToTime: '22:00', capacity: 1000, hasSlots: false, days: ALL_DAYS },
        ],
        fileUrls:[
          {url:'https://res.cloudinary.com/dchobrz74/video/upload/v1787171617/4_6036310207900944302_xzizvz.mp4',
          fileType:FileType.VIDEO ,
          publicId:'4_6036310207900944302_xzizvz' ,
          },
          {
        url:'https://res.cloudinary.com/dchobrz74/image/upload/v1787171694/f939a7e77c1d9acef019af3d7f83a43c_krxrdk.jpg',
          fileType:FileType.IMAGE ,
          publicId:'f939a7e77c1d9acef019af3d7f83a43c_krxrdk' ,
        },
        {
        url:'https://res.cloudinary.com/dchobrz74/image/upload/v1787171694/f939a7e77c1d9acef019af3d7f83a43c_krxrdk.jpg',
          fileType:FileType.IMAGE ,
          publicId:'f939a7e77c1d9acef019af3d7f83a43c_krxrdk' ,}
        ],
      },
    ],
  },
  {
    fullName: 'Sara Hadidi',
    email: 'sara@eventy.com',
    phone: '+962791100009',
    locationName: 'Zarqa, Jordan',
    latitude: 32.0728,
    longitude: 36.0876,
    businessName: 'Hadidi Kitchen',
    businessLicense: 'CR-HADIDI-20251015',
    description: 'Home-style catering with authentic Jordanian cuisine.',
    profileImage:'https://res.cloudinary.com/dchobrz74/image/upload/v1787164725/Sara_food_wg3vo6.jpg',
    bankIban: 'JO94CBJO0010000000000131000310',
    bankName: 'Cairo Amman Bank',
    services: [
      {
        typeName: 'FOOD',
        description: 'Authentic Jordanian home-style cooking.',
        eventTypes: [EventType.WEDDING, EventType.BABY_SHOWER, EventType.BIRTHDAY, EventType.ALL_EVENTS],
        availability: [{ workFromTime: '08:00', workToTime: '21:00', capacity: 600, hasSlots: false, days: ALL_DAYS }],
        subServices: [
          { name: 'Mansaf (Large Tray)', description: 'Traditional Jordanian mansaf.', pricePerUnit: 45.0, unitType: 'ITEM', dailyCapacity: 100 },
          { name: 'Knafeh Dessert Station', description: 'Freshly prepared knafeh.', pricePerUnit: 8.0, unitType: 'ITEM', dailyCapacity: 200 },
        ],
      },
    ],
  },
  {
    fullName: 'Lina Barakat',
    email: 'lina@eventy.com',
    phone: '+962791100002',
    locationName: 'Amman, Jordan',
    latitude: 31.9638,
    longitude: 35.8802,
    businessName: 'LensCraft Studio',
    businessLicense: 'CR-LENSCRAFT-20241101',
    description: 'Award-winning photography and videography.',
    profileImage:'https://res.cloudinary.com/dchobrz74/image/upload/v1787164711/lina_photo_tjcer8.jpg',
    bankIban: 'JO94CBJO0010000000000131000303',
    bankName: 'Jordan Ahli Bank',
    services: [
      {
        typeName: 'PHOTOGRAPHY',
        description: 'Full-coverage wedding and event photography.',
        eventTypes: [EventType.WEDDING, EventType.ENGAGEMENT, EventType.GRADUATION, EventType.ALL_EVENTS],
        availability: [{ workFromTime: '07:00', workToTime: '23:00', capacity: 3, hasSlots: false, days: ALL_DAYS }],
        subServices: [
          { name: 'Photo Session (4 Hours)', description: 'Dedicated 4-hour photo session.', pricePerUnit: 250.0, unitType: 'SESSION', dailyCapacity: 2 },
          { name: 'Photo Album (Premium)', description: 'Luxury 30-page album.', pricePerUnit: 120.0, unitType: 'ITEM', dailyCapacity: 5 },
        ],
      },
    ],
  },
  {
    fullName: 'Amara Rasheed',
    email: 'Amar@eventy.com',
    phone: '+962791100010',
    locationName: 'Irbid, Jordan',
    latitude: 32.5568,
    longitude: 35.8469,
    businessName: 'FlashPoint Media',
    businessLicense: 'CR-FLASH-20250301',
    description: 'Creative photography and social-media content production.',
    profileImage:'https://res.cloudinary.com/dchobrz74/image/upload/v1787164728/omar_iruf18.jpg',
    bankIban: 'JO94CBJO0010000000000131000311',
    bankName: 'Arab Bank',
    services: [
      {
        typeName: 'PHOTOGRAPHY',
        description: 'Creative event photography focused on storytelling.',
        eventTypes: [EventType.BIRTHDAY, EventType.GRADUATION, EventType.CONFERENCE, EventType.ALL_EVENTS],
        availability: [{ workFromTime: '10:00', workToTime: '22:00', capacity: 2, hasSlots: false, days: ALL_DAYS }],
        subServices: [
          { name: 'Photobooth Package', description: 'Instant-print photobooth.', pricePerUnit: 200.0, unitType: 'ITEM', dailyCapacity: 1 },
        ],
      },
    ],
  },
  {
    fullName: 'Nour Al-Masri',
    email: 'nour@eventy.com',
    phone: '+962791100003',
    locationName: 'Amman, Jordan',
    latitude: 31.9722,
    longitude: 35.9339,
    businessName: 'GiftWrap Studio',
    businessLicense: 'CR-GIFTWRAP-20250201',
    description: 'Bespoke wedding favours and personalised gifts.',
    profileImage:'https://res.cloudinary.com/dchobrz74/image/upload/v1787164724/rose_cxqe4d.jpg',
    bankIban: 'JO94CBJO0010000000000131000304',
    bankName: 'Bank of Jordan',
    services: [
      {
        typeName: 'FAVORS',
        description: 'Custom wedding and event favours.',
        eventTypes: [EventType.WEDDING, EventType.ENGAGEMENT, EventType.BABY_SHOWER, EventType.BIRTHDAY],
        availability: [{ workFromTime: '09:00', workToTime: '18:00', capacity: 500, hasSlots: false, days: WEEKDAYS }],
        subServices: [
          { name: 'Custom Name Box', description: 'Engraved gift box.', pricePerUnit: 4.5, unitType: 'ITEM', dailyCapacity: 500 },
        ],
      },
    ],
  },
  {
    fullName: 'Hana Zreiqat',
    email: 'hana@eventy.com',
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
        description: 'Handcrafted floral-themed gifts and keepsakes.',
        eventTypes: [EventType.WEDDING, EventType.BABY_SHOWER, EventType.ENGAGEMENT],
        availability: [{ workFromTime: '08:00', workToTime: '17:00', capacity: 400, hasSlots: false, days: WEEKDAYS }],
        subServices: [
          { name: 'Dried Flower Frame', description: 'Pressed wildflower art frame.', pricePerUnit: 9.0, unitType: 'ITEM', dailyCapacity: 150 },
        ],
      },
    ],
  },
  {
    fullName: 'Tarek Suleiman',
    email: 'tarek@eventy.com',
    phone: '+962791100004',
    locationName: 'Amman, Jordan',
    latitude: 31.9800,
    longitude: 35.9200,
    businessName: 'Grande Décor',
    businessLicense: 'CR-GRANDECOR-20240901',
    description: 'High-end event decoration.',
    profileImage:'https://res.cloudinary.com/dchobrz74/image/upload/v1787164726/yousef_a2kutk.jpg',
    bankIban: 'JO94CBJO0010000000000131000305',
    bankName: 'Arab Bank',
    services: [
      {
        typeName: 'DECORATION',
        description: 'Luxury event decoration including floral installations and lighting.',
        eventTypes: [EventType.WEDDING, EventType.ENGAGEMENT, EventType.GRADUATION, EventType.ALL_EVENTS],
        availability: [{ workFromTime: '08:00', workToTime: '22:00', capacity: 4, hasSlots: false, days: ALL_DAYS }],
        subServices: [
          { name: 'Floral Backdrop Wall', description: 'Custom 3×3 m floral wall.', pricePerUnit: 350.0, unitType: 'ITEM', dailyCapacity: 2 },
          { name: 'Centrepiece (Per Table)', description: 'Elegant table centrepiece.', pricePerUnit: 40.0, unitType: 'ITEM', dailyCapacity: 100 },
        ],
      },
    ],
  },
  {
    fullName: 'Maya Khoury',
    email: 'maya@eventy.com',
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
        description: 'Rustic, boho, and garden-party decoration.',
        eventTypes: [EventType.WEDDING, EventType.BABY_SHOWER, EventType.BIRTHDAY, EventType.ENGAGEMENT],
        availability: [{ workFromTime: '09:00', workToTime: '20:00', capacity: 3, hasSlots: false, days: WEEKDAYS }],
        subServices: [
          { name: 'Pampas Grass Arch', description: 'Dried pampas grass arch.', pricePerUnit: 220.0, unitType: 'ITEM', dailyCapacity: 2 },
        ],
      },
    ],
  },
  {
    fullName: 'Khalid Mansour',
    email: 'khalid@eventy.com',
    phone: '+962791100005',
    locationName: 'Amman, Jordan',
    latitude: 31.9580,
    longitude: 35.9370,
    businessName: 'Royal Events Venue',
    businessLicense: 'CR-ROYALEVENTS-20230601',
    description: 'Upscale ballroom and banquet hall — standalone, no exclusive partners.',
    bankIban: 'JO94CBJO0010000000000131000306',
    bankName: 'Jordan Kuwait Bank',
    services: [
      {
        typeName: 'HALL',
        description: 'Grand ballroom seating up to 800 guests.',
        eventTypes: [EventType.WEDDING, EventType.ENGAGEMENT, EventType.CONFERENCE, EventType.ALL_EVENTS],
        isPackaged: false,
        minCapacity: 100,
        maxCapacity: 800,
        price: 2500.0,
        availability: [{ workFromTime: '10:00', workToTime: '02:00', capacity: 2, hasSlots: false, days: ALL_DAYS }],
      },
    ],
  },
  {
    fullName: 'Rania Odeh',
    email: 'rania@eventy.com',
    phone: '+962791100006',
    locationName: 'Jerash, Jordan',
    latitude: 32.2731,
    longitude: 35.8994,
    businessName: 'Garden Palace Venue',
    businessLicense: 'CR-GARDENPALACE-20240101',
    description: 'Open-air garden venue — standalone, no exclusive partners.',
    bankIban: 'JO94CBJO0010000000000131000307',
    bankName: 'Arab Bank',
    services: [
      {
        typeName: 'HALL',
        description: 'Scenic outdoor garden venue for weddings and celebrations.',
        eventTypes: [EventType.WEDDING, EventType.GRADUATION, EventType.BIRTHDAY, EventType.ENGAGEMENT],
        isPackaged: false,
        minCapacity: 50,
        maxCapacity: 400,
        price: 1500.0,
        availability: [{ workFromTime: '10:00', workToTime: '23:59', capacity: 1, hasSlots: false, days: ALL_DAYS }],
      },
    ],
  },
  {
    fullName: 'Yousef Qasim',
    email: 'yousef@eventy.com',
    phone: '+962791100007',
    locationName: 'Amman, Jordan',
    latitude: 31.9450,
    longitude: 35.9270,
    businessName: 'SoundWave Productions',
    businessLicense: 'CR-SOUNDWAVE-20241201',
    description: 'Professional DJ, PA systems, and lighting.',
    bankIban: 'JO94CBJO0010000000000131000308',
    bankName: 'Housing Bank',
    services: [
      {
        typeName: 'SOUND',
        description: 'Full audio-visual production services.',
        eventTypes: [EventType.WEDDING, EventType.BIRTHDAY, EventType.CONFERENCE, EventType.ALL_EVENTS],
        isPackaged: false,
        price: 800.0,
        availability: [{ workFromTime: '12:00', workToTime: '03:00', capacity: 3, hasSlots: false, days: ALL_DAYS }],
      },
    ],
  },
  {
    fullName: 'Faris Halabi',
    email: 'faris@eventy.com',
    phone: '+962791100008',
    locationName: 'Zarqa, Jordan',
    latitude: 32.0694,
    longitude: 36.1008,
    businessName: 'BeatMaster Audio',
    businessLicense: 'CR-BEATMASTER-20250101',
    description: 'Budget-friendly DJ and audio services.',
    bankIban: 'JO94CBJO0010000000000131000309',
    bankName: 'Cairo Amman Bank',
    services: [
      {
        typeName: 'SOUND',
        description: 'Affordable DJ and PA setup.',
        eventTypes: [EventType.GRADUATION, EventType.CONFERENCE, EventType.BIRTHDAY, EventType.OTHER],
        isPackaged: false,
        price: 450.0,
        availability: [{ workFromTime: '14:00', workToTime: '02:00', capacity: 2, hasSlots: false, days: ALL_DAYS }],
      },
    ],
  },

  // ══════════ صالتان Package (isPackaged=true) — كل منهما مالك 3 باقات ══════════
  {
    fullName: 'Hazem Freij',
    email: 'hazem@eventy.com',
    phone: '+962791100020',
    locationName: 'Amman, Jordan',
    latitude: 31.9650,
    longitude: 35.9250,
    businessName: 'Emerald Grand Hall',
    businessLicense: 'CR-EMERALD-20250601',
    description: 'Exclusive package hall — works only through curated packages.',
    bankIban: 'JO94CBJO0010000000000131000320',
    bankName: 'Arab Bank',
    services: [
      {
        typeName: 'HALL',
        description: 'Elegant hall exclusive to Emerald packages.',
        eventTypes: [EventType.WEDDING, EventType.ENGAGEMENT, EventType.ALL_EVENTS],
        serviceLogo:'https://res.cloudinary.com/dchobrz74/image/upload/v1787174813/HallLogo_dtpfbu.jpg',
        isPackaged: true,
        minCapacity: 100,
        maxCapacity: 600,
        price: 3000.0,
        availability: [{ workFromTime: '10:00', workToTime: '02:00', capacity: 3, hasSlots: false, days: ALL_DAYS }],
        fileUrls:[
          {
        url:'https://res.cloudinary.com/dchobrz74/image/upload/v1787174748/2fb42d09a6801fe3a21b0b97cc03adbf_ak56pj.jpg',
          fileType:FileType.IMAGE ,
          publicId:'2fb42d09a6801fe3a21b0b97cc03adbf_ak56pj' ,
        },
        {
        url:'https://res.cloudinary.com/dchobrz74/image/upload/v1787174801/a8a540f71bc95c18b7ae64dc083b5192_vfkcuc.jpg',
          fileType:FileType.IMAGE ,
          publicId:'a8a540f71bc95c18b7ae64dc083b5192_vfkcuc',}
        ],
      },
    ],
  },
  {
    fullName: 'Rasha Nimer',
    email: 'rasha@eventy.com',
    phone: '+962791100021',
    locationName: 'Amman, Jordan',
    latitude: 31.9700,
    longitude: 35.8900,
    businessName: 'Diamond Palace Hall',
    businessLicense: 'CR-DIAMOND-20250601',
    description: 'Exclusive package hall — works only through curated packages.',
    bankIban: 'JO94CBJO0010000000000131000321',
    bankName: 'Cairo Amman Bank',
    services: [
      {
        typeName: 'HALL',
        description: 'Modern hall exclusive to Diamond packages.',
        eventTypes: [EventType.WEDDING, EventType.CONFERENCE, EventType.ALL_EVENTS],
        isPackaged: true,
        minCapacity: 80,
        maxCapacity: 500,
        price: 2800.0,
        availability: [{ workFromTime: '09:00', workToTime: '01:00', capacity: 2, hasSlots: false, days: ALL_DAYS }],
      },
    ],
  },

  // ══════════ 2 خدمة بانتظار قبول الأدمن (مزوّد مقبول، خدمة جديدة PENDING_APPROVAL) ══════════
  {
    fullName: 'Waleed Amer',
    email: 'waleed@eventy.com',
    phone: '+962791100030',
    locationName: 'Amman, Jordan',
    latitude: 31.9500,
    longitude: 35.9300,
    businessName: 'Golden Spoon Catering',
    businessLicense: 'CR-GOLDENSPOON-20260701',
    description: 'New catering service awaiting admin review.',
    bankIban: 'JO94CBJO0010000000000131000330',
    bankName: 'Bank of Jordan',
    services: [
      {
        typeName: 'FOOD',
        description: 'Fusion catering — pending admin approval.',
        eventTypes: [EventType.WEDDING, EventType.ALL_EVENTS],
        serviceApprovalStatus: ServiceStatus.PENDING_APPROVAL,
        isCompleted: false,
        needsCreateChangeRequest: true,
      },
    ],
  },
  {
    fullName: 'Dana Freihat',
    email: 'dana@eventy.com',
    phone: '+962791100031',
    locationName: 'Amman, Jordan',
    latitude: 31.9600,
    longitude: 35.9400,
    businessName: 'Dana Décor Studio',
    businessLicense: 'CR-DANADECOR-20260701',
    description: 'New decoration service awaiting admin review.',
    bankIban: 'JO94CBJO0010000000000131000331',
    bankName: 'Housing Bank',
    services: [
      {
        typeName: 'DECORATION',
        description: 'Modern minimalist décor — pending admin approval.',
        eventTypes: [EventType.WEDDING, EventType.ENGAGEMENT],
        serviceApprovalStatus: ServiceStatus.PENDING_APPROVAL,
        isCompleted: false,
        needsCreateChangeRequest: true,
      },
    ],
  },

  // ══════════ 2 خدمة بانتظار الإكمال (مزوّد مقبول، الخدمة PENDING_DETAILS) ══════════
  // بدون خدمات فرعية (HALL)
  {
    fullName: 'Salim Kanaan',
    email: 'salim@eventy.com',
    phone: '+962791100040',
    locationName: 'Aqaba, Jordan',
    latitude: 29.5200,
    longitude: 35.0100,
    businessName: 'Coral Bay Hall',
    businessLicense: 'CR-CORALBAY-20260710',
    description: 'Beachfront hall — awaiting completion of details.',
    bankIban: 'JO94CBJO0010000000000131000340',
    bankName: 'Arab Bank',
    services: [
      {
        typeName: 'HALL',
        description: 'Beachfront venue, still setting up capacity/media.',
        eventTypes: [EventType.WEDDING],
        serviceApprovalStatus: ServiceStatus.PENDING_DETAILS,
        isCompleted: false,
      },
    ],
  },
  // مع خدمات فرعية (FOOD) — الفرعية نفسها لا تُنشأ لأن الخدمة الأم غير مكتملة
  {
    fullName: 'Ruba Sami',
    email: 'ruba@eventy.com',
    phone: '+962791100041',
    locationName: 'Irbid, Jordan',
    latitude: 32.5500,
    longitude: 35.8500,
    businessName: 'Ruba Sweets & Catering',
    businessLicense: 'CR-RUBASWEETS-20260710',
    description: 'Catering provider still completing service details and sub-services.',
    bankIban: 'JO94CBJO0010000000000131000341',
    bankName: 'Jordan Ahli Bank',
    services: [
      {
        typeName: 'FOOD',
        description: 'Sweets and catering — awaiting completion (needs sub-services next).',
        eventTypes: [EventType.BIRTHDAY, EventType.BABY_SHOWER],
        serviceApprovalStatus: ServiceStatus.PENDING_DETAILS,
        isCompleted: false,
      },
    ],
  },

  // ══════════ 3 طلبات مزوّد بانتظار قبول الأدمن (تسجيل جديد بالكامل) ══════════
  {
    fullName: 'Hadi Odat',
    email: 'hadi@eventy.com',
    phone: '+962791100050',
    locationName: 'Amman, Jordan',
    latitude: 31.9450,
    longitude: 35.9150,
    businessName: 'Odat Sound Rentals',
    businessLicense: 'CR-ODATSOUND-20260715',
    description: 'New sound provider — registration under admin review.',
    providerApprovalStatus: ApprovalStatus.PENDING,
    userStatus: AccountStatus.PENDING,
    services: [
      {
        typeName: 'SOUND',
        description: 'Sound rental service — pending provider approval.',
        eventTypes: [EventType.CONFERENCE, EventType.BIRTHDAY],
        price: 500.0,
        serviceApprovalStatus: ServiceStatus.PENDING_APPROVAL,
        isCompleted: false,
      },
    ],
  },
  {
    fullName: 'Lara Nassar',
    email: 'lara@eventy.com',
    phone: '+962791100051',
    locationName: 'Amman, Jordan',
    latitude: 31.9350,
    longitude: 35.9450,
    businessName: 'Lara Favors House',
    businessLicense: 'CR-LARAFAVORS-20260715',
    description: 'New favors provider — registration under admin review.',
    providerApprovalStatus: ApprovalStatus.PENDING,
    userStatus: AccountStatus.PENDING,
    services: [
      {
        typeName: 'FAVORS',
        description: 'Custom favors — pending provider approval.',
        eventTypes: [EventType.WEDDING],
        serviceApprovalStatus: ServiceStatus.PENDING_APPROVAL,
        isCompleted: false,
      },
    ],
  },
  {
    fullName: 'Samer Ayoub',
    email: 'samer@eventy.com',
    phone: '+962791100052',
    locationName: 'Zarqa, Jordan',
    latitude: 32.0600,
    longitude: 36.0900,
    businessName: 'Ayoub Photography',
    businessLicense: 'CR-AYOUBPHOTO-20260715',
    description: 'New photography provider — registration under admin review.',
    providerApprovalStatus: ApprovalStatus.PENDING,
    userStatus: AccountStatus.PENDING,
    services: [
      {
        typeName: 'PHOTOGRAPHY',
        description: 'Photography service — pending provider approval.',
        eventTypes: [EventType.GRADUATION],
        serviceApprovalStatus: ServiceStatus.PENDING_APPROVAL,
        isCompleted: false,
      },
    ],
  },

  // ══════════ طلب تسجيل مزوّد مرفوض ══════════
  {
    fullName: 'Bassam Karam',
    email: 'bassam@eventy.com',
    phone: '+962791100060',
    locationName: 'Mafraq, Jordan',
    latitude: 32.3400,
    longitude: 36.2100,
    businessName: 'Karam Events (Rejected)',
    businessLicense: 'CR-KARAM-20260601',
    description: 'Provider registration rejected by admin.',
    providerApprovalStatus: ApprovalStatus.REJECTED,
    userStatus: AccountStatus.SUSPENDED,
    services: [
      {
        typeName: 'DECORATION',
        description: 'Rejected decoration service.',
        eventTypes: [EventType.WEDDING],
        serviceApprovalStatus: ServiceStatus.REJECTED,
        isCompleted: false,
      },
    ],
  },
];

// ─── Seeder function ────────────────────────────────────────────────────────

export async function seedProviders(prisma: PrismaClient): Promise<SeededProvidersContext> {
  const passwordHash = await getSeedPasswordHash();
  const refs: Partial<SeededProvidersContext> = {};

  for (const def of PROVIDERS) {
    const providerApprovalStatus = def.providerApprovalStatus ?? ApprovalStatus.APPROVED;
    const userStatus = def.userStatus ?? AccountStatus.ACTIVE;

    let user = await prisma.user.findUnique({ where: { email: def.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          fullName: def.fullName,
          email: def.email,
          phoneNumber: def.phone,
          profileImage: def.profileImage ?? null, // ← ضع رابط الصورة هنا لاحقاً
          passwordHash,
          role: UserRole.PROVIDER,
          status: userStatus,
          emailVerified: true,
          locationName: def.locationName,
          latitude: def.latitude,
          longitude: def.longitude,
          provider: {
            create: {
              businessName: def.businessName,
              businessLicense: def.businessLicense,
              description: def.description,
              approvalStatus: providerApprovalStatus,
            },
          },
        },
        include: { provider: true },
      });
      console.log('  ✅ Provider created:', user.email, `[${providerApprovalStatus}]`);
    } else {
      console.log('  ⚠️  Provider exists, skipping user creation:', user.email);
    }

    const provider = await prisma.serviceProvider.findUnique({ where: { userId: user.id } });
    if (!provider) throw new Error(`ServiceProvider missing for user ${user.email}`);

    // ── مراجع السياق المستخدمة لاحقاً بملفات seed أخرى ──
    if (def.email === 'khalid@eventy.com') {
      refs.khalidRoyalEvents = { providerId: provider.id, providerUserId: user.id, businessName: provider.businessName };
    }
    if (def.email === 'hadi@eventy.com') {
      // مزوّد بانتظار موافقة الأدمن — يُستخدم لإشعار ADMIN_NEW_PROVIDER_REQUEST
      refs.beatmasterAudio = { providerId: provider.id, providerUserId: user.id, businessName: provider.businessName };
    }

    // ── حساب بنكي (فقط للمزوّدين المقبولين بالكامل) ──
    if (providerApprovalStatus === ApprovalStatus.APPROVED && def.bankIban) {
      const existingBank = await prisma.bankAccount.findUnique({ where: { userId: user.id } });
      if (!existingBank) {
        await prisma.bankAccount.create({
          data: {
            userId: user.id,
            iban: def.bankIban,
            bankName: def.bankName ?? 'Arab Bank',
            accountHolderName: def.fullName,
            isVerified: true,
          },
        });
      }
    }

    // ── الخدمات ──
    for (const svcDef of def.services) {
      const serviceType = await prisma.serviceType.findUnique({ where: { name: svcDef.typeName } });
      if (!serviceType) throw new Error(`ServiceType '${svcDef.typeName}' not found. Run admin seed first.`);

      let service = await prisma.service.findFirst({
        where: { providerId: provider.id, serviceTypeId: serviceType.id },
      });

      const serviceApprovalStatus = svcDef.serviceApprovalStatus ?? ServiceStatus.ACTIVE;
      const isCompleted = svcDef.isCompleted ?? true;

      if (!service) {
        service = await prisma.service.create({
          data: {
            providerId: provider.id,
            serviceTypeId: serviceType.id,
            description: svcDef.description,
            approvalStatus: serviceApprovalStatus,
            serviceLogo: svcDef.serviceLogo ?? null, // ← ضع رابط اللوغو هنا لاحقاً
            isCompleted,
            isPackaged: svcDef.isPackaged ?? false,
            minCapacity: svcDef.minCapacity,
            maxCapacity: svcDef.maxCapacity,
            price: svcDef.price,
            eventTypes: { create: svcDef.eventTypes.map((et) => ({ eventType: et })) },
            files: svcDef.fileUrls
              ? { create: svcDef.fileUrls.map((f) => ({ fileUrl: f.url, fileType: f.fileType, publicId: f.publicId })) }
              : undefined,
          },
        });
        console.log(`    ✅ Service [${svcDef.typeName}/${serviceApprovalStatus}]:`, service.id);
      } else {
        console.log(`    ⚠️  Service [${svcDef.typeName}] already exists:`, service.id);
      }

      if (def.email === 'anas@eventy.com' && svcDef.typeName === 'FOOD') {
        refs.anasFoodService = {
          providerId: provider.id,
          providerUserId: user.id,
          businessName: provider.businessName,
          serviceId: service.id,
          serviceType: serviceType.name,
        };
      }

      // ── Availability + SubServices فقط للخدمات المكتملة ──
      if (isCompleted) {
        for (const avail of svcDef.availability ?? []) {
          await createAvailability(prisma, service.id, avail);
        }

        if (svcDef.subServices?.length) {
          for (const sub of svcDef.subServices) {
            const existing = await prisma.subService.findFirst({ where: { serviceId: service.id, name: sub.name } });
            if (!existing) {
              await prisma.subService.create({
                data: {
                  serviceId: service.id,
                  name: sub.name,
                  description: sub.description,
                  pricePerUnit: sub.pricePerUnit,
                  unitType: sub.unitType,
                  approvalStatus: 'ACTIVE',
                  dailyCapacity: sub.dailyCapacity,
                  isAvailable: true,
                  media: sub.mediaUrls
                    ? { create: sub.mediaUrls.map((url) => ({ url, type: /\.(mp4|mov|webm)$/i.test(url) ? FileType.VIDEO : FileType.IMAGE })) }
                    : undefined,
                },
              });
            }
          }
          console.log(`    ✅ SubServices for [${svcDef.typeName}]: ${svcDef.subServices.length} items`);
        }
      }

      // ── طلب مراجعة (CREATE) للخدمات الجديدة بانتظار قبول الأدمن ──
      if (svcDef.needsCreateChangeRequest) {
        const existingCR = await prisma.serviceChangeRequest.findFirst({
          where: { targetType: 'SERVICE', targetId: service.id, requestType: 'CREATE', status: 'PENDING' },
        });
        if (!existingCR) {
          await prisma.serviceChangeRequest.create({
            data: {
              targetType: 'SERVICE',
              targetId: service.id,
              requestType: 'CREATE',
              payload: { description: svcDef.description, eventTypes: svcDef.eventTypes },
              status: 'PENDING',
            },
          });
          console.log(`    📋 ServiceChangeRequest [CREATE/PENDING] for ${svcDef.typeName}`);
        }
      }
    }
  }

  // ── طلبات تحديث (UPDATE) على خدمة/خدمة فرعية فعالتين ──
  await seedServiceUpdateRequests(prisma);

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

/**
 * طلبات تحديث لخدمة (sara/FOOD) وخدمة فرعية (hana/Dried Flower Frame) —
 * تُجمّد الهدف بحالة PENDING_APPROVAL طبقاً لمنطق updateService()/updateSubService()
 * الفعلي بالنظام، لتفادي التعارض مع hall/decoration المستخدمين بحجوزات/باقات فعالة.
 */
async function seedServiceUpdateRequests(prisma: PrismaClient): Promise<void> {
  // 1) تحديث خدمة كاملة — Sara's FOOD service
  const saraUser = await prisma.user.findUnique({ where: { email: 'sara@eventy.com' } });
  if (saraUser) {
    const saraProvider = await prisma.serviceProvider.findUnique({ where: { userId: saraUser.id } });
    const saraFoodType = await prisma.serviceType.findUnique({ where: { name: 'FOOD' } });
    if (saraProvider && saraFoodType) {
      const saraService = await prisma.service.findFirst({
        where: { providerId: saraProvider.id, serviceTypeId: saraFoodType.id },
      });
      if (saraService && saraService.approvalStatus === 'ACTIVE') {
        const existing = await prisma.serviceChangeRequest.findFirst({
          where: { targetType: 'SERVICE', targetId: saraService.id, requestType: 'UPDATE', status: 'PENDING' },
        });
        if (!existing) {
          await prisma.$transaction([
            prisma.serviceChangeRequest.create({
              data: {
                targetType: 'SERVICE',
                targetId: saraService.id,
                requestType: 'UPDATE',
                payload: { description: 'Updated: now offering vegan Jordanian menu options.' },
                status: 'PENDING',
              },
            }),
            prisma.service.update({ where: { id: saraService.id }, data: { approvalStatus: 'PENDING_APPROVAL' } }),
          ]);
          console.log('  📋 ServiceChangeRequest [UPDATE/PENDING] — Sara FOOD service');
        }
      }
    }
  }

  // 2) تحديث خدمة فرعية — Hana's "Dried Flower Frame"
  const hanaUser = await prisma.user.findUnique({ where: { email: 'hana@eventy.com' } });
  if (hanaUser) {
    const hanaProvider = await prisma.serviceProvider.findUnique({ where: { userId: hanaUser.id } });
    if (hanaProvider) {
      const hanaSub = await prisma.subService.findFirst({
        where: { name: 'Dried Flower Frame', service: { providerId: hanaProvider.id } },
      });
      if (hanaSub && hanaSub.approvalStatus === 'ACTIVE') {
        const existing = await prisma.serviceChangeRequest.findFirst({
          where: { targetType: 'SUB_SERVICE', targetId: hanaSub.id, requestType: 'UPDATE', status: 'PENDING' },
        });
        if (!existing) {
          await prisma.$transaction([
            prisma.serviceChangeRequest.create({
              data: {
                targetType: 'SUB_SERVICE',
                targetId: hanaSub.id,
                requestType: 'UPDATE',
                payload: { pricePerUnit: 11.0, description: 'Updated: larger A4 frame size.' },
                status: 'PENDING',
              },
            }),
            prisma.subService.update({ where: { id: hanaSub.id }, data: { approvalStatus: 'PENDING_APPROVAL' } }),
          ]);
          console.log('  📋 ServiceChangeRequest [UPDATE/PENDING] — Hana sub-service');
        }
      }
    }
  }
}
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
        serviceLogo:'https://res.cloudinary.com/dchobrz74/image/upload/v1787534982/photo_2026-08-24_04-24-37_fgcttj.jpg',
        eventTypes: [EventType.WEDDING, EventType.BABY_SHOWER, EventType.BIRTHDAY, EventType.ALL_EVENTS],
        availability: [{ workFromTime: '08:00', workToTime: '21:00', capacity: 600, hasSlots: false, days: ALL_DAYS }],
        subServices: [
          { name: 'Mansaf (Large Tray)', description: 'Traditional Jordanian mansaf.', pricePerUnit: 45.0, unitType: 'ITEM', dailyCapacity: 100,
             mediaUrls: [
              'https://res.cloudinary.com/dchobrz74/image/upload/v1787534987/photo_2026-08-24_04-25-39_yotkpf.jpg',
            ],
           },
          { name: 'Knafeh Dessert Station', description: 'Freshly prepared knafeh.', pricePerUnit: 8.0, unitType: 'ITEM', dailyCapacity: 200,
             mediaUrls: [
              'https://res.cloudinary.com/dchobrz74/image/upload/v1787534991/photo_2026-08-24_04-25-34_nj3oqb.jpg',
              'https://res.cloudinary.com/dchobrz74/image/upload/v1787534989/photo_2026-08-24_04-25-37_haqn4a.jpg'
            ],
           },
        ],
      },
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
        serviceLogo:'https://res.cloudinary.com/dchobrz74/image/upload/v1787535335/photoLogo_b7ewgz.jpg',
        eventTypes: [EventType.WEDDING, EventType.ENGAGEMENT, EventType.GRADUATION, EventType.ALL_EVENTS],
        availability: [{ workFromTime: '07:00', workToTime: '23:00', capacity: 3, hasSlots: false, days: ALL_DAYS }],
        subServices: [
          { name: 'Photo Session (4 Hours)', description: 'Dedicated 4-hour photo session.', pricePerUnit: 250.0, unitType: 'SESSION', dailyCapacity: 2,
 mediaUrls: [
              'https://res.cloudinary.com/dchobrz74/image/upload/v1787535326/ba496dc65deebc96253f045414631e44_n5xbdh.jpg',
            ],
           },
          { name: 'Photo Album (Premium)', description: 'Luxury 30-page album.', pricePerUnit: 120.0, unitType: 'ITEM', dailyCapacity: 5,
             mediaUrls: [
              'https://res.cloudinary.com/dchobrz74/image/upload/v1787535339/photo6_zhpklf.jpg',
            ],
           },
        ],
      },
    ],
  },
  {
    fullName: 'Amar Rasheed',
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
        serviceLogo:'https://res.cloudinary.com/dchobrz74/image/upload/v1787535326/142373755470d869b67c30eb1e9dbdc5_hbegfo.jpg',
        eventTypes: [EventType.BIRTHDAY, EventType.GRADUATION, EventType.CONFERENCE, EventType.ALL_EVENTS],
        availability: [{ workFromTime: '10:00', workToTime: '22:00', capacity: 2, hasSlots: false, days: ALL_DAYS }],
        subServices: [
          { name: 'Photobooth Package', description: 'Instant-print photobooth.', pricePerUnit: 200.0, unitType: 'ITEM', dailyCapacity: 1,
             mediaUrls: [
              'https://res.cloudinary.com/dchobrz74/image/upload/v1787535326/ba496dc65deebc96253f045414631e44_n5xbdh.jpg',
            ],
           },
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
        serviceLogo:'https://res.cloudinary.com/dchobrz74/image/upload/v1787536016/74b8dc40fda191f72a7fd86636c442c2_cpwbwd.jpg',
        eventTypes: [EventType.WEDDING, EventType.ENGAGEMENT, EventType.BABY_SHOWER, EventType.BIRTHDAY],
        availability: [{ workFromTime: '09:00', workToTime: '18:00', capacity: 500, hasSlots: false, days: WEEKDAYS }],
        subServices: [
         { name: 'blue pen', description: 'nice blue pen', pricePerUnit: 4, unitType: 'ITEM', dailyCapacity: 500,
           mediaUrls: [
              'https://res.cloudinary.com/dchobrz74/image/upload/v1787536026/fad4a42a9a6c02db7631d90fe652adab_lj38b8.jpg',
            ],
          },
          { name: 'Custom Name Box', description: 'Engraved gift box.', pricePerUnit: 4.5, unitType: 'ITEM', dailyCapacity: 500 ,
             mediaUrls: [
              'https://res.cloudinary.com/dchobrz74/image/upload/v1787536027/973a7c4071acd3de5aa7bc3349012148_vtydyk.jpg',
            ],
          },
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
        serviceLogo:'https://res.cloudinary.com/dchobrz74/image/upload/v1787174806/b3e225e3d198c67e3cbc4c2c71d748de_jbamkg.jpg',
        eventTypes: [EventType.WEDDING, EventType.ENGAGEMENT, EventType.GRADUATION, EventType.ALL_EVENTS],
        availability: [{ workFromTime: '08:00', workToTime: '22:00', capacity: 4, hasSlots: false, days: ALL_DAYS }],
        subServices: [
          { name: 'Floral Backdrop Wall', description: 'Custom 3×3 m floral wall.', pricePerUnit: 350.0, unitType: 'ITEM', dailyCapacity: 2,
             mediaUrls: [
              'https://res.cloudinary.com/dchobrz74/image/upload/v1787536846/9dc22bdd02583c3c1fbae3c152765e5c_bbihks.jpg',
            ],
           },
          { name: 'Centrepiece (Per Table)', description: 'Elegant table centrepiece.', pricePerUnit: 40.0, unitType: 'ITEM', dailyCapacity: 100,
             mediaUrls: [
              'https://res.cloudinary.com/dchobrz74/image/upload/v1787536865/decorchair1_khokbl.jpg',
              'https://res.cloudinary.com/dchobrz74/image/upload/v1787536883/193b9bac1398aa104c2dfceb06612feb_hxvpfe.jpg'
            ],
           },
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
    profileImage:'https://res.cloudinary.com/dchobrz74/image/upload/v1787164711/faris_xzq0xa.jpg',
    bankIban: 'JO94CBJO0010000000000131000306',
    bankName: 'Jordan Kuwait Bank',
    services: [
      {
        typeName: 'HALL',
        description: 'Grand ballroom seating up to 800 guests.',
        serviceLogo:'https://res.cloudinary.com/dchobrz74/image/upload/v1787537146/9ead854e93d679c7e2d82171e1cc2b15_qzfhap.jpg',
        eventTypes: [EventType.WEDDING, EventType.ENGAGEMENT, EventType.CONFERENCE, EventType.ALL_EVENTS],
        isPackaged: false,
        minCapacity: 100,
        maxCapacity: 800,
        price: 2500.0,
        availability: [{ workFromTime: '10:00', workToTime: '02:00', capacity: 2, hasSlots: false, days: ALL_DAYS }
        ],
        fileUrls:[
          {url:'https://res.cloudinary.com/dchobrz74/video/upload/v1787175010/4_6036310207900944302_jinfxj.mp4',
          fileType:FileType.VIDEO ,
          publicId:'4_6036310207900944302_jinfxj' ,
          },
          {
        url:'https://res.cloudinary.com/dchobrz74/image/upload/v1787174797/827470221a86461e2b6dbd9948d24c26_kyrtvs.jpg',
          fileType:FileType.IMAGE ,
          publicId:'f939a7e77c1d9acef019af3d7f83a43c_krxrdk' ,
        },
        {
        url:'https://res.cloudinary.com/dchobrz74/image/upload/v1787174780/14a640e613d80d08bada9f484591fccd_i3iil2.jpg',
          fileType:FileType.IMAGE ,
          publicId:'f939a7e77c1d9acef019af3d7f83a43c_krxrdk' ,}
        ],
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
    profileImage:'https://res.cloudinary.com/dchobrz74/image/upload/v1787537906/photo_2026-08-24_05-17-34_tbm2ci.jpg',
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
        fileUrls:[
          {
        url:'https://res.cloudinary.com/dchobrz74/image/upload/v1787537946/2db79fad8cfc6b58b0df493f95cf7c62_to9tx1.jpg',
          fileType:FileType.IMAGE ,
          publicId:'f939a7e77c1d9acef019af3d7f83a43c_krxrdk' ,
        },
        {
        url:'https://res.cloudinary.com/dchobrz74/image/upload/v1787537925/83226ba61269705f4cea784adfd8736b_inkdyw.jpg',
          fileType:FileType.IMAGE ,
          publicId:'f939a7e77c1d9acef019af3d7f83a43c_krxrdk' ,}
        ],
      },
    ],
  },

  // ══════════ 2 خدمة بانتظار قبول الأدمن (مزوّد مقبول، خدمة جديدة PENDING_APPROVAL) ══════════
  {
    fullName: 'lya Amer',
    email: 'lya@eventy.com',
    phone: '+962791100030',
    locationName: 'Amman, Jordan',
    latitude: 31.9500,
    longitude: 35.9300,
    businessName: 'Golden Spoon Catering',
    businessLicense: 'CR-GOLDENSPOON-20260701',
    description: 'New catering service awaiting admin review.',
    profileImage:'https://res.cloudinary.com/dchobrz74/image/upload/v1787164719/dina_nfo5j3.jpg',
    bankIban: 'JO94CBJO0010000000000131000330',
    bankName: 'Bank of Jordan',
    services: [
      {
        typeName: 'FOOD',
        description: 'Fusion catering — pending admin approval.',
        serviceLogo:'https://res.cloudinary.com/dchobrz74/image/upload/v1784720250/eventy/services/uivnpiwdhctpwibmwxvy.jpg',
        eventTypes: [EventType.WEDDING, EventType.ALL_EVENTS],
        serviceApprovalStatus: ServiceStatus.PENDING_DETAILS,
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
    profileImage:'https://res.cloudinary.com/dchobrz74/image/upload/v1787164720/rania_nnwone.jpg',
    bankIban: 'JO94CBJO0010000000000131000331',
    bankName: 'Housing Bank',
    services: [
      {
        typeName: 'DECORATION',
        description: 'Modern minimalist décor — pending admin approval.',
        eventTypes: [EventType.WEDDING, EventType.ENGAGEMENT],
        serviceApprovalStatus: ServiceStatus.PENDING_DETAILS,
        isCompleted: false,
        needsCreateChangeRequest: true,
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
    profileImage:'https://res.cloudinary.com/dchobrz74/image/upload/v1787164711/faris_xzq0xa.jpg',
    providerApprovalStatus: ApprovalStatus.PENDING,
    userStatus: AccountStatus.PENDING,
    services: [
      {
        typeName: 'SOUND',
        description: 'Sound rental service — pending provider approval.',
        serviceLogo:'https://res.cloudinary.com/dchobrz74/image/upload/v1787537904/raniaDJ_lxlvtb.jpg',
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
    profileImage:'https://res.cloudinary.com/dchobrz74/image/upload/v1787164724/rose_cxqe4d.jpg',
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
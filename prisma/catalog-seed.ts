import { BUSINESSES, PHARMACY_UNITS, type PharmacyUnitName } from "../lib/businesses";

type CatalogBatch = {
  batchCode: string;
  quantity: number;
  expireDate?: string;
  buyingPrice?: number;
  sellingPrice?: number;
};

type CatalogItem = {
  name: string;
  code: string;
  category: string;
  unit: PharmacyUnitName;
  genericName: string;
  brandName: string;
  dosageForm: string;
  strength: string;
  packSize: string;
  manufacturer: string;
  countryOfOrigin: string;
  requiresPrescription: boolean;
  isControlled?: boolean;
  lowStockAlert?: number;
  buyingPrice: number;
  sellingPrice: number;
  batches: CatalogBatch[];
};

type PrismaLike = {
  category: {
    upsert: (args: any) => Promise<{ id: string }>;
  };
  unit: {
    findFirst: (args: any) => Promise<{ id: string } | null>;
    upsert: (args: any) => Promise<{ id: string }>;
    create: (args: any) => Promise<{ id: string }>;
    deleteMany: (args: any) => Promise<unknown>;
  };
  item: {
    upsert: (args: any) => Promise<{ id: string }>;
    updateMany: (args: any) => Promise<unknown>;
  };
  saleItem: {
    count: (args: any) => Promise<number>;
  };
  inventoryBatch: {
    findFirst: (args: any) => Promise<{ id: string } | null>;
    update: (args: any) => Promise<unknown>;
    create: (args: any) => Promise<unknown>;
  };
};

const PHARMACY_ITEMS: CatalogItem[] = [
  {
    name: "Paracetamol 500mg",
    code: "PCM-500",
    category: "Analgesics",
    unit: "Tablet",
    genericName: "Paracetamol",
    brandName: "Panadol",
    dosageForm: "Tablet",
    strength: "500mg",
    packSize: "10",
    manufacturer: "GSK",
    countryOfOrigin: "Kenya",
    requiresPrescription: false,
    lowStockAlert: 100,
    buyingPrice: 2,
    sellingPrice: 5,
    batches: [
      { batchCode: "PCM-26A", quantity: 180, expireDate: "2026-12-20" },
      { batchCode: "PCM-27B", quantity: 420, expireDate: "2027-11-30" },
    ],
  },
  {
    name: "Ibuprofen 400mg",
    code: "IBU-400",
    category: "Analgesics",
    unit: "Tablet",
    genericName: "Ibuprofen",
    brandName: "Brufen",
    dosageForm: "Tablet",
    strength: "400mg",
    packSize: "10",
    manufacturer: "Abbott",
    countryOfOrigin: "India",
    requiresPrescription: false,
    buyingPrice: 4,
    sellingPrice: 8,
    batches: [{ batchCode: "IBU-27A", quantity: 160, expireDate: "2027-08-31" }],
  },
  {
    name: "Diclofenac 50mg",
    code: "DIC-50",
    category: "Analgesics",
    unit: "Tablet",
    genericName: "Diclofenac",
    brandName: "Voltaren",
    dosageForm: "Tablet",
    strength: "50mg",
    packSize: "10",
    manufacturer: "Novartis",
    countryOfOrigin: "Egypt",
    requiresPrescription: true,
    buyingPrice: 3,
    sellingPrice: 7,
    batches: [
      { batchCode: "DIC-EXP", quantity: 24, expireDate: "2026-07-15" },
      { batchCode: "DIC-27A", quantity: 90, expireDate: "2027-09-30" },
    ],
  },
  {
    name: "Tramadol 50mg",
    code: "TRA-50",
    category: "Analgesics",
    unit: "Capsule",
    genericName: "Tramadol",
    brandName: "Tramal",
    dosageForm: "Capsule",
    strength: "50mg",
    packSize: "10",
    manufacturer: "Grünenthal",
    countryOfOrigin: "Germany",
    requiresPrescription: true,
    isControlled: true,
    lowStockAlert: 30,
    buyingPrice: 8,
    sellingPrice: 15,
    batches: [{ batchCode: "TRA-27A", quantity: 40, expireDate: "2027-04-30" }],
  },
  {
    name: "Amoxicillin 500mg",
    code: "AMX-500",
    category: "Antibiotics",
    unit: "Capsule",
    genericName: "Amoxicillin",
    brandName: "Amoxil",
    dosageForm: "Capsule",
    strength: "500mg",
    packSize: "21",
    manufacturer: "GSK",
    countryOfOrigin: "United Kingdom",
    requiresPrescription: true,
    buyingPrice: 8,
    sellingPrice: 15,
    batches: [
      { batchCode: "AMX-26C", quantity: 60, expireDate: "2026-10-20" },
      { batchCode: "AMX-27A", quantity: 140, expireDate: "2028-01-31" },
    ],
  },
  {
    name: "Amoxicillin Suspension",
    code: "AMX-SUS",
    category: "Antibiotics",
    unit: "Bottle",
    genericName: "Amoxicillin",
    brandName: "Amoxil",
    dosageForm: "Suspension",
    strength: "250mg/5ml",
    packSize: "100ml",
    manufacturer: "GSK",
    countryOfOrigin: "Kenya",
    requiresPrescription: true,
    buyingPrice: 45,
    sellingPrice: 75,
    batches: [{ batchCode: "AMXS-27A", quantity: 36, expireDate: "2027-05-31" }],
  },
  {
    name: "Azithromycin 250mg",
    code: "AZM-250",
    category: "Antibiotics",
    unit: "Tablet",
    genericName: "Azithromycin",
    brandName: "Zithromax",
    dosageForm: "Tablet",
    strength: "250mg",
    packSize: "6",
    manufacturer: "Pfizer",
    countryOfOrigin: "India",
    requiresPrescription: true,
    buyingPrice: 12,
    sellingPrice: 25,
    batches: [{ batchCode: "AZM-27A", quantity: 48, expireDate: "2027-12-31" }],
  },
  {
    name: "Ciprofloxacin 500mg",
    code: "CIP-500",
    category: "Antibiotics",
    unit: "Tablet",
    genericName: "Ciprofloxacin",
    brandName: "Cipro",
    dosageForm: "Tablet",
    strength: "500mg",
    packSize: "10",
    manufacturer: "Bayer",
    countryOfOrigin: "India",
    requiresPrescription: true,
    buyingPrice: 6,
    sellingPrice: 12,
    batches: [{ batchCode: "CIP-27A", quantity: 80, expireDate: "2027-10-31" }],
  },
  {
    name: "Metronidazole 250mg",
    code: "MTZ-250",
    category: "Antibiotics",
    unit: "Tablet",
    genericName: "Metronidazole",
    brandName: "Flagyl",
    dosageForm: "Tablet",
    strength: "250mg",
    packSize: "10",
    manufacturer: "Sanofi",
    countryOfOrigin: "France",
    requiresPrescription: true,
    buyingPrice: 3,
    sellingPrice: 6,
    batches: [{ batchCode: "MTZ-27A", quantity: 120, expireDate: "2028-02-28" }],
  },
  {
    name: "Cotrimoxazole",
    code: "CTX-480",
    category: "Antibiotics",
    unit: "Strip",
    genericName: "Sulfamethoxazole / Trimethoprim",
    brandName: "Septrin",
    dosageForm: "Tablet",
    strength: "480mg",
    packSize: "10",
    manufacturer: "Aspen",
    countryOfOrigin: "South Africa",
    requiresPrescription: true,
    buyingPrice: 18,
    sellingPrice: 30,
    batches: [{ batchCode: "CTX-27A", quantity: 50, expireDate: "2027-06-30" }],
  },
  {
    name: "Artemether Lumefantrine",
    code: "ALU-20",
    category: "Antimalarial",
    unit: "Tablet",
    genericName: "Artemether / Lumefantrine",
    brandName: "Coartem",
    dosageForm: "Tablet",
    strength: "20/120mg",
    packSize: "24",
    manufacturer: "Novartis",
    countryOfOrigin: "Switzerland",
    requiresPrescription: true,
    buyingPrice: 35,
    sellingPrice: 60,
    batches: [{ batchCode: "ALU-27A", quantity: 40, expireDate: "2027-09-30" }],
  },
  {
    name: "Albendazole 400mg",
    code: "ALB-400",
    category: "Antiparasitic",
    unit: "Tablet",
    genericName: "Albendazole",
    brandName: "Zentel",
    dosageForm: "Tablet",
    strength: "400mg",
    packSize: "1",
    manufacturer: "GSK",
    countryOfOrigin: "India",
    requiresPrescription: false,
    buyingPrice: 8,
    sellingPrice: 15,
    batches: [{ batchCode: "ALB-27A", quantity: 80, expireDate: "2028-03-31" }],
  },
  {
    name: "Omeprazole 20mg",
    code: "OME-20",
    category: "Gastrointestinal",
    unit: "Capsule",
    genericName: "Omeprazole",
    brandName: "Losec",
    dosageForm: "Capsule",
    strength: "20mg",
    packSize: "14",
    manufacturer: "AstraZeneca",
    countryOfOrigin: "Sweden",
    requiresPrescription: false,
    buyingPrice: 5,
    sellingPrice: 10,
    batches: [{ batchCode: "OME-27A", quantity: 100, expireDate: "2027-07-31" }],
  },
  {
    name: "Antacid Suspension",
    code: "ANT-200",
    category: "Gastrointestinal",
    unit: "Bottle",
    genericName: "Aluminium hydroxide / Magnesium hydroxide",
    brandName: "Mylanta",
    dosageForm: "Suspension",
    strength: "200ml",
    packSize: "200ml",
    manufacturer: "Johnson & Johnson",
    countryOfOrigin: "United States",
    requiresPrescription: false,
    buyingPrice: 45,
    sellingPrice: 80,
    batches: [{ batchCode: "ANT-27A", quantity: 24, expireDate: "2027-03-31" }],
  },
  {
    name: "ORS",
    code: "ORS",
    category: "Gastrointestinal",
    unit: "Sachet",
    genericName: "Oral rehydration salts",
    brandName: "ORS",
    dosageForm: "Sachet",
    strength: "20.5g",
    packSize: "1",
    manufacturer: "EPHARM",
    countryOfOrigin: "Ethiopia",
    requiresPrescription: false,
    lowStockAlert: 40,
    buyingPrice: 8,
    sellingPrice: 15,
    batches: [{ batchCode: "ORS-27A", quantity: 200, expireDate: "2028-06-30" }],
  },
  {
    name: "Hyoscine 10mg",
    code: "HYS-10",
    category: "Gastrointestinal",
    unit: "Tablet",
    genericName: "Hyoscine butylbromide",
    brandName: "Buscopan",
    dosageForm: "Tablet",
    strength: "10mg",
    packSize: "10",
    manufacturer: "Boehringer",
    countryOfOrigin: "Germany",
    requiresPrescription: false,
    buyingPrice: 6,
    sellingPrice: 12,
    batches: [{ batchCode: "HYS-27A", quantity: 70, expireDate: "2027-12-31" }],
  },
  {
    name: "Cetirizine 10mg",
    code: "CET-10",
    category: "Cold and Flu",
    unit: "Tablet",
    genericName: "Cetirizine",
    brandName: "Zyrtec",
    dosageForm: "Tablet",
    strength: "10mg",
    packSize: "10",
    manufacturer: "UCB",
    countryOfOrigin: "Belgium",
    requiresPrescription: false,
    buyingPrice: 3,
    sellingPrice: 6,
    batches: [{ batchCode: "CET-27A", quantity: 150, expireDate: "2028-01-31" }],
  },
  {
    name: "Loratadine 10mg",
    code: "LOR-10",
    category: "Cold and Flu",
    unit: "Tablet",
    genericName: "Loratadine",
    brandName: "Clarityne",
    dosageForm: "Tablet",
    strength: "10mg",
    packSize: "10",
    manufacturer: "Bayer",
    countryOfOrigin: "India",
    requiresPrescription: false,
    buyingPrice: 4,
    sellingPrice: 8,
    batches: [{ batchCode: "LOR-26N", quantity: 40, expireDate: "2026-12-15" }],
  },
  {
    name: "Cough Syrup",
    code: "COF-100",
    category: "Cold and Flu",
    unit: "Bottle",
    genericName: "Dextromethorphan",
    brandName: "Benylin",
    dosageForm: "Syrup",
    strength: "100ml",
    packSize: "100ml",
    manufacturer: "Johnson & Johnson",
    countryOfOrigin: "South Africa",
    requiresPrescription: false,
    buyingPrice: 55,
    sellingPrice: 95,
    batches: [{ batchCode: "COF-27A", quantity: 28, expireDate: "2027-04-30" }],
  },
  {
    name: "Saline Nasal Drops",
    code: "SND",
    category: "Cold and Flu",
    unit: "Bottle",
    genericName: "Sodium chloride",
    brandName: "Salinex",
    dosageForm: "Drops",
    strength: "0.9%",
    packSize: "15ml",
    manufacturer: "EPHARM",
    countryOfOrigin: "Ethiopia",
    requiresPrescription: false,
    buyingPrice: 25,
    sellingPrice: 45,
    batches: [{ batchCode: "SND-27A", quantity: 30, expireDate: "2027-08-31" }],
  },
  {
    name: "Vitamin C 1000mg",
    code: "VTC-1000",
    category: "Vitamins",
    unit: "Tablet",
    genericName: "Ascorbic acid",
    brandName: "Redoxon",
    dosageForm: "Tablet",
    strength: "1000mg",
    packSize: "10",
    manufacturer: "Bayer",
    countryOfOrigin: "Germany",
    requiresPrescription: false,
    buyingPrice: 6,
    sellingPrice: 12,
    batches: [{ batchCode: "VTC-27A", quantity: 120, expireDate: "2028-05-31" }],
  },
  {
    name: "Multivitamin",
    code: "MVT",
    category: "Vitamins",
    unit: "Tablet",
    genericName: "Multivitamin",
    brandName: "Centrum",
    dosageForm: "Tablet",
    strength: "1 tablet",
    packSize: "30",
    manufacturer: "Haleon",
    countryOfOrigin: "United States",
    requiresPrescription: false,
    buyingPrice: 80,
    sellingPrice: 140,
    batches: [{ batchCode: "MVT-27A", quantity: 36, expireDate: "2027-11-30" }],
  },
  {
    name: "Folic Acid 5mg",
    code: "FOL-5",
    category: "Vitamins",
    unit: "Tablet",
    genericName: "Folic acid",
    brandName: "Folate",
    dosageForm: "Tablet",
    strength: "5mg",
    packSize: "100",
    manufacturer: "EPHARM",
    countryOfOrigin: "Ethiopia",
    requiresPrescription: false,
    buyingPrice: 2,
    sellingPrice: 5,
    batches: [{ batchCode: "FOL-28A", quantity: 200, expireDate: "2028-04-30" }],
  },
  {
    name: "Zinc Sulfate",
    code: "ZNC-20",
    category: "Vitamins",
    unit: "Tablet",
    genericName: "Zinc sulfate",
    brandName: "Zinc",
    dosageForm: "Tablet",
    strength: "20mg",
    packSize: "10",
    manufacturer: "EPHARM",
    countryOfOrigin: "Ethiopia",
    requiresPrescription: false,
    buyingPrice: 3,
    sellingPrice: 6,
    batches: [{ batchCode: "ZNC-27A", quantity: 90, expireDate: "2027-10-31" }],
  },
  {
    name: "Metformin 500mg",
    code: "MET-500",
    category: "Diabetes",
    unit: "Tablet",
    genericName: "Metformin",
    brandName: "Glucophage",
    dosageForm: "Tablet",
    strength: "500mg",
    packSize: "30",
    manufacturer: "Merck",
    countryOfOrigin: "Germany",
    requiresPrescription: true,
    buyingPrice: 4,
    sellingPrice: 8,
    batches: [{ batchCode: "MET-27A", quantity: 180, expireDate: "2028-01-31" }],
  },
  {
    name: "Glibenclamide 5mg",
    code: "GLB-5",
    category: "Diabetes",
    unit: "Tablet",
    genericName: "Glibenclamide",
    brandName: "Daonil",
    dosageForm: "Tablet",
    strength: "5mg",
    packSize: "10",
    manufacturer: "Sanofi",
    countryOfOrigin: "France",
    requiresPrescription: true,
    lowStockAlert: 40,
    buyingPrice: 3,
    sellingPrice: 7,
    batches: [{ batchCode: "GLB-26L", quantity: 12, expireDate: "2027-02-28" }],
  },
  {
    name: "Insulin 100 IU/ml",
    code: "INS-100",
    category: "Diabetes",
    unit: "Vial",
    genericName: "Insulin",
    brandName: "Actrapid",
    dosageForm: "Injection",
    strength: "100 IU/ml",
    packSize: "10ml",
    manufacturer: "Novo Nordisk",
    countryOfOrigin: "Denmark",
    requiresPrescription: true,
    lowStockAlert: 8,
    buyingPrice: 180,
    sellingPrice: 260,
    batches: [{ batchCode: "INS-26C", quantity: 10, expireDate: "2026-10-18" }],
  },
  {
    name: "Amlodipine 5mg",
    code: "AML-5",
    category: "Hypertension",
    unit: "Tablet",
    genericName: "Amlodipine",
    brandName: "Norvasc",
    dosageForm: "Tablet",
    strength: "5mg",
    packSize: "30",
    manufacturer: "Pfizer",
    countryOfOrigin: "India",
    requiresPrescription: true,
    buyingPrice: 4,
    sellingPrice: 9,
    batches: [{ batchCode: "AML-27A", quantity: 100, expireDate: "2028-02-28" }],
  },
  {
    name: "Enalapril 5mg",
    code: "ENA-5",
    category: "Hypertension",
    unit: "Tablet",
    genericName: "Enalapril",
    brandName: "Renitec",
    dosageForm: "Tablet",
    strength: "5mg",
    packSize: "28",
    manufacturer: "MSD",
    countryOfOrigin: "Netherlands",
    requiresPrescription: true,
    buyingPrice: 5,
    sellingPrice: 10,
    batches: [{ batchCode: "ENA-27A", quantity: 80, expireDate: "2027-09-30" }],
  },
  {
    name: "Hydrochlorothiazide 25mg",
    code: "HCT-25",
    category: "Hypertension",
    unit: "Tablet",
    genericName: "Hydrochlorothiazide",
    brandName: "Esidrex",
    dosageForm: "Tablet",
    strength: "25mg",
    packSize: "20",
    manufacturer: "Novartis",
    countryOfOrigin: "India",
    requiresPrescription: true,
    buyingPrice: 3,
    sellingPrice: 7,
    batches: [{ batchCode: "HCT-27A", quantity: 60, expireDate: "2027-06-30" }],
  },
  {
    name: "Salbutamol Inhaler",
    code: "SAL-INH",
    category: "Respiratory",
    unit: "Piece",
    genericName: "Salbutamol",
    brandName: "Ventolin",
    dosageForm: "Drops",
    strength: "100mcg",
    packSize: "200 doses",
    manufacturer: "GSK",
    countryOfOrigin: "United Kingdom",
    requiresPrescription: true,
    buyingPrice: 120,
    sellingPrice: 190,
    batches: [{ batchCode: "SAL-27A", quantity: 18, expireDate: "2027-12-31" }],
  },
  {
    name: "Hydrocortisone Cream 1%",
    code: "HYD-1",
    category: "Skin Care",
    unit: "Tube",
    genericName: "Hydrocortisone",
    brandName: "Cortaid",
    dosageForm: "Cream",
    strength: "1%",
    packSize: "15g",
    manufacturer: "Johnson & Johnson",
    countryOfOrigin: "United States",
    requiresPrescription: false,
    buyingPrice: 35,
    sellingPrice: 65,
    batches: [{ batchCode: "HYD-27A", quantity: 24, expireDate: "2027-08-31" }],
  },
  {
    name: "Clotrimazole Cream",
    code: "CLO",
    category: "Skin Care",
    unit: "Tube",
    genericName: "Clotrimazole",
    brandName: "Canesten",
    dosageForm: "Cream",
    strength: "1%",
    packSize: "20g",
    manufacturer: "Bayer",
    countryOfOrigin: "Germany",
    requiresPrescription: false,
    buyingPrice: 40,
    sellingPrice: 75,
    batches: [{ batchCode: "CLO-26E", quantity: 8, expireDate: "2026-08-01" }],
  },
  {
    name: "Diazepam 5mg",
    code: "DZP-5",
    category: "Controlled",
    unit: "Tablet",
    genericName: "Diazepam",
    brandName: "Valium",
    dosageForm: "Tablet",
    strength: "5mg",
    packSize: "10",
    manufacturer: "Roche",
    countryOfOrigin: "Switzerland",
    requiresPrescription: true,
    isControlled: true,
    lowStockAlert: 20,
    buyingPrice: 6,
    sellingPrice: 12,
    batches: [{ batchCode: "DZP-27A", quantity: 30, expireDate: "2027-05-31" }],
  },
  {
    name: "Cotton Wool 100g",
    code: "CTW",
    category: "First Aid",
    unit: "Piece",
    genericName: "Cotton wool",
    brandName: "Cotton",
    dosageForm: "Sachet",
    strength: "100g",
    packSize: "1",
    manufacturer: "Local",
    countryOfOrigin: "Ethiopia",
    requiresPrescription: false,
    buyingPrice: 20,
    sellingPrice: 35,
    batches: [{ batchCode: "CTW-OPEN", quantity: 40 }],
  },
  {
    name: "Adhesive Bandage",
    code: "BND",
    category: "First Aid",
    unit: "Box",
    genericName: "Adhesive bandage",
    brandName: "Bandage",
    dosageForm: "Sachet",
    strength: "Assorted",
    packSize: "100",
    manufacturer: "Local",
    countryOfOrigin: "China",
    requiresPrescription: false,
    buyingPrice: 15,
    sellingPrice: 30,
    batches: [{ batchCode: "BND-27A", quantity: 50, expireDate: "2029-01-31" }],
  },
  {
    name: "Surgical Gloves",
    code: "GLV",
    category: "Medical Supplies",
    unit: "Box",
    genericName: "Examination gloves",
    brandName: "Gloves",
    dosageForm: "Sachet",
    strength: "Medium",
    packSize: "100",
    manufacturer: "Ansell",
    countryOfOrigin: "Malaysia",
    requiresPrescription: false,
    buyingPrice: 180,
    sellingPrice: 280,
    batches: [{ batchCode: "GLV-27A", quantity: 20, expireDate: "2029-06-30" }],
  },
  {
    name: "Hand Sanitizer 500ml",
    code: "SAN-500",
    category: "Medical Supplies",
    unit: "Bottle",
    genericName: "Alcohol hand rub",
    brandName: "Sanitizer",
    dosageForm: "Suspension",
    strength: "500ml",
    packSize: "500ml",
    manufacturer: "Local",
    countryOfOrigin: "Ethiopia",
    requiresPrescription: false,
    buyingPrice: 70,
    sellingPrice: 120,
    batches: [{ batchCode: "SAN-27A", quantity: 32, expireDate: "2028-08-31" }],
  },
  {
    name: "Digital Thermometer",
    code: "THM",
    category: "Medical Supplies",
    unit: "Piece",
    genericName: "Digital thermometer",
    brandName: "Thermo",
    dosageForm: "Sachet",
    strength: "1",
    packSize: "1",
    manufacturer: "Omron",
    countryOfOrigin: "Japan",
    requiresPrescription: false,
    lowStockAlert: 10,
    buyingPrice: 150,
    sellingPrice: 250,
    batches: [{ batchCode: "THM-OPEN", quantity: 6 }],
  },
  {
    name: "Disposable Syringe 5ml",
    code: "SYR-5",
    category: "Medical Supplies",
    unit: "Piece",
    genericName: "Syringe",
    brandName: "Syringe",
    dosageForm: "Injection",
    strength: "5ml",
    packSize: "1",
    manufacturer: "BD",
    countryOfOrigin: "United States",
    requiresPrescription: false,
    buyingPrice: 5,
    sellingPrice: 10,
    batches: [{ batchCode: "SYR-28A", quantity: 200, expireDate: "2028-12-31" }],
  },
];

const STOCK_FACTORS = [1, 0.7, 1.25];

function scaleQuantity(quantity: number, branchIndex: number) {
  if (quantity <= 0) return 0;
  return Math.max(1, Math.round(quantity * (STOCK_FACTORS[branchIndex] ?? 1)));
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function categoryIdFor(locationId: string, name: string) {
  return `cat-${locationId}-${slug(name)}`;
}

function itemIdFor(locationId: string, code: string) {
  return `item-${locationId}-${slug(code)}`;
}

function expiryDate(value?: string) {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

async function ensureCategory(prisma: PrismaLike, locationId: string, name: string) {
  return prisma.category.upsert({
    where: { locationId_name: { locationId, name } },
    update: { isActive: true },
    create: {
      id: categoryIdFor(locationId, name),
      locationId,
      name,
      isActive: true,
    },
  });
}

async function ensureUnit(prisma: PrismaLike, locationId: string, unit: CatalogItem["unit"]) {
  const spec = PHARMACY_UNITS.find((entry) => entry.name === (unit || "Piece")) || PHARMACY_UNITS.find((entry) => entry.key === "pcs")!;

  const existing = await prisma.unit.findFirst({
    where: { locationId, name: spec.name },
  });
  if (existing) return existing;

  return prisma.unit.upsert({
    where: { id: `unit-${spec.key}-${locationId}` },
    update: { name: spec.name, shortName: spec.shortName, locationId },
    create: {
      id: `unit-${spec.key}-${locationId}`,
      locationId,
      name: spec.name,
      shortName: spec.shortName,
    },
  });
}

async function syncBatches(
  prisma: PrismaLike,
  itemId: string,
  locationId: string,
  batches: CatalogBatch[],
  buyingPrice: number,
  sellingPrice: number,
) {
  const soldCount = await prisma.saleItem.count({ where: { itemId } });
  if (soldCount > 0) return;

  const opening = await prisma.inventoryBatch.findFirst({
    where: { itemId, locationId, batchCode: "OPENING" },
  });
  if (opening) {
    await prisma.inventoryBatch.update({
      where: { id: opening.id },
      data: { quantityIn: 0, remainingQuantity: 0, status: "DEPLETED" },
    });
  }

  for (const batch of batches) {
    const cost = batch.buyingPrice ?? buyingPrice;
    const price = batch.sellingPrice ?? sellingPrice;
    const existing = await prisma.inventoryBatch.findFirst({
      where: { itemId, locationId, batchCode: batch.batchCode },
    });
    const data = {
      quantityIn: batch.quantity,
      remainingQuantity: batch.quantity,
      buyingPrice: cost,
      sellingPrice: price,
      expireDate: expiryDate(batch.expireDate),
      batchCode: batch.batchCode,
      status: batch.quantity > 0 ? "ACTIVE" : "DEPLETED",
      reservedQuantity: 0,
    };
    if (existing) {
      await prisma.inventoryBatch.update({ where: { id: existing.id }, data });
      continue;
    }
    await prisma.inventoryBatch.create({
      data: {
        itemId,
        locationId,
        ...data,
      },
    });
  }
}

async function seedLocationCatalog(
  prisma: PrismaLike,
  locationId: string,
  items: CatalogItem[],
) {
  const categoryIds = new Map<string, string>();
  let seeded = 0;

  for (const item of items) {
    if (!categoryIds.has(item.category)) {
      const category = await ensureCategory(prisma, locationId, item.category);
      categoryIds.set(item.category, category.id);
    }

    const unit = await ensureUnit(prisma, locationId, item.unit);
    const upserted = await prisma.item.upsert({
      where: {
        locationId_code: {
          locationId,
          code: item.code,
        },
      },
      update: {
        name: item.name,
        categoryId: categoryIds.get(item.category),
        unitId: unit.id,
        defaultBuyingPrice: item.buyingPrice,
        defaultSellingPrice: item.sellingPrice,
        lowStockAlert: item.lowStockAlert ?? 10,
        genericName: item.genericName,
        brandName: item.brandName,
        dosageForm: item.dosageForm,
        strength: item.strength,
        packSize: item.packSize,
        manufacturer: item.manufacturer,
        countryOfOrigin: item.countryOfOrigin,
        requiresPrescription: item.requiresPrescription,
        isControlled: Boolean(item.isControlled),
        isActive: true,
      },
      create: {
        id: itemIdFor(locationId, item.code),
        locationId,
        name: item.name,
        code: item.code,
        categoryId: categoryIds.get(item.category),
        unitId: unit.id,
        defaultBuyingPrice: item.buyingPrice,
        defaultSellingPrice: item.sellingPrice,
        lowStockAlert: item.lowStockAlert ?? 10,
        genericName: item.genericName,
        brandName: item.brandName,
        dosageForm: item.dosageForm,
        strength: item.strength,
        packSize: item.packSize,
        manufacturer: item.manufacturer,
        countryOfOrigin: item.countryOfOrigin,
        requiresPrescription: item.requiresPrescription,
        isControlled: Boolean(item.isControlled),
        isActive: true,
      },
    });

    await syncBatches(prisma, upserted.id, locationId, item.batches, item.buyingPrice, item.sellingPrice);
    seeded += 1;
  }

  return seeded;
}

export async function seedBusinessCatalogs(prisma: PrismaLike) {
  const counts: number[] = [];
  for (const [index, business] of BUSINESSES.entries()) {
    const items = PHARMACY_ITEMS.map((item) => ({
      ...item,
      batches: item.batches.map((batch) => ({
        ...batch,
        quantity: scaleQuantity(batch.quantity, index),
      })),
    }));
    counts.push(await seedLocationCatalog(prisma, business.id, items));
  }

  const batchCount = PHARMACY_ITEMS.reduce((sum, item) => sum + item.batches.length, 0);
  console.log(
    `Catalog seeded: ${counts.join(", ")} medicines (${PHARMACY_ITEMS.length} items, ${batchCount} batches each) across ${BUSINESSES.map((business) => business.name).join(", ")}.`,
  );
}

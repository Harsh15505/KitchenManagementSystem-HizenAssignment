import { calendarDate, hhmmToMinutes, toDbDate } from '@fernleaf/shared';
import type { PrismaClient } from '../../src/generated/prisma/client';

/**
 * Client companies and ~60 employees from vault/08 Knowledge/Demo Data Plan.md (T-407).
 * Create-if-missing only: re-seeding never overwrites admin edits. Domains use the reserved
 * `.example` TLD so no real company is impersonated.
 */

interface CompanySeed {
  name: string;
  domains: string[];
  tier: string | null;
  workingDays: number[];
  time: string;
  lead: number;
  driverEmail: string;
  packaging: string;
  instructions: string;
  billing: { name: string; email: string; phone: string; address: string };
  addresses: Array<{
    label: string;
    line1: string;
    line2: string;
    city: string;
    postalCode: string;
    accessNotes: string;
  }>;
  holidays: Array<{ date: string; name: string }>;
  hideCategories: string[];
  hideItems: Array<{ category: string; sku: string }>;
  employees: number;
}

const COMPANIES: CompanySeed[] = [
  {
    name: 'Lumen Labs',
    domains: ['lumenlabs.example'],
    tier: 'Enterprise',
    workingDays: [1, 2, 3, 4, 5],
    time: '12:30',
    lead: 60,
    driverEmail: 'driver@test.com',
    packaging: 'Compostable Box',
    instructions: 'Reception on 3F, ask for the pantry lead.',
    billing: {
      name: 'Kiran Desai',
      email: 'accounts@lumenlabs.example',
      phone: '+91 80 4123 5500',
      address: 'Lumen Labs Pvt Ltd, 14 Residency Road, Bengaluru 560025',
    },
    addresses: [
      {
        label: 'HQ · 3rd floor reception',
        line1: '14 Residency Road',
        line2: '3rd floor',
        city: 'Bengaluru',
        postalCode: '560025',
        accessNotes: 'Visitor badge at the lobby desk',
      },
      {
        label: 'Annex · ground floor',
        line1: '9 Museum Road',
        line2: 'Ground floor',
        city: 'Bengaluru',
        postalCode: '560001',
        accessNotes: 'Loading bay at the back',
      },
    ],
    holidays: [{ date: '2026-10-20', name: 'Dussehra' }],
    hideCategories: ['desserts'],
    hideItems: [],
    employees: 14,
  },
  {
    name: 'Northwind Traders',
    domains: ['northwind.example', 'nwtraders.example'],
    tier: null,
    workingDays: [1, 2, 3, 4, 5],
    time: '13:00',
    lead: 45,
    driverEmail: 'imran.driver@fernleaf.example',
    packaging: 'Compostable Box',
    instructions: 'Hand over to security at gate 2; they call the office manager.',
    billing: {
      name: 'Sameer Joshi',
      email: 'finance@northwind.example',
      phone: '+91 22 6612 0400',
      address: 'Northwind Traders LLP, Lower Parel, Mumbai 400013',
    },
    addresses: [
      {
        label: 'Main office · 7th floor',
        line1: 'Peninsula Business Park, Tower B',
        line2: '7th floor',
        city: 'Mumbai',
        postalCode: '400013',
        accessNotes: 'Gate 2 only after 11:00',
      },
    ],
    holidays: [{ date: '2026-10-09', name: 'Company offsite' }],
    hideCategories: [],
    hideItems: [],
    employees: 12,
  },
  {
    name: 'Kestrel Fintech',
    domains: ['kestrel.example'],
    tier: 'Partner',
    workingDays: [2, 3, 4],
    time: '12:45',
    lead: 60,
    driverEmail: 'deepa.driver@fernleaf.example',
    packaging: 'Bento Box',
    instructions: 'Hybrid office: in-person Tue to Thu only. Pantry on 5F.',
    billing: {
      name: 'Leela Krishnan',
      email: 'ap@kestrel.example',
      phone: '+91 44 4290 7788',
      address: 'Kestrel Fintech, Guindy, Chennai 600032',
    },
    addresses: [
      {
        label: 'Guindy campus · 5F pantry',
        line1: '21 Mount Road',
        line2: '5th floor',
        city: 'Chennai',
        postalCode: '600032',
        accessNotes: 'Service lift on the left',
      },
    ],
    holidays: [],
    hideCategories: [],
    hideItems: [{ category: 'beverages', sku: 'FL-BEV-002' }],
    employees: 11,
  },
  {
    name: 'Orbit Health',
    domains: ['orbithealth.example'],
    tier: 'Standard',
    workingDays: [1, 2, 3, 4, 5, 6, 7],
    time: '08:30',
    lead: 60,
    driverEmail: 'driver@test.com',
    packaging: 'Insulated Bag',
    instructions: 'Hospital: use the staff entrance, not the emergency bay.',
    billing: {
      name: 'Dr. Nandini Rao',
      email: 'purchase@orbithealth.example',
      phone: '+91 40 2355 1100',
      address: 'Orbit Health Hospital, Banjara Hills, Hyderabad 500034',
    },
    addresses: [
      {
        label: 'Staff canteen · B1',
        line1: 'Road No. 12, Banjara Hills',
        line2: 'Basement 1',
        city: 'Hyderabad',
        postalCode: '500034',
        accessNotes: 'Staff entrance on the east side',
      },
      {
        label: 'Nurses station · 4F',
        line1: 'Road No. 12, Banjara Hills',
        line2: '4th floor, Ward C',
        city: 'Hyderabad',
        postalCode: '500034',
        accessNotes: 'Ask for the duty sister',
      },
    ],
    holidays: [],
    hideCategories: [],
    hideItems: [],
    employees: 13,
  },
  {
    name: 'Saffron Studio',
    domains: ['saffronstudio.example'],
    tier: 'Startup',
    workingDays: [1, 2, 3, 4, 5, 6, 7],
    time: '19:30',
    lead: 90,
    driverEmail: 'driver@test.com',
    packaging: 'Compostable Box',
    instructions: '24×7 support centre; night shift lead signs for the delivery.',
    billing: {
      name: 'Aditya Bose',
      email: 'billing@saffronstudio.example',
      phone: '+91 33 4006 9090',
      address: 'Saffron Studio, Salt Lake Sector V, Kolkata 700091',
    },
    addresses: [
      {
        label: 'Support floor · 2nd',
        line1: 'Block GP, Sector V, Salt Lake',
        line2: '2nd floor',
        city: 'Kolkata',
        postalCode: '700091',
        accessNotes: 'Ring the night bell after 21:00',
      },
    ],
    holidays: [],
    hideCategories: [],
    hideItems: [],
    employees: 10,
  },
];

const FIRST = [
  'Priya',
  'Arjun',
  'Kavya',
  'Rohan',
  'Ananya',
  'Farhan',
  'Meera',
  'Siddharth',
  'Ishita',
  'Vivek',
  'Neha',
  'Aditya',
  'Pooja',
  'Karthik',
  'Sneha',
  'Rahul',
  'Divya',
  'Nikhil',
  'Aisha',
  'Varun',
  'Shreya',
  'Manish',
  'Tanvi',
  'Harsh',
  'Lakshmi',
  'Gaurav',
  'Riya',
  'Abhishek',
  'Zoya',
  'Pranav',
];
const LAST = [
  'Sharma',
  'Mehta',
  'Iyer',
  'Gupta',
  'Reddy',
  'Ali',
  'Pillai',
  'Banerjee',
  'Nair',
  'Kulkarni',
  'Chopra',
  'Rao',
  'Singh',
  'Menon',
  'Patel',
  'Bhat',
  'Das',
  'Joshi',
  'Khan',
  'Verma',
];

/** Deterministic pseudo-random in [0, 1) so the seed is stable across runs. */
function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export async function seedCompanies(prisma: PrismaClient): Promise<void> {
  const [tiers, packaging, drivers, allergens, tags, categories] = await Promise.all([
    prisma.priceTier.findMany({ select: { id: true, name: true } }),
    prisma.packagingType.findMany({ select: { id: true, name: true } }),
    prisma.user.findMany({ select: { id: true, email: true } }),
    prisma.allergen.findMany({ select: { id: true, name: true } }),
    prisma.dietaryTag.findMany({ select: { id: true, name: true } }),
    prisma.menuCategory.findMany({
      select: {
        id: true,
        slug: true,
        items: { select: { id: true, dish: { select: { sku: true } } } },
      },
    }),
  ]);
  const byName = <T extends { name: string; id: string }>(rows: T[], name: string): string => {
    const row = rows.find((r) => r.name === name);
    if (!row) throw new Error(`Seed: missing "${name}". Run the earlier seed steps first.`);
    return row.id;
  };
  const allergyPool = ['Peanuts', 'Milk / Dairy', 'Gluten', 'Sesame'].map((n) =>
    byName(allergens, n),
  );
  const prefPool = ['Vegan', 'Jain', 'Gluten-free', 'Vegetarian', 'High-protein'].map((n) =>
    byName(tags, n),
  );

  let personIndex = 0;
  let employeeCount = 0;
  for (const c of COMPANIES) {
    const driver = drivers.find((d) => d.email === c.driverEmail);
    if (!driver) throw new Error(`Seed: driver ${c.driverEmail} missing.`);
    const primaryDomain = c.domains[0]!;

    // People for this company (the first one owns it).
    const people = Array.from({ length: c.employees }, () => {
      const i = personIndex++;
      const first = FIRST[i % FIRST.length]!;
      const last = LAST[(i * 7 + 3) % LAST.length]!;
      return {
        i,
        name: `${first} ${last}`,
        email: `${first}.${last}`.toLowerCase() + `@${c.domains[i % c.domains.length]}`,
      };
    });

    let company = await prisma.company.findUnique({
      where: { name: c.name },
      select: { id: true },
    });
    if (!company) {
      // A-29 / BR-CMP-02: company, owner, first domain and default address in one transaction.
      company = await prisma.$transaction(async (tx) => {
        const created = await tx.company.create({
          data: {
            name: c.name,
            priceTierId: c.tier ? byName(tiers, c.tier) : null,
            billingContactName: c.billing.name,
            billingEmail: c.billing.email,
            billingPhone: c.billing.phone,
            billingAddress: c.billing.address,
            workingDays: c.workingDays,
            defaultDeliveryTimeMinutes: hhmmToMinutes(c.time),
            dispatchLeadMinutes: c.lead,
            defaultPackagingTypeId: byName(packaging, c.packaging),
            driverInstructions: c.instructions,
            defaultDriverId: driver.id,
          },
          select: { id: true },
        });
        await tx.companyDomain.create({ data: { companyId: created.id, domain: primaryDomain } });
        const address = await tx.companyAddress.create({
          data: { ...c.addresses[0]!, companyId: created.id },
          select: { id: true },
        });
        const owner = people[0]!;
        const employee = await tx.employee.upsert({
          where: { email: owner.email },
          update: {},
          create: {
            companyId: created.id,
            name: owner.name,
            email: owner.email,
            phone: `+91 98${String(10000000 + owner.i * 7919).slice(0, 8)}`,
          },
          select: { id: true },
        });
        await tx.company.update({
          where: { id: created.id },
          data: { ownerEmployeeId: employee.id, defaultAddressId: address.id },
        });
        return created;
      });
    }
    const companyId = company.id;

    for (const domain of c.domains)
      await prisma.companyDomain.upsert({
        where: { domain },
        update: {},
        create: { companyId, domain },
      });
    for (const address of c.addresses)
      await prisma.companyAddress.upsert({
        where: { companyId_label: { companyId, label: address.label } },
        update: {},
        create: { ...address, companyId },
      });
    for (const h of c.holidays)
      await prisma.companyHoliday.upsert({
        where: { companyId_date: { companyId, date: toDbDate(calendarDate(h.date)) } },
        update: {},
        create: { companyId, name: h.name, date: toDbDate(calendarDate(h.date)) },
      });
    await prisma.companyHiddenCategory.createMany({
      data: c.hideCategories.map((slug) => ({
        companyId,
        categoryId: categories.find((x) => x.slug === slug)!.id,
      })),
      skipDuplicates: true,
    });
    await prisma.companyHiddenMenuItem.createMany({
      data: c.hideItems.map(({ category, sku }) => ({
        companyId,
        menuItemId: categories
          .find((x) => x.slug === category)!
          .items.find((it) => it.dish.sku === sku)!.id,
      })),
      skipDuplicates: true,
    });

    for (const [n, p] of people.entries()) {
      const r = (k: number) => rand(p.i * 31 + k);
      const allergies = r(1) < 0.25 ? [allergyPool[Math.floor(r(2) * allergyPool.length)]!] : [];
      const prefs = r(3) < 0.35 ? [prefPool[Math.floor(r(4) * prefPool.length)]!] : [];
      await prisma.employee.upsert({
        where: { email: p.email },
        update: {},
        create: {
          companyId,
          name: p.name,
          email: p.email,
          phone: `+91 98${String(10000000 + p.i * 7919).slice(0, 8)}`,
          canChooseAddress: c.addresses.length > 1 && r(5) < 0.3,
          canChangeDeliveryTime: r(6) < 0.2,
          canChangePackaging: r(7) < 0.25,
          // One inactive employee per company (never the owner).
          isActive: n !== people.length - 1,
          allergies: { create: allergies.map((allergenId) => ({ allergenId })) },
          dietaryPreferences: { create: prefs.map((dietaryTagId) => ({ dietaryTagId })) },
        },
      });
      employeeCount++;
    }
  }
  console.log(`  ${COMPANIES.length} companies, ${employeeCount} employees`);
}

import type { PrismaClient } from '../../src/generated/prisma/client';

/** Reference lists from vault/08 Knowledge/Demo Data Plan.md. Upsert by name; never deletes. */
const ALLERGENS = [
  'Milk / Dairy',
  'Gluten',
  'Peanuts',
  'Tree nuts',
  'Soy',
  'Sesame',
  'Mustard',
  'Egg',
  'Shellfish',
  'Fish',
];
const DIETARY_TAGS = ['Vegetarian', 'Vegan', 'Jain', 'Gluten-free', 'Dairy-free', 'High-protein'];
const STATIONS = ['Tandoor', 'Curry & Dal', 'Grill', 'Cold Kitchen', 'Pastry', 'Beverages'];
const PORTION_SIZES = ['Regular', 'Large'];
const PACKAGING: ReadonlyArray<[string, string]> = [
  ['Compostable Box', 'Bagasse box, the default for most meals'],
  ['Insulated Bag', 'Keeps hot meals hot on longer routes'],
  ['Bento Box', 'Compartment box for thalis and combos'],
  ['Bulk Crate', 'Reusable crate for large office drops'],
];

/** BR-CMP-01: companies can never claim these as their email domain. */
const PUBLIC_EMAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'yandex.com',
  'mail.com',
  'gmx.com',
  'rediffmail.com',
];

export async function seedReference(prisma: PrismaClient): Promise<void> {
  const simpleLists = [
    [prisma.allergen, ALLERGENS],
    [prisma.dietaryTag, DIETARY_TAGS],
    [prisma.kitchenStation, STATIONS],
    [prisma.portionSize, PORTION_SIZES],
  ] as const;

  for (const [delegate, names] of simpleLists) {
    for (const [sortOrder, name] of names.entries()) {
      // Each delegate has the same upsert shape; the cast keeps one loop for four tables.
      await (delegate as unknown as { upsert(args: object): Promise<unknown> }).upsert({
        where: { name },
        update: {},
        create: { name, sortOrder },
      });
    }
  }
  for (const [sortOrder, [name, description]] of PACKAGING.entries()) {
    await prisma.packagingType.upsert({
      where: { name },
      update: {},
      create: { name, description, sortOrder },
    });
  }
  for (const domain of PUBLIC_EMAIL_DOMAINS) {
    await prisma.publicEmailDomain.upsert({ where: { domain }, update: {}, create: { domain } });
  }
  console.log('  reference lists + public email domains');
}

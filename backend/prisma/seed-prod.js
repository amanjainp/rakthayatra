const { PrismaClient, UserStatus, BloodGroup, InventoryStatus, CampStatus } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed-Prod] Starting idempotent production database initialization...');

  // 1. Seed Roles
  const roles = [
    { name: 'ADMIN', permissions: ['*'] },
    { name: 'DONOR', permissions: ['read:profile', 'write:profile', 'read:notifications'] },
    { name: 'PATIENT', permissions: ['read:profile', 'write:profile', 'write:request', 'read:requests'] },
    { name: 'HOSPITAL', permissions: ['read:profile', 'write:request', 'read:requests', 'read:inventory'] },
    { name: 'BLOOD_BANK', permissions: ['read:profile', 'write:inventory', 'read:inventory', 'read:requests'] },
  ];

  const roleMap = {};

  for (const roleDef of roles) {
    let role = await prisma.role.findFirst({
      where: { name: roleDef.name },
    });

    if (!role) {
      role = await prisma.role.create({
        data: {
          name: roleDef.name,
          permissions: roleDef.permissions,
        },
      });
      console.log(`[Seed-Prod] Created role: ${role.name}`);
    } else {
      console.log(`[Seed-Prod] Existing role verified: ${role.name}`);
    }
    roleMap[role.name] = role.id;
  }

  const salt = await bcrypt.genSalt(10);

  // 2. Seed Default Admin User
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@lifelink.org' },
  });

  if (!existingAdmin) {
    const adminPasswordHash = await bcrypt.hash('Admin@1234', salt);
    await prisma.user.create({
      data: {
        email: 'admin@lifelink.org',
        passwordHash: adminPasswordHash,
        roleId: roleMap['ADMIN'],
        status: UserStatus ? UserStatus.ACTIVE : 'ACTIVE',
      },
    });
    console.log('[Seed-Prod] Created default Admin (admin@lifelink.org / Admin@1234)');
  } else {
    console.log('[Seed-Prod] Default Admin already exists.');
  }

  // 3. Seed Sample Blood Bank
  let bankProfileId = null;
  const existingBank = await prisma.user.findUnique({
    where: { email: 'citybank@lifelink.org' },
    include: { bloodBankProfile: true },
  });

  if (!existingBank) {
    const bankPasswordHash = await bcrypt.hash('Bank@1234', salt);
    const bankUser = await prisma.user.create({
      data: {
        email: 'citybank@lifelink.org',
        passwordHash: bankPasswordHash,
        roleId: roleMap['BLOOD_BANK'],
        status: UserStatus ? UserStatus.ACTIVE : 'ACTIVE',
      },
    });

    const bankProfile = await prisma.bloodBankProfile.create({
      data: {
        userId: bankUser.id,
        name: 'City Central Blood Bank',
        licenseNumber: 'BB-12345-KAR',
        phone: '+919988776655',
        address: 'Vyalikaval, Bengaluru',
        city: 'Bengaluru',
        latitude: 12.9998,
        longitude: 77.5721,
        isVerified: true,
      },
    });
    bankProfileId = bankProfile.id;
    console.log('[Seed-Prod] Created sample Blood Bank (citybank@lifelink.org / Bank@1234)');
  } else {
    bankProfileId = existingBank.bloodBankProfile ? existingBank.bloodBankProfile.id : null;
    console.log('[Seed-Prod] Sample Blood Bank already exists.');
  }

  // 4. Seed Sample Hospital
  const existingHospital = await prisma.user.findUnique({
    where: { email: 'apollo@lifelink.org' },
  });

  if (!existingHospital) {
    const hospitalPasswordHash = await bcrypt.hash('Hosp@1234', salt);
    const hospUser = await prisma.user.create({
      data: {
        email: 'apollo@lifelink.org',
        passwordHash: hospitalPasswordHash,
        roleId: roleMap['HOSPITAL'],
        status: UserStatus ? UserStatus.ACTIVE : 'ACTIVE',
      },
    });

    await prisma.hospitalProfile.create({
      data: {
        userId: hospUser.id,
        name: 'Apollo Hospital Specialities',
        licenseNumber: 'HOSP-99887-KAR',
        phone: '+918877665544',
        address: 'Bannerghatta Road, Bengaluru',
        city: 'Bengaluru',
        latitude: 12.8962,
        longitude: 77.5991,
        isVerified: true,
      },
    });
    console.log('[Seed-Prod] Created sample Hospital (apollo@lifelink.org / Hosp@1234)');
  } else {
    console.log('[Seed-Prod] Sample Hospital already exists.');
  }

  // 5. Seed Sample Donor
  const existingDonor = await prisma.user.findUnique({
    where: { email: 'aman.jain@donor.org' },
    include: { donorProfile: true },
  });

  if (!existingDonor) {
    const donorPasswordHash = await bcrypt.hash('Donor@1234', salt);
    const donorUser = await prisma.user.create({
      data: {
        email: 'aman.jain@donor.org',
        passwordHash: donorPasswordHash,
        roleId: roleMap['DONOR'],
        status: UserStatus ? UserStatus.ACTIVE : 'ACTIVE',
      },
    });

    const donorProfile = await prisma.donorProfile.create({
      data: {
        userId: donorUser.id,
        fullName: 'Aman Jain P',
        gender: 'Male',
        dob: new Date('2005-06-15'),
        phone: '+919876543210',
        bloodGroup: BloodGroup ? BloodGroup.O_NEG : 'O_NEG',
        address: 'Yeshwanthpur, Bengaluru',
        latitude: 13.0235,
        longitude: 77.5468,
        isAvailable: true,
        consentGiven: true,
        consentDate: new Date(),
      },
    });

    await prisma.medicalEligibility.create({
      data: {
        donorProfileId: donorProfile.id,
        isEligible: true,
        answers: JSON.stringify({
          weightOk: true,
          noRecentTattoo: true,
          noChronicDisease: true,
          ageOk: true,
        }),
      },
    });
    console.log('[Seed-Prod] Created sample Donor (aman.jain@donor.org / Donor@1234)');
  } else {
    console.log('[Seed-Prod] Sample Donor already exists.');
  }

  // 6. Seed Real-world Donation Camps
  const camps = [
    {
      name: 'CurePlus Blood Centre Donation Camp',
      organizer: 'CurePlus Blood Centre',
      address: 'ARC Sportzone, Hebbal Industrial Area, Mysuru',
      city: 'Mysuru',
      latitude: 12.355,
      longitude: 76.62,
      startDate: new Date('2026-08-16T09:00:00Z'),
      endDate: new Date('2026-08-18T18:00:00Z'),
      status: CampStatus ? CampStatus.UPCOMING : 'UPCOMING',
      externalRegistrationUrl: 'https://cureplusbloodbank.com/',
    },
    {
      name: 'Juhar Parivar Independence Drive',
      organizer: 'Juhar Parivar & Kauvery Hospital',
      address: 'Kauvery Hospital, Electronic City, Bengaluru',
      city: 'Bengaluru',
      latitude: 12.8465,
      longitude: 77.6625,
      startDate: new Date('2026-08-17T09:00:00Z'),
      endDate: new Date('2026-08-19T18:00:00Z'),
      status: CampStatus ? CampStatus.UPCOMING : 'UPCOMING',
      externalRegistrationUrl: 'https://www.kauveryhospital.com/',
    },
  ];

  for (const camp of camps) {
    const existing = await prisma.donationCamp.findFirst({
      where: { name: camp.name },
    });
    if (!existing) {
      await prisma.donationCamp.create({ data: camp });
      console.log(`[Seed-Prod] Created camp: ${camp.name}`);
    } else {
      if (existing.externalRegistrationUrl !== camp.externalRegistrationUrl) {
        await prisma.donationCamp.update({
          where: { id: existing.id },
          data: { externalRegistrationUrl: camp.externalRegistrationUrl },
        });
      }
      console.log(`[Seed-Prod] Camp verified: ${camp.name}`);
    }
  }

  // 7. Seed Sample Inventory if empty
  if (bankProfileId) {
    const inventoryCount = await prisma.bloodInventory.count({
      where: { bloodBankId: bankProfileId },
    });

    if (inventoryCount === 0) {
      await prisma.bloodInventory.createMany({
        data: [
          {
            bloodBankId: bankProfileId,
            bloodGroup: BloodGroup ? BloodGroup.O_NEG : 'O_NEG',
            unitsCount: 15,
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: InventoryStatus ? InventoryStatus.AVAILABLE : 'AVAILABLE',
          },
          {
            bloodBankId: bankProfileId,
            bloodGroup: BloodGroup ? BloodGroup.A_POS : 'A_POS',
            unitsCount: 22,
            expiryDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
            status: InventoryStatus ? InventoryStatus.AVAILABLE : 'AVAILABLE',
          },
        ],
      });
      console.log('[Seed-Prod] Seeded initial sample blood inventory.');
    }
  }

  console.log('[Seed-Prod] Production database initialization finished successfully.');
}

main()
  .catch((e) => {
    console.error('[Seed-Prod] Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

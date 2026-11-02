const { PrismaClient, UserStatus, BloodGroup, BloodComponent, InventoryStatus, CampStatus } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed-Prod] Starting idempotent production database initialization...');

  // 1. Seed Roles
  const roles = [
    { name: 'ADMIN', permissions: ['*'] },
    { name: 'DONOR', permissions: ['read:profile', 'write:profile', 'read:notifications'] },
    { name: 'PATIENT', permissions: ['read:profile', 'write:profile', 'write:request', 'read:requests'] },
    { name: 'HOSPITAL', permissions: ['read:profile', 'write:request', 'read:requests', 'read:inventory', 'write:redistribution'] },
    { name: 'BLOOD_BANK', permissions: ['read:profile', 'write:inventory', 'read:inventory', 'read:requests', 'write:redistribution'] },
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

  // 4. Seed Sample Hospital A (Apollo Hospital)
  let apolloHospitalId = null;
  const existingHospital = await prisma.user.findUnique({
    where: { email: 'apollo@lifelink.org' },
    include: { hospitalProfile: true },
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

      const hospProfile = await prisma.hospitalProfile.create({
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
      apolloHospitalId = hospProfile.id;
      console.log('[Seed-Prod] Created sample Hospital (apollo@lifelink.org / Hosp@1234)');
    } else {
      apolloHospitalId = existingHospital.hospitalProfile ? existingHospital.hospitalProfile.id : null;
      console.log('[Seed-Prod] Sample Hospital already exists.');
    }

  // 4B. Seed Partner Hospital B (Manipal Hospital) for Hospital-to-Hospital Redistribution
  let manipalHospitalId = null;
    const existingManipal = await prisma.user.findUnique({
      where: { email: 'manipal@lifelink.org' },
      include: { hospitalProfile: true },
    });

    if (!existingManipal) {
      const manipalPasswordHash = await bcrypt.hash('Hosp@1234', salt);
      const manipalUser = await prisma.user.create({
        data: {
          email: 'manipal@lifelink.org',
          passwordHash: manipalPasswordHash,
          roleId: roleMap['HOSPITAL'],
          status: UserStatus ? UserStatus.ACTIVE : 'ACTIVE',
        },
      });

      const manipalProfile = await prisma.hospitalProfile.create({
        data: {
          userId: manipalUser.id,
          name: 'Manipal Hospital Regional Center',
          licenseNumber: 'HOSP-44321-KAR',
          phone: '+918025024444',
          address: 'Old Airport Road, Bengaluru',
          city: 'Bengaluru',
          latitude: 12.9583,
          longitude: 77.6489,
          isVerified: true,
        },
      });
      manipalHospitalId = manipalProfile.id;
      console.log('[Seed-Prod] Created partner Hospital (manipal@lifelink.org / Hosp@1234)');
    } else {
      manipalHospitalId = existingManipal.hospitalProfile ? existingManipal.hospitalProfile.id : null;
      console.log('[Seed-Prod] Partner Hospital already exists.');
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

    // 6. Seed Real-world Donation Camps (only if empty, with valid upcoming schedule)
    const existingCampCount = await prisma.donationCamp.count();
    if (existingCampCount === 0) {
      const authenticCamp = {
        name: 'Red Cross Voluntary Blood Donation Drive',
        organizer: 'Indian Red Cross Society & City Central Blood Bank',
        address: 'Town Hall Grounds, JC Road',
        city: 'Bengaluru',
        latitude: 12.9634,
        longitude: 77.5855,
        startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        status: CampStatus ? CampStatus.UPCOMING : 'UPCOMING',
        externalRegistrationUrl: 'https://eraktkosh.mohfw.in/BLDAHIMS/bloodbank/campSchedule.cnt',
      };
      await prisma.donationCamp.create({ data: authenticCamp });
      console.log(`[Seed-Prod] Provisioned verified upcoming camp: ${authenticCamp.name}`);
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
              componentType: BloodComponent ? BloodComponent.WHOLE_BLOOD : 'WHOLE_BLOOD',
              unitsCount: 15,
              expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              batchNumber: 'LOT-BB-ONEG-01',
              storageTemp: '2°C to 6°C',
              status: InventoryStatus ? InventoryStatus.AVAILABLE : 'AVAILABLE',
            },
            {
              bloodBankId: bankProfileId,
              bloodGroup: BloodGroup ? BloodGroup.A_POS : 'A_POS',
              componentType: BloodComponent ? BloodComponent.PACKED_RBC : 'PACKED_RBC',
              unitsCount: 22,
              expiryDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
              batchNumber: 'LOT-BB-APOS-02',
              storageTemp: '2°C to 6°C',
              status: InventoryStatus ? InventoryStatus.AVAILABLE : 'AVAILABLE',
            },
          ],
        });
        console.log('[Seed-Prod] Seeded initial sample blood bank inventory.');
      }
    }

    if (manipalHospitalId) {
      const hospInvCount = await prisma.bloodInventory.count({
        where: { hospitalId: manipalHospitalId },
      });
      if (hospInvCount === 0) {
        await prisma.bloodInventory.createMany({
          data: [
            {
              hospitalId: manipalHospitalId,
              bloodGroup: BloodGroup ? BloodGroup.O_NEG : 'O_NEG',
              componentType: BloodComponent ? BloodComponent.WHOLE_BLOOD : 'WHOLE_BLOOD',
              unitsCount: 8,
              expiryDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
              batchNumber: 'LOT-MNP-ONEG-101',
              storageTemp: '2°C to 6°C',
              status: InventoryStatus ? InventoryStatus.AVAILABLE : 'AVAILABLE',
            },
            {
              hospitalId: manipalHospitalId,
              bloodGroup: BloodGroup ? BloodGroup.O_NEG : 'O_NEG',
              componentType: BloodComponent ? BloodComponent.PACKED_RBC : 'PACKED_RBC',
              unitsCount: 10,
              expiryDate: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000),
              batchNumber: 'LOT-MNP-ONEG-102',
              storageTemp: '2°C to 6°C',
              status: InventoryStatus ? InventoryStatus.AVAILABLE : 'AVAILABLE',
            },
            {
              hospitalId: manipalHospitalId,
              bloodGroup: BloodGroup ? BloodGroup.AB_POS : 'AB_POS',
              componentType: BloodComponent ? BloodComponent.PLASMA : 'PLASMA',
              unitsCount: 12,
              expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
              batchNumber: 'LOT-MNP-FFP-201',
              storageTemp: '≤ -18°C to -30°C',
              status: InventoryStatus ? InventoryStatus.AVAILABLE : 'AVAILABLE',
            },
          ],
        });
        console.log('[Seed-Prod] Seeded initial hospital redistribution inventory for Manipal Hospital.');
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

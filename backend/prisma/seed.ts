import { PrismaClient, UserStatus, BloodGroup, InventoryStatus, CampStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing database tables...');
  
  // Clear tables in dependency order
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.donation.deleteMany({});
  await prisma.bloodInventory.deleteMany({});
  await prisma.bloodRequest.deleteMany({});
  await prisma.medicalEligibility.deleteMany({});
  await prisma.donorProfile.deleteMany({});
  await prisma.hospitalProfile.deleteMany({});
  await prisma.bloodBankProfile.deleteMany({});
  await prisma.donationCamp.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.role.deleteMany({});

  console.log('Seeding default roles...');
  
  const adminRole = await prisma.role.create({
    data: {
      name: 'ADMIN',
      permissions: ['*'],
    },
  });

  const donorRole = await prisma.role.create({
    data: {
      name: 'DONOR',
      permissions: ['read:profile', 'write:profile', 'read:notifications'],
    },
  });

  const patientRole = await prisma.role.create({
    data: {
      name: 'PATIENT',
      permissions: ['read:profile', 'write:profile', 'write:request', 'read:requests'],
    },
  });

  const hospitalRole = await prisma.role.create({
    data: {
      name: 'HOSPITAL',
      permissions: ['read:profile', 'write:request', 'read:requests', 'read:inventory'],
    },
  });

  const bloodBankRole = await prisma.role.create({
    data: {
      name: 'BLOOD_BANK',
      permissions: ['read:profile', 'write:inventory', 'read:inventory', 'read:requests'],
    },
  });

  console.log('Seeding administrative users...');
  
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Admin@1234', salt);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@lifelink.org',
      passwordHash,
      roleId: adminRole.id,
      status: UserStatus.ACTIVE,
    },
  });

  console.log('Seeding sample blood banks...');
  const bloodBankPasswordHash = await bcrypt.hash('Bank@1234', salt);

  const bankUser1 = await prisma.user.create({
    data: {
      email: 'citybank@lifelink.org',
      passwordHash: bloodBankPasswordHash,
      roleId: bloodBankRole.id,
      status: UserStatus.ACTIVE,
    },
  });

  const bankProfile1 = await prisma.bloodBankProfile.create({
    data: {
      userId: bankUser1.id,
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

  console.log('Seeding sample hospitals...');
  const hospitalPasswordHash = await bcrypt.hash('Hosp@1234', salt);

  const hospUser1 = await prisma.user.create({
    data: {
      email: 'apollo@lifelink.org',
      passwordHash: hospitalPasswordHash,
      roleId: hospitalRole.id,
      status: UserStatus.ACTIVE,
    },
  });

  const hospProfile1 = await prisma.hospitalProfile.create({
    data: {
      userId: hospUser1.id,
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

  console.log('Seeding donation camps...');
  const camp1 = await prisma.donationCamp.create({
    data: {
      name: 'Mega Voluntary Blood Donation Camp',
      organizer: 'Red Cross Society & LifeLink',
      address: 'Malleshwaram Grounds, Bengaluru',
      city: 'Bengaluru',
      latitude: 13.0031,
      longitude: 77.5694,
      startDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
      endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // next day
      status: CampStatus.UPCOMING,
    },
  });

  console.log('Seeding sample donors...');
  const donorPasswordHash = await bcrypt.hash('Donor@1234', salt);

  const donorUser1 = await prisma.user.create({
    data: {
      email: 'aman.jain@donor.org',
      passwordHash: donorPasswordHash,
      roleId: donorRole.id,
      status: UserStatus.ACTIVE,
    },
  });

  const donorProfile1 = await prisma.donorProfile.create({
    data: {
      userId: donorUser1.id,
      fullName: 'Aman Jain P',
      gender: 'Male',
      dob: new Date('2005-06-15'),
      phone: '+919876543210',
      bloodGroup: BloodGroup.O_NEG,
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
      donorProfileId: donorProfile1.id,
      isEligible: true,
      answers: JSON.stringify({
        weightOk: true,
        noRecentTattoo: true,
        noChronicDisease: true,
        ageOk: true,
      }),
    },
  });

  console.log('Seeding blood inventories...');
  await prisma.bloodInventory.createMany({
    data: [
      {
        bloodBankId: bankProfile1.id,
        bloodGroup: BloodGroup.O_NEG,
        unitsCount: 15,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        status: InventoryStatus.AVAILABLE,
      },
      {
        bloodBankId: bankProfile1.id,
        bloodGroup: BloodGroup.A_POS,
        unitsCount: 22,
        expiryDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        status: InventoryStatus.AVAILABLE,
      },
      {
        bloodBankId: bankProfile1.id,
        bloodGroup: BloodGroup.AB_NEG,
        unitsCount: 2,
        expiryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Expired 2 days ago
        status: InventoryStatus.EXPIRED,
      },
    ],
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

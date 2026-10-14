/**
 * Plain JS seed runner — avoids ts-node module resolution conflicts.
 * Run: node prisma/seed.js
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing database tables...');
  await prisma.auditLog.deleteMany({});
  await prisma.notificationAudit.deleteMany({}).catch(() => {});
  await prisma.notification.deleteMany({}).catch(() => {});
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

  console.log('Seeding roles...');
  const adminRole    = await prisma.role.create({ data: { name: 'ADMIN',      permissions: ['*'] } });
  const donorRole    = await prisma.role.create({ data: { name: 'DONOR',      permissions: ['read:profile','write:profile','read:notifications'] } });
  const patientRole  = await prisma.role.create({ data: { name: 'PATIENT',    permissions: ['read:profile','write:profile','write:request','read:requests'] } });
  const hospitalRole = await prisma.role.create({ data: { name: 'HOSPITAL',   permissions: ['read:profile','write:request','read:requests','read:inventory'] } });
  const bloodBankRole= await prisma.role.create({ data: { name: 'BLOOD_BANK', permissions: ['read:profile','write:inventory','read:inventory','read:requests'] } });

  const salt = await bcrypt.genSalt(10);

  console.log('Seeding admin...');
  await prisma.user.create({
    data: { email: 'admin@lifelink.org',    passwordHash: await bcrypt.hash('Admin@1234',   salt), roleId: adminRole.id,     status: 'ACTIVE' },
  });

  console.log('Seeding patient...');
  await prisma.user.create({
    data: { email: 'patient@lifelink.org',  passwordHash: await bcrypt.hash('Patient@1234', salt), roleId: patientRole.id,   status: 'ACTIVE' },
  });

  console.log('Seeding hospital...');
  const hospUser = await prisma.user.create({
    data: { email: 'apollo@lifelink.org',   passwordHash: await bcrypt.hash('Hosp@1234',   salt), roleId: hospitalRole.id,  status: 'ACTIVE' },
  });
  await prisma.hospitalProfile.create({
    data: { userId: hospUser.id, name: 'Apollo Hospital Specialities', licenseNumber: 'HOSP-99887-KAR', phone: '+918877665544',
            address: 'Bannerghatta Road, Bengaluru', city: 'Bengaluru', latitude: 12.8962, longitude: 77.5991, isVerified: true },
  });

  console.log('Seeding blood bank...');
  const bankUser = await prisma.user.create({
    data: { email: 'citybank@lifelink.org', passwordHash: await bcrypt.hash('Bank@1234',   salt), roleId: bloodBankRole.id, status: 'ACTIVE' },
  });
  const bankProfile = await prisma.bloodBankProfile.create({
    data: { userId: bankUser.id, name: 'City Central Blood Bank', licenseNumber: 'BB-12345-KAR', phone: '+919988776655',
            address: 'Vyalikaval, Bengaluru', city: 'Bengaluru', latitude: 12.9998, longitude: 77.5721, isVerified: true },
  });

  console.log('Seeding donor...');
  const donorUser = await prisma.user.create({
    data: { email: 'aman.jain@donor.org',   passwordHash: await bcrypt.hash('Donor@1234',  salt), roleId: donorRole.id,     status: 'ACTIVE' },
  });
  const donorProfile = await prisma.donorProfile.create({
    data: { userId: donorUser.id, fullName: 'Aman Jain P', gender: 'Male', dob: new Date('2005-06-15'),
            phone: '+919876543210', bloodGroup: 'O_NEG', address: 'Yeshwanthpur, Bengaluru',
            latitude: 13.0235, longitude: 77.5468, isAvailable: true, consentGiven: true, consentDate: new Date() },
  });
  await prisma.medicalEligibility.create({
    data: { donorProfileId: donorProfile.id, isEligible: true,
            answers: JSON.stringify({ weightOk: true, noRecentTattoo: true, noChronicDisease: true, ageOk: true }) },
  });

  console.log('Seeding donation camp...');
  await prisma.donationCamp.create({
    data: { name: 'Mega Voluntary Blood Donation Camp', organizer: 'Red Cross Society & LifeLink',
            address: 'Malleshwaram Grounds, Bengaluru', city: 'Bengaluru', latitude: 13.0031, longitude: 77.5694,
            startDate: new Date(Date.now() + 86400000), endDate: new Date(Date.now() + 172800000), status: 'UPCOMING' },
  });

  console.log('Seeding blood inventory...');
  await prisma.bloodInventory.createMany({
    data: [
      { bloodBankId: bankProfile.id, bloodGroup: 'O_NEG', unitsCount: 15,
        expiryDate: new Date(Date.now() + 30*86400000), status: 'AVAILABLE' },
      { bloodBankId: bankProfile.id, bloodGroup: 'A_POS', unitsCount: 22,
        expiryDate: new Date(Date.now() + 25*86400000), status: 'AVAILABLE' },
    ],
  });

  console.log('Seed complete.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

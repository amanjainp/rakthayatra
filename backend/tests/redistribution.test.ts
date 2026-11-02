import { EventEmitter } from 'events';
import app from '../src/app';
import { generateAccessToken } from '../src/utils/crypto';
import { compatibilityService } from '../src/services/compatibility.service';

/**
 * In-memory Express request dispatcher that executes the full Express middleware + router + controller
 * pipeline (including JWT `authenticate`, `requireRoles`, Zod schemas, and `redistributionService`)
 * without binding a TCP socket (avoiding Windows sandbox EACCES on 127.0.0.1 loopback).
 */
function invokeApp(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', urlPath: string) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  let bodyPayload: any = {};

  const builder = {
    set(key: string, value: string) {
      headers[key.toLowerCase()] = value;
      return builder;
    },
    send(payload?: any) {
      if (payload !== undefined) {
        bodyPayload = payload;
      }
      return execute();
    },
  };

  function execute(): Promise<{ status: number; body: any; headers: Record<string, any> }> {
    return new Promise((resolve, reject) => {
      const req: any = new EventEmitter();
      req.method = method;
      req.url = urlPath;
      req.originalUrl = urlPath;
      req.headers = headers;
      req.body = bodyPayload;
      req._body = true; // Tells express.json() / body-parser that body is already parsed
      req.ip = '127.0.0.1';
      req.ips = [];
      req.connection = { remoteAddress: '127.0.0.1', encrypted: false };
      req.socket = { remoteAddress: '127.0.0.1', encrypted: false };
      req.get = (name: string) => headers[name.toLowerCase()];
      req.header = req.get;

      const resHeaders: Record<string, any> = {};
      const res: any = new EventEmitter();
      res.statusCode = 200;
      res.headersSent = false;

      res.setHeader = (name: string, val: any) => {
        resHeaders[name.toLowerCase()] = val;
      };
      res.getHeader = (name: string) => resHeaders[name.toLowerCase()];
      res.removeHeader = (name: string) => {
        delete resHeaders[name.toLowerCase()];
      };
      res.set = (field: any, val?: any) => {
        if (typeof field === 'string') {
          res.setHeader(field, val);
        } else if (field && typeof field === 'object') {
          for (const [k, v] of Object.entries(field)) {
            res.setHeader(k, v);
          }
        }
        return res;
      };
      res.header = res.set;
      res.status = (code: number) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data: any) => {
        res.headersSent = true;
        resolve({ status: res.statusCode, body: data, headers: resHeaders });
        return res;
      };
      res.send = (data: any) => {
        res.headersSent = true;
        let parsed = data;
        if (typeof data === 'string') {
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
        }
        resolve({ status: res.statusCode, body: parsed, headers: resHeaders });
        return res;
      };
      res.end = (chunk?: any) => {
        res.headersSent = true;
        resolve({ status: res.statusCode, body: chunk, headers: resHeaders });
        return res;
      };

      try {
        (app as any).handle(req, res, (err: any) => {
          if (err) {
            reject(err);
          } else if (!res.headersSent) {
            resolve({ status: res.statusCode, body: undefined, headers: resHeaders });
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  return builder;
}

const apiClient = {
  get: (urlPath: string) => invokeApp('GET', urlPath),
  post: (urlPath: string) => invokeApp('POST', urlPath),
};

// In-memory state store for realistic end-to-end stateful testing across Prisma calls
const dbState: {
  hospitals: any[];
  bloodBanks: any[];
  inventory: any[];
  requests: any[];
  proposals: any[];
  transfers: any[];
  allocations: any[];
  events: any[];
  notifications: any[];
  auditLogs: any[];
  simulateConcurrencyConflict: boolean;
} = {
  hospitals: [],
  bloodBanks: [],
  inventory: [],
  requests: [],
  proposals: [],
  transfers: [],
  allocations: [],
  events: [],
  notifications: [],
  auditLogs: [],
  simulateConcurrencyConflict: false,
};

function matchWhere(item: any, where: any): boolean {
  if (!where) return true;
  for (const [key, val] of Object.entries(where)) {
    if (key === 'OR' && Array.isArray(val)) {
      if (!val.some((sub) => matchWhere(item, sub))) return false;
      continue;
    }
    if (key === 'AND' && Array.isArray(val)) {
      if (!val.every((sub) => matchWhere(item, sub))) return false;
      continue;
    }
    if (key === 'request' && val && typeof val === 'object') {
      const reqItem = dbState.requests.find((r) => r.id === item.requestId);
      if (!reqItem || !matchWhere(reqItem, val)) return false;
      continue;
    }
    if (val === undefined) continue;
    if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
      const cond = val as any;
      if ('not' in cond) {
        if (item[key] === cond.not) return false;
        continue;
      }
      if ('in' in cond && Array.isArray(cond.in)) {
        if (!cond.in.includes(item[key])) return false;
        continue;
      }
      if ('notIn' in cond && Array.isArray(cond.notIn)) {
        if (cond.notIn.includes(item[key])) return false;
        continue;
      }
      if ('gt' in cond) {
        if (!(new Date(item[key]).getTime() > new Date(cond.gt).getTime())) return false;
        continue;
      }
      if ('gte' in cond) {
        if (!(new Date(item[key]).getTime() >= new Date(cond.gte).getTime())) return false;
        continue;
      }
      if ('lte' in cond) {
        if (!(new Date(item[key]).getTime() <= new Date(cond.lte).getTime())) return false;
        continue;
      }
      if ('lt' in cond) {
        if (!(new Date(item[key]).getTime() < new Date(cond.lt).getTime())) return false;
        continue;
      }
    }
    if (item[key] instanceof Date && val instanceof Date) {
      if (item[key].getTime() !== val.getTime()) return false;
      continue;
    }
    if (item[key] !== val) return false;
  }
  return true;
}

function hydrateRequest(reqObj: any) {
  if (!reqObj) return null;
  const destinationHospital = dbState.hospitals.find((h) => h.id === reqObj.destinationHospitalId) || null;
  const destinationBloodBank = dbState.bloodBanks.find((b) => b.id === reqObj.destinationBloodBankId) || null;
  const proposals = dbState.proposals
    .filter((p) => p.requestId === reqObj.id)
    .map((p) => ({
      ...p,
      sourceHospital: dbState.hospitals.find((h) => h.id === p.sourceHospitalId) || null,
      sourceBloodBank: dbState.bloodBanks.find((b) => b.id === p.sourceBloodBankId) || null,
      transfer: dbState.transfers.find((t) => t.proposalId === p.id) || null,
    }));
  const transfers = dbState.transfers
    .filter((t) => t.requestId === reqObj.id)
    .map((t) => hydrateTransfer(t));
  const events = dbState.events.filter((e) => e.requestId === reqObj.id);
  return {
    ...reqObj,
    destinationHospital,
    destinationBloodBank,
    proposals,
    transfers,
    events,
  };
}

function hydrateProposal(propObj: any) {
  if (!propObj) return null;
  const reqObj = dbState.requests.find((r) => r.id === propObj.requestId) || null;
  const trObj = dbState.transfers.find((t) => t.proposalId === propObj.id) || null;
  return {
    ...propObj,
    request: reqObj,
    transfer: trObj,
    sourceHospital: dbState.hospitals.find((h) => h.id === propObj.sourceHospitalId) || null,
    sourceBloodBank: dbState.bloodBanks.find((b) => b.id === propObj.sourceBloodBankId) || null,
  };
}

function hydrateTransfer(trObj: any) {
  if (!trObj) return null;
  const reqObj = dbState.requests.find((r) => r.id === trObj.requestId) || null;
  const propObj = dbState.proposals.find((p) => p.id === trObj.proposalId) || null;
  const allocations = dbState.allocations
    .filter((a) => a.transferId === trObj.id)
    .map((a) => ({
      ...a,
      inventory: dbState.inventory.find((inv) => inv.id === a.inventoryId) || null,
    }));
  const events = dbState.events.filter((e) => e.transferId === trObj.id);
  return {
    ...trObj,
    request: reqObj,
    proposal: propObj,
    sourceHospital: dbState.hospitals.find((h) => h.id === trObj.sourceHospitalId) || null,
    sourceBloodBank: dbState.bloodBanks.find((b) => b.id === trObj.sourceBloodBankId) || null,
    destinationHospital: dbState.hospitals.find((h) => h.id === trObj.destinationHospitalId) || null,
    destinationBloodBank: dbState.bloodBanks.find((b) => b.id === trObj.destinationBloodBankId) || null,
    allocations,
    events,
  };
}

jest.mock('@prisma/client', () => {
  const actualPrisma = jest.requireActual('@prisma/client');
  let idCounter = 100;
  const nextUuid = (prefixHex: string) =>
    `${prefixHex}-2222-4333-8444-${String(++idCounter).padStart(12, '0')}`;

  const localMockPrisma: any = {
    user: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where?.id === 'hosp-a-user') {
          return { id: 'hosp-a-user', email: 'hospital-a@lifelink.org', status: 'ACTIVE', role: { name: 'HOSPITAL' } };
        }
        if (where?.id === 'hosp-b-user') {
          return { id: 'hosp-b-user', email: 'hospital-b@lifelink.org', status: 'ACTIVE', role: { name: 'HOSPITAL' } };
        }
        return null;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where?.id === 'hosp-a-user') {
          return { id: 'hosp-a-user', email: 'hospital-a@lifelink.org', status: 'ACTIVE', role: { name: 'HOSPITAL' } };
        }
        if (where?.id === 'hosp-b-user') {
          return { id: 'hosp-b-user', email: 'hospital-b@lifelink.org', status: 'ACTIVE', role: { name: 'HOSPITAL' } };
        }
        return null;
      }),
    },
    hospitalProfile: {
      findFirst: jest.fn(async ({ where }: any) => {
        return dbState.hospitals.find((h) => matchWhere(h, where)) || null;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        return dbState.hospitals.find((h) => matchWhere(h, where)) || null;
      }),
      findMany: jest.fn(async ({ where, include }: any = {}) => {
        const list = dbState.hospitals.filter((h) => matchWhere(h, where));
        return list.map((h) => ({
          ...h,
          user: { id: h.userId, email: h.email, status: 'ACTIVE' },
          inventory: include?.inventory
            ? dbState.inventory.filter(
              (inv) => inv.hospitalId === h.id && matchWhere(inv, include.inventory.where)
            )
            : [],
        }));
      }),
    },
    bloodBankProfile: {
      findFirst: jest.fn(async ({ where }: any) => {
        return dbState.bloodBanks.find((b) => matchWhere(b, where)) || null;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        return dbState.bloodBanks.find((b) => matchWhere(b, where)) || null;
      }),
      findMany: jest.fn(async ({ where, include }: any = {}) => {
        const list = dbState.bloodBanks.filter((b) => matchWhere(b, where));
        return list.map((b) => ({
          ...b,
          user: { id: b.userId, email: b.email, status: 'ACTIVE' },
          inventory: include?.inventory
            ? dbState.inventory.filter(
              (inv) => inv.bloodBankId === b.id && matchWhere(inv, include.inventory.where)
            )
            : [],
        }));
      }),
    },
    bloodInventory: {
      findFirst: jest.fn(async ({ where }: any) => {
        return dbState.inventory.find((i) => matchWhere(i, where)) || null;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        return dbState.inventory.find((i) => matchWhere(i, where)) || null;
      }),
      findMany: jest.fn(async ({ where }: any = {}) => {
        const matches = dbState.inventory.filter((i) => matchWhere(i, where));
        return matches.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
      }),
      create: jest.fn(async ({ data }: any) => {
        const created = {
          id: data.id || nextUuid('aaaa0000'),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        dbState.inventory.push(created);
        return created;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const idx = dbState.inventory.findIndex((i) => i.id === where.id);
        if (idx === -1) throw new Error('Inventory not found');
        const current = dbState.inventory[idx];
        const nextUnits =
          data.unitsCount && typeof data.unitsCount === 'object' && 'increment' in data.unitsCount
            ? current.unitsCount + data.unitsCount.increment
            : data.unitsCount !== undefined
              ? data.unitsCount
              : current.unitsCount;
        dbState.inventory[idx] = {
          ...current,
          ...data,
          unitsCount: nextUnits,
          updatedAt: new Date(),
        };
        return dbState.inventory[idx];
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (dbState.simulateConcurrencyConflict) {
          return { count: 0 };
        }
        let count = 0;
        dbState.inventory = dbState.inventory.map((item) => {
          if (matchWhere(item, where)) {
            count++;
            return { ...item, ...data, updatedAt: new Date() };
          }
          return item;
        });
        return { count };
      }),
    },
    redistributionRequest: {
      create: jest.fn(async ({ data }: any) => {
        const created = {
          id: data.id || nextUuid('11111111'),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        dbState.requests.push(created);
        return hydrateRequest(created);
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const found = dbState.requests.find((r) => matchWhere(r, where));
        return found ? hydrateRequest(found) : null;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const found = dbState.requests.find((r) => matchWhere(r, where));
        return found ? hydrateRequest(found) : null;
      }),
      findMany: jest.fn(async ({ where }: any = {}) => {
        return dbState.requests.filter((r) => matchWhere(r, where)).map(hydrateRequest);
      }),
      count: jest.fn(async ({ where }: any = {}) => {
        return dbState.requests.filter((r) => matchWhere(r, where)).length;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const idx = dbState.requests.findIndex((r) => r.id === where.id);
        if (idx === -1) throw new Error('Request not found');
        dbState.requests[idx] = { ...dbState.requests[idx], ...data, updatedAt: new Date() };
        return hydrateRequest(dbState.requests[idx]);
      }),
    },
    redistributionProposal: {
      create: jest.fn(async ({ data }: any) => {
        const created = {
          id: data.id || nextUuid('22222222'),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        dbState.proposals.push(created);
        return hydrateProposal(created);
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const found = dbState.proposals.find((p) => matchWhere(p, where));
        return found ? hydrateProposal(found) : null;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const found = dbState.proposals.find((p) => matchWhere(p, where));
        return found ? hydrateProposal(found) : null;
      }),
      findMany: jest.fn(async ({ where }: any = {}) => {
        return dbState.proposals.filter((p) => matchWhere(p, where)).map(hydrateProposal);
      }),
      count: jest.fn(async ({ where }: any = {}) => {
        return dbState.proposals.filter((p) => matchWhere(p, where)).length;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const idx = dbState.proposals.findIndex((p) => p.id === where.id);
        if (idx === -1) throw new Error('Proposal not found');
        dbState.proposals[idx] = { ...dbState.proposals[idx], ...data, updatedAt: new Date() };
        return hydrateProposal(dbState.proposals[idx]);
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        dbState.proposals = dbState.proposals.map((p) => {
          if (matchWhere(p, where)) {
            count++;
            return { ...p, ...data, updatedAt: new Date() };
          }
          return p;
        });
        return { count };
      }),
    },
    redistributionTransfer: {
      create: jest.fn(async ({ data }: any) => {
        const created = {
          id: data.id || nextUuid('33333333'),
          unitsDispatched: null,
          unitsReceived: null,
          damagedUnits: 0,
          temperatureCheckConfirmed: false,
          conditionVerified: false,
          hasDiscrepancy: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        dbState.transfers.push(created);
        return hydrateTransfer(created);
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const found = dbState.transfers.find((t) => matchWhere(t, where));
        return found ? hydrateTransfer(found) : null;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const found = dbState.transfers.find((t) => matchWhere(t, where));
        return found ? hydrateTransfer(found) : null;
      }),
      findMany: jest.fn(async ({ where }: any = {}) => {
        return dbState.transfers.filter((t) => matchWhere(t, where)).map(hydrateTransfer);
      }),
      count: jest.fn(async ({ where }: any = {}) => {
        return dbState.transfers.filter((t) => matchWhere(t, where)).length;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const idx = dbState.transfers.findIndex((t) => t.id === where.id);
        if (idx === -1) throw new Error('Transfer not found');
        dbState.transfers[idx] = { ...dbState.transfers[idx], ...data, updatedAt: new Date() };
        return hydrateTransfer(dbState.transfers[idx]);
      }),
    },
    redistributionAllocation: {
      create: jest.fn(async ({ data }: any) => {
        const created = { id: nextUuid('44444444'), status: 'RESERVED', createdAt: new Date(), ...data };
        dbState.allocations.push(created);
        return created;
      }),
      findMany: jest.fn(async ({ where }: any = {}) => {
        return dbState.allocations.filter((a) => matchWhere(a, where));
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const idx = dbState.allocations.findIndex((a) => a.id === where.id);
        if (idx !== -1) {
          dbState.allocations[idx] = { ...dbState.allocations[idx], ...data };
          return dbState.allocations[idx];
        }
        return null;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        dbState.allocations = dbState.allocations.map((a) => {
          if (matchWhere(a, where)) {
            count++;
            return { ...a, ...data };
          }
          return a;
        });
        return { count };
      }),
    },
    redistributionEvent: {
      create: jest.fn(async ({ data }: any) => {
        const created = { id: nextUuid('55555555'), createdAt: new Date(), ...data };
        dbState.events.push(created);
        return created;
      }),
      findMany: jest.fn(async ({ where }: any = {}) => {
        return dbState.events.filter((e) => matchWhere(e, where)).map((e) => ({
          ...e,
          request: dbState.requests.find((r) => r.id === e.requestId) || null,
          transfer: dbState.transfers.find((t) => t.id === e.transferId) || null,
        }));
      }),
    },
    notification: {
      create: jest.fn(async ({ data }: any) => {
        const created = { id: nextUuid('66666666'), createdAt: new Date(), ...data };
        dbState.notifications.push(created);
        return created;
      }),
    },
    auditLog: {
      create: jest.fn(async ({ data }: any) => {
        const created = { id: nextUuid('77777777'), createdAt: new Date(), ...data };
        dbState.auditLogs.push(created);
        return created;
      }),
    },
  };

  localMockPrisma.$transaction = jest.fn(async (callback: (tx: any) => any) => {
    return callback(localMockPrisma);
  });

  return {
    ...actualPrisma,
    PrismaClient: jest.fn().mockImplementation(() => localMockPrisma),
  };
});

describe('Hospital-to-Hospital Blood Redistribution Module Tests', () => {
  let hospitalAToken: string;
  let hospitalBToken: string;
  let unverifiedHospToken: string;
  let donorToken: string;
  let patientToken: string;

  const hospitalAId = 'aaaa1111-1111-4111-8111-111111111111';
  const hospitalBId = 'bbbb2222-2222-4222-8222-222222222222';
  const unverifiedHospitalId = 'cccc3333-3333-4333-8333-333333333333';
  const bloodBankId = 'dddd4444-4444-4444-8444-444444444444';

  beforeAll(() => {
    hospitalAToken = generateAccessToken({ userId: 'hosp-a-user', role: 'HOSPITAL' });
    hospitalBToken = generateAccessToken({ userId: 'hosp-b-user', role: 'HOSPITAL' });
    unverifiedHospToken = generateAccessToken({ userId: 'unverified-hosp-user', role: 'HOSPITAL' });
    donorToken = generateAccessToken({ userId: 'donor-user', role: 'DONOR' });
    patientToken = generateAccessToken({ userId: 'patient-user', role: 'PATIENT' });
  });

  beforeEach(() => {
    dbState.hospitals = [
      {
        id: hospitalAId,
        userId: 'hosp-a-user',
        name: 'Hospital A - Apollo Care Hospital',
        licenseNumber: 'KA-HSP-2026-001',
        email: 'hospital-a@lifelink.org',
        phone: '+918044556677',
        address: '154 Bannerghatta Road',
        city: 'Bengaluru',
        latitude: 12.8958,
        longitude: 77.5986,
        isVerified: true,
        deletedAt: null,
      },
      {
        id: hospitalBId,
        userId: 'hosp-b-user',
        name: 'Hospital B - Manipal Tertiary Care',
        licenseNumber: 'KA-HSP-2026-002',
        email: 'hospital-b@lifelink.org',
        phone: '+918022223333',
        address: '98 Old Airport Road',
        city: 'Bengaluru',
        latitude: 12.9592,
        longitude: 77.6476,
        isVerified: true,
        deletedAt: null,
      },
      {
        id: unverifiedHospitalId,
        userId: 'unverified-hosp-user',
        name: 'Unverified Clinic',
        licenseNumber: 'KA-HSP-UNVERIFIED',
        email: 'unverified@lifelink.org',
        phone: '+918099990000',
        address: '10 Test Road',
        city: 'Bengaluru',
        latitude: 12.91,
        longitude: 77.61,
        isVerified: false,
        deletedAt: null,
      },
    ];

    dbState.bloodBanks = [
      {
        id: bloodBankId,
        userId: 'bank-user',
        name: 'LifeLink Metro Blood Center',
        licenseNumber: 'KA-BB-2026-001',
        email: 'bloodbank@lifelink.org',
        phone: '+918022334455',
        address: 'MG Road',
        city: 'Bengaluru',
        latitude: 12.9716,
        longitude: 77.5946,
        isVerified: true,
        deletedAt: null,
      },
    ];

    const now = Date.now();
    dbState.inventory = [
      // Hospital B has 8 eligible units of O-Negative PACKED_RBC across 2 batches (FEFO order: 3 units expiring in 5 days, 5 units expiring in 18 days)
      {
        id: 'eeee1111-1111-4111-8111-111111111111',
        hospitalId: hospitalBId,
        bloodBankId: null,
        bloodGroup: 'O_NEG',
        componentType: 'PACKED_RBC',
        unitsCount: 3,
        expiryDate: new Date(now + 5 * 24 * 60 * 60 * 1000),
        collectionDate: new Date(now - 25 * 24 * 60 * 60 * 1000),
        batchNumber: 'HBP-ONEG-001',
        storageTemp: '2°C to 6°C',
        status: 'AVAILABLE',
        updatedAt: new Date(now - 1000),
      },
      {
        id: 'eeee2222-2222-4222-8222-222222222222',
        hospitalId: hospitalBId,
        bloodBankId: null,
        bloodGroup: 'O_NEG',
        componentType: 'PACKED_RBC',
        unitsCount: 5,
        expiryDate: new Date(now + 18 * 24 * 60 * 60 * 1000),
        collectionDate: new Date(now - 12 * 24 * 60 * 60 * 1000),
        batchNumber: 'HBP-ONEG-002',
        storageTemp: '2°C to 6°C',
        status: 'AVAILABLE',
        updatedAt: new Date(now - 1000),
      },
      // Unverified hospital has stock that must NEVER be recommended as eligible
      {
        id: 'eeee3333-3333-4333-8333-333333333333',
        hospitalId: unverifiedHospitalId,
        bloodBankId: null,
        bloodGroup: 'O_NEG',
        componentType: 'PACKED_RBC',
        unitsCount: 10,
        expiryDate: new Date(now + 15 * 24 * 60 * 60 * 1000),
        batchNumber: 'UNV-001',
        storageTemp: '2°C to 6°C',
        status: 'AVAILABLE',
        updatedAt: new Date(now - 1000),
      },
    ];

    dbState.requests = [];
    dbState.proposals = [];
    dbState.transfers = [];
    dbState.allocations = [];
    dbState.events = [];
    dbState.notifications = [];
    dbState.auditLogs = [];
    dbState.simulateConcurrencyConflict = false;
  });

  // =========================================================================
  // 1. UNIT TESTS: Component-Specific Blood Compatibility Engine
  // =========================================================================
  describe('Unit Tests: CompatibilityService (Component-Aware Transfusion Rules)', () => {
    it('correctly validates Packed RBC ABO/RhD compatibility (O- universal RBC donor)', () => {
      const exactMatch = compatibilityService.evaluateCompatibility('O_NEG', 'O_NEG', 'PACKED_RBC');
      expect(exactMatch.isCompatible).toBe(true);
      expect(exactMatch.tier).toBe('ISOGROUP_EXACT');
      expect(exactMatch.requiresClinicalReview).toBe(false);

      const universalDonor = compatibilityService.evaluateCompatibility('A_POS', 'O_NEG', 'PACKED_RBC');
      expect(universalDonor.isCompatible).toBe(true);
      expect(universalDonor.tier).toBe('COMPATIBLE_SUBSTITUTE');

      const incompatible = compatibilityService.evaluateCompatibility('O_NEG', 'A_POS', 'PACKED_RBC');
      expect(incompatible.isCompatible).toBe(false);
      expect(incompatible.tier).toBe('INCOMPATIBLE');
    });

    it('correctly validates Plasma reverse ABO compatibility (AB universal plasma donor, O restricted to O)', () => {
      const abToO = compatibilityService.evaluateCompatibility('O_POS', 'AB_POS', 'PLASMA');
      expect(abToO.isCompatible).toBe(true);
      expect(abToO.tier).toBe('COMPATIBLE_SUBSTITUTE');

      const oToA = compatibilityService.evaluateCompatibility('A_POS', 'O_NEG', 'PLASMA');
      expect(oToA.isCompatible).toBe(false);
      expect(oToA.tier).toBe('INCOMPATIBLE');
    });

    it('flags non-isogroup Whole Blood and Platelets as requiring clinical review (CLINICAL_REVIEW_REQUIRED)', () => {
      const wbExact = compatibilityService.evaluateCompatibility('B_POS', 'B_POS', 'WHOLE_BLOOD');
      expect(wbExact.isCompatible).toBe(true);
      expect(wbExact.tier).toBe('ISOGROUP_EXACT');
      expect(wbExact.requiresClinicalReview).toBe(false);

      const wbNonIso = compatibilityService.evaluateCompatibility('B_POS', 'O_NEG', 'WHOLE_BLOOD');
      expect(wbNonIso.isCompatible).toBe(true);
      expect(wbNonIso.tier).toBe('CLINICAL_REVIEW_REQUIRED');
      expect(wbNonIso.requiresClinicalReview).toBe(true);
    });
  });

  // =========================================================================
  // 2. RBAC, AUTHORIZATION & VALIDATION TESTS
  // =========================================================================
  describe('RBAC, Institution Ownership & Input Validation', () => {
    it('forbids DONOR and PATIENT roles from accessing redistribution endpoints (403 FORBIDDEN)', async () => {
      const donorRes = await apiClient
        .post('/api/redistribution/requests')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          bloodGroup: 'O_NEG',
          componentType: 'PACKED_RBC',
          unitsRequired: 5,
          urgency: 'CRITICAL',
          requiredBy: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
          reason: 'Massive trauma hemorrhage protocol',
        });

      expect(donorRes.status).toBe(403);
      expect(donorRes.body.error.code).toBe('FORBIDDEN');

      const patientRes = await apiClient
        .get('/api/redistribution')
        .set('Authorization', `Bearer ${patientToken}`)
        .send();

      expect(patientRes.status).toBe(403);
    });

    it('forbids unverified hospitals from creating redistribution requests', async () => {
      const res = await apiClient
        .post('/api/redistribution/requests')
        .set('Authorization', `Bearer ${unverifiedHospToken}`)
        .send({
          bloodGroup: 'O_NEG',
          componentType: 'PACKED_RBC',
          unitsRequired: 2,
          urgency: 'URGENT',
          requiredBy: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
          reason: 'Surgical emergency reserve',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('verified');
    });

    it('rejects invalid payload (zero units, invalid blood group, or past requiredBy timestamp)', async () => {
      const zeroUnitsRes = await apiClient
        .post('/api/redistribution/requests')
        .set('Authorization', `Bearer ${hospitalAToken}`)
        .send({
          bloodGroup: 'O_NEG',
          componentType: 'PACKED_RBC',
          unitsRequired: 0,
          urgency: 'URGENT',
          requiredBy: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
          reason: 'Valid clinical reason string',
        });

      expect(zeroUnitsRes.status).toBe(400);

      const pastDateRes = await apiClient
        .post('/api/redistribution/requests')
        .set('Authorization', `Bearer ${hospitalAToken}`)
        .send({
          bloodGroup: 'O_NEG',
          componentType: 'PACKED_RBC',
          unitsRequired: 3,
          urgency: 'URGENT',
          requiredBy: new Date(Date.now() - 3600 * 1000).toISOString(),
          reason: 'Valid clinical reason string',
        });

      expect(pastDateRes.status).toBe(400);
    });

    it('forbids cross-institution inventory registration (HOSPITAL passing targetBloodBankId or another targetHospitalId)', async () => {
      const spoofRes = await apiClient
        .post('/api/redistribution/inventory')
        .set('Authorization', `Bearer ${hospitalAToken}`)
        .send({
          bloodGroup: 'O_NEG',
          componentType: 'PACKED_RBC',
          unitsCount: 4,
          expiryDate: new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString(),
          targetHospitalId: hospitalBId,
        });

      expect(spoofRes.status).toBe(403);
      expect(spoofRes.body.error.code).toBe('FORBIDDEN');
    });

    it('forbids self-approval of a proposal by the proposing institution and restricts match discovery to the destination owner', async () => {
      const reqRes = await apiClient
        .post('/api/redistribution/requests')
        .set('Authorization', `Bearer ${hospitalAToken}`)
        .send({
          bloodGroup: 'O_NEG',
          componentType: 'PACKED_RBC',
          unitsRequired: 3,
          urgency: 'URGENT',
          requiredBy: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
          reason: 'Pediatric surgical blood reserve',
        });
      const requestId = reqRes.body.data.request.id;

      // Hospital B (not the destination owner) cannot enumerate matches on Hospital A's request
      const unauthorizedMatchesRes = await apiClient
        .get(`/api/redistribution/requests/${requestId}/matches`)
        .set('Authorization', `Bearer ${hospitalBToken}`)
        .send();
      expect(unauthorizedMatchesRes.status).toBe(403);

      // Hospital B submits a transfer proposal
      const propRes = await apiClient
        .post(`/api/redistribution/requests/${requestId}/proposals`)
        .set('Authorization', `Bearer ${hospitalBToken}`)
        .send({
          bloodGroup: 'O_NEG',
          unitsProposed: 3,
        });
      expect(propRes.status).toBe(201);
      const proposalId = propRes.body.data.proposal.id;

      // Hospital B attempts to approve its own offer without Hospital A's consent -> must be 403 FORBIDDEN
      const selfApproveRes = await apiClient
        .post(`/api/redistribution/proposals/${proposalId}/approve`)
        .set('Authorization', `Bearer ${hospitalBToken}`)
        .send({});
      expect(selfApproveRes.status).toBe(403);
      expect(selfApproveRes.body.error.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // 3. END-TO-END WORKFLOW: Discovery -> Proposal -> Atomic Reservation -> Dispatch -> Receipt
  // =========================================================================
  describe('End-to-End Redistribution Workflow (Hospital A <-> Hospital B)', () => {
    it('executes full lifecycle: Request -> Source Discovery -> Proposal -> Atomic FEFO Reservation -> Cold-Chain Dispatch -> In-Transit -> Receipt Reconciliation & Inventory Credit', async () => {
      // STEP 1: Hospital A urgently requests 5 units of O_NEG PACKED_RBC
      const createReqRes = await apiClient
        .post('/api/redistribution/requests')
        .set('Authorization', `Bearer ${hospitalAToken}`)
        .send({
          bloodGroup: 'O_NEG',
          componentType: 'PACKED_RBC',
          unitsRequired: 5,
          urgency: 'CRITICAL',
          requiredBy: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
          minRemainingShelfLifeDays: 2,
          reason: 'Emergency trauma resuscitation requiring 5 units O-Neg PRBC',
        });

      expect(createReqRes.status).toBe(201);
      expect(createReqRes.body.success).toBe(true);
      const requestId = createReqRes.body.data.request.id;
      expect(createReqRes.body.data.request.status).toBe('MATCHING');

      // STEP 2: Discover ranked source hospitals for Request
      const discoveryRes = await apiClient
        .get(`/api/redistribution/requests/${requestId}/matches`)
        .set('Authorization', `Bearer ${hospitalAToken}`)
        .send();

      expect(discoveryRes.status).toBe(200);
      const { eligibleMatches, ineligibleMatches } = discoveryRes.body.data;
      expect(eligibleMatches.length).toBe(1);
      expect(eligibleMatches[0].institutionId).toBe(hospitalBId);
      expect(eligibleMatches[0].eligibleUnitsAvailable).toBe(8);
      expect(eligibleMatches[0].canFulfillCompletely).toBe(true);
      expect(eligibleMatches[0].category).toBe('ELIGIBLE');
      expect(eligibleMatches[0].score).toBeGreaterThan(0.7);

      // Verify unverified hospital is strictly in ineligibleMatches
      const unverifiedEntry = ineligibleMatches.find((s: any) => s.institutionId === unverifiedHospitalId);
      expect(unverifiedEntry).toBeDefined();
      expect(unverifiedEntry.category).toBe('INELIGIBLE');

      // STEP 3: Hospital B proposes transferring 5 units of O_NEG PACKED_RBC
      const proposalRes = await apiClient
        .post(`/api/redistribution/requests/${requestId}/proposals`)
        .set('Authorization', `Bearer ${hospitalBToken}`)
        .send({
          bloodGroup: 'O_NEG',
          unitsProposed: 5,
          notes: '8 units available in Cold Rack A; 5 units ready for immediate dispatch.',
        });

      expect(proposalRes.status).toBe(201);
      const proposalId = proposalRes.body.data.proposal.id;
      expect(proposalRes.body.data.proposal.status).toBe('PENDING');

      // Verify request moved to AWAITING_APPROVAL
      const matchedReq = dbState.requests.find((r) => r.id === requestId);
      expect(matchedReq.status).toBe('AWAITING_APPROVAL');

      // STEP 4: Verify Optimistic Concurrency Conflict handling (409 Conflict if stock changed concurrently)
      dbState.simulateConcurrencyConflict = true;
      const conflictApproveRes = await apiClient
        .post(`/api/redistribution/proposals/${proposalId}/approve`)
        .set('Authorization', `Bearer ${hospitalAToken}`)
        .send({});
      expect(conflictApproveRes.status).toBe(409);
      dbState.simulateConcurrencyConflict = false;

      // STEP 5: Hospital A approves proposal -> Atomic FEFO reservation of 5 units across Hospital B's 2 batches (3 units from batch 1 + 2 units split from batch 2)
      const approveRes = await apiClient
        .post(`/api/redistribution/proposals/${proposalId}/approve`)
        .set('Authorization', `Bearer ${hospitalAToken}`)
        .send({ idempotencyKey: 'idem-approve-001' });

      expect(approveRes.status).toBe(200);
      const transferId = approveRes.body.data.transfer.id;
      expect(approveRes.body.data.transfer.status).toBe('RESERVED');
      expect(approveRes.body.data.transfer.unitsApproved).toBe(5);

      // Verify Hospital B's remaining available inventory is now 8 - 5 = 3 units
      const hospBAvailable = dbState.inventory
        .filter((i) => i.hospitalId === hospitalBId && i.status === 'AVAILABLE')
        .reduce((sum, i) => sum + i.unitsCount, 0);
      const hospBReserved = dbState.inventory
        .filter((i) => i.hospitalId === hospitalBId && i.status === 'RESERVED')
        .reduce((sum, i) => sum + i.unitsCount, 0);
      expect(hospBAvailable).toBe(3);
      expect(hospBReserved).toBe(5);

      // STEP 6: Cold-Chain Verification requirement before Dispatch
      const unverifiedColdChainRes = await apiClient
        .post(`/api/redistribution/transfers/${transferId}/dispatch`)
        .set('Authorization', `Bearer ${hospitalBToken}`)
        .send({
          dispatcherName: 'Ramesh Kumar',
          temperatureCheckConfirmed: false,
        });
      expect(unverifiedColdChainRes.status).toBe(400);

      // STEP 7: Hospital B records Dispatch with valid cold-chain check
      const dispatchRes = await apiClient
        .post(`/api/redistribution/transfers/${transferId}/dispatch`)
        .set('Authorization', `Bearer ${hospitalBToken}`)
        .send({
          dispatcherName: 'Ramesh Kumar',
          temperatureCheckConfirmed: true,
          shipmentReference: 'SHP-2026-001',
          transportVehicleDetails: 'KA-01-EM-1080 Medical Cold-Chain Van',
          coldChainNotes: 'Validated 2-6C phase-change cooling packs intact.',
        });

      expect(dispatchRes.status).toBe(200);
      expect(dispatchRes.body.data.transfer.status).toBe('DISPATCHED');

      // STEP 8: Mark In-Transit checkpoint
      const inTransitRes = await apiClient
        .post(`/api/redistribution/transfers/${transferId}/in-transit`)
        .set('Authorization', `Bearer ${hospitalBToken}`)
        .send({ inTransitNotes: 'Courier crossed Silk Board flyover, ETA 12 mins' });

      expect(inTransitRes.status).toBe(200);
      expect(inTransitRes.body.data.transfer.status).toBe('IN_TRANSIT');

      // STEP 9: Hospital A records Receipt & Quantity Reconciliation (5 good units, 0 damaged)
      const receiveRes = await apiClient
        .post(`/api/redistribution/transfers/${transferId}/receive`)
        .set('Authorization', `Bearer ${hospitalAToken}`)
        .send({
          unitsReceived: 5,
          damagedUnits: 0,
          receiverStaffName: 'Nurse Anitha R.',
          conditionVerified: true,
        });

      expect(receiveRes.status).toBe(200);
      expect(receiveRes.body.data.transfer.status).toBe('COMPLETED');
      expect(receiveRes.body.data.transfer.hasDiscrepancy).toBe(false);

      // Verify Hospital A's inventory was automatically credited with 5 AVAILABLE units of O_NEG PACKED_RBC
      const hospAInventory = dbState.inventory.filter(
        (i) => i.hospitalId === hospitalAId && i.bloodGroup === 'O_NEG' && i.status === 'AVAILABLE'
      );
      expect(hospAInventory.length).toBe(1);
      expect(hospAInventory[0].unitsCount).toBe(5);

      // Verify Request status is COMPLETED
      const finalReq = dbState.requests.find((r) => r.id === requestId);
      expect(finalReq.status).toBe('COMPLETED');

      // STEP 10: Verify History & Analytics endpoints return real database metrics
      const historyRes = await apiClient
        .get('/api/redistribution/history')
        .set('Authorization', `Bearer ${hospitalAToken}`)
        .send();
      expect(historyRes.status).toBe(200);
      expect(historyRes.body.data.auditEvents.length).toBeGreaterThanOrEqual(5);

      const analyticsRes = await apiClient
        .get('/api/redistribution/analytics')
        .set('Authorization', `Bearer ${hospitalAToken}`)
        .send();
      expect(analyticsRes.status).toBe(200);
      expect(analyticsRes.body.data.metrics.totalUnitsReceived).toBe(5);
      expect(analyticsRes.body.data.metrics.completedTransfers).toBe(1);
    });
  });

  // =========================================================================
  // 4. CANCELLATION & RESERVATION RELEASE + DISCREPANCY RECONCILIATION TESTS
  // =========================================================================
  describe('Pre-Dispatch Cancellation & Receipt Discrepancy Handling', () => {
    it('releases reserved inventory back to AVAILABLE when an approved transfer is cancelled before dispatch', async () => {
      const reqRes = await apiClient
        .post('/api/redistribution/requests')
        .set('Authorization', `Bearer ${hospitalAToken}`)
        .send({
          bloodGroup: 'O_NEG',
          componentType: 'PACKED_RBC',
          unitsRequired: 4,
          urgency: 'URGENT',
          requiredBy: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
          reason: 'Scheduled high-risk cardiac surgery standby',
        });
      const requestId = reqRes.body.data.request.id;

      const propRes = await apiClient
        .post(`/api/redistribution/requests/${requestId}/proposals`)
        .set('Authorization', `Bearer ${hospitalBToken}`)
        .send({
          bloodGroup: 'O_NEG',
          unitsProposed: 4,
        });
      const proposalId = propRes.body.data.proposal.id;

      const approveRes = await apiClient
        .post(`/api/redistribution/proposals/${proposalId}/approve`)
        .set('Authorization', `Bearer ${hospitalAToken}`)
        .send({});
      const transferId = approveRes.body.data.transfer.id;

      const availableDuringReserve = dbState.inventory
        .filter((i) => i.hospitalId === hospitalBId && i.status === 'AVAILABLE')
        .reduce((sum, i) => sum + i.unitsCount, 0);
      expect(availableDuringReserve).toBe(4);

      // Cancel transfer before dispatch -> releases 4 reserved units back to Hospital B's AVAILABLE stock
      const cancelRes = await apiClient
        .post(`/api/redistribution/transfers/${transferId}/cancel`)
        .set('Authorization', `Bearer ${hospitalAToken}`)
        .send({ reason: 'Surgery postponed by clinical team; releasing standby units.' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.transfer.status).toBe('CANCELLED');

      const availableAfterCancel = dbState.inventory
        .filter((i) => i.hospitalId === hospitalBId && i.status === 'AVAILABLE')
        .reduce((sum, i) => sum + i.unitsCount, 0);
      expect(availableAfterCancel).toBe(8);
    });

    it('cancels a redistribution request via POST /api/redistribution/requests/:id/cancel and releases any pre-dispatch reserved units', async () => {
      const reqRes = await apiClient
        .post('/api/redistribution/requests')
        .set('Authorization', `Bearer ${hospitalAToken}`)
        .send({
          bloodGroup: 'O_NEG',
          componentType: 'PACKED_RBC',
          unitsRequired: 5,
          urgency: 'URGENT',
          requiredBy: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
          reason: 'Vascular surgery standby reserve',
        });
      const requestId = reqRes.body.data.request.id;

      const propRes = await apiClient
        .post(`/api/redistribution/requests/${requestId}/proposals`)
        .set('Authorization', `Bearer ${hospitalBToken}`)
        .send({
          bloodGroup: 'O_NEG',
          unitsProposed: 5,
        });
      const proposalId = propRes.body.data.proposal.id;

      await apiClient
        .post(`/api/redistribution/proposals/${proposalId}/approve`)
        .set('Authorization', `Bearer ${hospitalAToken}`)
        .send({});

      // Cancel at the request level before dispatch
      const cancelReqRes = await apiClient
        .post(`/api/redistribution/requests/${requestId}/cancel`)
        .set('Authorization', `Bearer ${hospitalAToken}`)
        .send({ reason: 'Patient requirement resolved via internal cross-match; cancelling request.' });

      expect(cancelReqRes.status).toBe(200);
      expect(cancelReqRes.body.data.request.status).toBe('CANCELLED');

      const availableAfterReqCancel = dbState.inventory
        .filter((i) => i.hospitalId === hospitalBId && i.status === 'AVAILABLE')
        .reduce((sum, i) => sum + i.unitsCount, 0);
      expect(availableAfterReqCancel).toBe(8);
    });

    it('flags transfer as RECEIVED with hasDiscrepancy=true (instead of silently completing) when damaged units occur', async () => {
      const reqRes = await apiClient
        .post('/api/redistribution/requests')
        .set('Authorization', `Bearer ${hospitalAToken}`)
        .send({
          bloodGroup: 'O_NEG',
          componentType: 'PACKED_RBC',
          unitsRequired: 3,
          urgency: 'URGENT',
          requiredBy: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
          reason: 'Oncology transfusion support',
        });
      const requestId = reqRes.body.data.request.id;

      const propRes = await apiClient
        .post(`/api/redistribution/requests/${requestId}/proposals`)
        .set('Authorization', `Bearer ${hospitalBToken}`)
        .send({
          bloodGroup: 'O_NEG',
          unitsProposed: 3,
        });
      const proposalId = propRes.body.data.proposal.id;

      const approveRes = await apiClient
        .post(`/api/redistribution/proposals/${proposalId}/approve`)
        .set('Authorization', `Bearer ${hospitalAToken}`)
        .send({});
      const transferId = approveRes.body.data.transfer.id;

      await apiClient
        .post(`/api/redistribution/transfers/${transferId}/dispatch`)
        .set('Authorization', `Bearer ${hospitalBToken}`)
        .send({
          dispatcherName: 'Express Med Courier',
          temperatureCheckConfirmed: true,
        });

      // Receive 3 units total, 1 damaged (so 2 good usable units)
      const receiveRes = await apiClient
        .post(`/api/redistribution/transfers/${transferId}/receive`)
        .set('Authorization', `Bearer ${hospitalAToken}`)
        .send({
          unitsReceived: 3,
          damagedUnits: 1,
          receiverStaffName: 'Nurse Kavitha',
          conditionVerified: true,
          discrepancyReason: '1 bag seal compromised during transit handling',
        });

      expect(receiveRes.status).toBe(200);
      expect(receiveRes.body.data.transfer.hasDiscrepancy).toBe(true);
      expect(receiveRes.body.data.transfer.status).toBe('RECEIVED'); // Flagged for review, NOT silently COMPLETED

      // Only the 2 verified good units are credited to Hospital A
      const hospAGoodStock = dbState.inventory
        .filter((i) => i.hospitalId === hospitalAId && i.status === 'AVAILABLE')
        .reduce((sum, i) => sum + i.unitsCount, 0);
      expect(hospAGoodStock).toBe(2);
    });
  });
});
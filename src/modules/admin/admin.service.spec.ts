import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AdminService } from './admin.service';

// El cliente real de Prisma no hace falta: se inyecta un mock en cada test
jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));

type Account = {
  memb___id: string;
  ctl1_code: string;
  AccountLevel: number;
  AccountExpireDate: Date;
};

function createPrismaMock(
  accounts: Account[],
  characters: { Name: string; AccountID: string; CtlCode: number }[] = [],
) {
  return {
    mEMB_INFO: {
      findFirst: jest.fn(({ where }: { where: { memb___id: string } }) =>
        Promise.resolve(
          accounts.find((a) => a.memb___id === where.memb___id) ?? null,
        ),
      ),
      updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
    mEMB_STAT: {
      findUnique: jest.fn(() => Promise.resolve({ ConnectStat: 0 })),
    },
    character: {
      findUnique: jest.fn(({ where }: { where: { Name: string } }) =>
        Promise.resolve(characters.find((c) => c.Name === where.Name) ?? null),
      ),
      update: jest.fn(() => Promise.resolve({})),
    },
    adminAuditLog: {
      create: jest.fn(() => Promise.resolve({})),
    },
  };
}

const actor = { username: 'boss', ip: '1.2.3.4' };
const account = (memb___id: string, ctl1_code = '0'): Account => ({
  memb___id,
  ctl1_code,
  AccountLevel: 0,
  AccountExpireDate: new Date(),
});

describe('AdminService', () => {
  it('banea una cuenta normal y lo registra en auditoría', async () => {
    const prisma = createPrismaMock([account('boss', '8'), account('cheater')]);
    const service = new AdminService(prisma as never);

    await service.banAccount(actor, 'cheater', 'Uso de speed hack');

    expect(prisma.mEMB_INFO.updateMany).toHaveBeenCalledWith({
      where: { memb___id: 'cheater' },
      data: { ctl1_code: '1' },
    });
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        AdminUser: 'boss',
        Action: 'account.ban',
        Target: 'cheater',
        Reason: 'Uso de speed hack',
        Ip: '1.2.3.4',
      }),
    });
  });

  it('no permite banear la propia cuenta', async () => {
    const prisma = createPrismaMock([account('boss', '8')]);
    const service = new AdminService(prisma as never);

    await expect(
      service.banAccount(actor, 'boss', 'test'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.mEMB_INFO.updateMany).not.toHaveBeenCalled();
  });

  it('no permite banear otra cuenta admin', async () => {
    const prisma = createPrismaMock([
      account('boss', '8'),
      account('otro', '32'),
    ]);
    const service = new AdminService(prisma as never);

    await expect(
      service.banAccount(actor, 'otro', 'test'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('falla si la cuenta no existe', async () => {
    const prisma = createPrismaMock([]);
    const service = new AdminService(prisma as never);

    await expect(
      service.banAccount(actor, 'nadie', 'test'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('VIP con nivel > 0 exige duración', async () => {
    const prisma = createPrismaMock([account('player')]);
    const service = new AdminService(prisma as never);

    await expect(
      service.setVip(actor, 'player', { level: 2 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('asigna VIP con vencimiento y lo audita', async () => {
    const prisma = createPrismaMock([account('player')]);
    const service = new AdminService(prisma as never);
    const before = Date.now();

    await service.setVip(actor, 'player', { level: 3, days: 30 });

    const call = prisma.mEMB_INFO.updateMany.mock.calls[0] as unknown as [
      { data: { AccountLevel: number; AccountExpireDate: Date } },
    ];
    const { data } = call[0];
    expect(data.AccountLevel).toBe(3);
    const days = (data.AccountExpireDate.getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThan(29.99);
    expect(days).toBeLessThan(30.01);
    expect(prisma.adminAuditLog.create).toHaveBeenCalledTimes(1);
  });

  it('no da GM a un personaje baneado', async () => {
    const prisma = createPrismaMock(
      [],
      [{ Name: 'Pepe', AccountID: 'x', CtlCode: 1 }],
    );
    const service = new AdminService(prisma as never);

    await expect(service.grantGm(actor, 'Pepe')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.character.update).not.toHaveBeenCalled();
  });

  it('banea un personaje y guarda el código anterior en la auditoría', async () => {
    const prisma = createPrismaMock(
      [],
      [{ Name: 'Pepe', AccountID: 'x', CtlCode: 0 }],
    );
    const service = new AdminService(prisma as never);

    await service.banCharacter(actor, 'Pepe', 'Insultos');

    expect(prisma.character.update).toHaveBeenCalledWith({
      where: { Name: 'Pepe' },
      data: { CtlCode: 1 },
    });
    const call = prisma.adminAuditLog.create.mock.calls[0] as unknown as [
      { data: { Details: string } },
    ];
    expect(JSON.parse(call[0].data.Details)).toMatchObject({
      account: 'x',
      previousCode: 0,
      newCode: 1,
    });
  });
});

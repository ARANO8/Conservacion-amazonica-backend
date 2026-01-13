import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogsService {
  constructor(private prisma: PrismaService) {}

  async findAllBudgetLines() {
    return this.prisma.budgetLine.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
      },
      orderBy: {
        code: 'asc',
      },
    });
  }

  async findAllFinancingSources() {
    return this.prisma.financingSource.findMany({
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: {
        code: 'asc',
      },
    });
  }

  async findAllUsers() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        position: true,
        area: true,
      },
      orderBy: {
        fullName: 'asc',
      },
    });

    return users.map((user) => ({
      id: user.id, // User ID is now String in schema
      name: user.fullName,
      position: user.position,
      area: user.area,
    }));
  }

  async findAllPoaActivities() {
    return this.prisma.poaActivity.findMany({
      select: {
        id: true,
        code: true,
        og: true,
        oe: true,
        op: true,
        ac: true,
        project: true,
        group: true,
        poaBudgetLine: true,
        activityCode: true,
        description: true,
        unitCost: true,
        totalCost: true,
      },
      orderBy: {
        code: 'asc',
      },
    });
  }
}

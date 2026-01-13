import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRequestDto,
  CreateRequestItemDto,
} from './dto/create-request.dto';
import { Prisma, RequestStatus } from '@prisma/client';
import { RequestUser } from './interfaces/request-user.interface';

@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createRequestDto: CreateRequestDto) {
    const { items, viaticos, ...requestData } = createRequestDto;

    // Calculate total amount in backend as per requirement
    // Using the 'amount' field from the item which represents the total for that line
    const totalAmount = items.reduce(
      (sum: number, item: CreateRequestItemDto) => sum + Number(item.amount),
      0,
    );

    // Generate unique code
    const code = `REQ-${Date.now()}`;

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const request = await tx.request.create({
        data: {
          ...requestData,
          code,
          totalAmount,
          requesterId: userId,
          poaActivityId: createRequestDto.poaActivityId,
          refById: createRequestDto.refById,
          disbursementToId: createRequestDto.disbursementToId,
          status: RequestStatus.DRAFT,
          items: {
            create: items.map((item: CreateRequestItemDto) => ({
              description: item.description,
              quantity: item.quantity,
              unitCost: item.unitCost,
              totalAmount: item.amount, // Mapping DTO 'amount' directly to DB 'totalAmount'
              detail: item.detail,
              documentNumber: item.documentNumber,
              budgetLine: { connect: { id: item.budgetLineId } },
              financingSource: { connect: { id: item.financingSourceId } },
            })),
          },
          travelExpenses: viaticos
            ? {
                create: viaticos.map((v) => ({
                  concept: v.concept,
                  city: v.city,
                  destination: v.destination,
                  transportType: v.transportType,
                  days: v.days,
                  peopleCount: v.peopleCount,
                })),
              }
            : undefined,
        },
        include: {
          items: true,
          travelExpenses: true,
        },
      });
      return request;
    });
  }

  async findAll(user: RequestUser) {
    const { role, userId } = user;

    // Check if user is Admin or Approver
    // Adjust role names based on your Role seed/enum
    const isAdminOrApprover = [
      'ADMIN',
      'APROBADOR',
      'APROBADOR_FINANCIERO',
    ].some((r) => role.includes(r) || role === r);

    const whereClause = isAdminOrApprover ? {} : { requesterId: userId };

    return this.prisma.request.findMany({
      where: whereClause,
      include: {
        requester: {
          select: {
            id: true,
            fullName: true,
            email: true,
            position: true,
          },
        },
        items: {
          include: {
            budgetLine: true,
            financingSource: true,
          },
        },
        travelExpenses: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.request.findUnique({
      where: { id },
      include: {
        requester: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        items: {
          include: {
            budgetLine: true,
            financingSource: true,
          },
        },
        travelExpenses: true,
        approver: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });
  }
}

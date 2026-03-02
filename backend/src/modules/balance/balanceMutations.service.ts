import { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import { HttpError } from "../../utils/errors";

export type BalanceMutationDirection = "CREDIT" | "DEBIT";

export type ApplyBalanceMutationInput = {
  userId: string;
  direction: BalanceMutationDirection;
  amount: number;
  type: string;
  referenceType?: string | null;
  referenceId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type BalanceMutationHistoryQuery = {
  page?: number;
  pageSize?: number;
  type?: string;
  direction?: string;
  query?: string;
};

function toInt(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function normalizeText(value: unknown) {
  const x = String(value ?? "").trim();
  return x || undefined;
}

function normalizeDirection(value: unknown): BalanceMutationDirection {
  const dir = String(value ?? "").trim().toUpperCase();
  if (dir !== "CREDIT" && dir !== "DEBIT") {
    throw new HttpError(400, "Direction mutasi saldo tidak valid");
  }
  return dir;
}

export function toBalanceMutationDto(row: any) {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    direction: row.direction,
    amount: row.amount,
    balanceBefore: row.balanceBefore,
    balanceAfter: row.balanceAfter,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    description: row.description,
    metadata: row.metadata,
    createdAt: row.createdAt,
  };
}

export async function applyBalanceMutationTx(
  tx: Prisma.TransactionClient,
  input: ApplyBalanceMutationInput,
) {
  const userId = normalizeText(input.userId);
  if (!userId) {
    throw new HttpError(400, "Missing userId untuk mutasi saldo");
  }

  const direction = normalizeDirection(input.direction);
  const amount = toInt(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, "Jumlah mutasi saldo tidak valid");
  }

  const type = String(input.type ?? "BALANCE_MUTATION").trim().toUpperCase();
  if (!type) {
    throw new HttpError(400, "Tipe mutasi saldo tidak valid");
  }

  const mutationDelta = direction === "CREDIT" ? amount : -amount;

  const updateResult =
    direction === "CREDIT"
      ? await tx.user.updateMany({
          where: { id: userId },
          data: { balance: { increment: amount } },
        })
      : await tx.user.updateMany({
          where: { id: userId, balance: { gte: amount } },
          data: { balance: { decrement: amount } },
        });

  if (updateResult.count === 0) {
    if (direction === "DEBIT") {
      throw new HttpError(400, "Saldo tidak cukup");
    }
    throw new HttpError(404, "User tidak ditemukan");
  }

  const userAfter = await tx.user.findUnique({
    where: { id: userId },
    select: { balance: true },
  });

  if (!userAfter) {
    throw new HttpError(404, "User tidak ditemukan");
  }

  const balanceAfter = Number(userAfter.balance ?? 0);
  const balanceBefore = balanceAfter - mutationDelta;

  const mutation = await tx.userBalanceMutation.create({
    data: {
      userId,
      type,
      direction,
      amount,
      balanceBefore,
      balanceAfter,
      referenceType: normalizeText(input.referenceType) ?? null,
      referenceId: normalizeText(input.referenceId) ?? null,
      description: normalizeText(input.description) ?? null,
      metadata:
        input.metadata === undefined
          ? undefined
          : input.metadata === null
            ? Prisma.JsonNull
            : (input.metadata as Prisma.InputJsonValue),
    },
  });

  return {
    mutation,
    balanceBefore,
    balanceAfter,
  };
}

export async function applyBalanceMutation(input: ApplyBalanceMutationInput) {
  return prisma.$transaction((tx) => applyBalanceMutationTx(tx, input));
}

export async function getBalanceMutationHistoryForUser(
  userIdInput: string,
  query: BalanceMutationHistoryQuery = {},
) {
  const userId = normalizeText(userIdInput);
  if (!userId) {
    throw new HttpError(400, "Missing userId");
  }

  const page = Math.max(1, toInt(query.page || 1));
  const pageSize = Math.min(100, Math.max(5, toInt(query.pageSize || 20)));
  const type = normalizeText(query.type)?.toUpperCase();
  const direction = normalizeText(query.direction)?.toUpperCase();
  const keyword = normalizeText(query.query);

  const where: Prisma.UserBalanceMutationWhereInput = {
    userId,
  };

  if (type && type !== "ALL") {
    where.type = type;
  }

  if (direction && direction !== "ALL") {
    if (direction !== "CREDIT" && direction !== "DEBIT") {
      throw new HttpError(400, "Filter direction tidak valid");
    }
    where.direction = direction;
  }

  if (keyword) {
    where.OR = [
      { type: { contains: keyword, mode: "insensitive" } },
      { referenceType: { contains: keyword, mode: "insensitive" } },
      { referenceId: { contains: keyword, mode: "insensitive" } },
      { description: { contains: keyword, mode: "insensitive" } },
    ];
  }

  const [
    totalItems,
    rows,
    user,
    totalCreditAgg,
    totalDebitAgg,
  ] = await Promise.all([
    prisma.userBalanceMutation.count({ where }),
    prisma.userBalanceMutation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    }),
    prisma.userBalanceMutation.aggregate({
      where: { userId, direction: "CREDIT" },
      _sum: { amount: true },
    }),
    prisma.userBalanceMutation.aggregate({
      where: { userId, direction: "DEBIT" },
      _sum: { amount: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const totalCredit = Number(totalCreditAgg._sum.amount ?? 0);
  const totalDebit = Number(totalDebitAgg._sum.amount ?? 0);

  return {
    balance: Number(user?.balance ?? 0),
    summary: {
      totalCredit,
      totalDebit,
      net: totalCredit - totalDebit,
    },
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
    },
    items: rows.map(toBalanceMutationDto),
  };
}
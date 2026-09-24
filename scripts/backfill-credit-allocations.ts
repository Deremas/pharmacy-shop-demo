import "dotenv/config";
import { prisma } from "../lib/prisma";
import { asMoney, moneyNumber } from "../lib/money";
import { allocatePaymentFifo, unpaidCreditSales } from "../lib/finance/credit-ledger";

async function main() {
  const [sales, payments] = await Promise.all([
    prisma.sale.findMany({
      where: { creditAmount: { gt: 0 } },
      select: { id: true, customerId: true, creditAmount: true, saleDate: true, createdAt: true },
    }),
    prisma.customerPayment.findMany({
      include: { allocations: true },
      orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    }),
  ]);

  const saleRows = sales.map((sale) => ({
    id: sale.id,
    customerId: sale.customerId,
    creditAmount: moneyNumber(sale.creditAmount),
    saleDate: sale.saleDate,
    createdAt: sale.createdAt,
  }));
  const paymentRows = payments.map((payment) => ({
    id: payment.id,
    customerId: payment.customerId,
    saleId: payment.saleId,
    amount: moneyNumber(payment.amount),
  }));
  const allocationRows = payments.flatMap((payment) =>
    payment.allocations.map((allocation) => ({
      paymentId: allocation.paymentId,
      saleId: allocation.saleId,
      amount: moneyNumber(allocation.amount),
    })),
  );

  for (const payment of payments) {
    if (payment.allocations.length > 0) continue;

    if (payment.saleId) {
      const created = await prisma.customerPaymentAllocation.create({
        data: {
          paymentId: payment.id,
          saleId: payment.saleId,
          amount: payment.amount,
        },
      });
      allocationRows.push({
        paymentId: created.paymentId,
        saleId: created.saleId,
        amount: moneyNumber(created.amount),
      });
      continue;
    }

    const unpaid = unpaidCreditSales(payment.customerId, saleRows, paymentRows, allocationRows);
    const allocations = allocatePaymentFifo(unpaid, moneyNumber(payment.amount));
    if (!allocations.length) continue;
    await prisma.customerPaymentAllocation.createMany({
      data: allocations.map((allocation) => ({
        paymentId: payment.id,
        saleId: allocation.saleId,
        amount: asMoney(allocation.amount),
      })),
    });
    allocationRows.push(
      ...allocations.map((allocation) => ({
        paymentId: payment.id,
        saleId: allocation.saleId,
        amount: allocation.amount,
      })),
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

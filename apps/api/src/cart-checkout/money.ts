import { BadRequestException } from '@nestjs/common';

const MAX_POISHA = 2_147_483_647;

function assertPoisha(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_POISHA) {
    throw new BadRequestException(`${field} must be a whole number of poisha in range 0..${MAX_POISHA}`);
  }
}

export function lineTotalPoisha(unitPricePoisha: number, quantity: number): number {
  assertPoisha(unitPricePoisha, 'unitPricePoisha');
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new BadRequestException('quantity must be a positive integer');
  }
  const total = unitPricePoisha * quantity;
  assertPoisha(total, 'lineTotalPoisha');
  return total;
}

export function percentageDiscountPoisha(subtotalPoisha: number, discountValue: number): number {
  assertPoisha(subtotalPoisha, 'subtotalPoisha');
  assertPoisha(discountValue, 'discountValue');
  return Math.min(Math.floor((subtotalPoisha * discountValue) / 100), subtotalPoisha);
}

export function fixedDiscountPoisha(subtotalPoisha: number, discountValue: number): number {
  assertPoisha(subtotalPoisha, 'subtotalPoisha');
  assertPoisha(discountValue, 'discountValue');
  return Math.min(discountValue, subtotalPoisha);
}

export function orderTotals(
  subtotalPoisha: number,
  discountPoisha: number,
  deliveryFeePoisha: number,
): { taxPoisha: number; totalPoisha: number } {
  assertPoisha(subtotalPoisha, 'subtotalPoisha');
  assertPoisha(discountPoisha, 'discountPoisha');
  assertPoisha(deliveryFeePoisha, 'deliveryFeePoisha');
  if (discountPoisha > subtotalPoisha) {
    throw new BadRequestException('discount cannot exceed subtotal');
  }
  const taxPoisha = 0;
  const total = subtotalPoisha - discountPoisha + deliveryFeePoisha;
  assertPoisha(total, 'totalPoisha');
  return { taxPoisha, totalPoisha: total };
}

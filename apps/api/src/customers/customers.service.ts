import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'database';
import { PrismaService } from '../platform/database/prisma.service';
import type { CustomerQuery } from './customers.schemas';

export interface AdminCustomer {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  status: string;
  createdAt: string;
}

export interface AdminCustomerAddress {
  id: string;
  label: string | null;
  recipientName: string;
  recipientPhone: string;
  addressLine1: string;
  addressLine2: string | null;
  area: string | null;
  district: string;
  division: string;
  postalCode: string | null;
  countryCode: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

export interface AdminCustomerOrderSummary {
  id: string;
  number: string;
  status: string;
  total: number;
  createdAt: string;
}

export interface AdminCustomerDetail extends AdminCustomer {
  addresses: AdminCustomerAddress[];
  orders: AdminCustomerOrderSummary[];
}

export interface AdminCustomerPage {
  items: AdminCustomer[];
  total: number;
  page: number;
  pageSize: number;
}

const CUSTOMER_SELECT = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  status: true,
  createdAt: true,
} as const;

const ADDRESS_SELECT = {
  id: true,
  label: true,
  recipientName: true,
  recipientPhone: true,
  addressLine1: true,
  addressLine2: true,
  area: true,
  district: true,
  division: true,
  postalCode: true,
  countryCode: true,
  isDefaultShipping: true,
  isDefaultBilling: true,
} as const;

const ORDER_SUMMARY_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  totalPoisha: true,
  createdAt: true,
} as const;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async listCustomers(input: CustomerQuery): Promise<AdminCustomerPage> {
    const where: Prisma.CustomerWhereInput = input.q
      ? {
          OR: [
            { firstName: { contains: input.q, mode: 'insensitive' } },
            { lastName: { contains: input.q, mode: 'insensitive' } },
            { email: { contains: input.q, mode: 'insensitive' } },
            { phone: { contains: input.q } },
          ],
        }
      : {};

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        select: CUSTOMER_SELECT,
        orderBy: [{ createdAt: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items: customers.map((c) => ({
        id: c.id,
        email: c.email,
        phone: c.phone,
        firstName: c.firstName,
        lastName: c.lastName,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
      })),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async getCustomer(customerId: string): Promise<AdminCustomerDetail> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        ...CUSTOMER_SELECT,
        addresses: { select: ADDRESS_SELECT },
        orders: {
          select: ORDER_SUMMARY_SELECT,
          orderBy: [{ createdAt: 'desc' }],
          take: 10,
        },
      },
    });
    if (!customer) {
      throw new NotFoundException(`Customer "${customerId}" not found`);
    }

    return {
      id: customer.id,
      email: customer.email,
      phone: customer.phone,
      firstName: customer.firstName,
      lastName: customer.lastName,
      status: customer.status,
      createdAt: customer.createdAt.toISOString(),
      addresses: customer.addresses.map((a) => ({
        id: a.id,
        label: a.label,
        recipientName: a.recipientName,
        recipientPhone: a.recipientPhone,
        addressLine1: a.addressLine1,
        addressLine2: a.addressLine2,
        area: a.area,
        district: a.district,
        division: a.division,
        postalCode: a.postalCode,
        countryCode: a.countryCode,
        isDefaultShipping: a.isDefaultShipping,
        isDefaultBilling: a.isDefaultBilling,
      })),
      orders: customer.orders.map((o) => ({
        id: o.id,
        number: o.orderNumber,
        status: o.status,
        total: o.totalPoisha,
        createdAt: o.createdAt.toISOString(),
      })),
    };
  }
}

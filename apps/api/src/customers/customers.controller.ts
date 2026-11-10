import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { AuthAccess } from '../auth/auth-access.decorator';
import { CustomersService } from './customers.service';
import { parseCustomerInput, customerQuerySchema } from './customers.schemas';

@Controller('admin/customers')
export class CustomersController {
  constructor(@Inject(CustomersService) private readonly customers: CustomersService) {}

  @Get()
  @AuthAccess({
    access: 'admin',
    permission: 'customers.read',
    scope: 'store',
  })
  list(@Query() query: Record<string, unknown>) {
    return this.customers.listCustomers(parseCustomerInput(customerQuerySchema, query));
  }

  @Get(':customerId')
  @AuthAccess({
    access: 'admin',
    permission: 'customers.read',
    scope: 'store',
  })
  get(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.customers.getCustomer(customerId);
  }
}

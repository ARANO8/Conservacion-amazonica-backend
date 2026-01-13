import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CatalogsService } from './catalogs.service';
import { BudgetLineEntity } from './entities/budget-line.entity';
import { FinancingSourceEntity } from './entities/financing-source.entity';
import { UserCatalogEntity } from './entities/user-catalog.entity';
import { PoaActivityEntity } from './entities/poa-activity.entity';

@ApiTags('Catalogs')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('catalogs')
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Get('budget-lines')
  @ApiOperation({ summary: 'Get all budget lines' })
  @ApiResponse({
    status: 200,
    description: 'List of budget lines ordered by code.',
    type: [BudgetLineEntity],
  })
  async findAllBudgetLines(): Promise<BudgetLineEntity[]> {
    return this.catalogsService.findAllBudgetLines();
  }

  @Get('financing-sources')
  @ApiOperation({ summary: 'Get all financing sources' })
  @ApiResponse({
    status: 200,
    description: 'List of financing sources ordered by code.',
    type: [FinancingSourceEntity],
  })
  async findAllFinancingSources(): Promise<FinancingSourceEntity[]> {
    return this.catalogsService.findAllFinancingSources();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get list of users (lite version)' })
  @ApiResponse({
    status: 200,
    description: 'Lite version of users list ordered by name.',
    type: [UserCatalogEntity],
  })
  async findAllUsers(): Promise<UserCatalogEntity[]> {
    return this.catalogsService.findAllUsers();
  }

  @Get('poa-activities')
  @ApiOperation({ summary: 'Get all POA activities' })
  @ApiResponse({
    status: 200,
    description: 'List of POA activities ordered by code.',
    type: [PoaActivityEntity],
  })
  async findAllPoaActivities(): Promise<PoaActivityEntity[]> {
    return this.catalogsService.findAllPoaActivities();
  }
}

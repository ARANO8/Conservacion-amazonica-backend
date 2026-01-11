import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RequestUser } from './interfaces/request-user.interface';

@ApiTags('Requests')
@ApiBearerAuth()
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Create a new request' })
  @ApiResponse({ status: 201, description: 'Request created successfully.' })
  create(
    @Request() req: { user: RequestUser },
    @Body() createRequestDto: CreateRequestDto,
  ) {
    // req.user comes from JwtStrategy.validate() -> { userId, email, role }
    return this.requestsService.create(req.user.userId, createRequestDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'List all requests' })
  @ApiResponse({
    status: 200,
    description: 'Return all requests (filtered by role).',
  })
  findAll(@Request() req: { user: RequestUser }) {
    return this.requestsService.findAll(req.user);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get a request by id' })
  @ApiResponse({ status: 200, description: 'Return the request details.' })
  findOne(@Param('id') id: string) {
    return this.requestsService.findOne(id);
  }
}

import { PartialType } from '@nestjs/swagger';
import { CreatePoaDto } from './create-poa.dto';

export class UpdatePoaDto extends PartialType(CreatePoaDto) {}

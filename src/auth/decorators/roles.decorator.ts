import { SetMetadata } from '@nestjs/common';
import { Rol } from '@prisma/client';

export const Roles = (...roles: Rol[]) => SetMetadata('roles', roles);

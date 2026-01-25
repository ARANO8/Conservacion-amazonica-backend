import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsuariosService {
  constructor(private prisma: PrismaService) {}

  private readonly userSelect = {
    id: true,
    nombreCompleto: true,
    email: true,
    rol: true,
    cargo: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
  };

  async create(createUsuarioDto: CreateUsuarioDto) {
    const hashedPassword = await bcrypt.hash(createUsuarioDto.password, 10);

    return this.prisma.usuario.create({
      data: {
        ...createUsuarioDto,
        password: hashedPassword,
      },
      select: this.userSelect,
    });
  }

  async findAll() {
    return this.prisma.usuario.findMany({
      where: { deletedAt: null },
      select: this.userSelect,
    });
  }

  async findOne(id: number) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id, deletedAt: null },
      select: this.userSelect,
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return usuario;
  }

  async findByEmail(email: string) {
    return this.prisma.usuario.findFirst({
      where: { email, deletedAt: null },
    });
  }

  async update(id: number, updateUsuarioDto: UpdateUsuarioDto) {
    await this.findOne(id); // Verificar existencia

    const data = { ...updateUsuarioDto };
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    return this.prisma.usuario.update({
      where: { id },
      data,
      select: this.userSelect,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.usuario.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: this.userSelect,
    });
  }
}

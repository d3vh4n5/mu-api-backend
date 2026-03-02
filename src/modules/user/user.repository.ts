import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
//import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserMapper } from './mappers/user.mapper';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const result = await this.prisma.mEMB_INFO.create({
      data: {
        // Campos variables
        memb___id: createUserDto.username,
        memb__pwd: createUserDto.password ?? '',
        memb_name: createUserDto.name || createUserDto.username,
        mail_addr: createUserDto.email,

        // Campos constantes obligatorios (el "relleno" del Mu Online)
        sno__numb: '1111111111111',
        post_code: '1234',
        addr_info: '1',
        addr_deta: '1',
        fpas_ques: 'Pregunta',
        fpas_answ: 'Respuesta',
        job__code: '1',
        mail_chek: '0',
        bloc_code: '0',
        ctl1_code: '0',

        // Fechas (Prisma traduce new Date() al GETDATE() de SQL)
        appl_days: new Date(),
        modi_days: new Date(),
        out__days: new Date(),
        true_days: new Date(),

        // Si tu tabla tiene AccountLevel y otros campos nuevos de Season alta:
        AccountLevel: 0,
        AccountExpireDate: new Date(),
      },
    });

    return UserMapper.toDomain(result);
  }

  async findByUsername(username: string): Promise<User | null> {
    const result = await this.prisma.mEMB_INFO.findFirst({
      where: { memb___id: username },
    });

    if (result) {
      return UserMapper.toDomain(result);
    }

    return null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.prisma.mEMB_INFO.findFirst({
      where: { mail_addr: email },
    });

    if (result) {
      return UserMapper.toDomain(result);
    }

    return null;
  }
}

import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
//import { UpdateUserDto } from './dto/update-user.dto';
import { UserRepository } from './user.repository';
import { EmailService } from 'src/common/email/email.service';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly emailService: EmailService,
  ) {}

  randomNumber() {
    return Math.floor(100000 + Math.random() * 900000);
  }

  async create(createUserDto: CreateUserDto) {
    const { username, email } = createUserDto;

    const existingUser = await this.userRepository.findByUsername(username);
    const existingEmail = await this.userRepository.findByEmail(email);

    if (existingEmail) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    if (existingUser) {
      throw new ConflictException('El nombre de usuario ya existe');
    }

    const randomNumber = this.randomNumber();

    const result = await this.userRepository.create({
      ...createUserDto,
      password: randomNumber.toString(),
    });

    if (!result) {
      throw new Error('Error al crear el usuario');
    }

    try {
      const emailResult = await this.emailService.sendWelcomeWithPasswordEmail(
        { email: result.email, name: result.name },
        randomNumber.toString(),
      );

      Logger.log(
        `Email sent to ${result.email}: ${JSON.stringify(emailResult)}`,
      );

      return result;
    } catch (error) {
      // Rollback manual
      await this.userRepository.delete(result.id);

      Logger.error(
        `No se pudo enviar el email a ${result.email}. Usuario eliminado.`,
        error,
      );

      throw new InternalServerErrorException(
        'No se pudo enviar el correo de bienvenida',
      );
    }
  }

  findAll() {
    return this.userRepository.findAll();
  }

  findByEmail(email: string) {
    return this.userRepository.findByEmail(email);
  }

  findCredentialsByLogin(login: string) {
    return this.userRepository.findCredentialsByLogin(login);
  }

  updatePassword(id: number, password: string) {
    return this.userRepository.updatePassword(id, password);
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  // update(id: number, updateUserDto: UpdateUserDto) {
  //   return `This action updates a #${id} user`;
  // }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}

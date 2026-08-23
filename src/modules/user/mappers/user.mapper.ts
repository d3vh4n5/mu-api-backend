import { CreateUserDto } from '../dto/create-user.dto';
import { User } from '../entities/user.entity';

export class UserMapper {
  static toDomain(raw: any): User {
    const user = new User();
    user.id = raw.memb_guid; // Asumiendo que el ID es el username
    user.username = raw.memb___id;
    user.name = raw.memb_name;
    user.email = raw.mail_addr;

    return user;
  }

  static toPersistence(user: CreateUserDto): any {
    return {
      memb___id: user.username,
      memb_name: user.name || user.username,
      mail_addr: user.email,
      // Agrega otros campos necesarios para la persistencia
    };
  }
}

import { AuthService } from "../services/auth.service.js";

export class AuthController {

    static async createUser(req, res) {
        try {
            const { username, password, email, name } = req.body;

            // Validaciones MU 99b
            if (!username || !password || username.length > 10 || password.length > 10) {
                return res.status(400).json({
                    error: "Usuario y password deben tener entre 1 y 10 caracteres."
                });
            }

            await AuthService.createUser({ username, password, email, name });

            return res.status(201).json({
                message: "Cuenta creada exitosamente. ¡Ya puedes loguear!"
            });

        } catch (err) {
            if (err.message === 'USER_EXISTS') {
                return res.status(400).json({
                    error: "El nombre de usuario ya existe."
                });
            }

            console.error(err);
            return res.status(500).json({
                error: "Error interno del servidor."
            });
        }
    }
}

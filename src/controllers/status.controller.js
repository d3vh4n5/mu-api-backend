import { StatusService } from "../services/status.service.js";

export class StatusController {
    
    static async getStatus(req, res) {
        try {
            const status = await StatusService.getStatus();
            res.json(status);
        } catch (err) {
            res.status(500).json({ error: 'Error obteniendo status' });
        }
    }
}

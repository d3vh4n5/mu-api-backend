import { HealthService } from "../services/health.service.js";

export class HealthController {
    static async readiness (req, res) {
        const status = {
            api: "ok",
            muServer: {
            gameServer: await HealthService.checkService("GameServer"),
            joinServer: await HealthService.checkService("JoinServer"),
            connectServer: await HealthService.checkService("ConnectServer"),
            }
        };

        res.json(status);
    }
}
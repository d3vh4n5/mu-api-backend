import { HealthService } from "../services/health.service.js";

export class HealthController {
    static async readiness (req, res) {
        const status = {
            api: "ok",
            muServerDaemons: {
                gameServer: await HealthService.checkService("GameServer"),
                joinServer: await HealthService.checkService("JoinServer"),
                connectServer: await HealthService.checkService("ConnectServer"),
                dataServer: await HealthService.checkService("DataServer"),
            },
            muServer: {
                connectServer: await HealthService.checkPort(44405),
                joinServer: await HealthService.checkPort(55970),
                gameServer: await HealthService.checkPort(55900),
                dataServer: await HealthService.checkPort(55960),
            }
        };

        res.json(status);
    }
}
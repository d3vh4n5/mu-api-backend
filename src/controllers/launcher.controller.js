import { HealthService } from "../services/health.service.js";
import { StatusService } from "../services/status.service.js";

export class LauncherController {
    static async getServers(req, res) {
        try {
            const status = await HealthService.checkService();
            console.log(status);
            // res.json(status);
            const servers = []
            servers.push(
                {
                    id: 1,
                    name: "Mu Campana 99b Classic",
                    status: "Online",
                    fileUrl: "/downloads/Mu99bClassic/Client/ServerInfo.sse",
                    registerUrl: "https://mu-front.vercel.app/register",
                },
                {
                    id: 2,
                    name: "Mu Campana 99b Classic RPP",
                    status: "Online",
                    fileUrl: "/downloads/Mu97Classic/ServerInfo.sse",
                    registerUrl: "https://www.mucampana.com/registro",
                },
            )
            res.json(servers)
        } catch (err) {
            console.error(err);
            return res.status(500).json({
                error: 'Error obteniendo status'
            });
        }
    }
}
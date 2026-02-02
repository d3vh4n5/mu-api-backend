import { RankingService } from "../services/ranking.service.js";



export class RankingController {


    static getRanking = async (req, res) => {
        try {
            const result = await RankingService.getRanking()
            res.json(result.recordset);
        } catch (err) {
            console.error("Error en SQL:", err.message);
            res.status(500).send("Error al obtener el ranking");
        }
    }
}

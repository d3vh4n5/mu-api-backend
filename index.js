import { app } from "./src/app.js";

const PORT = 80;
app.listen(PORT, () => {
    console.log(`API del Mu corriendo en http://localhost:${PORT}`);
});
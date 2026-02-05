import { exec } from "child_process";
import net from "net";

export class HealthService {
    static async checkService(name) {
        return new Promise((resolve) => {
            exec(`sc query "${name}"`, (err, stdout) => {
            if (err) return resolve("not_installed");
            if (stdout.includes("RUNNING")) return resolve("running");
            if (stdout.includes("STOPPED")) return resolve("stopped");
            resolve("unknown");
            });
        });
    }

    static async checkPort(port, host = "127.0.0.1") {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(1000);

            socket.on("connect", () => {
            socket.destroy();
            resolve("running");
            });

            socket.on("error", () => resolve("stopped"));
            socket.on("timeout", () => resolve("stopped"));

            socket.connect(port, host);
        });
    }
}
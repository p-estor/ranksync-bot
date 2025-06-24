// src/types/teemojs.d.ts
declare module 'teemojs' {
    interface TeemoJSInstance {
        get(region: string, endpoint: string, ...args: any[]): Promise<any>;
        // Si usas otros métodos de TeemoJS, podrías añadirlos aquí para un tipado más completo:
        // setApiKey(apiKey: string): void;
        // setConfiguration(config: { distFactor?: number; retries?: number; maxConcurrent?: number; timeout?: number; }): void;
    }

    // Esta es la función principal que el módulo "teemojs" exporta.
    // Toma una apiKey y una configuración opcional, y devuelve una instancia de TeemoJS.
    function TeemoJS(apiKey: string, config?: { distFactor?: number; retries?: number; maxConcurrent?: number; timeout?: number; }): TeemoJSInstance;

    // Esto le dice a TypeScript que 'TeemoJS' es la exportación principal del módulo.
    export = TeemoJS;
}